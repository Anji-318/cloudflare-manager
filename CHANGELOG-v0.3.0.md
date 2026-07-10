# Cloudflare 多账户管理系统 v0.3.0 更新日志

## 版本信息

- **当前版本**：v0.3.0
- **发布日期**：2026-07-10
- **上一版本**：v0.2.0

---

## 新增功能

### 1. 仪表盘 - 账户 Workers 今日请求数
- 通过 **GraphQL Analytics API** 实时获取账户 Workers 今日请求数
- 显示请求数 / 配额上限（如 `7,251 / 100,000`）
- 使用百分比指示器（绿色 < 70%，黄色 70-90%，红色 ≥ 90%）
- 支持手动刷新按钮
- 数据与 Cloudflare 官网完全一致

### 2. 账户管理 - 行内编辑
- 表格内直接编辑账户信息（名称、邮箱、Token）
- 点击"编辑"按钮进入行内编辑模式
- 保存/取消按钮在同一行操作
- 添加账户弹窗保持不变

### 3. 账户管理 - 真实域名数
- 自动查询每个账户的 API 获取真实域名数量
- 进入账户页面时异步加载（显示 `...`）
- 逐个账户查询，避免并发过多

---

## 功能修复

### DNS 管理页
| 功能 | v0.2.0 | v0.3.0 |
|------|--------|--------|
| 代理开关 | ❌ 静态显示，不可操作 | ✅ 点击切换，调用 API |
| 编辑按钮 | ❌ 无响应 | ✅ 打开编辑器弹窗 |
| 删除按钮 | ✅ 可用 | ✅ 可用 |

### GraphQL API 修复
- 修正 GraphQL endpoint 路径（`/client/v4/graphql` → `/graphql`）
- 修复 GraphQL 响应解析（使用 `cloudflare_request_text` 直接获取原始 JSON）
- 添加 UTC 时间查询，与 Cloudflare 官网统计周期一致

---

## 优化改进

### 构建脚本
- `build.bat` 自动检测实际生成的安装包文件名
- 避免版本号硬编码问题

### 错误处理
- 优化 Workers 请求数加载错误分类：权限不足 / 无 Workers / 网络超时 / 数据延迟
- DNS 页面删除账户后不再触发仪表盘刷新（避免冲突）

---

## 版本号更新位置

| 文件 | 更新内容 |
|------|----------|
| `package.json` | `"version": "0.3.0"` |
| `package-lock.json` | `"version": "0.3.0"` |
| `src/app.js` | `const APP_VERSION = '0.3.0'` |
| `src/index.html` | `<span id="app-version">0.3.0</span>` |
| `src-tauri/Cargo.toml` | `version = "0.3.0"` |
| `src-tauri/tauri.conf.json` | `"version": "0.3.0"` |
| `README.md` | 安装包名称更新 |
| `.github/workflows/release.yml` | 默认 tag 更新 |

---

## 已知限制

1. **Workers 请求数数据延迟**：GraphQL Analytics 数据有 1-3 小时延迟，非实时
2. **Free 计划限制**：部分 Analytics 数据集可能需要 Paid 计划
3. **Windows 独占**：当前仅构建 Windows 版本

---

## 下载

- 安装包：`cloudflare-manager_0.3.0_x64-setup.exe`
- 源码包：`cloudflare-manager-v0.3.0-src.zip`
