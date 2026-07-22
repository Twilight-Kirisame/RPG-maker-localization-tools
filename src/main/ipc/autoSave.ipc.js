/**
 * @file src/main/ipc/autoSave.ipc.js
 * @description 自动保存 IPC。
 */

const { ipcMain, dialog } = require('electron');
const { autoSaveDraft, autoSaveGlossary, autoSaveAll } = require('../services/autoSave/AutoSaveService');

function registerAutoSaveIpc() {
  ipcMain.handle('auto-save-draft', async (_event, payload) => autoSaveDraft(payload || {}));

  ipcMain.handle('auto-save-glossary', async (_event, payload) => autoSaveGlossary(payload || {}));

  ipcMain.handle('auto-save-all', async (_event, payload) => autoSaveAll(payload || {}));

  ipcMain.handle('pick-auto-save-dir', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (canceled || !filePaths[0]) return { ok: false, canceled: true };
    return { ok: true, dir: filePaths[0] };
  });
}

module.exports = { registerAutoSaveIpc };
