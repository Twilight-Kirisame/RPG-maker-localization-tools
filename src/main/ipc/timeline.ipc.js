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
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('get-view-mode', async () => ({
    ok: true,
    currentMode: globalProjectStore.viewMode,
    total: globalProjectStore.getActiveEntries().length,
    meta: globalProjectStore.timelineMeta,
    chapterGroups: globalProjectStore.getChapterGroups(),
  }));

  ipcMain.handle('get-view-mode-entries', async (_event, { page = 1, pageSize = 200 } = {}) => {
    const { total, entries } = globalProjectStore.getEntriesByPage(page, pageSize);
    return { ok: true, currentMode: globalProjectStore.viewMode, total, entries, meta: globalProjectStore.timelineMeta, chapterGroups: globalProjectStore.getChapterGroups() };
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

  ipcMain.handle('get-chapter-tree', async () => {
    if (!globalProjectStore.chapterGroups?.length) return { ok: false, error: '未加载项目或不是 RPG Maker 项目' };
    return {
      ok: true,
      groups: globalProjectStore.getChapterGroups(),
      currentMode: globalProjectStore.viewMode,
    };
  });

  ipcMain.handle('get-chapter-entries', async (_event, { groupId, subGroupId, page = 1, pageSize = 200 } = {}) => {
    const entries = globalProjectStore.getEntriesByChapter(groupId, subGroupId);
    const start = Math.max(0, (page - 1) * pageSize);
    return {
      ok: true,
      groupId,
      subGroupId,
      total: entries.length,
      entries: entries.slice(start, start + pageSize),
    };
  });

  ipcMain.handle('move-entry-chapter', async (_event, { entryId, targetGroupId, targetSubGroupId } = {}) => {
    const ok = await globalProjectStore.moveEntryToChapter(entryId, targetGroupId, targetSubGroupId);
    return {
      ok,
      entryId,
      targetGroupId,
      targetSubGroupId,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('create-chapter-group', async (_event, { name, order } = {}) => {
    const group = await globalProjectStore.createChapterGroup(name, order);
    return {
      ok: Boolean(group),
      group,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('rename-chapter-group', async (_event, { groupId, newName } = {}) => {
    const ok = await globalProjectStore.renameChapterGroup(groupId, newName);
    return {
      ok,
      groupId,
      newName,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('delete-chapter-group', async (_event, { groupId } = {}) => {
    const ok = await globalProjectStore.deleteChapterGroup(groupId);
    return {
      ok,
      groupId,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('create-chapter-sub-group', async (_event, { groupId, subGroupName } = {}) => {
    const subGroup = await globalProjectStore.createChapterSubGroup(groupId, subGroupName);
    return {
      ok: Boolean(subGroup),
      subGroup,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('rename-chapter-sub-group', async (_event, { groupId, subGroupId, newName } = {}) => {
    const ok = await globalProjectStore.renameChapterSubGroup(groupId, subGroupId, newName);
    return {
      ok,
      groupId,
      subGroupId,
      newName,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('delete-chapter-sub-group', async (_event, { groupId, subGroupId } = {}) => {
    const ok = await globalProjectStore.deleteChapterSubGroup(groupId, subGroupId);
    return {
      ok,
      groupId,
      subGroupId,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });

  ipcMain.handle('reset-chapter-overrides', async () => {
    const ok = await globalProjectStore.resetChapterOverrides();
    return {
      ok,
      chapterGroups: globalProjectStore.getChapterGroups(),
    };
  });
}

module.exports = { registerTimelineIpc };
