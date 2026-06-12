/**
 * @file src/main/ipc/translation.ipc.js
 * @description AI 与翻译设置 IPC。
 */

const { ipcMain } = require('electron');
const { loadAiSettings, saveAiSettings, saveTranslatorSettings, testTraditional, buildAiTranslate } = require('../services/translation/TranslationService');

/**
 * 注册翻译相关 IPC。
 */
function registerTranslationIpc() {
  ipcMain.handle('get-ai-settings', async (_event, payload) => {
    const { project } = payload || {};
    return { ok: true, settings: await loadAiSettings(project) };
  });

  ipcMain.handle('save-ai-settings', async (_event, payload) => {
    const { project, ...settings } = payload || {};
    return saveAiSettings(project, settings);
  });

  ipcMain.handle('save-translator-settings', async (_event, payload) => {
    const { project } = payload || {};
    return saveTranslatorSettings(project, payload);
  });

  ipcMain.handle('test-translator-settings', async (_event, payload) => {
    const { type, settings, sampleText } = payload || {};
    try {
      if (type === 'traditional') return testTraditional(settings, sampleText);
      return { ok: true, message: '设置格式有效。' };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('ai-translate', async (_event, payload) => buildAiTranslate(payload));
}

module.exports = { registerTranslationIpc };