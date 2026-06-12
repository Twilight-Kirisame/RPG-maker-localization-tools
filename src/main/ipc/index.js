/**
 * @file src/main/ipc/index.js
 * @description IPC 统一注册入口。
 */

const { registerProjectIpc } = require('./project.ipc');
const { registerGlossaryIpc } = require('./glossary.ipc');
const { registerExportIpc } = require('./export.ipc');
const { registerTranslationIpc } = require('./translation.ipc');

/**
 * 注册全部 IPC。
 */
function registerAllIpc() {
  registerProjectIpc();
  registerGlossaryIpc();
  registerExportIpc();
  registerTranslationIpc();
}

module.exports = { registerAllIpc };
