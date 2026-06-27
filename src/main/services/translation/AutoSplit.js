/**
 * @file src/main/services/translation/AutoSplit.js
 * @description 把超长译文按行宽/行数约束切分。切分优先级：
 *   中文标点（，。！？；：、）> 英文标点（,.!?;:）> 空格 > 硬切
 *
 * RPG Maker 对话框（code:401）超过单行上限会被截断，所以 buildAiTranslate
 * 在用户开启 autoSplit 时调用本函数把 AI 返回的中文整段拆成多行，让 writeback
 * 阶段插入多条 401（同 indent）。
 */

const CJK_PUNCT = /[，。！？；：、]/;
const ASCII_PUNCT = /[,.!?;:]/;

/**
 * 按约束把 text 拆成多行。
 * @param {string} text
 * @param {{maxCharsPerLine: number, maxLines: number}} constraint
 * @returns {{lines: string[], overflow: boolean}}
 */
function split(text, constraint) {
  const src = String(text || '');
  const maxChars = Math.max(0, Number(constraint?.maxCharsPerLine) || 0);
  const maxLines = Math.max(0, Number(constraint?.maxLines) || 0);
  if (!maxChars || src.length <= maxChars) return { lines: [src], overflow: false };

  const lines = [];
  let rest = src;
  while (rest.length > maxChars) {
    if (maxLines && lines.length >= maxLines - 1) break;
    const slice = rest.slice(0, maxChars);
    let breakAt = -1;
    for (let i = slice.length - 1; i >= Math.floor(maxChars / 2); i--) {
      if (CJK_PUNCT.test(slice[i])) { breakAt = i + 1; break; }
    }
    if (breakAt === -1) {
      for (let i = slice.length - 1; i >= Math.floor(maxChars / 2); i--) {
        if (ASCII_PUNCT.test(slice[i])) { breakAt = i + 1; break; }
      }
    }
    if (breakAt === -1) {
      for (let i = slice.length - 1; i >= Math.floor(maxChars / 2); i--) {
        if (slice[i] === ' ') { breakAt = i + 1; break; }
      }
    }
    if (breakAt === -1) breakAt = maxChars;
    lines.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).replace(/^\s+/, '');
  }
  if (rest) lines.push(rest);
  const overflow = maxLines > 0 && lines.length > maxLines;
  if (overflow) {
    const tail = lines.slice(maxLines - 1).join('');
    lines.splice(maxLines - 1, lines.length - (maxLines - 1), tail);
  }
  return { lines: lines.filter((line) => line.length > 0), overflow };
}

module.exports = { split };
