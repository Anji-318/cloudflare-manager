use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use ring::aead::{LessSafeKey, Nonce, UnboundKey, AES_256_GCM, Aad};
use ring::digest::{digest, SHA256};
use ring::rand::{SecureRandom, SystemRandom};
use serde::{Deserialize, Serialize};
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
    #[serde(deserialize_with = "null_to_empty_vec")]
    pub errors: Vec<serde_json::Value>,
    #[serde(deserialize_with = "null_to_empty_vec")]
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
