/**
 * @file src/main/services/engines/adapters/SmileGameBuilderAdapter.js
 * @description SMILE GAME BUILDER 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectSmileGameBuilder(rootDir) {
  const markers = [
    { file: 'game.exe', weight: 0.3 },
    { file: 'Game.exe', weight: 0.3 },
    { dir: 'data', weight: 0.2 },
    { dir: 'dlc', weight: 0.2 },
    { file: 'smilegamebuilder.dat', weight: 0.5 },
  ];

  let confidence = 0;
  for (const marker of markers) {
    if (marker.file && fs.existsSync(path.join(rootDir, marker.file))) {
      confidence += marker.weight;
    }
    if (marker.dir && fs.existsSync(path.join(rootDir, marker.dir))) {
      confidence += marker.weight;
    }
  }

  return { found: confidence > 0, confidence: Math.min(0.85, confidence), dataRoots: [] };
}

class SmileGameBuilderAdapter extends BaseStubAdapter {
  constructor() {
    super('smile-game-builder', 'SMILE GAME BUILDER', detectSmileGameBuilder);
  }
}

module.exports = { SmileGameBuilderAdapter };
