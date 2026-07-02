@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "ROOT=%~dp0"
cd /d "%ROOT%"

if not exist "package.json" (
  echo [ERROR] package.json not found in project root.
  pause
  exit /b 1
)

echo ========================================
echo RPG Localization Workbench Packager
echo ========================================
echo.
echo 1. Build Windows stable release   (dist/,      .exe)
echo 2. Build Windows test release     (dist-test/, .exe)
echo 3. Build macOS   stable release   (dist/,      .zip x64+arm64)
echo 4. Build macOS   test release     (dist-test/, .zip x64+arm64)
echo.
echo    [Note] macOS DMG cannot be produced on Windows (requires macOS
echo    native tools). We emit ZIPs signed with identity=null; users
echo    should unzip and drag the .app to /Applications, then
echo    "xattr -d com.apple.quarantine /Applications/*.app" to launch.
echo.
set "BUILD_KIND=1"
set /p "BUILD_KIND=Choose build type [1/2/3/4] [default=1]: "
if not defined BUILD_KIND set "BUILD_KIND=1"

set "BUILD_NAME="
set "OUTPUT_DIR="
set "NPM_SCRIPT="
set "CLEAN_DIR="

if "%BUILD_KIND%"=="1" goto stable
if "%BUILD_KIND%"=="2" goto test
if "%BUILD_KIND%"=="3" goto macstable
if "%BUILD_KIND%"=="4" goto mactest
goto invalid

:stable
set "BUILD_NAME=Windows stable"
set "OUTPUT_DIR=dist"
set "NPM_SCRIPT=dist"
set "CLEAN_DIR=dist"
goto selected

:test
set "BUILD_NAME=Windows test"
set "OUTPUT_DIR=dist-test"
set "NPM_SCRIPT=dist:test"
set "CLEAN_DIR=dist-test"
goto selected

:macstable
set "BUILD_NAME=macOS stable (zip only)"
set "OUTPUT_DIR=dist"
set "NPM_SCRIPT=dist:mac:winhost"
set "CLEAN_DIR=dist"
goto selected

:mactest
set "BUILD_NAME=macOS test (zip only)"
set "OUTPUT_DIR=dist-test"
set "NPM_SCRIPT=dist:mac:winhost:test"
set "CLEAN_DIR=dist-test"
goto selected

:invalid
echo [ERROR] Invalid selection. Please enter 1, 2, 3 or 4.
pause
exit /b 1

:selected
echo [INFO] Selected %BUILD_NAME% build.

if not exist "node_modules\electron" (
  echo [INFO] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 goto depfail
)

echo [1/2] Closing possible locked build processes...
taskkill /f /im "electron.exe" >nul 2>&1
taskkill /f /im "app-builder.exe" >nul 2>&1
taskkill /f /im "node.exe" >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/2] Cleaning %BUILD_NAME% build artifacts...
if not defined CLEAN_DIR goto cleanfail
if "%CLEAN_DIR%"=="" goto cleanfail
if "%CLEAN_DIR%"=="." goto cleanfail
if "%CLEAN_DIR%"=="\" goto cleanfail
if exist "%CLEAN_DIR%" (
  rmdir /s /q "%CLEAN_DIR%" 2>nul
  if exist "%CLEAN_DIR%" (
    timeout /t 2 /nobreak >nul
    rmdir /s /q "%CLEAN_DIR%" 2>nul
  )
  if exist "%CLEAN_DIR%" goto cleanfail
)
mkdir "%CLEAN_DIR%" >nul 2>&1
if errorlevel 1 goto cleanfail

echo.
echo [2/2] Building %BUILD_NAME% release...
call npm run %NPM_SCRIPT%
if errorlevel 1 goto buildfail

echo.
echo ========================================
echo Build complete.
echo Output directory: %ROOT%%OUTPUT_DIR%
echo ========================================
echo.
pause
exit /b 0

:depfail
echo [ERROR] Dependency installation failed.
pause
exit /b 1

:cleanfail
echo [ERROR] Failed to clean output contents in %CLEAN_DIR%.
pause
exit /b 1

:buildfail
echo.
echo [ERROR] Build failed. Please check the logs above.
pause
exit /b 1
