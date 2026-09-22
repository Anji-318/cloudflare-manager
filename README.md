# Cloudflare 多账户管理系统（桌面端）

基于 **Tauri v2 + Rust + WebView** 的 Windows 桌面应用，用于集中管理多个 Cloudflare 账户的域名、DNS、Workers、Pages、R2、KV、D1、Tunnels、防火墙、缓存与分析数据。

## 项目路径

```
C:\Users\Giga\Desktop\cloudflare多账户管理系统
```

## 技术栈

- **后端**：Rust + Tauri v2
- **前端**：原生 HTML / Tailwind CSS / JavaScript
- **本地存储**：Tauri Store（`accounts.json`）+ AES-256-GCM Token 加密
- **网络**：reqwest（Cloudflare API v4）
- **打包**：Tauri NSIS 安装包

## 功能清单

- [x] 多账户管理：添加、编辑、删除、切换账户，每个账户可设置本地自定义头像（PNG/JPG/WebP/GIF/BMP/SVG/ICO，点击头像直接更换，未设置时按名字自动生成彩色字母头像）
- [x] Token 加密存储，切换账户时从本地存储实时读取对应 Token
- [x] 账户域名数独立统计，按各账户 Token 精确计数
- [x] 域名列表、DNS 记录管理（增删改查、代理开关）
- [x] Workers：脚本列表、编辑部署、Secrets、自定义域名、Zone Routes、workers.dev 开关
- [x] Pages：项目列表、部署历史、域名管理，支持本地目录 wrangler 部署、ZIP 压缩包 Direct Upload 部署与 Wrangler 项目目录部署
- [x] R2：Bucket 列表与创建/删除
- [x] KV / D1：命名空间/数据库列表与基本管理
- [x] Snippets：Snippet 列表、创建/编辑/删除，代码编辑器带行号显示
- [x] Tunnels、Firewall、缓存清除、分析报表入口
- [x] 深色/浅色主题切换

## 构建方式

### 环境要求

- Node.js 18+
- Rust 1.80+
- Windows（当前仅构建 Windows 版本）

### 命令行构建

```bash
npm install
npm run build
```

构建产物：

- 可执行文件：`src-tauri\target\release\cloudflare-manager.exe`
- 安装包：`src-tauri\target\release\bundle\nsis\cloudflare-manager_0.3.5_x64-setup.exe`

### 快速构建脚本

Windows 环境下也可直接运行项目根目录的：

```bat
build.bat
```

## 使用方式

1. 运行安装包或直接运行 `cloudflare-manager.exe`。
2. 首次使用点击右上角 **添加账户**，输入账户名称、邮箱和 Cloudflare API Token（头像为可选项，也可添加后点击账户头像随时更换）。
3. 切换账户时，应用会自动清空上一个账户的缓存数据并重新加载当前页面。

## API Token 推荐权限

| 范围 | 资源 | 权限 |
|------|------|------|
| 帐户 | D1 | 编辑 |
| 帐户 | Cloudflare Pages | 编辑 |
| 帐户 | Workers R2 存储 | 编辑 |
| 帐户 | Workers KV 存储 | 编辑 |
| 帐户 | Workers 脚本 | 编辑 |
| 帐户 | 帐户 | 读取 |
| 帐户 | 帐户设置 | 读取 |
| 帐户 | Cloudflare Tunnel | 编辑 |
| 区域 | 区域设置 | 编辑 |
| 区域 | 区域 | 读取 |
| 区域 | 防火墙服务 | 编辑 |
| 区域 | Workers 路由 | 编辑 |
| 区域 | DNS | 编辑 |
| 区域 | Analytics | 读取 |

> 如果只需要域名 + DNS + 缓存 + 防火墙 + 分析，最少需要：区域（读取、编辑相关）+ 帐户 - 帐户（读取）+ 帐户设置（读取）。
>
> 如需管理 Workers / Pages / R2 / KV / D1 / Tunnels，请额外勾选对应“帐户”权限。

## 项目结构

```
cloudflare多账户管理系统/
├── src/                          # 前端源码
│   ├── app.js                    # 业务逻辑
│   ├── index.html                # 主界面
│   ├── usage.html                # 使用说明弹窗
│   └── styles.css                # 自定义样式
├── src-tauri/                    # Tauri / Rust 后端
│   ├── src/lib.rs                # 命令与 Cloudflare API 代理
│   ├── Cargo.toml
│   ├── build.rs
│   └── tauri.conf.json
├── LICENSE-MIT / LICENSE-APACHE   # 开源许可证（MIT OR Apache-2.0 双许可）
├── CHANGELOG-v0.3.3.md / CHANGELOG-v0.3.5.md   # 更新日志
├── build.bat                     # Windows 快速构建脚本
├── .gitignore                    # Git 忽略配置
├── package.json
├── package-lock.json
└── README.md                     # 本文件


```


## 常见问题

**切换账户后某些页面没有数据？**  
请确认目标账户的 API Token 已启用，并且包含对应资源的权限。例如 Workers 页面需要“帐户 - Workers 脚本（编辑）”。

**提示“无法获取 Account ID”？**  
Token 缺少“帐户 - 帐户（读取）”权限，或 Account Resources 未包含目标账户。请重新生成 Token 后添加账户。

**加载域名失败 / API 请求超时？**  
请检查本地网络是否能访问 `https://api.cloudflare.com`。应用已内置请求重试，长时间无响应通常是网络或代理问题。

## 分发与备份

构建完成后，建议同时保留：

- 安装包：`cloudflare-manager_0.3.5_x64-setup.exe`
- 可执行文件：`cloudflare-manager.exe`

## 开源许可

本项目采用 **MIT OR Apache-2.0** 双许可，详见 [LICENSE-MIT](LICENSE-MIT) 与 [LICENSE-APACHE](LICENSE-APACHE)。
