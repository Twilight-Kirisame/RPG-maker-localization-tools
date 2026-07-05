/**
 * @file src/main/services/project/ProjectTextService.js
 * @description RPG Maker 项目识别与文本提取服务。
 */

const fs = require('fs');
const path = require('path');
const { detectEngine: detectByRegistry, extractProjectTexts, listProjectFiles, extractProjectFile, shouldUseLazyLoad } = require('../engines/EngineRegistry');
const { calculateGlobalProgress, calculateFileProgress, calculateCurrentFileProgress } = require('../localization/ProgressService');

/**
 * 识别 RPG Maker 项目类型。
 * @param {string} rootDir
 * @returns {{rootDir:string, engine:string, files:Array, features:Object}}
 */
function detectEngine(rootDir) {
  const detected = detectByRegistry(rootDir);
  if (detected?.ok && detected.engine === 'rpg-maker') return { ...detected, engine: 'RPG Maker MV/MZ' };
  return detected?.ok ? detected : { rootDir, engine: 'unknown', displayName: 'unknown', files: [], features: {}, dataRoots: [], warnings: detected?.warnings || [] };
}

function discoverDataRoots(rootDir) {
  const detected = detectByRegistry(rootDir);
  return Array.isArray(detected?.dataRoots) ? detected.dataRoots : [];
}

/**
 * 将 RPG Maker 指令文本转为字符串。
 * @param {any} value
 * @returns {string}
 */
function buildDialogueText(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '')).join('\n').trim();
  return String(value ?? '').trim();
}

/**
 * 判断文本是否值得提取。
 * @param {any} value
 * @returns {boolean}
 */
function isSafeRpgText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (/^\s*[-+]?\d+(?:\.\d+)?\s*$/.test(text)) return false;
  if (/^(true|false|null)$/i.test(text)) return false;
  if (/^[\[{].*[\]}]$/.test(text)) return false;
  return true;
}

/**
 * 创建标准文本条目。
 * @param {string} file
 * @param {string} key
 * @param {string} source
 * @param {Object} meta
 * @returns {Object}
 */
function createEntry(file, key, source, meta = {}) {
  return {
    id: `${file}:${key}:${meta.kind || 'text'}:${meta.code ?? ''}:${meta.index ?? ''}`,
    file,
    key,
    source,
    target: '',
    kind: meta.kind || 'text',
    code: meta.code ?? null,
    index: meta.index ?? null,
    path: meta.path || '',
    controls: meta.controls || [],
    hints: meta.hints || [],
  };
}

function extractSystemText(systemJson, file) {
  const entries = [];
  if (!systemJson || typeof systemJson !== 'object') return entries;
  if (isSafeRpgText(systemJson.gameTitle)) entries.push(createEntry(file, 'gameTitle', systemJson.gameTitle, { kind: 'system', path: 'gameTitle' }));
  if (isSafeRpgText(systemJson.currencyUnit)) entries.push(createEntry(file, 'currencyUnit', systemJson.currencyUnit, { kind: 'system', path: 'currencyUnit' }));
  const terms = systemJson.terms || {};
  ['commands', 'basic'].forEach((group) => {
    const values = Array.isArray(terms[group]) ? terms[group] : [];
    values.forEach((item, index) => {
      if (isSafeRpgText(item)) entries.push(createEntry(file, `terms.${group}[${index}]`, item, { kind: `system-${group}`, index, path: `terms.${group}[${index}]` }));
    });
  });
  Object.entries(terms.messages || {}).forEach(([key, value]) => {
    if (isSafeRpgText(value)) entries.push(createEntry(file, `terms.messages.${key}`, value, { kind: 'system-message', path: `terms.messages.${key}` }));
  });
  return entries;
}

function extractDatabaseText(json, file) {
  const entries = [];
  if (!Array.isArray(json)) return entries;
  json.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    ['name', 'description', 'profile', 'message1', 'message2', 'message3'].forEach((field) => {
      if (isSafeRpgText(item[field])) entries.push(createEntry(file, `${field}[${index}]`, item[field], { kind: field, index, path: `${index}.${field}` }));
    });
  });
  return entries;
}

function extractEventCommandTexts(list, file, basePath) {
  const entries = [];
  if (!Array.isArray(list)) return entries;
  list.forEach((command, index) => {
    if (!command || typeof command !== 'object') return;
    const code = Number(command.code);
    const params = Array.isArray(command.parameters) ? command.parameters : [];
    const commandPath = `${basePath}.list[${index}]`;
    if (code === 401) {
      const text = buildDialogueText(params[0]);
      if (isSafeRpgText(text)) entries.push(createEntry(file, `${commandPath}.parameters[0]`, text, { kind: 'dialogue-line', code, index, path: `${commandPath}.parameters[0]` }));
    }
    if (code === 102) {
      const choices = Array.isArray(params[0]) ? params[0].filter((choice) => isSafeRpgText(choice)) : [];
      choices.forEach((choice, choiceIndex) => entries.push(createEntry(file, `${commandPath}.parameters[0][${choiceIndex}]`, choice, { kind: 'choice', code, index: choiceIndex, path: `${commandPath}.parameters[0][${choiceIndex}]` })));
    }
    if (code === 402) {
      const branchName = buildDialogueText(params[1]);
      if (isSafeRpgText(branchName)) entries.push(createEntry(file, `${commandPath}.parameters[1]`, branchName, { kind: 'choice-branch', code, index, path: `${commandPath}.parameters[1]` }));
    }
    if (code === 101) {
      const speaker = buildDialogueText(params[4]);
      if (isSafeRpgText(speaker)) entries.push(createEntry(file, `${commandPath}.parameters[4]`, speaker, { kind: 'speaker', code, index, path: `${commandPath}.parameters[4]` }));
    }
  });
  return entries;
}

