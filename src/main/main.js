/**
 * @file src/main/main.js
 * @description 主进程入口，负责应用生命周期与 IPC 注册。
 */

const { app } = require('electron');
const { createMainWindow } = require('./appWindow');
const { registerAllIpc } = require('./ipc');

/**
 * 启动应用。
 */
function bootstrap() {
  app.whenReady().then(() => {
    createMainWindow();
    registerAllIpc();

    app.on('activate', () => {
      if (require('electron').BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

bootstrap();
