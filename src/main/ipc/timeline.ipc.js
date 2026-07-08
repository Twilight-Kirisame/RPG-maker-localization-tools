/**
 * @file src/main/ipc/timeline.ipc.js
 * @description 剧情流线模式（虚拟剧本时间线）视图切换 IPC。
 */

const { ipcMain } = require('electron');
const { globalProjectStore } = require('../services/project/ProjectStore');

function registerTimelineIpc() {
  ipcMain.handle('set-view-mode', async (_event, mode) => {
    const ok = globalProjectStore.setViewMode(mode);
    return {
      ok,
      currentMode: globalProjectStore.viewMode,
      total: globalProjectStore.getActiveEntries().length,
      meta: globalProjectStore.timelineMeta,
    };
  });

  ipcMain.handle('get-view-mode', async () => ({
    ok: true,
    currentMode: globalProjectStore.viewMode,
    total: globalProjectStore.getActiveEntries().length,
    meta: globalProjectStore.timelineMeta,
  }));

  ipcMain.handle('get-view-mode-entries', async (_event, { page = 1, pageSize = 200 } = {}) => {
    const { total, entries } = globalProjectStore.getEntriesByPage(page, pageSize);
    return { ok: true, currentMode: globalProjectStore.viewMode, total, entries, meta: globalProjectStore.timelineMeta };
  });

  ipcMain.handle('update-entry-translation', async (_event, { entryId, translatedText } = {}) => {
    const matchedEntry = globalProjectStore.findPhysicalEntryById(entryId);
    if (!matchedEntry) return { success: false, error: 'Entry 未找到' };
    matchedEntry.target = translatedText;
    matchedEntry.targetDraft = translatedText;
    if (matchedEntry.status && typeof matchedEntry.status === 'object') {
      matchedEntry.status.translation = String(translatedText || '').trim() ? 'translated' : 'pending';
    }
    return { success: true, entryId };
  });
}

module.exports = { registerTimelineIpc };
