/**
 * @file src/main/services/engines/adapters/PixelGameMakerMvAdapter.js
 * @description Pixel Game Maker MV 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectPixelGameMakerMv(rootDir) {
  const markers = [
    { file: 'game.exe', weight: 0.3 },
    { file: 'Game.exe', weight: 0.3 },
    { dir: 'data', weight: 0.2 },
    { dir: 'assets', weight: 0.2 },
    { file: 'pixelgamemaker.mv', weight: 0.5 },
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

  // 不应与 RPG Maker MV/MZ 混淆：Pixel Game Maker 没有 www/data/System.json
  const hasMvMz = fs.existsSync(path.join(rootDir, 'data/System.json'))
    || fs.existsSync(path.join(rootDir, 'www/data/System.json'));
  if (hasMvMz) return { found: false };

  return { found: confidence > 0, confidence: Math.min(0.85, confidence), dataRoots: [] };
}

class PixelGameMakerMvAdapter extends BaseStubAdapter {
  constructor() {
    super('pixel-game-maker-mv', 'Pixel Game Maker MV', detectPixelGameMakerMv);
  }
}

module.exports = { PixelGameMakerMvAdapter };
