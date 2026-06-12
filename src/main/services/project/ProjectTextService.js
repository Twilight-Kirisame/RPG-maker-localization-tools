/**
 * @file src/main/services/project/ProjectTextService.js
 * @description RPG Maker 项目识别与文本提取服务。
 */

const fs = require('fs');
const path = require('path');

/**
 * 识别 RPG Maker 项目类型。
 * @param {string} rootDir
 * @returns {{rootDir:string, engine:string, files:Array, features:Object}}
 */
function detectEngine(rootDir) {
  const result = { rootDir, engine: 'unknown', files: [], features: {} };
  const entries = fs.existsSync(rootDir) ? fs.readdirSync(rootDir, { withFileTypes: true }) : [];
  for (const entry of entries) result.files.push({ name: entry.name, type: entry.isDirectory() ? 'dir' : 'file' });
  result.features.hasDataDir = fs.existsSync(path.join(rootDir, 'data'));
  result.features.hasWwwDataDir = fs.existsSync(path.join(rootDir, 'www', 'data'));
  result.features.hasCommonEvents = fs.existsSync(path.join(rootDir, 'data', 'CommonEvents.json')) || fs.existsSync(path.join(rootDir, 'www', 'data', 'CommonEvents.json'));
  result.features.hasSystem = fs.existsSync(path.join(rootDir, 'data', 'System.json')) || fs.existsSync(path.join(rootDir, 'www', 'data', 'System.json'));
  result.features.hasMapJson = entries.some((entry) => entry.isDirectory() && entry.name.toLowerCase() === 'data') || fs.existsSync(path.join(rootDir, 'www', 'data'));
  if (result.features.hasDataDir || result.features.hasWwwDataDir) result.engine = 'RPG Maker MV/MZ';
  return result;
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

/**
 * 扫描并提取项目文本。
 * @param {string} rootDir
 * @returns {Object}
 */
function collectProjectTexts(rootDir) {
  const info = detectEngine(rootDir);
  const dataRoots = [];
  const dataDir = path.join(rootDir, 'data');
  const wwwDataDir = path.join(rootDir, 'www', 'data');
  if (fs.existsSync(dataDir)) dataRoots.push(dataDir);
  if (fs.existsSync(wwwDataDir)) dataRoots.push(wwwDataDir);
  const entries = [];
  for (const dataRoot of dataRoots) {
    for (const file of fs.readdirSync(dataRoot)) {
      if (!file.toLowerCase().endsWith('.json')) continue;
      const filePath = path.join(dataRoot, file);
      try {
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const relFile = path.relative(rootDir, filePath).replace(/\\/g, '/');
        if (/^Map\d+\.json$/i.test(file)) { entries.push(...extractMapText(json, relFile)); continue; }
        if (/^(CommonEvents|System)\.json$/i.test(file)) {
          if (file.toLowerCase() === 'system.json') entries.push(...extractSystemText(json, relFile));
          if (file.toLowerCase() === 'commonevents.json' && Array.isArray(json)) {
            json.forEach((event, index) => entries.push(...extractEventCommandTexts(event?.list || [], relFile, `commonEvents[${index}]`)));
          }
          continue;
        }
        const baseName = path.basename(file, '.json').toLowerCase();
        if (['items', 'weapons', 'armors', 'skills', 'actors', 'classes', 'states'].includes(baseName)) entries.push(...extractDatabaseText(json, relFile));
      } catch {
        // 忽略损坏 JSON，继续扫描其他文件。
      }
    }
  }
  return { ...info, entries };
}

module.exports = { detectEngine, collectProjectTexts };
