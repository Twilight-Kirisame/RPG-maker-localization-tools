/**
 * @file src/main/ipc/ui.ipc.js
 * @description UI 设置与窗口控制 IPC。
 */

const { ipcMain } = require('electron');
const { appStoragePath } = require('../services/storage/StorageService');
const fs = require('fs');
const fsp = fs.promises;

const settingsFile = appStoragePath('ui-settings.json');

async function loadUiSettings() {
  try {
    if (!fs.existsSync(settingsFile)) return { closeBehavior: 'minimize-to-tray' };
    return JSON.parse(await fsp.readFile(settingsFile, 'utf8'));
  } catch {
    return { closeBehavior: 'minimize-to-tray' };
  }
}

async function saveUiSettings(payload = {}) {
  const current = await loadUiSettings();
  const next = { ...current, ...payload };
  await fsp.writeFile(settingsFile, JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, settings: next };
}

function registerUiIpc() {
  ipcMain.handle('get-ui-settings', async () => ({ ok: true, settings: await loadUiSettings() }));
  ipcMain.handle('save-ui-settings', async (_event, payload) => saveUiSettings(payload));
}

module.exports = { registerUiIpc, loadUiSettings, saveUiSettings };
