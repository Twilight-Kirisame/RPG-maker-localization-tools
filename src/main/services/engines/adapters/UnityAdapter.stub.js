/**
 * @file src/main/services/engines/adapters/UnityAdapter.stub.js
 * @description Unity 引擎适配器预留接口。当前只做疑似识别，不进行资源解包或回写。
 */

const fs = require('fs');
const path = require('path');
const { EngineAdapter } = require('../EngineAdapter');

class UnityAdapterStub extends EngineAdapter {
  constructor() {
    super('unity');
  }

  detect(rootDir) {
    let entries = [];
    try {
      entries = fs.existsSync(rootDir) ? fs.readdirSync(rootDir, { withFileTypes: true }) : [];
    } catch {
      return { ok: false, rootDir, engine: 'unknown', displayName: 'unknown', confidence: 0, warnings: ['项目目录无法访问'] };
    }
    const names = entries.map((entry) => entry.name.toLowerCase());
    const hasUnitySignature = names.includes('unityplayer.dll') || entries.some((entry) => entry.isDirectory() && /_data$/i.test(entry.name));
    if (!hasUnitySignature) return { ok: false, rootDir, engine: 'unknown', displayName: 'unknown', confidence: 0 };
    const dataDirs = entries.filter((entry) => entry.isDirectory() && /_data$/i.test(entry.name)).map((entry) => path.join(rootDir, entry.name));
    return {
      ok: true,
      rootDir,
      engine: this.engineName,
      displayName: 'Unity',
      confidence: 0.65,
      dataRoots: dataDirs,
      warnings: ['Unity 适配器接口已预留，当前版本暂未实现 Unity 资源解包与文本回写。'],
    };
  }

  extract(rootDir) {
    const detection = this.detect(rootDir);
    return {
      ok: false,
      ...detection,
      entries: [],
      groups: [],
      warnings: [...(detection.warnings || []), 'Unity 文本提取暂未实现，请先使用 RPG Maker MV/MZ 项目或等待后续适配器。'],
    };
  }
}

module.exports = { UnityAdapterStub };
