/**
 * @file src/main/ipc/project.ipc.js
 * @description 项目选择、扫描、目录操作 IPC。
 */

const fs = require('fs');
const path = require('path');
const { dialog, ipcMain, shell } = require('electron');
const { detectEngine, collectProjectTexts, collectProjectFiles, collectFileTexts } = require('../services/project/ProjectTextService');
const { pickAdapter } = require('../services/engine/registry');
const { detectGlossaryHits, ensureProjectGlossary, loadAggregatedGlossary } = require('../services/glossary/GlossaryService');
const { loadAiSettings } = require('../services/translation/TranslationService');
const { loadDraft, applyDraftToEntries } = require('../services/export/ExportService');
const { calculateGlobalProgress, calculateFileProgress, calculateCurrentFileProgress } = require('../services/localization/ProgressService');
const { loadProjectProgressState, updateLastTranslatedPosition, rebuildProjectProgressState } = require('../services/localization/ProjectProgressStateService');
const { cleanupOnStartup } = require('../services/preview/GamePreviewService');

/**
 * 注册项目相关 IPC。
 */
function normalizeProjectPayload(project = {}, extra = {}) {
  const rootDir = project.rootDir || extra.project?.rootDir || extra.rootDir || '';
  const displayName = project.displayName || extra.project?.displayName || extra.displayName || (project.engine && project.engine !== 'unknown' ? project.engine : 'unknown');
  const engine = project.engine || extra.project?.engine || extra.engine || (project.dataRoots?.length ? 'RPG Maker MV/MZ' : 'unknown');
  const dataRoots = Array.isArray(project.dataRoots) && project.dataRoots.length ? project.dataRoots : (Array.isArray(extra.project?.dataRoots) ? extra.project.dataRoots : (Array.isArray(extra.dataRoots) ? extra.dataRoots : []));
  const files = Array.isArray(project.files) ? project.files : (Array.isArray(extra.project?.files) ? extra.project.files : (Array.isArray(extra.files) ? extra.files : []));
  const useLazyLoad = Boolean(project.useLazyLoad || extra.project?.useLazyLoad || extra.useLazyLoad);
  return {
    ok: true,
    ...extra,
    rootDir,
    engine,
    displayName,
    dataRoots,
    files,
    useLazyLoad,
    project: {
      ...extra.project,
      ...project,
      rootDir,
      engine,
      displayName,
      dataRoots,
      files,
      useLazyLoad,
    },
  };
}

