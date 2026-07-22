/**
 * @file src/main/services/engines/adapters/RpgMakerOldAdapter.js
 * @description RPG Maker 2000/2003/XP/VX/VX Ace 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectRpgMakerOld(rootDir) {
  const markers = [
    { file: 'RPG_RT.ini', weight: 0.3 },
    { file: 'Game.exe', weight: 0.1 },
    { ext: '.ldb', weight: 0.3 },
    { ext: '.lmt', weight: 0.15 },
    { ext: '.rxdata', weight: 0.3 },
    { ext: '.rvdata', weight: 0.3 },
    { ext: '.rvdata2', weight: 0.3 },
  ];

  let confidence = 0;
  const found = [];
  for (const marker of markers) {
    if (marker.file && fs.existsSync(path.join(rootDir, marker.file))) {
      confidence += marker.weight;
      found.push(marker.file);
    }
    if (marker.ext) {
      const hasExt = fs.readdirSync(rootDir, { withFileTypes: true }).some(
        (e) => e.isFile() && e.name.toLowerCase().endsWith(marker.ext)
      );
      if (hasExt) {
        confidence += marker.weight;
        found.push(marker.ext);
      }
    }
  }

  // 如果存在 System.json / Map*.json，说明是 MV/MZ，不应该命中旧版适配器
  const hasMvMz = fs.existsSync(path.join(rootDir, 'data/System.json'))
    || fs.existsSync(path.join(rootDir, 'www/data/System.json'));
  if (hasMvMz) return { found: false };

  return { found: confidence > 0, confidence: Math.min(0.9, confidence), dataRoots: [] };
}

class RpgMakerOldAdapter extends BaseStubAdapter {
  constructor() {
    super('rpg-maker-old', 'RPG Maker 2000/2003/XP/VX/VX Ace', detectRpgMakerOld);
  }
}

module.exports = { RpgMakerOldAdapter };
