/**
 * @file src/main/ipc/export.ipc.js
 * @description 草稿与补丁导出 IPC。
 */

const { ipcMain } = require('electron');
const { exportPatchFiles, saveDraft, loadDraft } = require('../services/export/ExportService');

/**
 * 注册导出 IPC。
 */
function registerExportIpc() {
  ipcMain.handle('export-patch', async (_event, payload) => exportPatchFiles(payload));

  ipcMain.handle('save-draft', async (_event, payload) => saveDraft(payload));

  ipcMain.handle('load-draft', async (_event, payload) => {
    const { rootDir } = payload || {};
    const draft = rootDir ? await loadDraft(rootDir) : null;
    return { ok: !!draft, draft };
  });
}

module.exports = { registerExportIpc };