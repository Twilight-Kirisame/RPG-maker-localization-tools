/**
 * @file src/main/services/engines/adapters/MkxpAdapter.js
 * @description MKXP / MKXP-Z 引擎识别适配器（stub）。
 */

const fs = require('fs');
const path = require('path');
const { BaseStubAdapter } = require('./BaseStubAdapter');

function detectMkxp(rootDir) {
  const markers = [
    { file: 'mkxp.json', weight: 0.5 },
    { file: 'mkxp.conf', weight: 0.5 },
    { file: 'mkxp.ini', weight: 0.4 },
    { file: 'Game.ini', weight: 0.2 },
  ];

  let confidence = 0;
  for (const marker of markers) {
    const full = path.join(rootDir, marker.file);
    if (fs.existsSync(full)) {
      confidence += marker.weight;
      try {
        const content = fs.readFileSync(full, 'utf8').toLowerCase();
        if (content.includes('mkxp')) confidence += 0.2;
      } catch { /* ignore */ }
    }
  }

  // 同时存在 RGSS 数据文件时提高置信度
  const hasRgssData = fs.readdirSync(rootDir, { withFileTypes: true }).some(
    (e) => e.isFile() && /\.(rxdata|rvdata|rvdata2|rgss|rgss2|rgss3)$/i.test(e.name)
  );
  if (hasRgssData) confidence += 0.2;

  return { found: confidence > 0, confidence: Math.min(0.95, confidence), dataRoots: [] };
}

class MkxpAdapter extends BaseStubAdapter {
  constructor() {
    super('mkxp', 'MKXP / MKXP-Z', detectMkxp);
  }
}

module.exports = { MkxpAdapter };
