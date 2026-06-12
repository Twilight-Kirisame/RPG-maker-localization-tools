@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ========================================
echo RPG 汉化工作台 - 打包发布版
echo ========================================
echo.

if not exist "package.json" (
  echo [错误] 当前目录不是项目根目录，未找到 package.json。
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo [提示] 未检测到 node_modules，开始安装依赖...
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败。
    pause
    exit /b 1
  )
)

echo [1/2] 清理旧的打包临时目录...
if exist "dist\win-unpacked" rmdir /s /q "dist\win-unpacked" 2>nul
if exist "dist\builder-debug.yml" del /f /q "dist\builder-debug.yml" 2>nul
if exist "dist\builder-effective-config.yaml" del /f /q "dist\builder-effective-config.yaml" 2>nul

echo.
echo [2/2] 开始生成 portable exe...
call npm run dist
if errorlevel 1 (
  echo.
  echo [错误] 打包失败，请查看上方日志。
  pause
  exit /b 1
)

echo.
echo ========================================
echo 打包完成。
echo 输出目录：%cd%\dist
echo ========================================
echo.
pause
