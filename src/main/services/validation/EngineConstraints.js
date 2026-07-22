/**
 * @file src/main/services/validation/EngineConstraints.js
 * @description 引擎级文本约束（行宽 / 行数 / 控制码保留要求）。前后端共享同一份常量。
 */

const constraints = {
  'RPG Maker MV/MZ': {
    dialogueLine: { maxCharsPerLine: 28, maxLines: 4, preserveControlCodes: true },
    choice: { maxCharsPerLine: 16, maxLines: 1, preserveControlCodes: true },
    'choice-branch': { maxCharsPerLine: 16, maxLines: 1, preserveControlCodes: true },
    speaker: { maxCharsPerLine: 12, maxLines: 1, preserveControlCodes: false },
    system: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  Unity: {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  TyranoBuilder: {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'Kirikiri / KAG': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  "Ren'Py": {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'RPG Maker 2000/2003/XP/VX/VX Ace': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'MKXP / MKXP-Z': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'Wolf RPG': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'SRPG Studio': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'SMILE GAME BUILDER': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  Bakin: {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
  'Pixel Game Maker MV': {
    default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
  },
};

const KIND_TO_CONSTRAINT_KEY = {
  'dialogue-line': 'dialogueLine',
  choice: 'choice',
  'choice-branch': 'choice-branch',
  speaker: 'speaker',
};

/**
 * 获取某条 entry 的约束。
 * @param {string} engine
 * @param {string} kind
 * @returns {{maxCharsPerLine: number, maxLines: number, preserveControlCodes: boolean}}
 */
function getConstraints(engine, kind) {
  const engineTable = constraints[engine] || constraints['RPG Maker MV/MZ'];
  const key = KIND_TO_CONSTRAINT_KEY[kind] || kind;
  return engineTable[key] || (String(kind || '').startsWith('system') ? engineTable.system : null) || engineTable.default;
}

module.exports = { constraints, getConstraints };
