# Cloudflare 多账户管理系统 v0.3.3 更新日志

## 版本信息

- **当前版本**：v0.3.3
- **上一版本**：v0.3.2

---

## 重要修复

### 1. Snippets 编辑器缺少行号
- 为 Snippets 编辑器的代码输入框增加行号显示，与 Worker 编辑器行为保持一致
- 行号列绝对定位在编辑器左侧（`w-12`），随代码内容自动更新
- 纵向滚动：`onscroll` 时通过 `translateY(-scrollTop)` 同步行号滚动位置
- 横向固定：行号列不参与滚动，`wrap="off"` 横向滚动仅作用于代码区
- 打开编辑器（新建 / 加载已有 Snippet）时自动刷新行号并重置滚动偏移

### 2. 补充开源许可证
- 项目此前未声明许可证（默认保留所有权利），现新增 **MIT OR Apache-2.0** 双许可
- 新增 `LICENSE-MIT`、`LICENSE-APACHE`
- `package.json` / `src-tauri/Cargo.toml` 的 `license` 字段统一声明为 `MIT OR Apache-2.0`
- README 增加「开源许可」说明

---

## 技术变更

| 项 | v0.3.2 | v0.3.3 |
|----|--------|--------|
| Snippets 编辑器 | 纯 textarea，无行号 | 行号 + 滚动同步（复用 Worker 编辑器方案） |
| 许可证 | 未声明 | MIT OR Apache-2.0 |
| 版本号 | 0.3.2 | 0.3.3 |

### 新增文件
- `LICENSE-MIT`
- `LICENSE-APACHE`
- `CHANGELOG-v0.3.3.md`

### 主要修改文件
- `src/index.html`（Snippet 编辑器代码区结构）
- `src/app.js`（`updateSnippetLineNumbers` / `syncSnippetLineNumbers`）
- `package.json`、`src-tauri/Cargo.toml`（license 字段）
- `README.md`（安装包版本号、开源许可说明）

---

## 构建方式

```bat
npm install
npm run build:css
npm run build
```

构建产物：
- 可执行文件：`src-tauri\target\release\cloudflare-manager.exe`
- 安装包：`src-tauri\target\release\bundle\nsis\cloudflare-manager_0.3.3_x64-setup.exe`

---

## 升级说明

1. 覆盖 `src/` 下修改的文件后重新执行 `npm run build:css && npm run build`
2. 本次改动仅涉及前端（HTML/JS）与元数据文件，无需重新 `npm install`
