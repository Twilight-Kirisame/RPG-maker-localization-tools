/**
 * @file src/main/services/localization/LocalizationEntry.js
 * @description 通用本地化文本条目与上下文组模型工具。
 */

const crypto = require('crypto');

function hashText(value) {
  return crypto.createHash('sha1').update(String(value || ''), 'utf8').digest('hex');
}

function createLocalizationEntry({
  engine = 'unknown',
  projectRoot = '',
  file = '',
  fileId = file,
  assetId = '',
  key = '',
  path = '',
  source = '',
  target = '',
  originalTarget = '',
  textClass = 'unknown',
  textType = 'generic-text',
  semanticRole = '',
  groupId = '',
  segmentIndex = 0,
  segmentCount = 1,
  context = {},
  constraints = {},
  progress = {},
  status = {},
  glossaryHits = [],
  warnings = [],
  adapterMeta = {},
} = {}) {
  const sourceText = String(source ?? '');
  const stableBase = [engine, file, key || path, sourceText, adapterMeta.code ?? '', adapterMeta.index ?? ''].join('\n');
  return {
    id: adapterMeta.id || `${file}:${key || path}:${adapterMeta.kind || textType}:${adapterMeta.code ?? ''}:${adapterMeta.index ?? ''}`,
    stableId: hashText(stableBase),
    engine,
    projectRoot,
    file,
    fileId,
    assetId,
    key,
    path,
    source: sourceText,
    target: String(target ?? ''),
    originalTarget: String(originalTarget ?? ''),
    textClass,
    textType,
    semanticRole,
    groupId,
    segmentIndex,
    segmentCount,
    context: {
      speaker: '',
      eventName: '',
      mapId: null,
      mapName: '',
      previousText: '',
      nextText: '',
      groupSource: '',
      groupTarget: '',
      sceneHint: '',
      sourceFileOrder: 0,
      ...context,
    },
    constraints: {
      maxCharsPerLine: 28,
      maxLines: 4,
      preserveControlCodes: true,
      allowMergeWithNext: true,
      allowSplit: true,
      ...constraints,
    },
    progress: {
      translated: Boolean(String(target ?? '').trim()),
      reviewed: false,
      locked: false,
      lastEditedAt: '',
      lastTranslatedAt: '',
      lastTranslator: '',
      ...progress,
    },
    status: {
      translation: String(target ?? '').trim() ? 'translated' : 'pending',
      validation: 'unchecked',
      cache: 'miss',
      glossary: Array.isArray(glossaryHits) && glossaryHits.length ? 'hit' : 'none',
      ...status,
    },
    glossaryHits: Array.isArray(glossaryHits) ? glossaryHits : [],
    warnings: Array.isArray(warnings) ? warnings : [],
    hash: hashText(sourceText),
    adapterMeta,
  };
}

function createContextGroup({
  groupId = '',
  file = '',
  textClass = 'contextual',
  textType = 'dialogue-block',
  entries = [],
  sourceJoined = '',
  targetJoined = '',
  speaker = '',
  mapName = '',
  eventName = '',
  previousGroupId = '',
  nextGroupId = '',
  translationMode = 'group',
  splitMode = 'preserve-lines',
  status = {},
} = {}) {
  const ids = entries.map((entry) => (typeof entry === 'string' ? entry : entry.id)).filter(Boolean);
  return {
    groupId: groupId || hashText([file, textType, ids.join('|'), sourceJoined].join('\n')),
    file,
    textClass,
    textType,
    entries: ids,
    sourceJoined,
    targetJoined,
    speaker,
    mapName,
    eventName,
    previousGroupId,
    nextGroupId,
    translationMode,
    splitMode,
    status: {
      translated: Boolean(String(targetJoined || '').trim()),
      reviewed: false,
      warningCount: 0,
      ...status,
    },
  };
}

module.exports = { createLocalizationEntry, createContextGroup, hashText };
