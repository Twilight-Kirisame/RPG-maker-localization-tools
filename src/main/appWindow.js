/**
 * @file src/main/appWindow.js
 * @description 主窗口创建与生命周期管理。
 */

const path = require('path');
const { BrowserWindow } = require('electron');

let mainWindow = null;

/**
 * 创建主窗口。
 * @returns {BrowserWindow}
 */
function createMainWindow() {
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

module.exports = { createMainWindow, getMainWindow };
