/**
 * @file src/main/services/engines/adapters/BakinAdapter.js
 * @description Bakin 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectBakin(rootDir) {
  const markers = [
    { dir: 'Bakin', weight: 0.4 },
    { dir: 'bakin', weight: 0.4 },
    { file: 'Bakin.exe', weight: 0.4 },
    { file: 'game.exe', weight: 0.2 },
    { ext: '.bakin', weight: 0.3 },
  ];

  let confidence = 0;
  for (const marker of markers) {
    if (marker.file && fs.existsSync(path.join(rootDir, marker.file))) {
      confidence += marker.weight;
    }
    if (marker.dir && fs.existsSync(path.join(rootDir, marker.dir))) {
      confidence += marker.weight;
    }
    if (marker.ext) {
      const hasExt = fs.readdirSync(rootDir, { withFileTypes: true }).some(
        (e) => e.isFile() && e.name.toLowerCase().endsWith(marker.ext)
      );
      if (hasExt) confidence += marker.weight;
    }
  }

  return { found: confidence > 0, confidence: Math.min(0.85, confidence), dataRoots: [] };
}

class BakinAdapter extends BaseStubAdapter {
  constructor() {
    super('bakin', 'Bakin', detectBakin);
  }
}

module.exports = { BakinAdapter };