function registerProjectIpc() {
  ipcMain.handle('pick-project-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (canceled || !filePaths[0]) return null;
    const project = detectEngine(filePaths[0]);
    const glossary = await ensureProjectGlossary(project, { createIfMissing: false });
    return normalizeProjectPayload(project, { project, glossary, rootDir: project.rootDir });
  });

  ipcMain.handle('scan-project-data-roots', async (_event, rootDir) => {
    if (!rootDir || !fs.existsSync(rootDir)) return { ok: false, message: '项目目录不存在或无法访问', dataRoots: [] };
    const project = detectEngine(rootDir);
    return normalizeProjectPayload(project, { project, dataRoots: project.dataRoots || [], rootDir });
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
      // 打开项目前先恢复任何残留的预览备份
      if (rootDir && fs.existsSync(rootDir)) await cleanupOnStartup(rootDir);
      let project;
      let useLazyLoad = false;
      if (rootDir && fs.existsSync(rootDir)) {
        const { adapter } = pickAdapter(rootDir);
        if (typeof adapter.listFiles === 'function') {
          const fileListResult = adapter.listFiles(rootDir);
          useLazyLoad = Boolean(fileListResult.useLazyLoad);
          if (useLazyLoad) {
            project = { ...fileListResult, engine: fileListResult.engine || adapter.displayName, adapterId: adapter.id, useLazyLoad: true };
          }
        }
        if (!useLazyLoad) {
          project = collectProjectTexts(rootDir);
        }
      } else {
        project = { rootDir: rootDir || '', engine: 'unknown', entries: [] };
      }
      const glossary = draft?.glossary || (rootDir ? await ensureProjectGlossary(project) : { projectName: '', glossaryName: 'default', category: 'default', terms: [] });
      // 草稿加载也要把同分类的聚合术语集一并算好，后续命中检测与 AI 注入才能命中所有子库
      const aggregatedGlossary = rootDir ? await loadAggregatedGlossary(project, glossary?.category, glossary) : { category: 'default', terms: [], contributingGlossaries: [] };
      const aiSettings = draft?.aiSettings || (rootDir ? await loadAiSettings() : { provider: 'deepseek', apiKey: '', baseUrl: '', model: '', prompt: '' });
      const warnings = ['已从草稿文件恢复翻译内容。'];

      if (useLazyLoad) {
        const previousProgressState = await loadProjectProgressState(project);
        const progressState = await rebuildProjectProgressState(project, [], previousProgressState);
        return { ok: true, draft, project, glossary, aggregatedGlossary, aiSettings, entries: [], warnings, draftPath: filePath, progressState, fileProgress: [], globalProgress: null, currentFileProgress: null, groups: [], useLazyLoad: true };
      }

      const entries = Array.isArray(draft?.entries) ? applyDraftToEntries(project.entries || [], draft.entries) : (project.entries || []);
      const progressState = await rebuildProjectProgressState(project, entries, draft?.progressState || draft?.projectProgressState || null);
      const fileProgress = calculateFileProgress(entries);
      const globalProgress = calculateGlobalProgress(entries);
      const currentFileProgress = calculateCurrentFileProgress(entries, entries[0]?.file || '');
      return { ok: true, draft, project, glossary, aggregatedGlossary, aiSettings, entries, warnings, draftPath: filePath, progressState, fileProgress, globalProgress, currentFileProgress, groups: project.groups || [] };
    } catch (error) {
      return { ok: false, message: error.message || '草稿文件读取失败' };
    }
  });

  ipcMain.handle('load-project-texts', async (_event, rootDir) => {
    if (!rootDir || !fs.existsSync(rootDir)) {
      const project = { rootDir: rootDir || '', engine: 'unknown', displayName: 'unknown', entries: [], dataRoots: [] };
      return { project, glossary: { projectName: '', terms: [], glossaryName: 'default' }, aiSettings: { provider: 'deepseek', apiKey: '', baseUrl: '', model: '', prompt: '' }, entries: [], warnings: ['项目目录不存在或无法访问'] };
    }
    // 打开项目前先恢复任何残留的预览备份
    await cleanupOnStartup(rootDir);
    const { adapter, probe, fallback } = pickAdapter(rootDir);
    let project;
    let useLazyLoad = false;
    let lazyFiles = [];
    // 若适配器支持文件级扫描，先评估是否启用懒加载
    if (typeof adapter.listFiles === 'function') {
      const fileListResult = adapter.listFiles(rootDir);
      lazyFiles = Array.isArray(fileListResult.files) ? fileListResult.files : [];
      useLazyLoad = Boolean(fileListResult.useLazyLoad);
      if (useLazyLoad) {
        project = { ...fileListResult, engine: fileListResult.engine || adapter.displayName, adapterId: adapter.id, useLazyLoad: true };
      }
    }
    if (!useLazyLoad) {
      project = adapter.extract(rootDir);
    }
    project.engine = project.engine || adapter.displayName;
    project.adapterId = adapter.id;
    const glossary = await ensureProjectGlossary(project);
    const aggregated = await loadAggregatedGlossary(project, glossary?.category, glossary);
    const aiSettings = await loadAiSettings(project);
    const warnings = [];
    if (fallback) warnings.push('未识别引擎类型，已回退到 RPG Maker 适配器');
    else warnings.push(`已识别引擎：${adapter.displayName}（置信度 ${(probe.confidence * 100).toFixed(0)}%）`);
    if (Array.isArray(project.warnings) && project.warnings.length) warnings.push(...project.warnings);
    if (!project.dataRoots?.length && adapter.id === 'rpgmaker-mvmz') warnings.push('未自动发现可扫描的数据目录');

    if (useLazyLoad) {
      const previousProgressState = await loadProjectProgressState(project);
      const progressState = await rebuildProjectProgressState(project, [], previousProgressState);
      if (!lazyFiles.length) warnings.push('未扫描到可提取的文本文件');
      return normalizeProjectPayload(project, { project, glossary, aggregatedGlossary: aggregated, aiSettings, entries: [], warnings, progressState, fileProgress: [], globalProgress: null, currentFileProgress: null, groups: [], rootDir });
    }

    let entries = detectGlossaryHits(project.entries || [], aggregated);
    const draft = await loadDraft(rootDir);
    if (draft?.entries?.length) entries = applyDraftToEntries(entries, draft.entries);
    const previousProgressState = await loadProjectProgressState(project);
    const progressState = await rebuildProjectProgressState(project, entries, previousProgressState);
    const fileProgress = calculateFileProgress(entries);
    const globalProgress = calculateGlobalProgress(entries);
    const currentFileProgress = calculateCurrentFileProgress(entries, entries[0]?.file || '');
    if (!entries.length) warnings.push('未扫描到可提取的文本条目');
    return normalizeProjectPayload(project, { project, glossary, aggregatedGlossary: aggregated, aiSettings, entries, warnings, progressState, fileProgress, globalProgress, currentFileProgress, groups: project.groups || [], rootDir });
  });

  ipcMain.handle('load-project-file-list', async (_event, rootDir) => {
    if (!rootDir || !fs.existsSync(rootDir)) {
      return { ok: false, files: [], warnings: ['项目目录不存在或无法访问'] };
    }
    const { adapter } = pickAdapter(rootDir);
    if (typeof adapter.listFiles !== 'function') {
      return { ok: false, files: [], warnings: ['当前引擎不支持文件级懒加载'] };
    }
    const result = adapter.listFiles(rootDir);
    return { ok: true, files: result.files || [], useLazyLoad: Boolean(result.useLazyLoad), warnings: result.warnings || [] };
  });

  ipcMain.handle('load-file-entries', async (_event, rootDir, filePath) => {
    if (!rootDir || !fs.existsSync(rootDir) || !filePath) {
      return { ok: false, file: filePath || '', entries: [], groups: [], warnings: ['参数错误'] };
    }
    const { adapter } = pickAdapter(rootDir);
    if (typeof adapter.extractFile !== 'function') {
      return { ok: false, file: filePath, entries: [], groups: [], warnings: ['当前引擎不支持按文件提取'] };
    }
    const fileResult = adapter.extractFile(rootDir, filePath);
    if (!fileResult.ok) return fileResult;
    const glossary = await ensureProjectGlossary({ rootDir });
    const aggregated = await loadAggregatedGlossary({ rootDir }, glossary?.category, glossary);
    let entries = detectGlossaryHits(fileResult.entries || [], aggregated);
    const draft = await loadDraft(rootDir);
    if (draft?.entries?.length) entries = applyDraftToEntries(entries, draft.entries);
    const fileProgress = calculateFileProgress(entries);
    return { ok: true, file: filePath, entries, groups: fileResult.groups || [], warnings: fileResult.warnings || [], fileProgress };
  });

  ipcMain.handle('save-project-last-position', async (_event, payload = {}) => {
    const project = payload.project || { rootDir: payload.rootDir || '' };
    return updateLastTranslatedPosition(project, payload.entry, { index: payload.index });
  });

  ipcMain.handle('load-project-progress-state', async (_event, project = {}) => loadProjectProgressState(project));

  ipcMain.handle('open-folder', async (_event, folderPath) => {
    if (!folderPath) return { ok: false, message: '缺少要打开的目录' };
    const result = await shell.openPath(folderPath);
    if (result) return { ok: false, message: result };
    return { ok: true };
  });
}

module.exports = { registerProjectIpc };