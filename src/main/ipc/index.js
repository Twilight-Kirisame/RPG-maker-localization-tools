/**
 * @file src/main/ipc/index.js
 * @description IPC 统一注册入口。
 */

const { registerProjectIpc } = require('./project.ipc');
const { registerGlossaryIpc } = require('./glossary.ipc');
const { registerExportIpc } = require('./export.ipc');
const { registerTranslationIpc } = require('./translation.ipc');
const { registerUiIpc } = require('./ui.ipc');
const { registerPreviewIpc } = require('./preview.ipc');
const { registerTimelineIpc } = require('./timeline.ipc');
const { registerAutoSaveIpc } = require('./autoSave.ipc');
const { registerFontIpc } = require('./font.ipc');

/**
 * 注册全部 IPC。
 */
function registerAllIpc() {
  registerProjectIpc();
  registerGlossaryIpc();
  registerExportIpc();
  registerTranslationIpc();
  registerUiIpc();
  registerPreviewIpc();
  registerTimelineIpc();
  registerAutoSaveIpc();
  registerFontIpc();
}

module.exports = { registerAllIpc };
