/**
 * @file src/main/services/storage/ProjectSettingsService.js
 * @description 项目级设置持久化（如自定义草稿目录）。
 */

const fs = require('fs');
const fsp = fs.promises;
const { projectStoragePath } = require('./StorageService');

/**
 * 加载项目级设置。
 * @param {Object} project
 * @returns {Promise<Object>}
 */
async function loadProjectSettings(project) {
  const filePath = projectStoragePath(project, 'project-settings.json');
  if (!fs.existsSync(filePath)) return {};
  try {
    const json = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return json && typeof json === 'object' ? json : {};
  } catch {
    return {};
  }
}

/**
 * 保存项目级设置。
 * @param {Object} project
 * @param {Object} settings
 * @returns {Promise<Object>}
 */
async function saveProjectSettings(project, settings = {}) {
  const filePath = projectStoragePath(project, 'project-settings.json');
  const prev = await loadProjectSettings(project);
  const next = { ...prev, ...settings, updatedAt: new Date().toISOString() };
  await fsp.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, path: filePath, settings: next };
}

/**
 * 读取自定义草稿目录（未设置返回空字符串）。
 * @param {Object} project
 * @returns {Promise<string>}
 */
async function getProjectDraftDir(project) {
  const settings = await loadProjectSettings(project);
  return settings?.draftDir || '';
}

module.exports = { loadProjectSettings, saveProjectSettings, getProjectDraftDir };
