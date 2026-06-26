/**
 * @file src/main/services/localization/ProjectProgressStateService.js
 * @description 项目翻译进度状态持久化。
 */

const fs = require('fs');
const fsp = fs.promises;
const { projectStoragePath } = require('../storage/StorageService');
const { calculateGlobalProgress, calculateFileProgress } = require('./ProgressService');

function defaultState(project = {}) {
  return {
    version: '1.0',
    projectRoot: project.rootDir || '',
    updatedAt: '',
    global: {
      total: 0,
      translated: 0,
      percent: 0,
      lastTranslatedFile: '',
      lastTranslatedEntryId: '',
      lastTranslatedIndex: -1,
      lastTranslatedKey: '',
      lastTranslatedSource: '',
      lastTranslatedTarget: '',
      lastTranslatedAt: '',
    },
    files: {},
  };
}

function normalizeState(project, state = {}) {
  return {
    ...defaultState(project),
    ...(state || {}),
    projectRoot: state.projectRoot || project?.rootDir || '',
    global: { ...defaultState(project).global, ...(state.global || {}) },
    files: state.files && typeof state.files === 'object' ? state.files : {},
  };
}

async function loadProjectProgressState(project) {
  const filePath = projectStoragePath(project, 'project-progress-state.json');
  if (!fs.existsSync(filePath)) return defaultState(project);
  try {
    const json = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    return normalizeState(project, json);
  } catch {
    return defaultState(project);
  }
}

async function saveProjectProgressState(project, state) {
  const filePath = projectStoragePath(project, 'project-progress-state.json');
  const next = normalizeState(project, { ...(state || {}), updatedAt: new Date().toISOString() });
  await fsp.writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, path: filePath, state: next };
}

async function updateLastTranslatedPosition(project, entry, extra = {}) {
  if (!project?.rootDir || !entry) return { ok: false, message: '缺少项目或条目信息' };
  const state = await loadProjectProgressState(project);
  const now = new Date().toISOString();
  const file = entry.file || '';
  const index = Number.isInteger(extra.index) ? extra.index : Number(entry.localIndex ?? entry.index ?? -1);
  const target = String(entry.targetDraft ?? entry.target ?? '');
  state.global.lastTranslatedFile = file;
  state.global.lastTranslatedEntryId = entry.id || '';
  state.global.lastTranslatedIndex = index;
  state.global.lastTranslatedKey = entry.key || entry.path || '';
  state.global.lastTranslatedSource = String(entry.source || '').slice(0, 160);
  state.global.lastTranslatedTarget = target.slice(0, 160);
  state.global.lastTranslatedAt = now;
  state.files[file] = {
    ...(state.files[file] || {}),
    file,
    lastTranslatedEntryId: entry.id || '',
    lastTranslatedIndex: index,
    lastTranslatedKey: entry.key || entry.path || '',
    lastTranslatedAt: now,
  };
  return saveProjectProgressState(project, state);
}

async function rebuildProjectProgressState(project, entries = [], previousState = null) {
  const prev = previousState || await loadProjectProgressState(project);
  const globalProgress = calculateGlobalProgress(entries);
  const fileProgress = calculateFileProgress(entries);
  const files = {};
  fileProgress.forEach((file) => {
    files[file.file] = { ...(prev.files?.[file.file] || {}), ...file };
  });
  const state = normalizeState(project, {
    ...prev,
    updatedAt: new Date().toISOString(),
    global: {
      ...prev.global,
      total: globalProgress.totalEntries,
      translated: globalProgress.translatedEntries,
      percent: globalProgress.percent,
    },
    files,
  });
  return saveProjectProgressState(project, state).then((result) => result.state);
}

module.exports = { defaultState, loadProjectProgressState, saveProjectProgressState, updateLastTranslatedPosition, rebuildProjectProgressState };
