use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use ring::aead::{LessSafeKey, Nonce, UnboundKey, AES_256_GCM, Aad};
use ring::digest::{digest, SHA256};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_store::StoreExt;
use tokio::time::{sleep, Duration};

// Simple in-memory state for the current session
pub struct AppState {
    pub app: AppHandle,
    pub current_account: Mutex<Option<Account>>,
    pub current_account_id: Mutex<Option<String>>,
}

fn http_client() -> &'static reqwest::Client {
    static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("CFManager/0.2.0")
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

async fn send_with_retry<F>(build: F) -> Result<reqwest::Response, String>
where
    F: Fn() -> reqwest::RequestBuilder,
{
    let mut last_err = String::new();
    for attempt in 0..3 {
        let builder = build();
        match builder.send().await {
            Ok(res) => return Ok(res),
            Err(e) => {
                last_err = e.to_string();
                if attempt < 2 {
                    sleep(Duration::from_millis(500)).await;
                }
            }
        }
    }
    Err(format!("网络请求失败（已重试3次）: {}", last_err))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub email: String,
    pub account_id: Option<String>,
    pub token_encrypted: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PagesEnvVar {
    pub name: String,
    pub value: String,
    pub is_secret: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CloudflareResponse<T> {
    pub success: bool,
    #[serde(default, deserialize_with = "null_to_empty_vec")]
    pub errors: Vec<serde_json::Value>,
    #[serde(default, deserialize_with = "null_to_empty_vec")]
    pub messages: Vec<serde_json::Value>,
    pub result: Option<T>,
    pub result_info: Option<serde_json::Value>,
}

fn null_to_empty_vec<'de, D, T>(deserializer: D) -> Result<Vec<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    let opt = Option::<Vec<T>>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

// AES-256-GCM encryption helpers
fn derive_key() -> [u8; 32] {
    let hash = digest(&SHA256, b"cloudflare-manager-secret-key-v1");
    let mut key = [0u8; 32];
    key.copy_from_slice(hash.as_ref());
    key
}

fn encrypt_token(token: &str) -> Result<String, String> {
    let key_bytes = derive_key();
    let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes).map_err(|e| format!("{:?}", e))?;
    let key = LessSafeKey::new(unbound_key);
    
    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes).map_err(|e| e.to_string())?;
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    
    let mut in_out = token.as_bytes().to_vec();
    key.seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| format!("{:?}", e))?;
    
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&in_out);
    Ok(BASE64.encode(&result))
}

fn decrypt_token(encrypted: &str) -> Result<String, String> {
    let data = BASE64.decode(encrypted).map_err(|e| e.to_string())?;
    if data.len() < 12 + 16 {
        return Err("Invalid encrypted data".to_string());
    }
    
    let nonce_bytes: [u8; 12] = data[..12].try_into().map_err(|_| "Invalid nonce")?;
    let ciphertext = &data[12..];
    
    let key_bytes = derive_key();
    let unbound_key = UnboundKey::new(&AES_256_GCM, &key_bytes).map_err(|e| format!("{:?}", e))?;
    let key = LessSafeKey::new(unbound_key);
    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    
    let mut in_out = ciphertext.to_vec();
    let plaintext = key.open_in_place(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| format!("{:?}", e))?;
    
    String::from_utf8(plaintext.to_vec()).map_err(|e| e.to_string())
}

