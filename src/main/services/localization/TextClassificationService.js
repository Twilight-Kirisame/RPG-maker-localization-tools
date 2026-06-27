/**
 * @file src/main/services/localization/TextClassificationService.js
 * @description 通用文本分类服务，区分上下文文本与独立词条。
 */

function classifyDatabaseField(fileName = '', fieldName = '', value = '') {
  const base = String(fileName || '').replace(/\.json$/i, '').toLowerCase();
  const field = String(fieldName || '').toLowerCase();
  const text = String(value || '');

  if (field === 'name') {
    const nameTypes = {
      actors: 'actor-name', enemies: 'enemy-name', items: 'item-name', weapons: 'weapon-name', armors: 'armor-name',
      skills: 'skill-name', states: 'state-name', classes: 'class-name', maps: 'map-name',
    };
    return { textClass: 'atomic', textType: nameTypes[base] || 'generic-text', semanticRole: 'name', confidence: 0.9 };
  }
  if (field === 'nickname') return { textClass: 'atomic', textType: 'actor-name', semanticRole: 'nickname', confidence: 0.85 };
  if (field === 'profile') return { textClass: 'contextual', textType: 'long-description', semanticRole: 'profile', confidence: 0.86 };
  if (field === 'description') return { textClass: text.length > 40 || /\n/.test(text) ? 'mixed' : 'atomic', textType: `${base || 'item'}-description`, semanticRole: 'description', confidence: 0.76 };
  if (/^message\d+$/.test(field)) return { textClass: 'contextual', textType: 'event-message', semanticRole: 'battle-message', confidence: 0.82 };
  if (field === 'gametitle') return { textClass: 'atomic', textType: 'system-title', semanticRole: 'title', confidence: 0.95 };
  if (field === 'currencyunit') return { textClass: 'atomic', textType: 'currency-unit', semanticRole: 'currency', confidence: 0.95 };
  return { textClass: text.length > 60 || /\n/.test(text) ? 'mixed' : 'unknown', textType: 'generic-text', semanticRole: '', confidence: 0.35 };
}

function classifyEventCommand(code, params = [], meta = {}) {
  const numericCode = Number(code);
  if (numericCode === 401) return { textClass: 'contextual', textType: 'dialogue-line', semanticRole: 'story-dialogue', confidence: 0.96 };
  if (numericCode === 101) return { textClass: 'contextual', textType: 'speaker', semanticRole: 'speaker', confidence: 0.82 };
  if (numericCode === 102 || numericCode === 402) return { textClass: 'atomic', textType: 'choice-option', semanticRole: 'choice', confidence: 0.82 };
  if (numericCode === 405) return { textClass: 'contextual', textType: 'long-description', semanticRole: 'scrolling-text', confidence: 0.9 };
  if (numericCode === 108 || numericCode === 408) return { textClass: 'mixed', textType: 'plugin-text', semanticRole: 'comment', confidence: 0.5 };
  if (numericCode === 356 || numericCode === 357) return { textClass: 'mixed', textType: 'plugin-text', semanticRole: 'plugin-command', confidence: 0.5 };
  return { textClass: meta?.source && String(meta.source).length > 60 ? 'mixed' : 'unknown', textType: 'generic-text', semanticRole: '', confidence: 0.3 };
}

function classifyEntry(entry = {}, projectInfo = {}) {
  if (entry.adapterMeta?.code != null || entry.code != null) return { ...entry, ...classifyEventCommand(entry.adapterMeta?.code ?? entry.code, [], entry) };
  const field = String(entry.adapterMeta?.field || entry.key || '').replace(/\[.*$/, '').split('.').pop();
  return { ...entry, ...classifyDatabaseField(entry.file, field, entry.source) };
}

function getDefaultRules(engineName = 'unknown') {
  return { engineName, textClasses: ['contextual', 'atomic', 'mixed', 'unknown'] };
}

module.exports = { classifyDatabaseField, classifyEventCommand, classifyEntry, getDefaultRules };
