/**
 * @file src/main/appWindow.js
 * @description 主窗口创建与生命周期管理。
 */

const path = require('path');
const fs = require('fs');
const { BrowserWindow, Tray, Menu, nativeImage, app } = require('electron');
const { appStoragePath } = require('./services/storage/StorageService');

let mainWindow = null;
let appTray = null;
let exitRequested = false;
let closeBehavior = 'minimize-to-tray';

function getTrayIcon() {
  const candidates = [
    path.join(app.getAppPath(), 'assets', 'tray-icon.png'),
    path.join(app.getAppPath(), 'assets', 'tray-icon.ico'),
    path.join(app.getAppPath(), 'assets', 'tray-icon.svg'),
    appStoragePath('tray-icon.png'),
  ];
  for (const iconPath of candidates) {
    try {
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) return icon;
      }
    } catch {
      // try next
    }
  }
  return nativeImage.createEmpty();
}

function ensureTray() {
  if (appTray) return appTray;
  const icon = getTrayIcon();
  appTray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  appTray.setToolTip('RPG 汉化工作台');
  appTray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开窗口', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createMainWindow(); } },
    { label: '退出程序', click: () => { exitRequested = true; app.quit(); } },
  ]));
  appTray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  return appTray;
}

function destroyTray() {
  if (appTray) { appTray.destroy(); appTray = null; }
}

function setExitRequested(value) {
  exitRequested = !!value;
}

function setCloseBehavior(value) {
  closeBehavior = ['minimize-to-tray', 'exit-immediately'].includes(value) ? value : 'minimize-to-tray';
}

function getCloseBehavior() {
  return closeBehavior;
}

function isExitRequested() {
  return exitRequested;
}

/**
 * 创建主窗口。
 * @returns {BrowserWindow}
 */
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 860,
    backgroundColor: '#0f1115',
    title: 'RPG 汉化工作台',
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('close', (event) => {
    if (exitRequested || closeBehavior === 'exit-immediately') return;
    event.preventDefault();
    mainWindow.hide();
    ensureTray();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  return mainWindow;
}

/**
 * 获取当前主窗口。
 * @returns {BrowserWindow|null}
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * 获取当前主窗口的 HWND（Windows）或 null。
 * @returns {string|null} 16 进制句柄字符串
 */
function getMainWindowHandle() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    const handle = mainWindow.getNativeWindowHandle();
    if (process.platform === 'win32' && Buffer.isBuffer(handle)) {
      if (handle.length === 8) return handle.readBigUInt64LE(0).toString(16);
      if (handle.length === 4) return handle.readUInt32LE(0).toString(16);
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = { createMainWindow, getMainWindow, getMainWindowHandle, ensureTray, destroyTray, setExitRequested, isExitRequested, setCloseBehavior, getCloseBehavior };
