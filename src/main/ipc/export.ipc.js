/**
 * @file src/main/ipc/export.ipc.js
 * @description 草稿与补丁导出 IPC。
 */

const { ipcMain } = require('electron');
const { exportPatchFiles, saveDraft, loadDraft } = require('../services/export/ExportService');
const { pickAdapter, getAdapterById } = require('../services/engine/registry');

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

  ipcMain.handle('apply-writeback', async (_event, payload) => {
    try {
      const adapter = payload?.project?.adapterId
        ? getAdapterById(payload.project.adapterId)
        : pickAdapter(payload?.project?.rootDir || '').adapter;
      if (!adapter || typeof adapter.apply !== 'function') return { ok: false, message: '未匹配到可写回的引擎适配器', files: [], errors: [{ reason: 'no adapter' }] };
      return await adapter.apply(payload);
    } catch (error) {
      return { ok: false, message: error.message, files: [], errors: [{ reason: error.message }] };
    }
  });
}

module.exports = { registerExportIpc };