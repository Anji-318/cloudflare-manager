# Cloudflare 多账户管理系统 v0.3.5 更新日志

## 版本信息

- **当前版本**：v0.3.5
- **上一版本**：v0.3.4

---

## 新功能

### 1. 账户自定义头像
- 支持从本地选择图片作为账户头像，格式覆盖 PNG / JPG / WebP / GIF / BMP / SVG / ICO
- 自动居中裁剪为正方形并压缩为 96×96 JPEG（约 4~8KB），以 dataURL 存储于本地 accounts.json，不上传任何服务器
- **点击账户管理表格中的圆形头像即可直接更换**，也可在"编辑账户"弹窗中选择/移除
- 未设置头像的账户按账户名 hash **自动生成不同颜色**的字母头像（替代原来统一的橙色）
- 侧边栏当前账户头像、账户表格、折叠态侧栏三处同步显示

### 2. 版本号动态显示
- 左下角版本号改为运行时从后端读取（新增 `get_app_version` 命令，编译期取自 Cargo.toml）
- 告别前后端版本号不一致（此前界面硬编码 0.3.3 与实际版本脱钩的问题）
- 以后升级版本只需修改 Cargo.toml 与 tauri.conf.json

## 重要修复

### 1. 域名数量统计错误
- 症状：账户管理表格中所有账户的"域名数"显示错误（如实际 3 个显示 1 个）
- 根因：统计逻辑通过"临时切换全局当前账户"逐账户请求，并发执行时账户切换互相竞争，请求用错了 Token（张冠李戴）
- 修复：后端新增 `count_zones(id)` 命令，按账户 ID 独立取 Token 统计，全程不触碰全局状态；并用 `result_info.total_count` 一次请求拿到精确总数（同时解决原分页上限 20 的问题）

### 2. 点击"开源仓库"链接打开两个相同标签页
- 根因：前端全局点击拦截器 `shell.open` 打开一次 + Tauri/WebView2 对 `target="_blank"` 的原生处理又打开一次，JS `preventDefault` 拦不住底层 NewWindow 请求
- 修复：链接去掉 `target="_blank"`，改走应用内 `openRepoUrl()` 单次打开

### 3. 更换头像报错 `missing required key token`
- 根因：快捷换头像调用了 `save_account`，该命令要求明文 token 参数（会重新加密覆盖），而快捷场景下只有加密后的 token
- 修复：后端新增 `update_account_avatar(id, avatar)` 轻量命令，只更新头像字段，不触碰 Token，天然安全

## 界面优化

- 侧边栏折叠时隐藏"开源仓库"链接、版本号保留并居中（此前折叠态两者挤压换行）

---

## 技术变更

| 项 | v0.3.4 | v0.3.5 |
|----|--------|--------|
| 账户头像 | 首字符 + 固定橙色 | 本地图片（多格式）/ 名字 hash 彩色兜底 |
| 版本号显示 | 前端硬编码 | 动态读取编译期版本 |
| 域名数统计 | 并发切换全局账户（有竞争 bug） | 独立按 ID 统计，total_count 精确计数 |
| 仓库链接 | 双开标签页 | 单次打开 |
| 版本号 | 0.3.4 | 0.3.5 |

### 新增文件
- `CHANGELOG-v0.3.5.md`

### 后端新增命令（src-tauri/src/lib.rs）
- `get_app_version`：返回编译期版本号
- `update_account_avatar`：仅更新账户头像
- `count_zones`：按账户 ID 独立统计域名总数

### 主要修改文件
- `src/app.js`、`src/index.html`、`src-tauri/src/lib.rs`、`src-tauri/Cargo.toml`

---

## 构建方式

```bat
npm install
npm run build:css
npm run build
```

构建产物：
- 可执行文件：`src-tauri\target\release\cloudflare-manager.exe`
- 安装包：`src-tauri\target\release\bundle\nsis\cloudflare-manager_0.3.5_x64-setup.exe`

---

## 升级说明

1. 本次涉及 Rust 后端变更（新增 3 个命令），覆盖文件后必须完整执行 `npm run build`
2. 旧版本 accounts.json 无 avatar 字段，首次启动自动兼容，无需迁移
