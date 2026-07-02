#!/usr/bin/env bash
# ============================================================
# RPG Localization Workbench — macOS Packager
# 使用方法（macOS 终端）：
#   chmod +x 打包发布版-mac.sh
#   ./打包发布版-mac.sh
# 会交互式让你在稳定版 / 测试版之间选择；输出到 dist/ 或 dist-test/。
#
# 依赖：Node.js 18+、npm、Xcode Command Line Tools（首次会自动提示安装）。
# 注：electron-builder 的 macOS 目标只能在 macOS 主机上编译；
#     在 Windows / Linux 上执行本脚本会直接报错退出。
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "[ERROR] 本脚本只能在 macOS 上执行。当前系统：$(uname -s)"
  echo "        Windows 用户请使用 打包发布版.bat。"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "[ERROR] 未在当前目录找到 package.json"
  exit 1
fi

echo "========================================"
echo "RPG Localization Workbench macOS Packager"
echo "========================================"
echo ""
echo "1. Build stable release  (dist/)"
echo "2. Build test release    (dist-test/)"
echo ""
read -rp "Choose build type [1/2] [default=1]: " BUILD_KIND
BUILD_KIND="${BUILD_KIND:-1}"

case "$BUILD_KIND" in
  1)
    BUILD_NAME="stable"
    OUTPUT_DIR="dist"
    NPM_SCRIPT="dist:mac"
    CLEAN_DIR="dist"
    ;;
  2)
    BUILD_NAME="test"
    OUTPUT_DIR="dist-test"
    NPM_SCRIPT="dist:mac:test"
    CLEAN_DIR="dist-test"
    ;;
  *)
    echo "[ERROR] 无效选择：$BUILD_KIND"
    exit 1
    ;;
esac

echo "[INFO] Selected $BUILD_NAME build."

if [ ! -d "node_modules/electron" ]; then
  echo "[INFO] node_modules 缺失，正在执行 npm install..."
  npm install
fi

echo "[1/2] Cleaning $BUILD_NAME build artifacts..."
if [ -z "$CLEAN_DIR" ] || [ "$CLEAN_DIR" = "." ] || [ "$CLEAN_DIR" = "/" ]; then
  echo "[ERROR] CLEAN_DIR 非法：$CLEAN_DIR"
  exit 1
fi
if [ -d "$CLEAN_DIR" ]; then
  rm -rf "$CLEAN_DIR"
fi
mkdir -p "$CLEAN_DIR"

echo ""
echo "[2/2] Building $BUILD_NAME release for macOS..."
npm run "$NPM_SCRIPT"

echo ""
echo "========================================"
echo "Build complete."
echo "Output directory: $ROOT/$OUTPUT_DIR"
echo "  · <productName>-<version>-x64.dmg    (Intel)"
echo "  · <productName>-<version>-arm64.dmg  (Apple Silicon)"
echo "  · 对应的 .zip 也会一并生成，便于自动更新分发。"
echo "========================================"
