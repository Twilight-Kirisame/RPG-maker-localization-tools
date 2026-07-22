/**
 * @file src/main/services/glossary/GlossaryService.js
 * @description 术语库 CRUD 与导入导出服务。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ensureDir, toSafeFileName } = require('../../utils/fsUtils');
const { glossaryDirFor, glossaryPathFor } = require('../storage/StorageService');

// 默认分类名：当术语库文件未显式指定 category 时按此归类。命中时同一项目下、category 相同的
// 所有子库会被聚合参与匹配；不同项目天然由 glossaryDirFor 的目录边界隔离，不会互相污染。
const DEFAULT_CATEGORY = 'default';

function normalizeCategory(category) {
  const value = String(category ?? '').trim();
  return value || DEFAULT_CATEGORY;
}

/**
 * 列出项目术语库。
 * @param {Object} project
 * @returns {Promise<string[]>}
 */
async function listGlossaries(project) {
  const dir = glossaryDirFor(project);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.json')).map((file) => path.basename(file, '.json'));
}

/**
 * 加载术语库。
 * @param {Object} project
 * @param {string} glossaryName
 * @returns {Promise<Object>}
 */
async function loadGlossary(project, glossaryName = 'default') {
  const safeGlossaryName = toSafeFileName(glossaryName || path.basename(project?.rootDir || 'default'));
  const filePath = glossaryPathFor(project, safeGlossaryName);
  if (!fs.existsSync(filePath)) return { projectName: path.basename(project?.rootDir || safeGlossaryName), glossaryName: safeGlossaryName, category: DEFAULT_CATEGORY, terms: [] };
  try {
    const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return {
      projectName: parsed?.projectName || path.basename(project?.rootDir || safeGlossaryName),
      glossaryName: parsed?.glossaryName || path.basename(filePath, '.json'),
      category: normalizeCategory(parsed?.category),
      terms: Array.isArray(parsed?.terms) ? parsed.terms : [],
    };
  } catch {
    return { projectName: path.basename(project?.rootDir || safeGlossaryName), glossaryName: safeGlossaryName, category: DEFAULT_CATEGORY, terms: [] };
  }
}

/**
 * 获取项目默认术语库名称。
 * @param {Object} project
 * @returns {string}
 */
function defaultGlossaryNameForProject(project) {
  return toSafeFileName(path.basename(project?.rootDir || 'default'));
}

/**
 * 确保项目同名术语库存在并返回它。
 * @param {Object} project
 * @returns {Promise<Object>}
 */
async function ensureProjectGlossary(project, { createIfMissing = false } = {}) {
  if (!project?.rootDir) return { projectName: '', glossaryName: 'default', category: DEFAULT_CATEGORY, terms: [] };
  const glossaryName = defaultGlossaryNameForProject(project);
  const glossary = await loadGlossary(project, glossaryName);
  const filePath = glossaryPathFor(project, glossaryName);
  if (createIfMissing && !fs.existsSync(filePath)) await saveGlossary(project, glossary, glossaryName);
  return { ...glossary, projectName: path.basename(project.rootDir), glossaryName, category: normalizeCategory(glossary?.category), exists: fs.existsSync(filePath) };
}

/**
 * 保存术语库到项目工作目录。
 * @param {Object} project
 * @param {Object} glossary
 * @param {string} glossaryName
 * @returns {Promise<Object>}
 */
async function saveGlossary(project, glossary, glossaryName = 'default') {
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const safeName = toSafeFileName(glossaryName || glossary?.glossaryName || glossary?.projectName || 'default');
  const filePath = glossaryPathFor(project, safeName);
  // 术语库文件里的 projectName 应当反映项目目录名；若传入为空，兜底到项目目录名，避免 UI 上"项目名闪一下后重置为空"或显示成术语库名。
  const projectNameFromRoot = path.basename(project.rootDir);
  const payload = {
    projectName: glossary?.projectName || projectNameFromRoot,
    glossaryName: safeName,
    category: normalizeCategory(glossary?.category),
    terms: Array.isArray(glossary?.terms) ? glossary.terms : [],
    updatedAt: new Date().toISOString(),
  };
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: filePath, glossaryName: safeName, category: payload.category, glossary: { projectName: payload.projectName, glossaryName: safeName, category: payload.category, terms: payload.terms } };
}