function extractMapText(mapJson, file) {
  const entries = [];
  if (!mapJson || typeof mapJson !== 'object') return entries;
  const events = Array.isArray(mapJson.events) ? mapJson.events : [];
  events.forEach((event, eventIndex) => {
    if (!event || typeof event !== 'object') return;
    const pages = Array.isArray(event.pages) ? event.pages : [];
    pages.forEach((page, pageIndex) => {
      const basePath = `events[${eventIndex}].pages[${pageIndex}]`;
      entries.push(...extractEventCommandTexts(page?.list || [], file, basePath));
    });
  });
  return entries;
}

function extractGenericJsonText(json, file) {
  const entries = [];
  const visited = new Set();
  const fieldHints = new Set(['name', 'nickname', 'description', 'profile', 'note', 'displayname', 'message', 'text', 'title', 'caption']);

  function walk(value, pathParts = []) {
    if (value == null) return;
    if (typeof value === 'string') {
      const keyName = String(pathParts[pathParts.length - 1] || '').toLowerCase();
      const shouldInclude = fieldHints.has(keyName) || /(?:name|text|message|description|profile|note|title|caption)$/i.test(keyName);
      if (shouldInclude && isSafeRpgText(value)) {
        const pathText = pathParts.join('.');
        entries.push(createEntry(file, pathText, value, { kind: `generic-${keyName || 'text'}`, path: pathText }));
      }
      return;
    }
    if (typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...pathParts, `[${index}]`]));
      return;
    }
    Object.entries(value).forEach(([key, next]) => walk(next, [...pathParts, key]));
  }

  walk(json);
  return entries;
}

function listJsonFilesRecursively(rootDir, maxDepth = 2) {
  const files = [];
  const visited = new Set();
  function walk(dir, depth) {
    if (!dir || visited.has(dir) || depth > maxDepth) return;
    visited.add(dir);
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath, depth + 1);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) files.push(fullPath);
    });
  }
  walk(rootDir, 0);
  return files;
}

/**
 * 扫描并提取项目文本。
 * @param {string} rootDir
 * @returns {Object}
 */
function collectProjectTexts(rootDir) {
  const result = extractProjectTexts(rootDir);
  const entries = Array.isArray(result.entries) ? result.entries : [];
  const fileProgress = calculateFileProgress(entries);
  const globalProgress = calculateGlobalProgress(entries);
  const currentFileProgress = calculateCurrentFileProgress(entries, entries[0]?.file || '');
  return {
    ...result,
    engine: result.adapterEngine === 'rpg-maker' || result.engine === 'rpg-maker' ? 'RPG Maker MV/MZ' : (result.displayName || result.engine || 'unknown'),
    entries,
    groups: Array.isArray(result.groups)
      ? result.groups.map((group) => ({
        ...group,
        sourceJoined: group.sourceJoined || '',
        targetJoined: group.targetJoined || '',
        entries: Array.isArray(group.entries) ? group.entries : [],
      }))
      : [],
    fileProgress,
    globalProgress,
    currentFileProgress,
  };
}

/**
 * 扫描项目文件索引，用于懒加载。
 * @param {string} rootDir
 * @returns {Object}
 */
function collectProjectFiles(rootDir) {
  const result = listProjectFiles(rootDir);
  const files = Array.isArray(result.files) ? result.files : [];
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const useLazyLoad = shouldUseLazyLoad(files);
  return {
    ...result,
    engine: result.adapterEngine === 'rpg-maker' || result.engine === 'rpg-maker' ? 'RPG Maker MV/MZ' : (result.displayName || result.engine || 'unknown'),
    files,
    totalSize,
    useLazyLoad,
    entries: [],
    groups: [],
    fileProgress: [],
    globalProgress: null,
    currentFileProgress: null,
  };
}

/**
 * 提取单个文件的文本。
 * @param {string} rootDir
 * @param {string} filePath
 * @returns {Object}
 */
function collectFileTexts(rootDir, filePath) {
  const result = extractProjectFile(rootDir, filePath);
  const entries = Array.isArray(result.entries) ? result.entries : [];
  const fileProgress = calculateFileProgress(entries);
  return {
    ...result,
    entries,
    groups: Array.isArray(result.groups)
      ? result.groups.map((group) => ({
        ...group,
        sourceJoined: group.sourceJoined || '',
        targetJoined: group.targetJoined || '',
        entries: Array.isArray(group.entries) ? group.entries : [],
      }))
      : [],
    fileProgress,
  };
}

module.exports = { detectEngine, collectProjectTexts, collectProjectFiles, collectFileTexts, discoverDataRoots };
