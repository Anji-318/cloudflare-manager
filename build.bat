@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo  Cloudflare Manager 编译脚本
echo ==========================================
echo.

if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
    set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
) else (
    echo [错误] 未找到 Cargo，请先安装 Rust 工具链。
    pause
    exit /b 1
)

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js。
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [信息] 正在安装 npm 依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] npm install 失败。
        pause
        exit /b 1
    )
)

echo [信息] 正在编译 Tailwind CSS（含自定义样式）...
call npm run build:css
if %errorlevel% neq 0 (
    echo.
    echo [错误] CSS 编译失败。请确认已 npm install，且存在 src\input.css、tailwind.config.js。
    pause
    exit /b 1
)

echo [信息] 开始编译 Tauri 应用...
call npm run tauri build
if %errorlevel% neq 0 (
    echo.
    echo [错误] 编译失败。
    pause
    exit /b 1
)

set "BUNDLE_DIR=src-tauri\target\release\bundle\nsis"
set "FOUND_FILE="
for %%f in ("%BUNDLE_DIR%\cloudflare-manager_*_x64-setup.exe") do (
    set "FOUND_FILE=%%f"
)

echo.
echo ==========================================
echo  编译成功！
echo ==========================================
echo.

if defined FOUND_FILE (
    echo 安装包位置：
    echo %FOUND_FILE%
    echo.
    echo [提示] 直接运行安装包即可安装应用。
) else (
    echo 安装包位置：
    echo %BUNDLE_DIR%\cloudflare-manager_*_x64-setup.exe
    echo.
    echo [提示] 未找到安装包，请检查 bundle 目录。
)

pause