fn get_store(app: &AppHandle) -> Result<std::sync::Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store("accounts.json").map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(AppState {
                app: app.handle().clone(),
                current_account: Mutex::new(None),
                current_account_id: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            validate_token,
            get_app_version,
            save_account,
            list_accounts,
            get_account_token,
            delete_account,
            set_current_account,
            clear_current_account,
            get_current_account,
            list_zones,
            list_dns_records,
            add_dns_record,
            update_dns_record,
            delete_dns_record,
            purge_cache,
            cloudflare_request,
            cloudflare_request_text,
            deploy_pages_local,
            deploy_pages_zip,
            deploy_pages_wrangler,
            minimize_window,
            maximize_window,
            close_window,
            show_main_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Cloudflare HTTP helpers
async fn cf_get<T: serde::de::DeserializeOwned>(
    token: &str,
    path: &str,
) -> Result<CloudflareResponse<T>, String> {
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4{}", path);
    let res = send_with_retry(|| {
        client
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {} | response: {}", e, text))
}

async fn cf_post<T: serde::de::DeserializeOwned>(
    token: &str,
    path: &str,
    body: serde_json::Value,
) -> Result<CloudflareResponse<T>, String> {
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4{}", path);
    let res = send_with_retry(|| {
        client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {} | response: {}", e, text))
}

async fn cf_patch<T: serde::de::DeserializeOwned>(
    token: &str,
    path: &str,
    body: serde_json::Value,
) -> Result<CloudflareResponse<T>, String> {
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4{}", path);
    let res = send_with_retry(|| {
        client
            .patch(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {} | response: {}", e, text))
}

async fn cf_delete<T: serde::de::DeserializeOwned>(
    token: &str,
    path: &str,
) -> Result<CloudflareResponse<T>, String> {
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4{}", path);
    let res = send_with_retry(|| {
        client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {} | response: {}", e, text))
}

// Commands
#[tauri::command]
async fn validate_token(token: String) -> Result<CloudflareResponse<serde_json::Value>, String> {
    cf_get(&token, "/user/tokens/verify").await
}

#[tauri::command]
fn get_app_version() -> String {
    // 编译期取自 Cargo.toml，与 tauri.conf.json 保持一致（Tauri 对两者不一致会告警）
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
async fn save_account(
    app: AppHandle,
    mut account: Account,
    token: String,
) -> Result<Account, String> {
    account.token_encrypted = encrypt_token(&token)?;
    
    // Auto-fetch Cloudflare account ID if not provided
    if account.account_id.is_none() || account.account_id.as_ref().unwrap().is_empty() {
        let resp: CloudflareResponse<Vec<serde_json::Value>> = cf_get(&token, "/accounts").await?;
        if let Some(accounts) = resp.result {
            if let Some(first) = accounts.first() {
                if let Some(id) = first.get("id").and_then(|v| v.as_str()) {
                    account.account_id = Some(id.to_string());
                }
            }
        }
        if account.account_id.is_none() || account.account_id.as_ref().unwrap().is_empty() {
            return Err("无法获取 Account ID，请确认 Token 拥有“帐户 - 帐户（读取）”权限，并且 Account Resources 包含目标账户。".to_string());
        }
    }
    
    let store = get_store(&app)?;
    let mut accounts: Vec<Account> = store
        .get("accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    
    // Replace if exists, otherwise add
    if let Some(idx) = accounts.iter().position(|a| a.id == account.id) {
        accounts[idx] = account.clone();
    } else {
        accounts.push(account.clone());
    }
    
    store.set("accounts", serde_json::to_value(&accounts).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(account)
}

#[tauri::command]
fn list_accounts(app: AppHandle) -> Result<Vec<Account>, String> {
    let store = get_store(&app)?;
    let accounts: Vec<Account> = store
        .get("accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    Ok(accounts)
}

#[tauri::command]
fn get_account_token(app: AppHandle, id: String) -> Result<String, String> {
    let store = get_store(&app)?;
    let accounts: Vec<Account> = store
        .get("accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let account = accounts.iter().find(|a| a.id == id).ok_or("Account not found")?;
    decrypt_token(&account.token_encrypted)
}

#[tauri::command]
fn delete_account(app: AppHandle, id: String) -> Result<(), String> {
    let store = get_store(&app)?;
    let mut accounts: Vec<Account> = store
        .get("accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    accounts.retain(|a| a.id != id);
    store.set("accounts", serde_json::to_value(&accounts).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_current_account(
    state: State<AppState>,
    account: Account,
    _token: String,
) -> Result<(), String> {
    let mut current = state.current_account.lock().map_err(|e| e.to_string())?;
    *current = Some(account.clone());
    let mut id_state = state.current_account_id.lock().map_err(|e| e.to_string())?;
    *id_state = Some(account.id);
    Ok(())
}

#[tauri::command]
fn clear_current_account(state: State<AppState>) -> Result<(), String> {
    let mut current = state.current_account.lock().map_err(|e| e.to_string())?;
    *current = None;
    let mut id_state = state.current_account_id.lock().map_err(|e| e.to_string())?;
    *id_state = None;
    Ok(())
}

#[tauri::command]
fn get_current_account(state: State<AppState>) -> Result<Option<Account>, String> {
    let current = state.current_account.lock().map_err(|e| e.to_string())?;
    Ok(current.clone())
}

fn get_current_token(state: &State<AppState>) -> Result<String, String> {
    let id = state
        .current_account_id
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "No account selected".to_string())?;
    let store = state.app.store("accounts.json").map_err(|e| e.to_string())?;
    let accounts: Vec<Account> = store
        .get("accounts")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    let account = accounts
        .iter()
        .find(|a| a.id == id)
        .ok_or_else(|| "Current account not found".to_string())?;
    decrypt_token(&account.token_encrypted)
}

#[tauri::command]
async fn list_zones(state: State<'_, AppState>) -> Result<CloudflareResponse<Vec<serde_json::Value>>, String> {
    let token = get_current_token(&state)?;
    cf_get(&token, "/zones").await
}

#[tauri::command]
async fn list_dns_records(
    state: State<'_, AppState>,
    zone_id: String,
) -> Result<CloudflareResponse<Vec<serde_json::Value>>, String> {
    let token = get_current_token(&state)?;
    cf_get(&token, &format!("/zones/{}/dns_records", zone_id)).await
}

#[tauri::command]
async fn add_dns_record(
    state: State<'_, AppState>,
    zone_id: String,
    record: serde_json::Value,
) -> Result<CloudflareResponse<serde_json::Value>, String> {
    let token = get_current_token(&state)?;
    cf_post(&token, &format!("/zones/{}/dns_records", zone_id), record).await
}

#[tauri::command]
async fn update_dns_record(
    state: State<'_, AppState>,
    zone_id: String,
    record_id: String,
    record: serde_json::Value,
) -> Result<CloudflareResponse<serde_json::Value>, String> {
    let token = get_current_token(&state)?;
    cf_patch(&token, &format!("/zones/{}/dns_records/{}", zone_id, record_id), record).await
}

#[tauri::command]
async fn delete_dns_record(
    state: State<'_, AppState>,
    zone_id: String,
    record_id: String,
) -> Result<CloudflareResponse<serde_json::Value>, String> {
    let token = get_current_token(&state)?;
    cf_delete(&token, &format!("/zones/{}/dns_records/{}", zone_id, record_id)).await
}

#[tauri::command]
async fn purge_cache(
    state: State<'_, AppState>,
    zone_id: String,
) -> Result<CloudflareResponse<serde_json::Value>, String> {
    let token = get_current_token(&state)?;
    cf_post(&token, &format!("/zones/{}/purge_cache", zone_id), serde_json::json!({"purge_everything": true})).await
}

#[tauri::command]
fn minimize_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn maximize_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn close_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn cloudflare_request(
    state: State<'_, AppState>,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<CloudflareResponse<serde_json::Value>, String> {
    let token = get_current_token(&state)?;
    match method.to_uppercase().as_str() {
        "GET" => cf_get(&token, &path).await,
        "POST" => cf_post(&token, &path, body.unwrap_or(serde_json::json!({}))).await,
        "PUT" => cf_put(&token, &path, body.unwrap_or(serde_json::json!({}))).await,
        "PATCH" => cf_patch(&token, &path, body.unwrap_or(serde_json::json!({}))).await,
        "DELETE" => cf_delete(&token, &path).await,
        _ => Err(format!("Unsupported HTTP method: {}", method)),
    }
}

#[tauri::command]
async fn cloudflare_request_text(
    state: State<'_, AppState>,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
    content_type: Option<String>,
) -> Result<String, String> {
    let token = get_current_token(&state)?;
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4{}", path);

    let method_upper = method.to_uppercase();
    let method_str = method_upper.as_str();
    if !matches!(method_str, "GET" | "POST" | "PUT" | "PATCH" | "DELETE") {
        return Err(format!("Unsupported HTTP method: {}", method));
    }

    let content_type_clone = content_type.clone();
    let body_clone = body.clone();
    let res = send_with_retry(|| {
        let mut req = match method_str {
            "GET" => client.get(&url),
            "POST" => client.post(&url),
            "PUT" => client.put(&url),
            "PATCH" => client.patch(&url),
            "DELETE" => client.delete(&url),
            _ => unreachable!(),
        };
        req = req
            .header("Authorization", format!("Bearer {}", token))
            .timeout(Duration::from_secs(120));
        if let Some(ref ct) = content_type_clone {
            req = req.header("Content-Type", ct.clone());
        }
        if let Some(ref b) = body_clone {
            let is_json = content_type_clone.as_deref() == Some("application/json");
            if is_json {
                req = req.json(b);
            } else {
                let body_text = match b {
                    serde_json::Value::String(s) => s.clone(),
                    _ => b.to_string(),
                };
                req = req.body(body_text);
            }
        }
        req
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    Ok(text)
}

#[tauri::command]
async fn deploy_pages_local(
    state: State<'_, AppState>,
    project_name: String,
    directory: String,
    branch: String,
    environment: String,
    env_vars: Vec<PagesEnvVar>,
) -> Result<String, String> {
    let token = get_current_token(&state)?;
    let account = state
        .current_account
        .lock()
        .unwrap()
        .clone()
        .ok_or("未选择账户")?;
    let account_id = account.account_id.ok_or("当前账户缺少 Account ID")?;

    // 1. 通过项目更新接口设置环境变量（支持 plain_text / secret_text）
    if !env_vars.is_empty() {
        let mut env_vars_map = serde_json::Map::new();
        for v in env_vars {
            let entry = serde_json::json!({
                "type": if v.is_secret { "secret_text" } else { "plain_text" },
                "value": v.value
            });
            env_vars_map.insert(v.name, entry);
        }
        let patch_body = serde_json::json!({
            "deployment_configs": {
                environment: {
                    "env_vars": env_vars_map
                }
            }
        });
        let path = format!("/accounts/{}/pages/projects/{}", account_id, project_name);
        cf_patch::<serde_json::Value>(&token, &path, patch_body).await.map_err(|e| {
            format!("设置 Pages 环境变量失败：{}", e)
        })?;
    }

    // 2. 调用 wrangler pages deploy 上传本地目录
    let output = tokio::process::Command::new("cmd")
        .args(&[
            "/C",
            "npx",
            "--yes",
            "wrangler",
            "pages",
            "deploy",
            &directory,
            "--project-name",
            &project_name,
            "--branch",
            &branch,
            "--commit-dirty=true",
        ])
        .env("CLOUDFLARE_API_TOKEN", &token)
        .env("CLOUDFLARE_ACCOUNT_ID", &account_id)
        .env("NO_COLOR", "1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("启动 wrangler 失败（请确认已安装 Node.js）：{}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        return Err(format!("Pages 部署失败：\n{}\n{}", stdout, stderr));
    }
    Ok(format!("{}\n{}", stdout, stderr))
}

async fn cf_put<T: serde::de::DeserializeOwned>(
    token: &str,
    path: &str,
    body: serde_json::Value,
) -> Result<CloudflareResponse<T>, String> {
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4{}", path);
    let res = send_with_retry(|| {
        client
            .put(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&body)
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }

    serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {} | response: {}", e, text))
}

// ============================================================================
// Pages Direct Upload (zip) — 借鉴 orange-cloud Android PagesRepository
// ============================================================================

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PagesDeployFileRust {
    path: String,
    data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PagesAssetMetadataRust {
    #[serde(rename = "contentType")]
    content_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PagesAssetUploadRust {
    key: String,
    value: String,
    metadata: PagesAssetMetadataRust,
    base64: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PagesHashesBodyRust {
    hashes: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PagesUploadTokenRust {
    jwt: String,
}

fn to_hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn compute_pages_hash(path: &str, data: &[u8]) -> String {
    let b64 = BASE64.encode(data);
    let ext = path.rsplitn(2, '.').next().unwrap_or("");
    let input = format!("{}{}", b64, ext);
    let hash = blake3::hash(input.as_bytes());
    // 取 hex 前 32 位（16 字节）
    to_hex(&hash.as_bytes()[..16])
}

fn content_type_from_path(path: &str) -> &'static str {
    match path.rsplitn(2, '.').next().unwrap_or("") {
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" => "application/javascript",
        "json" => "application/json",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "txt" => "text/plain",
        "xml" => "application/xml",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "eot" => "application/vnd.ms-fontobject",
        "pdf" => "application/pdf",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn normalize_pages_paths(files: Vec<(String, Vec<u8>)>) -> Vec<PagesDeployFileRust> {
    let cleaned: Vec<(String, Vec<u8>)> = files
        .into_iter()
        .map(|(n, b)| (n.replace('\\', "/").trim_start_matches('/').to_string(), b))
        .filter(|(n, _)| !n.is_empty())
        .collect();

    if cleaned.is_empty() {
        return Vec::new();
    }

    let first_segs: std::collections::HashSet<String> = cleaned
        .iter()
        .map(|(n, _)| n.split('/').next().unwrap_or("").to_string())
        .collect();

    let strip = if first_segs.len() == 1 && cleaned.iter().all(|(n, _)| n.contains('/')) {
        let top = first_segs.iter().next().unwrap().clone();
        format!("{}/", top)
    } else {
        String::new()
    };

    cleaned
        .into_iter()
        .map(|(n, b)| {
            let rel = n.strip_prefix(&strip).unwrap_or(&n).to_string();
            (rel, b)
        })
        .filter(|(rel, _)| !rel.is_empty() && !rel.ends_with('/'))
        .map(|(rel, b)| PagesDeployFileRust {
            path: format!("/{}", rel),
            data: b,
        })
        .collect()
}

fn read_zip_file(path: &str) -> Result<Vec<PagesDeployFileRust>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let mut data = Vec::new();
        entry.read_to_end(&mut data).map_err(|e| e.to_string())?;
        entries.push((name, data));
    }
    Ok(normalize_pages_paths(entries))
}

async fn cf_pages_assets_request<T: serde::de::DeserializeOwned>(
    jwt: &str,
    method: &str,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<T, String> {
    let client = http_client();
    let url = format!("https://api.cloudflare.com/client/v4/{}", path);
    let method_upper = method.to_uppercase();
    let method_str = method_upper.as_str();

    let body_clone = body.clone();
    let res = send_with_retry(|| {
        let mut req = match method_str {
            "GET" => client.get(&url),
            "POST" => client.post(&url),
            "PUT" => client.put(&url),
            "PATCH" => client.patch(&url),
            "DELETE" => client.delete(&url),
            _ => unreachable!(),
        };
        req = req
            .header("Authorization", format!("Bearer {}", jwt))
            .header("Content-Type", "application/json")
            .timeout(Duration::from_secs(120));
        if let Some(ref b) = body_clone {
            req = req.json(b);
        }
        req
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    let envelope: CloudflareResponse<T> = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse error: {} | response: {}", e, text))?;
    if !envelope.success {
        return Err(format!("Cloudflare API error: {:?}", envelope.errors));
    }
    envelope.result.ok_or_else(|| "Empty result".to_string())
}

async fn upload_pages_batch(jwt: &str, payloads: Vec<PagesAssetUploadRust>) -> Result<(), String> {
    let body = serde_json::to_value(&payloads).map_err(|e| e.to_string())?;
    cf_pages_assets_request::<serde_json::Value>(jwt, "POST", "pages/assets/upload", Some(body)).await?;
    Ok(())
}

async fn check_missing_hashes(jwt: &str, hashes: Vec<String>) -> Result<Vec<String>, String> {
    let body = serde_json::to_value(&PagesHashesBodyRust { hashes })
        .map_err(|e| e.to_string())?;
    cf_pages_assets_request::<Vec<String>>(jwt, "POST", "pages/assets/check-missing", Some(body)).await
}

async fn upsert_hashes(jwt: &str, hashes: Vec<String>) -> Result<(), String> {
    let body = serde_json::to_value(&PagesHashesBodyRust { hashes })
        .map_err(|e| e.to_string())?;
    cf_pages_assets_request::<serde_json::Value>(jwt, "POST", "pages/assets/upsert-hashes", Some(body)).await?;
    Ok(())
}

async fn create_pages_deployment(
    token: &str,
    account_id: &str,
    project_name: &str,
    manifest: HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    let client = http_client();
    let url = format!(
        "https://api.cloudflare.com/client/v4/accounts/{}/pages/projects/{}/deployments",
        account_id, project_name
    );

    let manifest_json = serde_json::to_string(&manifest).map_err(|e| e.to_string())?;

    let res = send_with_retry(|| {
        let form = reqwest::multipart::Form::new().text("manifest", manifest_json.clone());
        client
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .multipart(form)
            .timeout(Duration::from_secs(120))
    })
    .await?;

    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    let envelope: CloudflareResponse<serde_json::Value> = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse error: {} | response: {}", e, text))?;
    if !envelope.success {
        return Err(format!("Cloudflare API error: {:?}", envelope.errors));
    }
    envelope.result.ok_or_else(|| "Empty result".to_string())
}

#[tauri::command]
async fn deploy_pages_zip(
    state: State<'_, AppState>,
    project_name: String,
    zip_path: String,
) -> Result<serde_json::Value, String> {
    let token = get_current_token(&state)?;
    let account = state
        .current_account
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("未选择账户")?;
    let account_id = account.account_id.ok_or("当前账户缺少 Account ID")?;

    let files = read_zip_file(&zip_path)?;
    if files.is_empty() {
        return Err("压缩包为空或没有可部署文件".to_string());
    }

    // 计算 manifest 和按 hash 索引的文件
    let mut manifest = HashMap::<String, String>::new();
    let mut file_by_hash = HashMap::<String, PagesDeployFileRust>::new();
    let mut b64_by_hash = HashMap::<String, String>::new();
    for f in files {
        let ext = f.path.rsplitn(2, '.').next().unwrap_or("").to_string();
        let b64 = BASE64.encode(&f.data);
        let hash = compute_pages_hash(&f.path, &f.data);
        manifest.insert(f.path.clone(), hash.clone());
        file_by_hash.insert(hash.clone(), f);
        b64_by_hash.insert(hash, b64 + &ext);
    }

    // 1. 获取上传 JWT
    let upload_token: PagesUploadTokenRust =
        cf_get::<PagesUploadTokenRust>(&token, &format!("/accounts/{}/pages/projects/{}/upload-token", account_id, project_name))
            .await
            .map_err(|e| format!("获取上传令牌失败: {}", e))?
            .result
            .ok_or("上传令牌为空")?;
    let jwt = upload_token.jwt;

    // 2. 检查缺失 hash
    let all_hashes: Vec<String> = manifest.values().cloned().collect();
    let missing = check_missing_hashes(&jwt, all_hashes.clone()).await
        .map_err(|e| format!("check-missing 失败: {}", e))?;

    // 3. 分批上传缺失文件
    if !missing.is_empty() {
        let mut uploads = Vec::new();
        for h in &missing {
            if let Some(f) = file_by_hash.get(h) {
                let b64 = BASE64.encode(&f.data);
                uploads.push((h.clone(), f.clone(), b64));
            }
        }

        let max_bytes = 8 * 1024 * 1024;
        let max_count = 50;
        let mut batches: Vec<Vec<(String, PagesDeployFileRust, String)>> = Vec::new();
        let mut current: Vec<(String, PagesDeployFileRust, String)> = Vec::new();
        let mut current_bytes: usize = 0;

        for item in uploads {
            let size = item.1.data.len();
            if !current.is_empty() && (current_bytes + size > max_bytes || current.len() >= max_count) {
                batches.push(current);
                current = Vec::new();
                current_bytes = 0;
            }
            current_bytes += size;
            current.push(item);
        }
        if !current.is_empty() {
            batches.push(current);
        }

        for batch in batches {
            let payloads: Vec<PagesAssetUploadRust> = batch
                .into_iter()
                .map(|(h, f, b64)| PagesAssetUploadRust {
                    key: h,
                    value: b64,
                    metadata: PagesAssetMetadataRust {
                        content_type: content_type_from_path(&f.path).to_string(),
                    },
                    base64: true,
                })
                .collect();
            upload_pages_batch(&jwt, payloads).await
                .map_err(|e| format!("上传文件批次失败: {}", e))?;
        }
    }

    // 4. upsert hashes
    upsert_hashes(&jwt, all_hashes).await
        .map_err(|e| format!("upsert-hashes 失败: {}", e))?;

    // 5. 创建部署
    create_pages_deployment(&token, &account_id, &project_name, manifest).await
        .map_err(|e| format!("创建部署失败: {}", e))
}


// ============================================================================
// Wrangler CLI 部署（在项目目录执行 wrangler pages deploy / deploy 等）
// ============================================================================

#[tauri::command]
async fn deploy_pages_wrangler(
    state: State<'_, AppState>,
    project_dir: String,
    cmd: String,
    out_dir: Option<String>,
    extra_args: Option<String>,
) -> Result<String, String> {
    let token = get_current_token(&state)?;
    let account = state
        .current_account
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or("未选择账户")?;
    let account_id = account.account_id.ok_or("当前账户缺少 Account ID")?;

    let project_path = std::path::PathBuf::from(&project_dir);
    if !project_path.exists() || !project_path.is_dir() {
        return Err(format!("项目目录不存在: {}", project_dir));
    }

    // 解析命令，例如 "pages deploy" -> ["pages", "deploy"]
    let mut args: Vec<String> = cmd.split_whitespace().map(|s| s.to_string()).collect();
    if args.is_empty() {
        return Err("Wrangler 命令不能为空".to_string());
    }

    let is_pages = args.first().map(|s| s == "pages").unwrap_or(false);

    // 在最前面插入 wrangler
    let mut wrangler_args = vec!["wrangler".to_string()];
    wrangler_args.append(&mut args);

    // Pages 项目：wrangler pages deploy [目录]
    // 优先级：1) wrangler.toml 里有 pages_build_output_dir → 不带位置参数，wrangler 自己读配置
    //        2) 用户手填输出目录 → 作为位置参数传入
    //        3) 自动探测常见输出目录
    if is_pages && !has_pages_build_output_dir(&project_path) {
        let out_dir = out_dir
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .or_else(|| detect_pages_out_dir(&project_path));
        match out_dir {
            Some(dir) => {
                let full = project_path.join(&dir);
                if !full.exists() || !full.is_dir() {
                    return Err(format!(
                        "构建输出目录不存在: {}\n请在「构建输出目录」里填写正确路径（如 dist、build、out），或在 wrangler.toml 里配置 pages_build_output_dir。",
                        dir
                    ));
                }
                // 位置参数必须紧跟在 `pages deploy` 之后
                wrangler_args.insert(3, dir);
            }
            None => {
                return Err(
                    "未找到构建输出目录。请二选一：\n1. 在「构建输出目录」里填写（如 dist、build、out）\n2. 在 wrangler.toml 里配置 pages_build_output_dir（推荐，Pages 一体部署项目都这么写）".to_string(),
                );
            }
        }
    }

    // 追加额外参数
    if let Some(extra) = extra_args {
        if !extra.trim().is_empty() {
            for arg in extra.split_whitespace() {
                wrangler_args.push(arg.to_string());
            }
        }
    }

    // 只有 Worker 项目才需要 compatibility-date；Pages 部署不需要
    if !is_pages {
        wrangler_args.push("--compatibility-date".to_string());
        wrangler_args.push("2026-08-28".to_string());
    }

    let output = tokio::process::Command::new("cmd")
        .args(&["/C", "npx", "--yes"])
        .args(&wrangler_args)
        .current_dir(&project_path)
        .env("CLOUDFLARE_API_TOKEN", &token)
        .env("CLOUDFLARE_ACCOUNT_ID", &account_id)
        .env("NO_COLOR", "1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("启动 wrangler 失败（请确认已安装 Node.js）: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        return Err(format!("Wrangler 部署失败：\n{}\n{}", stdout, stderr));
    }
    Ok(format!("{}\n{}", stdout, stderr))
}

/// 检测 wrangler.toml / wrangler.json 是否配置了 pages_build_output_dir。
/// 配置了的话 wrangler pages deploy 无需位置参数，直接读配置。
fn has_pages_build_output_dir(project_path: &std::path::Path) -> bool {
    let toml_path = project_path.join("wrangler.toml");
    if toml_path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&toml_path) {
            if content.contains("pages_build_output_dir") {
                return true;
            }
        }
    }
    let json_path = project_path.join("wrangler.json");
    if json_path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&json_path) {
            if content.contains("pages_build_output_dir") {
                return true;
            }
        }
    }
    false
}

/// 在项目目录下自动探测常见的 Pages 构建输出目录
fn detect_pages_out_dir(project_path: &std::path::Path) -> Option<String> {
    for candidate in ["dist", "build", "out", "public", ".output/public", ".next", "www"] {
        let p = project_path.join(candidate);
        if p.is_dir() {
            // 有 index.html 的目录优先
            if p.join("index.html").exists() {
                return Some(candidate.to_string());
            }
        }
    }
    // 退一步：只要有目录就返回第一个存在的
    for candidate in ["dist", "build", "out", "public", ".output/public"] {
        if project_path.join(candidate).is_dir() {
            return Some(candidate.to_string());
        }
    }
    None
}
