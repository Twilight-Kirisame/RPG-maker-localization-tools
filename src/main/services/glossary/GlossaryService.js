/**
 * @file src/main/services/glossary/GlossaryService.js
 * @description 术语库 CRUD 与导入导出服务。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ensureDir, toSafeFileName } = require('../../utils/fsUtils');
const { glossaryDirFor, glossaryPathFor } = require('../storage/StorageService');

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
  if (!fs.existsSync(filePath)) return { projectName: path.basename(project?.rootDir || safeGlossaryName), glossaryName: safeGlossaryName, terms: [] };
  try {
    const parsed = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return {
      projectName: parsed?.projectName || path.basename(project?.rootDir || safeGlossaryName),
      glossaryName: parsed?.glossaryName || path.basename(filePath, '.json'),
      terms: Array.isArray(parsed?.terms) ? parsed.terms : [],
    };
  } catch {
    return { projectName: path.basename(project?.rootDir || safeGlossaryName), glossaryName: safeGlossaryName, terms: [] };
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
async function ensureProjectGlossary(project) {
  if (!project?.rootDir) return { projectName: '', glossaryName: 'default', terms: [] };
  const glossaryName = defaultGlossaryNameForProject(project);
  const glossary = await loadGlossary(project, glossaryName);
  const filePath = glossaryPathFor(project, glossaryName);
  if (!fs.existsSync(filePath)) await saveGlossary(project, glossary, glossaryName);
  return { ...glossary, projectName: path.basename(project.rootDir), glossaryName };
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
  const payload = {
    projectName: glossary?.projectName || safeName,
    glossaryName: safeName,
    terms: Array.isArray(glossary?.terms) ? glossary.terms : [],
    updatedAt: new Date().toISOString(),
  };
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: filePath, glossaryName: safeName };
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
    terms: Array.isArray(glossary?.terms) ? glossary.terms : [],
    updatedAt: new Date().toISOString(),
  };
  ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: filePath, glossaryName, glossary: { projectName: payload.projectName, glossaryName, terms: payload.terms } };
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
  const payload = { ...parsed, glossaryName, projectName: parsed?.projectName || glossaryName, terms: Array.isArray(parsed?.terms) ? parsed.terms : [], updatedAt: new Date().toISOString() };
  await fsp.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, path: targetPath, glossaryName, glossary: { projectName: payload.projectName, glossaryName, terms: payload.terms } };
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
    terms: Array.isArray(parsed?.terms) ? parsed.terms : [],
    updatedAt: new Date().toISOString(),
  };
  await fsp.writeFile(newPath, JSON.stringify(payload, null, 2), 'utf8');
  await fsp.unlink(oldPath);
  return { ok: true, oldName: safeOldName, glossaryName: safeNewName, path: newPath, glossary: { projectName: payload.projectName, glossaryName: safeNewName, terms: payload.terms } };
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

module.exports = { listGlossaries, loadGlossary, saveGlossary, saveGlossaryToPath, importGlossary, deleteGlossary, renameGlossary, exportGlossary, detectGlossaryHits, defaultGlossaryNameForProject, ensureProjectGlossary };
