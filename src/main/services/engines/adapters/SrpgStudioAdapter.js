/**
 * @file src/main/services/engines/adapters/SrpgStudioAdapter.js
 * @description SRPG Studio 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectSrpgStudio(rootDir) {
  const markers = [
    { file: 'data.srpm', weight: 0.6 },
    { ext: '.srpg', weight: 0.4 },
    { file: 'SrpgStudio.exe', weight: 0.3 },
    { file: 'Game.exe', weight: 0.1 },
  ];

  let confidence = 0;
  for (const marker of markers) {
    if (marker.file && fs.existsSync(path.join(rootDir, marker.file))) {
      confidence += marker.weight;
    }
    if (marker.ext) {
      const hasExt = fs.readdirSync(rootDir, { withFileTypes: true }).some(
        (e) => e.isFile() && e.name.toLowerCase().endsWith(marker.ext)
      );
      if (hasExt) confidence += marker.weight;
    }
  }

  return { found: confidence > 0, confidence: Math.min(0.9, confidence), dataRoots: [] };
}

class SrpgStudioAdapter extends BaseStubAdapter {
  constructor() {
    super('srpg-studio', 'SRPG Studio', detectSrpgStudio);
  }
}

module.exports = { SrpgStudioAdapter };
