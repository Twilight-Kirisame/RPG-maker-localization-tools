/**
 * @file src/main/ipc/ui.ipc.js
 * @description 界面设置持久化 IPC。
 */

const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const { appStoragePath } = require('../services/storage/StorageService');

const UI_SETTINGS_FILE = appStoragePath('ui-settings.json');

function readUiSettings() {
  try {
    if (!fs.existsSync(UI_SETTINGS_FILE)) return { closeBehavior: 'minimize-to-tray', enableGamePreview: true, previewWindowMode: 'popup' };
    const parsed = JSON.parse(fs.readFileSync(UI_SETTINGS_FILE, 'utf8'));
    return {
      closeBehavior: parsed.closeBehavior || 'minimize-to-tray',
      enableGamePreview: parsed.enableGamePreview !== false,
      previewWindowMode: ['popup', 'embedded'].includes(parsed.previewWindowMode) ? parsed.previewWindowMode : 'popup',
    };
  } catch {
    return { closeBehavior: 'minimize-to-tray', enableGamePreview: true, previewWindowMode: 'popup' };
  }
}

function writeUiSettings(settings) {
  const payload = {
    closeBehavior: ['minimize-to-tray', 'exit-immediately'].includes(settings?.closeBehavior) ? settings.closeBehavior : 'minimize-to-tray',
    enableGamePreview: settings?.enableGamePreview !== false,
    previewWindowMode: ['popup', 'embedded'].includes(settings?.previewWindowMode) ? settings.previewWindowMode : 'popup',
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(UI_SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(UI_SETTINGS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function registerUiIpc() {
  ipcMain.handle('get-ui-settings', async () => ({ ok: true, settings: readUiSettings() }));
  ipcMain.handle('save-ui-settings', async (_event, payload) => ({ ok: true, settings: writeUiSettings(payload) }));
}

module.exports = { registerUiIpc, readUiSettings, writeUiSettings };
