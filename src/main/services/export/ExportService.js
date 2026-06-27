/**
 * @file src/main/services/export/ExportService.js
 * @description 草稿与补丁导出服务。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ensureDir } = require('../../utils/fsUtils');
const { projectStoragePath, draftDirFor, draftPathFor } = require('../storage/StorageService');

/**
 * 构建补丁 manifest。
 * @param {Object} project
 * @param {Object[]} entries
 * @param {Object} glossary
 * @returns {Object}
 */
function buildPatchManifest(project, entries, glossary) {
  const changedEntries = entries.filter((entry) => entry.target && entry.target !== entry.source);
  return {
    schema: 'rpg-localization-patch/v1',
    project: { rootDir: project.rootDir, engine: project.engine },
    generatedAt: new Date().toISOString(),
    entryCount: changedEntries.length,
    glossary: { projectName: glossary?.projectName || '', termCount: glossary?.terms?.length || 0 },
    entries: changedEntries.map((entry) => ({ file: entry.file, key: entry.key, source: entry.source, target: entry.target, kind: entry.kind, code: entry.code, path: entry.path, glossaryHits: (entry.glossaryHits || []).map((term) => term.source) })),
  };
}

/**
 * 导出补丁文件。
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function exportPatchFiles(payload) {
  const { project, entries, glossary } = payload || {};
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const outDir = path.join(project.rootDir, 'localization_patch');
  ensureDir(outDir);
  ensureDir(path.join(outDir, 'translations'));
  const manifest = buildPatchManifest(project, entries || [], glossary || { terms: [] });
  await fsp.writeFile(path.join(outDir, 'patch-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  const grouped = new Map();
  manifest.entries.forEach((entry) => {
    if (!grouped.has(entry.file)) grouped.set(entry.file, []);
    grouped.get(entry.file).push(entry);
  });
  for (const [file, items] of grouped.entries()) {
    const safeFile = file.replace(/[\\/:*?"<>|]/g, '_');
    await fsp.writeFile(path.join(outDir, 'translations', `${safeFile}.json`), JSON.stringify(items, null, 2), 'utf8');
  }
  return { ok: true, outputDir: outDir, entryCount: manifest.entries.length };
}

/**
 * 构建草稿对象。
 * @param {Object} project
 * @param {Object[]} entries
 * @param {Object} glossary
 * @param {Object} aiSettings
 * @returns {Object}
 */
function buildDraft(project, entries, glossary, aiSettings, progressState = null, groups = []) {
  return {
    schema: 'rpg-localization-draft/v2',
    project: { rootDir: project.rootDir, engine: project.engine },
    exportedAt: new Date().toISOString(),
    glossary,
    aiSettings,
    progressState,
    groups,
    entries: entries.map((e) => {
      const target = String(e.targetDraft ?? e.target ?? '');
      const status = e.translationStatus || e.draftStatus || e.status?.translation || (target.trim() ? 'translated' : 'pending');
      return {
        file: e.file,
        key: e.key,
        source: e.source,
        target,
        targetDraft: target,
        kind: e.kind,
        code: e.code,
        path: e.path,
        textClass: e.textClass,
        textType: e.textType,
        groupId: e.groupId,
        segmentIndex: e.segmentIndex,
        segmentCount: e.segmentCount,
        warnings: e.warnings || [],
        glossaryHits: (e.glossaryHits || []).map((t) => t.source),
        status,
      };
    }),
  };
}

/**
 * 保存草稿。
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function saveDraft(payload) {
  const { project, entries, glossary, aiSettings, progressState, groups } = payload || {};
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const outDir = draftDirFor(project);
  ensureDir(outDir);
  const filePath = draftPathFor(project, 'work-draft');
  await fsp.writeFile(filePath, JSON.stringify(buildDraft(project, entries || [], glossary || { terms: [] }, aiSettings || {}, progressState || null, groups || []), null, 2), 'utf8');
  return { ok: true, path: filePath, outputDir: outDir };
}

/**
 * 加载工作草稿。
 * @param {string} rootDir
 * @returns {Promise<Object|null>}
 */
async function loadDraft(rootDir) {
  const draftPath = draftPathFor({ rootDir }, 'work-draft');
  const legacyExportDraft = path.join(rootDir, 'localization_exports', 'work-draft.json');
  const localDraft = projectStoragePath({ rootDir }, 'work-draft.json');
  const filePath = fs.existsSync(draftPath) ? draftPath : (fs.existsSync(legacyExportDraft) ? legacyExportDraft : localDraft);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 将草稿应用到条目。
 * @param {Object[]} entries
 * @param {Object[]} draftEntries
 * @returns {Object[]}
 */
function applyDraftToEntries(entries, draftEntries) {
  const index = new Map((draftEntries || []).map((entry) => [`${entry.file}::${entry.key}`, entry]));
  return entries.map((entry) => {
    const matched = index.get(`${entry.file}::${entry.key}`);
    if (!matched) return entry;
    const target = String(matched.targetDraft ?? matched.target ?? '');
    const status = matched.status || (target.trim() ? 'translated' : 'pending');
    return { ...entry, target, targetDraft: target, glossaryHits: entry.glossaryHits || [], draftStatus: status, translationStatus: status };
  });
}

module.exports = { exportPatchFiles, saveDraft, loadDraft, applyDraftToEntries };
