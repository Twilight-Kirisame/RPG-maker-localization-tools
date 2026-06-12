/**
 * @file src/main/ipc/project.ipc.js
 * @description 项目选择、扫描、目录操作 IPC。
 */

const fs = require('fs');
const path = require('path');
const { dialog, ipcMain, shell } = require('electron');
const { detectEngine, collectProjectTexts } = require('../services/project/ProjectTextService');
const { detectGlossaryHits, ensureProjectGlossary } = require('../services/glossary/GlossaryService');
const { loadAiSettings } = require('../services/translation/TranslationService');
const { loadDraft, applyDraftToEntries } = require('../services/export/ExportService');

/**
 * 注册项目相关 IPC。
 */
function registerProjectIpc() {
  ipcMain.handle('pick-project-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (canceled || !filePaths[0]) return null;
    const project = detectEngine(filePaths[0]);
    const glossary = await ensureProjectGlossary(project);
    return { ok: true, ...project, glossary };
  });

  ipcMain.handle('pick-draft-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Draft JSON', extensions: ['json'] }],
    });
    if (canceled || !filePaths[0]) return null;
    return { ok: true, filePath: filePaths[0] };
  });

  ipcMain.handle('pick-theme-image-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (canceled || !filePaths[0]) return null;
    return { ok: true, filePath: filePaths[0] };
  });

  ipcMain.handle('load-draft-file', async (_event, filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, message: '草稿文件不存在' };
    try {
      const draft = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const rootDir = draft?.project?.rootDir || path.dirname(path.dirname(filePath));
      const project = rootDir && fs.existsSync(rootDir) ? collectProjectTexts(rootDir) : { rootDir: rootDir || '', engine: 'unknown', entries: [] };
      const glossary = draft?.glossary || (rootDir ? await ensureProjectGlossary(project) : { projectName: '', glossaryName: 'default', terms: [] });
      const aiSettings = draft?.aiSettings || (rootDir ? await loadAiSettings(project) : { provider: 'deepseek', apiKey: '', baseUrl: '', model: '', prompt: '' });
      const entries = Array.isArray(draft?.entries) ? applyDraftToEntries(project.entries || [], draft.entries) : (project.entries || []);
      const warnings = ['已从草稿文件恢复翻译内容。'];
      return { ok: true, draft, project, glossary, aiSettings, entries, warnings, draftPath: filePath };
    } catch (error) {
      return { ok: false, message: error.message || '草稿文件读取失败' };
    }
  });

  ipcMain.handle('load-project-texts', async (_event, rootDir) => {
    if (!rootDir || !fs.existsSync(rootDir)) {
      return { project: { rootDir: rootDir || '', engine: 'unknown', entries: [] }, glossary: { projectName: '', terms: [], glossaryName: 'default' }, aiSettings: { provider: 'deepseek', apiKey: '', baseUrl: '', model: '', prompt: '' }, entries: [], warnings: ['项目目录不存在或无法访问'] };
    }
    const project = collectProjectTexts(rootDir);
    const glossary = await ensureProjectGlossary(project);
    const aiSettings = await loadAiSettings(project);
    let entries = detectGlossaryHits(project.entries, glossary);
    const draft = await loadDraft(rootDir);
    if (draft?.entries?.length) entries = applyDraftToEntries(entries, draft.entries);
    const warnings = [];
    if (!project.features?.hasDataDir && !project.features?.hasWwwDataDir) warnings.push('未发现标准 data 目录');
    if (!entries.length) warnings.push('未扫描到可提取的文本条目');
    return { project, glossary, aiSettings, entries, warnings };
  });

  ipcMain.handle('open-folder', async (_event, folderPath) => {
    if (!folderPath) return { ok: false, message: '缺少要打开的目录' };
    const result = await shell.openPath(folderPath);
    if (result) return { ok: false, message: result };
    return { ok: true };
  });
}

module.exports = { registerProjectIpc };