/**
 * 保存术语库到指定文件路径。
 * @param {Object} project
 * @param {Object} glossary
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
async function saveGlossaryToPath(project, glossary, filePath) {
  if (!filePath) throw new Error('缺少保存路径');
  const glossaryName = toSafeFileName(path.basename(filePath, path.extname(filePath)) || glossary?.glossaryName || 'default');
  const payload = {
    projectName: glossary?.projectName || path.basename(project?.rootDir || glossaryName),
    glossaryName,
    category: normalizeCategory(glossary?.category),
    terms: Array.isArray(glossary?.terms) ? glossary.terms : [],
    updatedAt: new Date().toISOString(),
  };
  ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: filePath, glossaryName, glossary: { projectName: payload.projectName, glossaryName, category: payload.category, terms: payload.terms } };
}

/**
 * 导出术语库到项目 localization_exports。
 * @param {Object} project
 * @param {Object} glossary
 * @param {string} name
 * @returns {Promise<Object>}
 */
async function exportGlossary(project, glossary, target) {
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const isFilePath = target && (path.isAbsolute(target) || path.extname(target));
  const safe = toSafeFileName(isFilePath ? path.basename(target, path.extname(target)) : (target || glossary?.glossaryName || glossary?.projectName || 'glossary'));
  const filePath = isFilePath ? target : path.join(project.rootDir, 'localization_exports', `${safe}.json`);
  ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify({ name: safe, projectRoot: project.rootDir, exportedAt: new Date().toISOString(), terms: Array.isArray(glossary?.terms) ? glossary.terms : [] }, null, 2), 'utf8');
  return { ok: true, path: filePath };
}

/**
 * 导入外部术语库。
 * @param {Object} project
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
async function importGlossary(project, filePath) {
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
  const glossaryName = toSafeFileName(parsed?.glossaryName || parsed?.projectName || path.basename(filePath, '.json') || 'default');
  const targetPath = glossaryPathFor(project, glossaryName);
  // 导入外部术语库时，projectName 应跟随当前项目目录名，避免显示成旧项目名或文件名。
  const projectNameFromRoot = path.basename(project.rootDir);
  const payload = { ...parsed, glossaryName, projectName: parsed?.projectName || projectNameFromRoot, category: normalizeCategory(parsed?.category), terms: Array.isArray(parsed?.terms) ? parsed.terms : [], updatedAt: new Date().toISOString() };
  await fsp.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: targetPath, glossaryName, glossary: { projectName: payload.projectName, glossaryName, category: payload.category, terms: payload.terms } };
}

/**
 * 删除术语库。
 * @param {Object} project
 * @param {string} glossaryName
 * @returns {Promise<Object>}
 */
async function deleteGlossary(project, glossaryName = 'default') {
  const filePath = glossaryPathFor(project, glossaryName);
  if (fs.existsSync(filePath)) await fsp.unlink(filePath);
  return { ok: true, path: filePath };
}

/**
 * 重命名术语库。
 * @param {Object} project
 * @param {string} oldName
 * @param {string} newName
 * @param {boolean} overwrite
 * @returns {Promise<Object>}
 */
async function renameGlossary(project, oldName = 'default', newName = 'default', overwrite = false) {
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const safeOldName = toSafeFileName(oldName || 'default');
  const safeNewName = toSafeFileName(newName || 'default');
  if (!safeNewName) throw new Error('新术语库名称不能为空');
  const oldPath = glossaryPathFor(project, safeOldName);
  const newPath = glossaryPathFor(project, safeNewName);
  if (!fs.existsSync(oldPath)) throw new Error(`术语库不存在：${safeOldName}`);
  if (oldPath === newPath) {
    const glossary = await loadGlossary(project, safeNewName);
    return { ok: true, path: newPath, glossaryName: safeNewName, glossary };
  }
  if (fs.existsSync(newPath) && !overwrite) throw new Error(`目标术语库已存在：${safeNewName}`);
  const parsed = JSON.parse(await fsp.readFile(oldPath, 'utf8'));
  const payload = {
    ...parsed,
    projectName: parsed?.projectName || path.basename(project.rootDir),
    glossaryName: safeNewName,
    category: normalizeCategory(parsed?.category),
    terms: Array.isArray(parsed?.terms) ? parsed.terms : [],
    updatedAt: new Date().toISOString(),
  };
  await fsp.writeFile(newPath, JSON.stringify(payload, null, 2), 'utf8');
  await fsp.unlink(oldPath);
  return { ok: true, oldName: safeOldName, glossaryName: safeNewName, path: newPath, glossary: { projectName: payload.projectName, glossaryName: safeNewName, category: payload.category, terms: payload.terms } };
}

/**
 * 计算术语命中。
 * @param {Object[]} entries
 * @param {Object} glossary
 * @returns {Object[]}
 */
function detectGlossaryHits(entries, glossary) {
  const terms = glossary?.terms || [];
  return entries.map((entry) => ({ ...entry, glossaryHits: terms.filter((term) => term.enabled !== false && term.source && entry.source.includes(term.source)) }));
}

/**
 * 读取项目目录下所有术语库文件元信息（不含 terms，便于做轻量列表）。
 * @param {Object} project
 * @returns {Promise<Array<{glossaryName, category, projectName, termCount, filePath}>>}
 */
