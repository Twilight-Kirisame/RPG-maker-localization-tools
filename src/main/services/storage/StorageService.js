/**
 * @file src/main/services/storage/StorageService.js
 * @description 应用数据与项目数据存储路径服务。
 */

const path = require('path');
const { app } = require('electron');
const { ensureDir, toSafeFileName } = require('../../utils/fsUtils');

/**
 * 返回项目级存储文件路径。
 * @param {Object} project
 * @param {string} fileName
 * @returns {string}
 */
function projectStoragePath(project, fileName) {
  const base = path.join(app.getPath('userData'), 'projects');
  ensureDir(base);
  const slug = toSafeFileName(project?.rootDir || 'default');
  return path.join(base, `${slug}.${fileName}`);
}

function appStoragePath(fileName) {
  const base = path.join(app.getPath('userData'), 'app');
  ensureDir(base);
  return path.join(base, fileName);
}

/**
 * 返回术语库目录。
 * @param {Object} project
 * @returns {string}
 */
function glossaryDirFor(project) {
  const dir = project?.rootDir
    ? path.join(project.rootDir, 'localization_glossaries')
    : path.join(app.getPath('userData'), 'projects', toSafeFileName(project?.rootDir || 'default'), 'glossaries');
  ensureDir(dir);
  return dir;
}

/**
 * 返回术语库文件路径。
 * @param {Object} project
 * @param {string} glossaryName
 * @returns {string}
 */
function glossaryPathFor(project, glossaryName = 'default') {
  return path.join(glossaryDirFor(project), `${toSafeFileName(glossaryName || 'default')}.json`);
}

/**
 * 返回翻译草稿目录。
 * @param {Object} project
 * @returns {string}
 */
function draftDirFor(project) {
  const customDir = project?.draftDir ? path.resolve(project.draftDir) : '';
  if (customDir) {
    ensureDir(customDir);
    return customDir;
  }
  const dir = project?.rootDir
    ? path.join(project.rootDir, 'localization_drafts')
    : path.join(app.getPath('userData'), 'projects', toSafeFileName(project?.rootDir || 'default'), 'drafts');
  ensureDir(dir);
  return dir;
}

/**
 * 返回翻译草稿文件路径。
 * @param {Object} project
 * @param {string} draftName
 * @returns {string}
 */
function draftPathFor(project, draftName = 'work-draft') {
  return path.join(draftDirFor(project), `${toSafeFileName(draftName || 'work-draft')}.json`);
}

module.exports = { projectStoragePath, appStoragePath, glossaryDirFor, glossaryPathFor, draftDirFor, draftPathFor };
