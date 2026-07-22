/**
 * @file src/main/main.js
 * @description 主进程入口，负责应用生命周期与 IPC 注册。
 */

const { app } = require('electron');
const { createMainWindow, ensureTray, destroyTray, setExitRequested, setCloseBehavior } = require('./appWindow');
const { registerAllIpc } = require('./ipc');
const { readUiSettings } = require('./ipc/ui.ipc');

/**
 * 启动应用。
 */
function bootstrap() {
  app.setAppUserModelId(app.name || 'com.rpg.localization.workbench');
  app.whenReady().then(async () => {
    registerAllIpc();
    const uiSettings = readUiSettings();
    setCloseBehavior(uiSettings.closeBehavior || 'minimize-to-tray');
    createMainWindow();
    ensureTray();

    app.on('activate', () => {
      if (require('electron').BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('before-quit', () => {
    setExitRequested(true);
    destroyTray();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

bootstrap();
