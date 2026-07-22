/**
 * @file src/main/services/engines/adapters/WolfRpgAdapter.js
 * @description Wolf RPG 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectWolfRpg(rootDir) {
  const markers = [
    { file: 'Data.wolf', weight: 0.6 },
    { file: 'Data.wolf2', weight: 0.6 },
    { file: 'Wolf.exe', weight: 0.3 },
    { file: 'Game.exe', weight: 0.1 },
    { file: 'game.ini', weight: 0.1 },
  ];

  let confidence = 0;
  for (const marker of markers) {
    if (fs.existsSync(path.join(rootDir, marker.file))) {
      confidence += marker.weight;
    }
  }

  return { found: confidence > 0, confidence: Math.min(0.95, confidence), dataRoots: [] };
}

class WolfRpgAdapter extends BaseStubAdapter {
  constructor() {
    super('wolf-rpg', 'Wolf RPG', detectWolfRpg);
  }
}

module.exports = { WolfRpgAdapter };
