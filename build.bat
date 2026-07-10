@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo  Cloudflare Manager 编译脚本
echo ==========================================
echo.

:: 添加 Rust / Cargo 到 PATH（如果未安装请先用 rustup 安装）
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
) else (
    echo [错误] 未找到 Cargo，请先安装 Rust 工具链。
    pause
    exit /b 1
)

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js。
    pause
    exit /b 1
)

:: 安装依赖（如果 node_modules 不存在）
if not exist "node_modules" (
    echo [信息] 正在安装 npm 依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] npm install 失败。
        pause
        exit /b 1
    )
)

:: 清理旧构建产物（可选，取消下面一行的 rem 可启用）
:: rmdir /s /q "src-tauri\target\release\bundle"

echo [信息] 开始编译 Tauri 应用...
call npm run tauri build
if %errorlevel% neq 0 (
    echo.
    echo [错误] 编译失败。
    pause
    exit /b 1
)

echo.
echo ==========================================
echo  编译成功！
echo ==========================================
echo.
echo 安装包位置：
echo src-tauri\target\release\bundle\nsis\cloudflare-manager_0.1.0_x64-setup.exe
echo.

pause
