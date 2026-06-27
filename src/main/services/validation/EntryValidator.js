/**
 * @file src/main/services/validation/EntryValidator.js
 * @description 译文校验：检查行宽 / 行数超限、控制码缺失。
 * 主进程 IPC 调用、前端实时按键也复用同一份逻辑（前端复制此函数避免每按键走一次 IPC）。
 */

const { getConstraints } = require('./EngineConstraints');

const CONTROL_CODE_RE = /\\[A-Za-z]+(?:\[[^\]]*\])?/g;

/**
 * 计算文本中的控制码集合。
 * @param {string} text
 * @returns {string[]}
 */
function extractControlCodes(text) {
  if (!text) return [];
  return String(text).match(CONTROL_CODE_RE) || [];
}

/**
 * 校验单条 entry 的译文是否超限。
 * @param {Object} entry
 * @param {string} engine
 * @returns {{warnings: Object[]}}
 */
function validateEntry(entry, engine) {
  const warnings = [];
  if (!entry) return { warnings };
  const target = String(entry.target ?? '');
  if (!target.trim()) return { warnings };

  const c = getConstraints(engine, entry.kind);
  if (!c) return { warnings };

  const lines = target.split(/\r?\n/);
  if (c.maxLines > 0 && lines.length > c.maxLines) {
    warnings.push({ code: 'too-many-lines', message: `译文 ${lines.length} 行，超过限制 ${c.maxLines}`, actual: lines.length, max: c.maxLines });
  }
  if (c.maxCharsPerLine > 0) {
    lines.forEach((line, idx) => {
      if (line.length > c.maxCharsPerLine) {
        warnings.push({ code: 'line-too-long', message: `第 ${idx + 1} 行 ${line.length} 字，超过限制 ${c.maxCharsPerLine}`, line: idx + 1, length: line.length, max: c.maxCharsPerLine });
      }
    });
  }
  if (c.preserveControlCodes) {
    const src = extractControlCodes(entry.source);
    const dst = extractControlCodes(target);
    const dstSet = new Set(dst);
    const missing = src.filter((code) => !dstSet.has(code));
    if (missing.length) {
      warnings.push({ code: 'control-char-missing', message: `译文缺失控制码：${missing.join(' ')}`, missing });
    }
  }
  return { warnings };
}

module.exports = { validateEntry, extractControlCodes };
