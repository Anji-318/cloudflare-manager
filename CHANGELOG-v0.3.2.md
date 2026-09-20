# Cloudflare 多账户管理系统 v0.3.2 更新日志

## 版本信息

- **当前版本**：v0.3.2
- **上一版本**：v0.3.1

---

## 重要修复

### 1. 启动界面错乱 / FOUC
- 移除对 `cdn.tailwindcss.com` 的运行时依赖
- 改为构建时用 Tailwind CLI 生成本地 `src/tailwind.css`
- 应用可在无外网环境下正常显示完整样式

### 2. 启动后界面发灰（需切换主题才恢复）
- 修正主题初始化逻辑：同时维护 `dark` / `light` class
- 默认使用深色主题；偏好写入 `localStorage`
- 同步设置 `color-scheme`，避免 WebView 系统配色干扰
- 提高 `.glass` 不透明度，并为 `html/body` 提供实色背景，避免半透明叠层发灰

### 3. 构建脚本
- `package.json` 增加 `build:css`、`watch:css`
- `build` / `dev` 会先编译 CSS 再启动 Tauri
- `build.bat` 单独执行 CSS 编译并给出明确错误提示
- 修复部分源码包中 `package.json` JSON 语法错误（缺逗号、重复 `build` key）

---

## 技术变更

| 项 | v0.3.1 | v0.3.2 |
|----|--------|--------|
| Tailwind | 本地预编译 CSS | 本地预编译 CSS |
| 自定义样式 | 合并进 `input.css`，无外网字体 | 合并进 `input.css`，无外网字体 |
| 主题 | `applyTheme` + `localStorage` | `applyTheme` + `localStorage` |
| Pages 部署 | 本地目录 wrangler | + ZIP 直接上传、Wrangler 项目目录 |
| Worker 部署 | API 直接上传 | API 直接上传 |
| 版本号 | 0.3.1 | 0.3.2 |

### 新增/调整文件
- `tailwind.config.js`
- `src/input.css`（Tailwind 入口 + 自定义样式）
- `src/tailwind.css`（构建产物，由 `npm run build:css` 生成）

### 主要修改文件
- `src/index.html`
- `src/app.js`
- `package.json`
- `build.bat`

---

## 构建方式

```bat
npm install
npm run build:css
npm run build
```

或直接运行根目录 `build.bat`。

构建产物：
- 可执行文件：`src-tauri\target\release\cloudflare-manager.exe`
- 安装包：`src-tauri\target\release\bundle\nsis\cloudflare-manager_0.3.2_x64-setup.exe`

---

## 升级说明

1. 覆盖源码后执行一次 `npm install`（新增 tailwind 相关依赖）
2. 必须重新执行 `build:css` 生成 `src/tailwind.css`
3. 若仍看到旧的发灰界面，可清除应用数据或在控制台执行：`localStorage.removeItem('theme')` 后重启


## 新增功能（基于 orange-cloud Android 部署能力）

### 4. Pages ZIP 压缩包直接上传部署
- 新增 **ZIP 压缩包部署** 模式，无需本地安装 wrangler
- 后端 Rust 完整实现 Cloudflare Pages Direct Upload API：
  - `upload-token` → `check-missing` → `upload` → `upsert-hashes` → `create deployment`
- 使用 blake3 计算文件哈希（与 orange-cloud Android 保持一致）
- 自动剥离压缩包共同顶层目录，支持 `dist/`、`build/` 等常见结构
- 单文件 25 MiB 上限，分批上传（~8 MiB / 50 文件一批）
- 新增文件：依赖 `blake3`、`zip`（Rust）

### 5. Wrangler 项目目录部署
- 新增 **Wrangler 项目** 部署模式
- 选择一个包含 `wrangler.toml` / `wrangler.json` 的项目目录
- 支持执行 `wrangler pages deploy`、`wrangler deploy`、`--dry-run` 等命令
- 自动注入当前账户的 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`
- 支持追加自定义参数，如 `--branch=main --project-name=my-project`
- 保留原有 **本地目录 + wrangler** 与 **ZIP 压缩包** 部署方式
- 主要修改：
  - `src-tauri/src/lib.rs`（新增 `deploy_pages_wrangler`）
  - `src/index.html`（新增 Wrangler 项目标签页）
  - `src/app.js`（新增 `deployPagesWrangler`）
