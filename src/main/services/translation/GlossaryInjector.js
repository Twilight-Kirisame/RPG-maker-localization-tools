/**
 * @file src/main/services/translation/GlossaryInjector.js
 * @description 术语库 AI 注入：在调用 AI 翻译前匹配命中术语，并按用户选择的模式
 * （强制替换原文 / 注入 System Prompt）改写请求，保证译名一致与省 token。
 */

/**
 * 匹配命中术语。
 * @param {string} sourceText
 * @param {Object[]} terms
 * @returns {Object[]} 命中的术语数组（按 source 长度倒序）
 */
function findHits(sourceText, terms) {
  if (!sourceText || !Array.isArray(terms) || !terms.length) return [];
  const hits = terms.filter((term) => term && term.enabled !== false && term.source && term.target && sourceText.includes(term.source));
  return hits.sort((a, b) => String(b.source).length - String(a.source).length);
}

/**
 * 转义正则元字符。
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 按命中术语强制替换原文中的对应片段。
 * 命中按 source 长度倒序处理，避免短术语先替换吃掉长术语。
 * @param {string} sourceText
 * @param {Object[]} hits
 * @returns {string}
 */
function forceReplace(sourceText, hits) {
  if (!hits || !hits.length) return sourceText;
  let out = String(sourceText || '');
  for (const term of hits) {
    if (!term?.source || !term?.target) continue;
    out = out.split(term.source).join(term.target);
  }
  return out;
}

/**
 * 拼接 Prompt 注入块。
 * @param {Object[]} hits
 * @returns {string}
 */
function buildPromptAddendum(hits) {
  if (!hits || !hits.length) return '';
  const lines = hits
    .filter((term) => term?.source && term?.target)
    .map((term) => `- ${term.source} → ${term.target}${term.note ? `（${term.note}）` : ''}`);
  return lines.join('\n');
}

/**
 * 根据 mode 一次性计算注入结果。
 * @param {Object} params
 * @param {string} params.sourceText
 * @param {string} params.systemPrompt
 * @param {Object} params.glossary {terms: Object[]}
 * @param {string} params.mode 'off' | 'replace' | 'prompt'
 * @returns {{effectiveSource: string, systemPrompt: string, hits: Object[]}}
 */
function applyInjection({ sourceText, systemPrompt, glossary, mode }) {
  const finalMode = mode || 'off';
  if (finalMode === 'off') return { effectiveSource: sourceText, systemPrompt, hits: [] };
  const hits = findHits(sourceText, glossary?.terms || []);
  if (!hits.length) return { effectiveSource: sourceText, systemPrompt, hits };
  if (finalMode === 'replace') {
    return { effectiveSource: forceReplace(sourceText, hits), systemPrompt, hits };
  }
  if (finalMode === 'prompt') {
    const addendum = buildPromptAddendum(hits);
    const nextPrompt = addendum
      ? `${systemPrompt}\n\n术语对照（必须严格遵守，若原文出现以下词条，译文必须使用对应译名）：\n${addendum}`
      : systemPrompt;
    return { effectiveSource: sourceText, systemPrompt: nextPrompt, hits };
  }
  return { effectiveSource: sourceText, systemPrompt, hits };
}

module.exports = { findHits, forceReplace, buildPromptAddendum, applyInjection, escapeRegExp };
