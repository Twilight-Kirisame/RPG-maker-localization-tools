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
    if (!fs.existsSync(UI_SETTINGS_FILE)) return defaultUiSettings();
    const parsed = JSON.parse(fs.readFileSync(UI_SETTINGS_FILE, 'utf8'));
    return normalizeUiSettings(parsed);
  } catch {
    return defaultUiSettings();
  }
}

function defaultUiSettings() {
  return {
    closeBehavior: 'minimize-to-tray',
    enableGamePreview: true,
    previewWindowMode: 'popup',
    showPreviewNotification: true,
    previewNotificationPosition: 'top-center',
    timelineModeEnabled: false,
  };
}

function normalizeUiSettings(parsed) {
  return {
    closeBehavior: parsed.closeBehavior || 'minimize-to-tray',
    enableGamePreview: parsed.enableGamePreview !== false,
    previewWindowMode: ['popup', 'embedded'].includes(parsed.previewWindowMode) ? parsed.previewWindowMode : 'popup',
    showPreviewNotification: parsed.showPreviewNotification !== false,
    previewNotificationPosition: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(parsed.previewNotificationPosition) ? parsed.previewNotificationPosition : 'top-center',
    timelineModeEnabled: parsed.timelineModeEnabled === true,
  };
}

function writeUiSettings(settings) {
  const payload = {
    closeBehavior: ['minimize-to-tray', 'exit-immediately'].includes(settings?.closeBehavior) ? settings.closeBehavior : 'minimize-to-tray',
    enableGamePreview: settings?.enableGamePreview !== false,
    previewWindowMode: ['popup', 'embedded'].includes(settings?.previewWindowMode) ? settings.previewWindowMode : 'popup',
    showPreviewNotification: settings?.showPreviewNotification !== false,
    previewNotificationPosition: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(settings?.previewNotificationPosition) ? settings.previewNotificationPosition : 'top-center',
    timelineModeEnabled: settings?.timelineModeEnabled === true,
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
