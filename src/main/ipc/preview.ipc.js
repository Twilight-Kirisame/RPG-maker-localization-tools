/**
 * @file src/main/ipc/preview.ipc.js
 * @description 游戏内快速预览 IPC。
 */

const { ipcMain } = require('electron');
const { previewInGame, repreviewInGame, returnToTitle, prevPreviewEntry, nextPreviewEntry, stopPreview, cleanupOnStartup } = require('../services/preview/GamePreviewService');

/**
 * 注册预览相关 IPC。
 */
function registerPreviewIpc() {
  ipcMain.handle('preview-in-game', async (_event, payload = {}) => {
    try {
      const { rootDir, entry, targetText, options } = payload;
      const result = await previewInGame(rootDir, entry, targetText, options);
      return result;
    } catch (error) {
      return { ok: false, message: error.message || '预览启动失败' };
    }
  });

  ipcMain.handle('repreview-in-game', async (_event, payload = {}) => {
    try {
      const { rootDir, entry, targetText, options } = payload;
      const result = await repreviewInGame(rootDir, entry, targetText, options);
      return result;
    } catch (error) {
      return { ok: false, message: error.message || '无缝重开预览失败' };
    }
  });

  ipcMain.handle('return-to-title', async (_event, payload = {}) => {
    try {
      const { rootDir, gamePid } = payload;
      returnToTitle(rootDir, gamePid);
      return { ok: true, message: '已发送退回标题指令' };
    } catch (error) {
      return { ok: false, message: error.message || '退回标题失败' };
    }
  });

  ipcMain.handle('prev-entry', async (_event, payload = {}) => {
    try {
      const { rootDir } = payload;
      prevPreviewEntry(rootDir);
      return { ok: true, message: '已发送上一句指令' };
    } catch (error) {
      return { ok: false, message: error.message || '上一句指令失败' };
    }
  });

  ipcMain.handle('next-entry', async (_event, payload = {}) => {
    try {
      const { rootDir } = payload;
      nextPreviewEntry(rootDir);
      return { ok: true, message: '已发送下一句指令' };
    } catch (error) {
      return { ok: false, message: error.message || '下一句指令失败' };
    }
  });

  ipcMain.handle('stop-preview', async (_event, rootDir) => {
    try {
      const result = await stopPreview(rootDir);
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, message: error.message || '停止预览失败' };
    }
  });

  ipcMain.handle('restore-preview-backups', async (_event, rootDir) => {
    try {
      const result = await stopPreview(rootDir);
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, message: error.message || '恢复备份失败' };
    }
  });

  ipcMain.handle('cleanup-preview-on-startup', async (_event, rootDir) => {
    try {
      const result = await cleanupOnStartup(rootDir);
      return { ok: true, ...result };
    } catch (error) {
      return { ok: false, message: error.message || '清理预览残留失败' };
    }
  });

  ipcMain.handle('resize-embedded-preview', async (_event, payload = {}) => {
    try {
      const { pid, embedRect, rootDir } = payload;
      if (!pid || !embedRect) return { ok: false, message: '缺少参数' };
      const { embedGameWindow } = require('../services/preview/GamePreviewService');
      const result = await embedGameWindow(rootDir || '', pid, embedRect);
      return { ok: result?.ok ?? true, ...result };
    } catch (error) {
      return { ok: false, message: error.message || '调整嵌入窗口失败' };
    }
  });
}

module.exports = { registerPreviewIpc };
