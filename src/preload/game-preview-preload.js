/**
 * @file src/preload/game-preview-preload.js
 * @description 游戏预览 webview 的 preload 脚本。
 * 仅在 webview 中运行，向游戏内提示插件暴露读取命令文件所需的最小 Node API。
 * 注意：不暴露完整 Node 环境，避免 RPG Maker 误判为 NW.js。
 */

const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('__rpgWorkbenchPreview', {
  node: {
    fs: {
      existsSync: (filePath) => fs.existsSync(filePath),
      readFileSync: (filePath, encoding) => fs.readFileSync(filePath, encoding),
      watchFile: (filePath, options, listener) => fs.watchFile(filePath, options, listener),
      unwatchFile: (filePath, listener) => fs.unwatchFile(filePath, listener),
    },
    path: {
      join: (...args) => path.join(...args),
      resolve: (...args) => path.resolve(...args),
    },
  },
});

// 在 webview 中启用 RPG Maker 的 stretch 模式，使游戏画面填满容器而非固定 816x624
function injectPreviewCss() {
  if (typeof document === 'undefined') return;
  try {
    const style = document.createElement('style');
    style.textContent = `
      html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
    `;
    document.head.appendChild(style);
  } catch (e) {
    console.error('[RpgWorkbenchPreviewPreload] inject css failed', e);
  }
}

function enableRpgMakerStretch() {
  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enableRpgMakerStretch());
    return;
  }
  injectPreviewCss();
  if (typeof window.Graphics === 'undefined' || !window.Graphics._updateAllElements) {
    setTimeout(enableRpgMakerStretch, 50);
    return;
  }
  try {
    window.Graphics._stretchEnabled = true;
    window.Graphics._updateAllElements();
    window.dispatchEvent(new Event('resize'));
  } catch (e) {
    console.error('[RpgWorkbenchPreviewPreload] enable stretch failed', e);
  }
}
enableRpgMakerStretch();
