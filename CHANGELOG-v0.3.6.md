# Cloudflare 多账户管理系统 v0.3.6 更新日志

- **发布类型**：功能增强 + 兼容性修复
- **当前版本**：v0.3.6

---

## 一、核心变更：同时支持 API Token 与 Global API Key

此前所有请求统一按 `Authorization: Bearer <token>` 发送，导致使用 Global API Key 时 Cloudflare 直接拒绝：

```
HTTP 400 Bad Request
{"success":false,"errors":[{"code":6003,"message":"Invalid request headers",
 "error_chain":[{"code":6111,"message":"Invalid format for Authorization header"}]}]}
```

v0.3.6 起，账户可自行选择认证方式，两种方式都能正常使用全部功能。

### 认证方式与请求头

| 认证方式 | 请求头 | 校验接口 | 适用场景 |
|---|---|---|---|
| API Token（推荐） | `Authorization: Bearer <token>` | `/user/tokens/verify` | 可精细授权，最小权限原则 |
| Global API Key | `X-Auth-Email` + `X-Auth-Key` | `/user` | 一键拥有账号全部权限，省去逐项勾选 |

### 后端改动（src-tauri/src/lib.rs）

- 新增 `AuthType` 枚举（`token` / `global_key`）与 `CfAuth` 认证载体，`Account` 增加 `auth_type` 字段（旧数据缺省按 `token` 解析，**无需迁移**）。
- 抽出统一请求入口 `cf_send` + `apply_auth`，GET / POST / PUT / PATCH / DELETE 全部按认证方式自动附加正确的请求头。
- `validate_token` 升级为 `validate_credential`：API Token 走 `/user/tokens/verify`，Global API Key 走 `/user`（该接口不接受 Bearer Token）。
- 新增 `format_cf_error`：把 Cloudflare 原始错误翻译成可操作提示。当出现 `6003 / 6111 / Invalid format for Authorization header` 时，直接提示「这通常是 Global API Key，请切换认证方式并填写登录邮箱」，不再抛出裸 HTTP 错误。
- Pages 直传（`deploy_pages_zip`）、`create_pages_deployment`、`cloudflare_request_text` 同步改造；Pages 上传 JWT 仍按规范使用 `Authorization: Bearer <jwt>`。
- wrangler 子进程环境变量按认证方式注入：API Token → `CLOUDFLARE_API_TOKEN`；Global API Key → `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL`（并清理另一组变量，避免互相覆盖）。
- Global API Key 保存时强制校验登录邮箱，缺失直接给出中文提示。

### 前端改动（src/index.html、src/app.js）

- 添加 / 编辑账户弹窗新增「认证方式」切换（API Token / Global API Key），标签、占位符、说明与告警文案随选择联动。
- 选择 Global API Key 时邮箱变为必填，并提示密钥来源（我的个人资料 → API 令牌，37 位十六进制）。
- 粘贴 37 位十六进制密钥时**自动切换**到 Global API Key，避免再次触发 6003/6111。
- 账户列表「Token 状态」列新增认证方式徽标（API Token / Global Key），一眼区分。
- API 连接状态检测按认证方式选择接口，Global API Key 不再误报「Token 无效」。
- 行内快速编辑沿用账户原有认证方式，修改密钥或邮箱时会重新校验。

### 文档

- `usage.html` 新增「使用 Global API Key」章节，并在常见问题中补充 6003/6111 的处理办法。

---

## 二、修复：自定义背景图片不生效

**现象**：设置页选择本地图片（或填图片 URL）作为背景后，界面没有任何变化。

**根因**：`src/input.css` 里残留了未解决的 Git 合并冲突标记（`<<<<<<< HEAD` / `=======` / `>>>>>>>`），
被 Tailwind 原样编译进了 `src/tailwind.css`，于是编译产物变成：

```css
<<<<<<< HEAD #app-background{position:fixed;inset:0;z-index:0;...}
```

这是**非法选择器**，浏览器会直接丢弃整条规则。`#app-background` 因此退化为一个没有定位、高度为 0 的普通 `div`，
背景图自然永远看不到——本地图片和 URL 两种方式同时失效。

**修复**：

- 解决 `src/input.css` 中两处冲突（保留 HEAD 一侧内容，删除冲突标记），重新生成 `src/tailwind.css`。
- 校验构建产物：`#app-background` 规则恢复正常，`.sticky-thead th` 等同样受影响的规则一并恢复。
- 冲突标记导致的连带问题：`#app-background`、`#app-root`、`.sticky-thead th`、`.glass` 前景透明度覆盖等规则此前都可能被丢弃，
  修复后「背景模糊 / 背景明暗 / 前景透明度 / 前景明暗」四个滑块以及固定表头才会真正生效。

**验证**：headless 浏览器实际渲染确认背景图正常显示（见仓库外的对比截图），面板半透明处与窗口边框均可看到背景。

> 说明：v0.3.6 首个提交里虽在提交信息中写了「修复 input.css 冲突标记」，但实际只重建了 CSS、未清理源文件，
> 冲突标记仍被带入产物。本次才是真正的修复。

## 三、兼容性说明

- 已存在的账户数据（`accounts.json`）无需任何处理：缺少 `auth_type` 字段时按 API Token 解析，行为与 v0.3.5 完全一致。
- 若旧账户其实是 Global API Key，进入「编辑」把认证方式切换为 Global API Key、填上登录邮箱即可，无需重新添加账户。

## 四、版本号

| 项 | v0.3.5 | v0.3.6 |
|---|---|---|
| package.json | 0.3.5 | 0.3.6 |
| Cargo.toml | 0.3.5 | 0.3.6 |
| tauri.conf.json | 0.3.5 | 0.3.6 |

## 五、构建

```bash
npm install
npm run build
```

产物：

- 可执行文件：`src-tauri\target\release\cloudflare-manager.exe`
- 安装包：`src-tauri\target\release\bundle\nsis\cloudflare-manager_0.3.6_x64-setup.exe`
