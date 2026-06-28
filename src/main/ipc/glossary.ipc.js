/**
 * @file src/main/ipc/glossary.ipc.js
 * @description 术语库相关 IPC。
 */

const fs = require('fs');
const path = require('path');
const { dialog, ipcMain } = require('electron');
const { listGlossaries, loadGlossary, saveGlossary, saveGlossaryToPath, importGlossary, deleteGlossary, renameGlossary, exportGlossary, ensureProjectGlossary, loadAggregatedGlossary, listProjectGlossaryMeta, updateGlossaryCategory } = require('../services/glossary/GlossaryService');

/**
 * 注册术语库 IPC。
 */
function registerGlossaryIpc() {
  ipcMain.handle('pick-glossary-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Glossary JSON', extensions: ['json'] }] });
    if (canceled || !filePaths[0]) return null;
    return { ok: true, filePath: filePaths[0] };
  });

  ipcMain.handle('load-glossary', async (_event, payload) => {
    const { project, glossaryName } = payload || {};
    const glossary = await loadGlossary(project, glossaryName || 'default');
    return { ok: true, glossary };
  });

  ipcMain.handle('list-glossaries', async (_event, payload) => {
    const { project } = payload || {};
    const glossaries = await listGlossaries(project);
    return { ok: true, glossaries };
  });

  ipcMain.handle('save-glossary', async (_event, payload) => {
    const { project, glossary, exportName, glossaryName } = payload || {};
    return saveGlossary(project, glossary, glossaryName || exportName || glossary?.glossaryName || glossary?.projectName || 'default');
  });

  ipcMain.handle('save-glossary-as', async (_event, payload) => {
    const { project, glossary, defaultName } = payload || {};
    const safeName = String(defaultName || glossary?.glossaryName || glossary?.projectName || 'glossary').replace(/[\\/:*?"<>|]/g, '_');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存术语库',
      defaultPath: `${safeName}.json`,
      filters: [{ name: 'Glossary JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    if (fs.existsSync(filePath)) {
      const confirm = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['覆盖', '取消'],
        defaultId: 1,
        cancelId: 1,
        title: '确认覆盖术语库',
        message: `目标位置已存在同名术语库文件：${path.basename(filePath)}`,
        detail: '覆盖后原文件内容将被替换，且可能无法恢复。是否继续？',
      });
      if (confirm.response !== 0) return { ok: false, canceled: true, overwriteDenied: true };
    }
    return saveGlossaryToPath(project, glossary, filePath);
  });

  ipcMain.handle('export-glossary-as', async (_event, payload) => {
    const { project, glossary, defaultName } = payload || {};
    const safeName = String(defaultName || glossary?.glossaryName || glossary?.projectName || 'glossary').replace(/[\\/:*?"<>|]/g, '_');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出术语库',
      defaultPath: `${safeName}.json`,
      filters: [{ name: 'Glossary JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    if (fs.existsSync(filePath)) {
      const confirm = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['覆盖', '取消'],
        defaultId: 1,
        cancelId: 1,
        title: '确认覆盖导出文件',
        message: `目标位置已存在同名文件：${path.basename(filePath)}`,
        detail: '覆盖后原文件内容将被替换，且可能无法恢复。是否继续？',
      });
      if (confirm.response !== 0) return { ok: false, canceled: true, overwriteDenied: true };
    }
    return exportGlossary(project, glossary, filePath);
  });

  ipcMain.handle('import-glossary', async (_event, payload) => {
    const { project, filePath } = payload || {};
    return importGlossary(project, filePath);
  });

  ipcMain.handle('delete-glossary', async (_event, payload) => {
    const { project, glossaryName } = payload || {};
    return deleteGlossary(project, glossaryName);
  });

  ipcMain.handle('rename-glossary', async (_event, payload) => {
    const { project, oldName, newName, overwrite } = payload || {};
    return renameGlossary(project, oldName, newName, !!overwrite);
  });

  // 列出项目下所有术语库元信息（含 category），用于分类管理界面
  ipcMain.handle('list-project-glossary-meta', async (_event, payload) => {
    const { project } = payload || {};
    const metas = await listProjectGlossaryMeta(project);
    return { ok: true, metas };
  });

  // 聚合：把项目下同一分类的所有子库 terms 合并，供命中检测与 AI 注入使用
  ipcMain.handle('load-aggregated-glossary', async (_event, payload) => {
    const { project, category, currentGlossary } = payload || {};
    const aggregated = await loadAggregatedGlossary(project, category, currentGlossary || null);
    return { ok: true, aggregated };
  });

  // 修改某术语库的分类标签（保留术语本体不动）
  ipcMain.handle('update-glossary-category', async (_event, payload) => {
    const { project, glossaryName, category } = payload || {};
    return updateGlossaryCategory(project, glossaryName, category);
  });
}

module.exports = { registerGlossaryIpc };
