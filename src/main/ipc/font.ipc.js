/**
 * @file src/main/ipc/font.ipc.js
 * @description 字体导入与管理 IPC。
 */

const fs = require('fs');
const path = require('path');
const { dialog, ipcMain } = require('electron');
const { appStoragePath } = require('../services/storage/StorageService');
const { ensureDir, toSafeFileName } = require('../utils/fsUtils');

const IMPORTED_FONTS_DIR = appStoragePath('imported-fonts');

function getFontFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.ttf': 'truetype',
    '.otf': 'opentype',
    '.woff': 'woff',
    '.woff2': 'woff2',
  };
  return map[ext] || 'truetype';
}

function listImportedFonts() {
  ensureDir(IMPORTED_FONTS_DIR);
  const fonts = [];
  try {
    const entries = fs.readdirSync(IMPORTED_FONTS_DIR);
    for (const entry of entries) {
      const entryPath = path.join(IMPORTED_FONTS_DIR, entry);
      const stat = fs.statSync(entryPath);
      if (!stat.isDirectory()) continue;
      const metaPath = path.join(entryPath, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;
      let meta;
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch {
        continue;
      }
      const fontFile = fs.readdirSync(entryPath).find((f) => /\.(ttf|otf|woff|woff2)$/i.test(f));
      if (!fontFile) continue;
      fonts.push({
        key: meta.key || entry,
        name: meta.name || meta.key || entry,
        familyName: meta.familyName || meta.name || meta.key || entry,
        filePath: path.join(entryPath, fontFile),
        format: meta.format || getFontFormat(fontFile),
      });
    }
  } catch (e) {
    console.error('Failed to list imported fonts:', e);
  }
  return fonts;
}

function registerFontIpc() {
  ipcMain.handle('pick-import-font-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || !filePaths || !filePaths[0]) return { ok: false, canceled: true };
    return { ok: true, filePath: filePaths[0] };
  });

  ipcMain.handle('import-font', async (_event, { name, familyName, filePath }) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, message: '字体文件不存在' };
    }

    const baseName = path.basename(filePath, path.extname(filePath));
    const key = toSafeFileName(name || baseName);
    if (!key) return { ok: false, message: '字体名称无效' };

    const targetDir = path.join(IMPORTED_FONTS_DIR, key);
    ensureDir(targetDir);

    const ext = path.extname(filePath).toLowerCase();
    const targetFileName = `font${ext}`;
    const targetFilePath = path.join(targetDir, targetFileName);

    try {
      fs.copyFileSync(filePath, targetFilePath);
      const meta = {
        key,
        name: name || baseName,
        familyName: familyName || name || baseName,
        format: getFontFormat(filePath),
        importedAt: new Date().toISOString(),
      };
      fs.writeFileSync(path.join(targetDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
      return {
        ok: true,
        font: {
          key,
          name: meta.name,
          familyName: meta.familyName,
          filePath: targetFilePath,
          format: meta.format,
        },
      };
    } catch (e) {
      return { ok: false, message: e.message || '字体复制失败' };
    }
  });

  ipcMain.handle('list-imported-fonts', async () => ({ ok: true, fonts: listImportedFonts() }));

  ipcMain.handle('delete-imported-font', async (_event, key) => {
    const targetDir = path.join(IMPORTED_FONTS_DIR, toSafeFileName(String(key)));
    if (fs.existsSync(targetDir)) {
      try {
        fs.rmSync(targetDir, { recursive: true, force: true });
        return { ok: true };
      } catch (e) {
        return { ok: false, message: e.message || '删除失败' };
      }
    }
    return { ok: false, message: '字体不存在' };
  });
}

module.exports = { registerFontIpc };
