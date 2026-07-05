/**
 * @file src/main/services/engine/RpgMakerAdapter.js
 * @description RPG Maker MV/MZ 引擎适配器。复用 ProjectTextService 提取链与 RpgMakerWriteback 写回链。
 */

const fs = require('fs');
const path = require('path');
const { detectEngine, collectProjectTexts, collectProjectFiles, collectFileTexts } = require('../project/ProjectTextService');
const { applyToFiles } = require('../export/RpgMakerWriteback');
const { getConstraints } = require('../validation/EngineConstraints');

/**
 * 检测置信度：
 *  - 找到 System.json + Map*.json → 1.0
 *  - 只找到 data 目录 → 0.5
 *  - 否则 → 0
 */
function detect(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return { confidence: 0, info: null };
  const probe = detectEngine(rootDir);
  if (!probe.dataRoots?.length) return { confidence: 0, info: probe };
  let confidence = 0.4;
  if (probe.features?.hasSystem) confidence += 0.3;
  if (probe.features?.hasMapJson) confidence += 0.2;
  if (probe.features?.hasCommonEvents) confidence += 0.1;
  return { confidence: Math.min(1, confidence), info: probe };
}

function extract(rootDir) {
  return collectProjectTexts(rootDir);
}

function listFiles(rootDir) {
  return collectProjectFiles(rootDir);
}

function extractFile(rootDir, filePath) {
  return collectFileTexts(rootDir, filePath);
}

function apply(payload) {
  return applyToFiles(payload);
}

module.exports = {
  id: 'rpgmaker-mvmz',
  displayName: 'RPG Maker MV/MZ',
  detect,
  extract,
  listFiles,
  extractFile,
  apply,
  getConstraints: (kind) => getConstraints('RPG Maker MV/MZ', kind),
};
