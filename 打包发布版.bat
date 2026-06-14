@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0"

echo ========================================
echo RPG Localization Workbench - Release Packager
echo ========================================
echo.

if not exist "package.json" (
  echo [ERROR] package.json not found. Please run this script from the project root.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo [INFO] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo [1/2] Cleaning old build artifacts...
if exist "dist\win-unpacked" rmdir /s /q "dist\win-unpacked" 2>nul
if exist "dist\builder-debug.yml" del /f /q "dist\builder-debug.yml" 2>nul
if exist "dist\builder-effective-config.yaml" del /f /q "dist\builder-effective-config.yaml" 2>nul

echo.
echo [2/2] Building portable exe...
call npm run dist
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Please check the logs above.
  pause
  exit /b 1
)

echo.
echo ========================================
echo Build complete.
echo Output directory: %cd%\dist
echo ========================================
echo.
pause
