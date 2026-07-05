/**
 * @file src/main/services/engines/adapters/RpgMakerAdapter.js
 * @description RPG Maker MV/MZ 引擎适配器。负责识别、提取并标准化 RPG Maker JSON 文本。
 */

const fs = require('fs');
const path = require('path');
const { EngineAdapter } = require('../EngineAdapter');
const { createLocalizationEntry, createContextGroup } = require('../../localization/LocalizationEntry');
const { classifyDatabaseField, classifyEventCommand } = require('../../localization/TextClassificationService');

function buildDialogueText(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '')).join('\n').trim();
  return String(value ?? '').trim();
}

function isSafeRpgText(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (/^\s*[-+]?\d+(?:\.\d+)?\s*$/.test(text)) return false;
  if (/^(true|false|null)$/i.test(text)) return false;
  if (/^[\[{].*[\]}]$/.test(text)) return false;
  return true;
}

function listJsonFilesRecursively(rootDir, maxDepth = 3) {
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

function getFileCategory(fileName) {
  const lower = fileName.toLowerCase();
  if (/^Map\d+\.json$/i.test(fileName)) return 'map';
  if (lower === 'system.json') return 'system';
  if (lower === 'commonevents.json') return 'commonEvents';
  if (['items', 'weapons', 'armors', 'skills', 'actors', 'classes', 'states', 'enemies'].includes(path.basename(fileName, '.json').toLowerCase())) return 'database';
  return 'generic';
}

class RpgMakerAdapter extends EngineAdapter {
  constructor() {
    super('rpg-maker');
  }

  discoverDataRoots(rootDir, maxDepth = 6) {
    const roots = [];
    const visited = new Set();

    function walk(dir, depth) {
      if (!dir || visited.has(dir) || depth > maxDepth) return;
      visited.add(dir);
      if (!fs.existsSync(dir)) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      const names = entries.filter((entry) => entry.isFile()).map((entry) => entry.name.toLowerCase());
      const hasDataSignature = names.includes('system.json') || names.includes('commonevents.json') || names.some((name) => /^map\d+\.json$/.test(name));
      if (hasDataSignature) {
        roots.push(dir);
        return;
      }
      entries.forEach((entry) => {
        if (!entry.isDirectory()) return;
        if (['node_modules', 'localization_exports', 'localization_drafts', 'localization_glossaries'].includes(entry.name)) return;
        walk(path.join(dir, entry.name), depth + 1);
      });
    }

    walk(rootDir, 0);
    return [...new Set(roots.filter(Boolean))];
  }

  detect(rootDir) {
    const result = { ok: false, rootDir, engine: 'unknown', displayName: 'unknown', confidence: 0, files: [], features: {}, dataRoots: [], warnings: [] };
    let entries = [];
    try {
      entries = fs.existsSync(rootDir) ? fs.readdirSync(rootDir, { withFileTypes: true }) : [];
    } catch {
      result.warnings.push('项目目录无法访问');
      return result;
    }
    result.files = entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'dir' : 'file' }));
    const dataRoots = this.discoverDataRoots(rootDir);
    result.dataRoots = dataRoots;
    result.features.hasDataDir = fs.existsSync(path.join(rootDir, 'data'));
    result.features.hasWwwDataDir = fs.existsSync(path.join(rootDir, 'www', 'data'));
    result.features.hasCommonEvents = dataRoots.some((dir) => fs.existsSync(path.join(dir, 'CommonEvents.json')));
    result.features.hasSystem = dataRoots.some((dir) => fs.existsSync(path.join(dir, 'System.json')));
    result.features.hasMapJson = dataRoots.some((dir) => {
      try { return fs.readdirSync(dir).some((file) => /^Map\d+\.json$/i.test(file)); } catch { return false; }
    });
    if (dataRoots.length) {
      result.ok = true;
      result.engine = this.engineName;
      result.displayName = 'RPG Maker MV/MZ';
      result.confidence = 0.95;
    }
    return result;
  }

  createEntry(projectRoot, file, key, source, meta = {}) {
    const classification = meta.classification || (meta.code != null
      ? classifyEventCommand(meta.code, [], { source })
      : classifyDatabaseField(path.basename(file), meta.field || meta.kind || key, source));
    return createLocalizationEntry({
      engine: this.engineName,
      projectRoot,
      file,
      fileId: file,
      assetId: path.basename(file, '.json'),
      key,
      path: meta.path || key,
      source,
      target: '',
      textClass: classification.textClass,
      textType: classification.textType,
      semanticRole: classification.semanticRole,
      context: meta.context || {},
      adapterMeta: {
        kind: meta.kind || classification.textType || 'text',
        code: meta.code ?? null,
        index: meta.index ?? null,
        field: meta.field || '',
        rawPath: meta.path || key,
      },
    });
  }

  extractSystemText(projectRoot, systemJson, file) {
    const entries = [];
    if (!systemJson || typeof systemJson !== 'object') return entries;
    if (isSafeRpgText(systemJson.gameTitle)) entries.push(this.createEntry(projectRoot, file, 'gameTitle', systemJson.gameTitle, { kind: 'system', field: 'gameTitle', path: 'gameTitle' }));
    if (isSafeRpgText(systemJson.currencyUnit)) entries.push(this.createEntry(projectRoot, file, 'currencyUnit', systemJson.currencyUnit, { kind: 'system', field: 'currencyUnit', path: 'currencyUnit' }));
    const terms = systemJson.terms || {};
    ['commands', 'basic'].forEach((group) => {
      const values = Array.isArray(terms[group]) ? terms[group] : [];
      values.forEach((item, index) => {
        if (isSafeRpgText(item)) entries.push(this.createEntry(projectRoot, file, `terms.${group}[${index}]`, item, { kind: `system-${group}`, field: group, index, path: `terms.${group}[${index}]`, classification: { textClass: 'atomic', textType: 'system-command', semanticRole: group } }));
      });
    });
    Object.entries(terms.messages || {}).forEach(([key, value]) => {
      if (isSafeRpgText(value)) entries.push(this.createEntry(projectRoot, file, `terms.messages.${key}`, value, { kind: 'system-message', field: key, path: `terms.messages.${key}`, classification: { textClass: String(value).length > 40 ? 'mixed' : 'atomic', textType: 'system-message', semanticRole: 'system-message' } }));
    });
    return entries;
  }

  extractDatabaseText(projectRoot, json, file) {
    const entries = [];
    if (!Array.isArray(json)) return entries;
    json.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      ['name', 'nickname', 'description', 'profile', 'message1', 'message2', 'message3'].forEach((field) => {
        if (isSafeRpgText(item[field])) entries.push(this.createEntry(projectRoot, file, `${field}[${index}]`, item[field], { kind: field, field, index, path: `${index}.${field}` }));
      });
    });
    return entries;
  }

  extractEventCommandTexts(projectRoot, list, file, basePath, context = {}) {
    const entries = [];
    if (!Array.isArray(list)) return entries;
    let currentSpeaker = '';
    list.forEach((command, index) => {
      if (!command || typeof command !== 'object') return;
      const code = Number(command.code);
      const params = Array.isArray(command.parameters) ? command.parameters : [];
      const commandPath = `${basePath}.list[${index}]`;
      if (code === 101) currentSpeaker = buildDialogueText(params[4]);
      if (code === 401) {
        const text = buildDialogueText(params[0]);
        if (isSafeRpgText(text)) entries.push(this.createEntry(projectRoot, file, `${commandPath}.parameters[0]`, text, { kind: 'dialogue-line', code, index, path: `${commandPath}.parameters[0]`, context: { ...context, speaker: currentSpeaker } }));
      }
      if (code === 405) {
        const text = buildDialogueText(params[0]);
        if (isSafeRpgText(text)) entries.push(this.createEntry(projectRoot, file, `${commandPath}.parameters[0]`, text, { kind: 'long-description', code, index, path: `${commandPath}.parameters[0]`, context }));
      }
      if (code === 102) {
        const choices = Array.isArray(params[0]) ? params[0].filter((choice) => isSafeRpgText(choice)) : [];
        choices.forEach((choice, choiceIndex) => entries.push(this.createEntry(projectRoot, file, `${commandPath}.parameters[0][${choiceIndex}]`, choice, { kind: 'choice', code, index: choiceIndex, path: `${commandPath}.parameters[0][${choiceIndex}]`, context, classification: { textClass: 'atomic', textType: 'choice-option', semanticRole: 'choice' } })));
      }
      if (code === 402) {
        const branchName = buildDialogueText(params[1]);
        if (isSafeRpgText(branchName)) entries.push(this.createEntry(projectRoot, file, `${commandPath}.parameters[1]`, branchName, { kind: 'choice-branch', code, index, path: `${commandPath}.parameters[1]`, context, classification: { textClass: 'atomic', textType: 'choice-option', semanticRole: 'choice-branch' } }));
      }
      if (code === 101) {
        const speaker = buildDialogueText(params[4]);
        if (isSafeRpgText(speaker)) entries.push(this.createEntry(projectRoot, file, `${commandPath}.parameters[4]`, speaker, { kind: 'speaker', code, index, path: `${commandPath}.parameters[4]`, context, classification: { textClass: 'atomic', textType: 'actor-name', semanticRole: 'speaker' } }));
      }
    });
    return entries;
  }

  extractMapText(projectRoot, mapJson, file) {
    const entries = [];
    if (!mapJson || typeof mapJson !== 'object') return entries;
    const events = Array.isArray(mapJson.events) ? mapJson.events : [];
    events.forEach((event, eventIndex) => {
      if (!event || typeof event !== 'object') return;
      const pages = Array.isArray(event.pages) ? event.pages : [];
      pages.forEach((page, pageIndex) => {
        const basePath = `events[${eventIndex}].pages[${pageIndex}]`;
        entries.push(...this.extractEventCommandTexts(projectRoot, page?.list || [], file, basePath, { eventName: event.name || '', mapName: mapJson.displayName || '', mapId: mapJson.mapId ?? null }));
      });
    });
    return entries;
  }

  extractGenericJsonText(projectRoot, json, file) {
    const entries = [];
    const visited = new Set();
    const fieldHints = new Set(['name', 'nickname', 'description', 'profile', 'note', 'displayname', 'message', 'text', 'title', 'caption']);
    const walk = (value, pathParts = []) => {
      if (value == null) return;
      if (typeof value === 'string') {
        const keyName = String(pathParts[pathParts.length - 1] || '').toLowerCase();
        const shouldInclude = fieldHints.has(keyName) || /(?:name|text|message|description|profile|note|title|caption)$/i.test(keyName);
        if (shouldInclude && isSafeRpgText(value)) {
          const pathText = pathParts.join('.');
          entries.push(this.createEntry(projectRoot, file, pathText, value, { kind: `generic-${keyName || 'text'}`, field: keyName, path: pathText }));
        }
        return;
      }
      if (typeof value !== 'object' || visited.has(value)) return;
      visited.add(value);
      if (Array.isArray(value)) {
        value.forEach((item, index) => walk(item, [...pathParts, `[${index}]`]));
        return;
      }
      Object.entries(value).forEach(([key, next]) => walk(next, [...pathParts, key]));
    };
    walk(json);
    return entries;
  }

  buildContextGroups(entries) {
    const groups = [];
    const byFile = new Map();
    entries.forEach((entry) => {
      if (!byFile.has(entry.file)) byFile.set(entry.file, []);
      byFile.get(entry.file).push(entry);
    });
    byFile.forEach((items, file) => {
      let buffer = [];
      const flush = () => {
        if (!buffer.length) return;
        if (buffer.length === 1) { buffer = []; return; }
        const sourceJoined = buffer.map((entry) => entry.source).join('\n');
        const group = createContextGroup({ file, entries: buffer, sourceJoined, textType: 'dialogue-block', speaker: buffer[0]?.context?.speaker || '', mapName: buffer[0]?.context?.mapName || '', eventName: buffer[0]?.context?.eventName || '' });
        buffer.forEach((entry, index) => {
          entry.groupId = group.groupId;
          entry.segmentIndex = index;
          entry.segmentCount = buffer.length;
          entry.context.groupSource = sourceJoined;
        });
        groups.push(group);
        buffer = [];
      };
      items.forEach((entry) => {
        if (entry.textClass === 'contextual' && ['dialogue-line', 'long-description'].includes(entry.textType)) buffer.push(entry);
        else flush();
      });
      flush();
    });
    return groups;
  }

  listFiles(rootDir, options = {}) {
    const info = this.detect(rootDir);
    const dataRoots = info.dataRoots && info.dataRoots.length ? info.dataRoots : [];
    const warnings = [...(info.warnings || [])];
    const files = [];
    if (!dataRoots.length) warnings.push('未自动发现可扫描的数据目录');
    dataRoots.forEach((dataRoot) => {
      const filePaths = listJsonFilesRecursively(dataRoot, options.maxJsonDepth || 3);
      filePaths.forEach((filePath) => {
        try {
          const stats = fs.statSync(filePath);
          const relFile = path.relative(rootDir, filePath).replace(/\\/g, '/');
          const fileName = path.basename(filePath);
          files.push({
            file: relFile,
            fileName,
            category: getFileCategory(fileName),
            size: stats.size,
            loaded: false,
          });
        } catch (error) {
          warnings.push(`忽略无法访问的 JSON：${path.relative(rootDir, filePath).replace(/\\/g, '/')} (${error.message})`);
        }
      });
    });
    return { ok: true, ...info, engine: 'RPG Maker MV/MZ', adapterEngine: this.engineName, files, warnings };
  }

  extractFile(rootDir, relFile, options = {}) {
    const info = this.detect(rootDir);
    const dataRoots = info.dataRoots && info.dataRoots.length ? info.dataRoots : [];
    const warnings = [];
    let entries = [];
    let resolvedPath = null;
    for (const dataRoot of dataRoots) {
      const candidate = path.join(rootDir, relFile);
      if (fs.existsSync(candidate)) { resolvedPath = candidate; break; }
      const candidate2 = path.join(dataRoot, relFile);
      if (fs.existsSync(candidate2)) { resolvedPath = candidate2; break; }
      const candidate3 = path.join(dataRoot, path.basename(relFile));
      if (fs.existsSync(candidate3)) { resolvedPath = candidate3; break; }
    }
    if (!resolvedPath) {
      return { ok: false, file: relFile, entries: [], groups: [], warnings: [`找不到文件：${relFile}`] };
    }
    try {
      const json = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      const file = path.basename(resolvedPath);
      const fileRel = path.relative(rootDir, resolvedPath).replace(/\\/g, '/');
      const category = getFileCategory(file);
      if (category === 'map') entries = this.extractMapText(rootDir, json, fileRel);
      else if (category === 'system') entries = this.extractSystemText(rootDir, json, fileRel);
      else if (category === 'commonEvents' && Array.isArray(json)) json.forEach((event, index) => { entries.push(...this.extractEventCommandTexts(rootDir, event?.list || [], fileRel, `commonEvents[${index}]`, { eventName: event?.name || '' })); });
      else if (category === 'database') entries = this.extractDatabaseText(rootDir, json, fileRel);
      else entries = this.extractGenericJsonText(rootDir, json, fileRel);
    } catch (error) {
      warnings.push(`JSON 解析失败：${relFile} (${error.message})`);
    }
    const groups = this.buildContextGroups(entries);
    return { ok: true, file: relFile, entries, groups, warnings };
  }

  extract(rootDir, options = {}) {
    const info = this.detect(rootDir);
    const dataRoots = info.dataRoots && info.dataRoots.length ? info.dataRoots : [];
    const entries = [];
    const warnings = [...(info.warnings || [])];
    if (!dataRoots.length) warnings.push('未自动发现可扫描的数据目录');
    dataRoots.forEach((dataRoot) => {
      const files = listJsonFilesRecursively(dataRoot, options.maxJsonDepth || 3);
      files.forEach((filePath) => {
        try {
          const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const relFile = path.relative(rootDir, filePath).replace(/\\/g, '/');
          const file = path.basename(filePath);
          if (/^Map\d+\.json$/i.test(file)) { entries.push(...this.extractMapText(rootDir, json, relFile)); return; }
          if (/^(CommonEvents|System)\.json$/i.test(file)) {
            if (file.toLowerCase() === 'system.json') entries.push(...this.extractSystemText(rootDir, json, relFile));
            if (file.toLowerCase() === 'commonevents.json' && Array.isArray(json)) json.forEach((event, index) => entries.push(...this.extractEventCommandTexts(rootDir, event?.list || [], relFile, `commonEvents[${index}]`, { eventName: event?.name || '' })));
            return;
          }
          const baseName = path.basename(file, '.json').toLowerCase();
          if (['items', 'weapons', 'armors', 'skills', 'actors', 'classes', 'states', 'enemies'].includes(baseName)) entries.push(...this.extractDatabaseText(rootDir, json, relFile));
          else entries.push(...this.extractGenericJsonText(rootDir, json, relFile));
        } catch (error) {
          warnings.push(`忽略损坏或不可解析 JSON：${path.relative(rootDir, filePath).replace(/\\/g, '/')} (${error.message})`);
        }
      });
    });
    const groups = this.buildContextGroups(entries);
    return { ok: true, ...info, engine: 'RPG Maker MV/MZ', adapterEngine: this.engineName, entries, groups, warnings };
  }
}

module.exports = { RpgMakerAdapter, isSafeRpgText, buildDialogueText, getFileCategory };