async function listProjectGlossaryMeta(project) {
  const dir = glossaryDirFor(project);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.json'));
  const metas = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    const name = path.basename(file, '.json');
    try {
      const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
      metas.push({
        glossaryName: parsed?.glossaryName || name,
        category: normalizeCategory(parsed?.category),
        projectName: parsed?.projectName || name,
        termCount: Array.isArray(parsed?.terms) ? parsed.terms.length : 0,
        filePath,
      });
    } catch {
      metas.push({ glossaryName: name, category: DEFAULT_CATEGORY, projectName: name, termCount: 0, filePath });
    }
  }
  return metas;
}

/**
 * 聚合项目内同一分类下所有子术语库的词条。命中检测时调用本函数得到合并后的词条数组，
 * 使得多个子库（如「角色名」「物品名」）只要分类相同就能同时参与命中。
 * 跨项目天然由 glossaryDirFor 的目录边界隔离，不会互相污染。
 *
 * 去重策略：以 source 为键，先来者优先（保留先出现的译文与备注）。来源 glossary 顺序按文件名排序。
 * 当传入 currentGlossary 时，优先把它放在最前面，以便用户在当前编辑库里覆盖更老的译名。
 *
 * @param {Object} project
 * @param {string} category — 期望聚合的分类名；空 / 'default' / 大小写归一后等价
 * @param {Object} [currentGlossary] — 当前编辑中的术语库（未必落盘）；若提供则优先生效
 * @returns {Promise<{category, terms, contributingGlossaries}>}
 */
async function loadAggregatedGlossary(project, category, currentGlossary = null) {
  const targetCategory = normalizeCategory(category);
  const metas = await listProjectGlossaryMeta(project);
  const matched = metas
    .filter((meta) => meta.category === targetCategory)
    .sort((a, b) => String(a.glossaryName).localeCompare(String(b.glossaryName)));
  const contributors = [];
  const merged = [];
  const seen = new Set();

  const ingestTerms = (terms, sourceLabel) => {
    let added = 0;
    (terms || []).forEach((term) => {
      if (!term || !term.source) return;
      const key = String(term.source);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({ ...term, __sourceGlossary: sourceLabel });
      added += 1;
    });
    return added;
  };

  // 当前编辑中的库优先：用户刚加的术语在保存到文件前就该参与命中
  if (currentGlossary && normalizeCategory(currentGlossary.category) === targetCategory) {
    const name = currentGlossary.glossaryName || 'current';
    const added = ingestTerms(currentGlossary.terms || [], name);
    contributors.push({ glossaryName: name, category: targetCategory, termCount: (currentGlossary.terms || []).length, addedCount: added, isCurrent: true });
  }

  for (const meta of matched) {
    if (currentGlossary && (currentGlossary.glossaryName || '') === meta.glossaryName) continue; // 已优先注入
    try {
      const parsed = JSON.parse(await fsp.readFile(meta.filePath, 'utf8'));
      const added = ingestTerms(parsed?.terms || [], meta.glossaryName);
      contributors.push({ glossaryName: meta.glossaryName, category: meta.category, termCount: meta.termCount, addedCount: added, isCurrent: false });
    } catch {
      contributors.push({ glossaryName: meta.glossaryName, category: meta.category, termCount: 0, addedCount: 0, isCurrent: false, error: 'read-failed' });
    }
  }

  return {
    category: targetCategory,
    terms: merged,
    contributingGlossaries: contributors,
  };
}

/**
 * 修改某术语库的分类标签（不改名、不动 terms），用于"把它移入/移出某个分类"。
 * @param {Object} project
 * @param {string} glossaryName
 * @param {string} nextCategory
 */
async function updateGlossaryCategory(project, glossaryName, nextCategory) {
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const safeName = toSafeFileName(glossaryName || 'default');
  const filePath = glossaryPathFor(project, safeName);
  if (!fs.existsSync(filePath)) throw new Error(`术语库不存在：${safeName}`);
  const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
  const payload = {
    ...parsed,
    glossaryName: safeName,
    category: normalizeCategory(nextCategory),
    terms: Array.isArray(parsed?.terms) ? parsed.terms : [],
    updatedAt: new Date().toISOString(),
  };
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, glossaryName: safeName, category: payload.category };
}

module.exports = { listGlossaries, loadGlossary, saveGlossary, saveGlossaryToPath, importGlossary, deleteGlossary, renameGlossary, exportGlossary, detectGlossaryHits, defaultGlossaryNameForProject, ensureProjectGlossary, listProjectGlossaryMeta, loadAggregatedGlossary, updateGlossaryCategory, DEFAULT_CATEGORY };
