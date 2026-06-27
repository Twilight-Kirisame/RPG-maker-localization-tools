/**
 * @file src/main/services/localization/ProgressService.js
 * @description 项目、文件与条目翻译进度统计服务。
 */

function getEntryTarget(entry = {}) {
  return String(entry.targetDraft ?? entry.target ?? '').trim();
}

function isEntryTranslated(entry = {}) {
  const status = entry.translationStatus || entry.draftStatus || entry.status?.translation || '';
  if (status === 'translated') return true;
  if (status === 'pending') return false;
  if (entry.progress?.translated) return true;
  return Boolean(getEntryTarget(entry));
}

function createEmptyGlobalProgress() {
  return {
    totalFiles: 0,
    completedFiles: 0,
    inProgressFiles: 0,
    notStartedFiles: 0,
    warningFiles: 0,
    totalEntries: 0,
    translatedEntries: 0,
    pendingEntries: 0,
    totalContextual: 0,
    translatedContextual: 0,
    totalAtomic: 0,
    translatedAtomic: 0,
    percent: 0,
    lastTranslated: null,
  };
}

function calculateFileProgress(entries = []) {
  const map = new Map();
  entries.forEach((entry, index) => {
    const file = entry.file || 'unknown';
    if (!map.has(file)) {
      map.set(file, {
        file,
        total: 0,
        translated: 0,
        reviewed: 0,
        pending: 0,
        warningCount: 0,
        contextual: 0,
        translatedContextual: 0,
        atomic: 0,
        translatedAtomic: 0,
        lastTranslatedEntryId: '',
        lastTranslatedIndex: -1,
        lastTranslatedKey: '',
        lastTranslatedAt: '',
        percent: 0,
        status: 'not-started',
      });
    }
    const item = map.get(file);
    const translated = isEntryTranslated(entry);
    const warningCount = Array.isArray(entry.warnings) ? entry.warnings.length : 0;
    item.total += 1;
    item.warningCount += warningCount;
    if (entry.textClass === 'contextual') item.contextual += 1;
    if (entry.textClass === 'atomic') item.atomic += 1;
    if (translated) {
      item.translated += 1;
      item.lastTranslatedEntryId = entry.id || '';
      item.lastTranslatedIndex = index;
      item.lastTranslatedKey = entry.key || entry.path || '';
      item.lastTranslatedAt = entry.progress?.lastTranslatedAt || entry.progress?.lastEditedAt || '';
      if (entry.textClass === 'contextual') item.translatedContextual += 1;
      if (entry.textClass === 'atomic') item.translatedAtomic += 1;
    }
    if (entry.progress?.reviewed) item.reviewed += 1;
  });
  map.forEach((item) => {
    item.pending = Math.max(0, item.total - item.translated);
    item.percent = item.total ? Number(((item.translated / item.total) * 100).toFixed(2)) : 0;
    if (!item.total) item.status = 'empty';
    else if (item.warningCount) item.status = 'warning';
    else if (item.translated === 0) item.status = 'not-started';
    else if (item.translated >= item.total) item.status = 'completed';
    else item.status = 'in-progress';
  });
  return [...map.values()];
}

function calculateGlobalProgress(entries = []) {
  const global = createEmptyGlobalProgress();
  const files = calculateFileProgress(entries);
  global.totalFiles = files.length;
  global.completedFiles = files.filter((file) => file.status === 'completed').length;
  global.inProgressFiles = files.filter((file) => file.status === 'in-progress').length;
  global.notStartedFiles = files.filter((file) => file.status === 'not-started').length;
  global.warningFiles = files.filter((file) => file.warningCount > 0).length;
  global.totalEntries = entries.length;
  global.translatedEntries = entries.filter((entry) => isEntryTranslated(entry)).length;
  global.pendingEntries = Math.max(0, global.totalEntries - global.translatedEntries);
  global.totalContextual = entries.filter((entry) => entry.textClass === 'contextual').length;
  global.translatedContextual = entries.filter((entry) => entry.textClass === 'contextual' && isEntryTranslated(entry)).length;
  global.totalAtomic = entries.filter((entry) => entry.textClass === 'atomic').length;
  global.translatedAtomic = entries.filter((entry) => entry.textClass === 'atomic' && isEntryTranslated(entry)).length;
  global.percent = global.totalEntries ? Number(((global.translatedEntries / global.totalEntries) * 100).toFixed(2)) : 0;
  const lastFile = [...files].filter((file) => file.lastTranslatedEntryId).sort((a, b) => b.lastTranslatedIndex - a.lastTranslatedIndex)[0];
  if (lastFile) global.lastTranslated = { file: lastFile.file, entryId: lastFile.lastTranslatedEntryId, index: lastFile.lastTranslatedIndex, key: lastFile.lastTranslatedKey, at: lastFile.lastTranslatedAt };
  return global;
}

function calculateCurrentFileProgress(entries = [], currentFile = '') {
  const fileEntries = entries.filter((entry) => entry.file === currentFile);
  const fileProgress = calculateFileProgress(fileEntries)[0] || null;
  const nextPendingIndex = fileEntries.findIndex((entry) => !isEntryTranslated(entry));
  const lastTranslatedIndex = [...fileEntries].map((entry, index) => ({ entry, index })).filter(({ entry }) => isEntryTranslated(entry)).pop()?.index ?? -1;
  return {
    currentFile,
    currentFileTotal: fileEntries.length,
    currentFileTranslated: fileEntries.filter((entry) => isEntryTranslated(entry)).length,
    currentFilePending: fileEntries.filter((entry) => !isEntryTranslated(entry)).length,
    currentFilePercent: fileEntries.length ? Number(((fileEntries.filter((entry) => isEntryTranslated(entry)).length / fileEntries.length) * 100).toFixed(2)) : 0,
    lastTranslatedEntryIndex: lastTranslatedIndex,
    lastTranslatedEntryId: lastTranslatedIndex >= 0 ? fileEntries[lastTranslatedIndex]?.id || '' : '',
    lastTranslatedPath: lastTranslatedIndex >= 0 ? fileEntries[lastTranslatedIndex]?.key || fileEntries[lastTranslatedIndex]?.path || '' : '',
    nextPendingEntryIndex: nextPendingIndex,
    nextPendingEntryId: nextPendingIndex >= 0 ? fileEntries[nextPendingIndex]?.id || '' : '',
    fileProgress,
  };
}

function findNextPendingEntry(entries = [], currentFile = '', fromIndex = 0) {
  const fileEntries = entries.filter((entry) => !currentFile || entry.file === currentFile);
  const start = Math.max(0, Number(fromIndex || 0));
  for (let index = start; index < fileEntries.length; index += 1) {
    if (!isEntryTranslated(fileEntries[index])) return { entry: fileEntries[index], index };
  }
  return null;
}

function findPreviousPendingEntry(entries = [], currentFile = '', fromIndex = 0) {
  const fileEntries = entries.filter((entry) => !currentFile || entry.file === currentFile);
  const start = Math.min(fileEntries.length - 1, Number(fromIndex || 0));
  for (let index = start; index >= 0; index -= 1) {
    if (!isEntryTranslated(fileEntries[index])) return { entry: fileEntries[index], index };
  }
  return null;
}

module.exports = { isEntryTranslated, calculateGlobalProgress, calculateFileProgress, calculateCurrentFileProgress, findNextPendingEntry, findPreviousPendingEntry };
