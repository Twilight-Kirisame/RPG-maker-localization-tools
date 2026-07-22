/**
 * @file src/main/services/autoSave/AutoSaveService.js
 * @description 术语库与译文草稿自动保存服务。
 *
 * 行为约定：
 *  - 自动保存默认写入手动保存的同级目录，但文件名带 auto-save 前缀以作区分。
 *  - 用户可在设置中指定自定义目录；自定义目录下会分别生成 auto-save-draft.json
 *    与 auto-save-glossary.json。
 *  - 新的自动保存始终覆盖旧的自动保存文件。
 *  - 保存格式与手动导出保持一致，便于灾难恢复。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ensureDir, toSafeFileName } = require('../../utils/fsUtils');
const { draftDirFor, glossaryDirFor } = require('../storage/StorageService');
const { buildDraft } = require('../export/ExportService');

const DEFAULT_DRAFT_NAME = 'auto-save.json';
const DEFAULT_GLOSSARY_NAME = 'auto-save-glossary.json';
const CUSTOM_DRAFT_NAME = 'auto-save-draft.json';
const CUSTOM_GLOSSARY_NAME = 'auto-save-glossary.json';

/**
 * 计算自动保存路径。
 * @param {Object} project
 * @param {string} [customDir]
 * @returns {{draftPath:string, glossaryPath:string}}
 */
function resolveAutoSavePaths(project, customDir = '') {
  const custom = String(customDir || '').trim();
  if (custom) {
    ensureDir(custom);
    return {
      draftPath: path.join(custom, CUSTOM_DRAFT_NAME),
      glossaryPath: path.join(custom, CUSTOM_GLOSSARY_NAME),
    };
  }
  return {
    draftPath: path.join(draftDirFor(project), DEFAULT_DRAFT_NAME),
    glossaryPath: path.join(glossaryDirFor(project), DEFAULT_GLOSSARY_NAME),
  };
}

/**
 * 保存自动保存草稿。
 * @param {Object} payload
 * @returns {Promise<{ok:boolean, path?:string, error?:string}>}
 */
async function autoSaveDraft(payload) {
  const { project, entries, glossary, aiSettings, progressState, groups, autoSaveDir } = payload || {};
  if (!project?.rootDir) return { ok: false, error: '缺少项目根目录' };
  try {
    const { draftPath } = resolveAutoSavePaths(project, autoSaveDir);
    ensureDir(path.dirname(draftPath));
    const draft = buildDraft(
      project,
      Array.isArray(entries) ? entries : [],
      glossary || { terms: [] },
      aiSettings || {},
      progressState || null,
      Array.isArray(groups) ? groups : []
    );
    draft.autoSave = true;
    draft.autoSavedAt = new Date().toISOString();
    await fsp.writeFile(draftPath, JSON.stringify(draft, null, 2), 'utf8');
    return { ok: true, path: draftPath };
  } catch (error) {
    return { ok: false, error: error.message || '自动保存草稿失败' };
  }
}

/**
 * 保存自动保存术语库。
 * @param {Object} payload
 * @returns {Promise<{ok:boolean, path?:string, error?:string}>}
 */
async function autoSaveGlossary(payload) {
  const { project, glossary, autoSaveDir } = payload || {};
  if (!project?.rootDir) return { ok: false, error: '缺少项目根目录' };
  try {
    const { glossaryPath } = resolveAutoSavePaths(project, autoSaveDir);
    ensureDir(path.dirname(glossaryPath));
    const safeName = toSafeFileName(glossary?.glossaryName || path.basename(project.rootDir) || 'default');
    // projectName 应以项目目录名为准；仅在前端未传入且无法取得目录名时才用 safeName 兜底。
    const projectNameFromRoot = path.basename(project.rootDir);
    const payload = {
      projectName: glossary?.projectName || projectNameFromRoot,
      glossaryName: safeName,
      category: String(glossary?.category || '').trim() || 'default',
      terms: Array.isArray(glossary?.terms) ? glossary.terms : [],
      autoSave: true,
      autoSavedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fsp.writeFile(glossaryPath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, path: glossaryPath };
  } catch (error) {
    return { ok: false, error: error.message || '自动保存术语库失败' };
  }
}

/**
 * 同时执行草稿与术语库自动保存。
 * @param {Object} payload
 * @returns {Promise<{ok:boolean, draft?:Object, glossary?:Object, errors:string[]}>}
 */
async function autoSaveAll(payload) {
  const errors = [];
  const [draftResult, glossaryResult] = await Promise.all([
    autoSaveDraft(payload).catch((e) => ({ ok: false, error: e.message })),
    autoSaveGlossary(payload).catch((e) => ({ ok: false, error: e.message })),
  ]);
  if (!draftResult.ok) errors.push(draftResult.error);
  if (!glossaryResult.ok) errors.push(glossaryResult.error);
  return {
    ok: errors.length === 0,
    draft: draftResult.ok ? { path: draftResult.path } : null,
    glossary: glossaryResult.ok ? { path: glossaryResult.path } : null,
    errors,
  };
}

module.exports = { autoSaveDraft, autoSaveGlossary, autoSaveAll, resolveAutoSavePaths };
