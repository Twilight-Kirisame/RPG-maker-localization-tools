/**
 * @file src/main/services/engines/adapters/BaseStubAdapter.js
 * @description 二进制/复杂引擎的 stub 适配器基类。
 *   只实现识别，extract/apply 返回友好提示。
 */

const fs = require('fs');
const { EngineAdapter } = require('../EngineAdapter');

class BaseStubAdapter extends EngineAdapter {
  constructor(engineName, displayName, detector) {
    super(engineName);
    this.displayName = displayName;
    this.detector = detector;
  }

  detect(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots: [], warnings: [] };
    }
    const result = this.detector(rootDir);
    if (!result.found) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots: [], warnings: [] };
    }
    return {
      ok: true,
      rootDir,
      engine: this.engineName,
      displayName: this.displayName,
      confidence: result.confidence || 0.6,
      dataRoots: result.dataRoots || [],
      warnings: [],
    };
  }

  extract(rootDir) {
    return {
      ok: true,
      engine: this.engineName,
      entries: [],
      groups: [],
      warnings: [`${this.displayName} 文本提取尚未实现，当前仅支持识别项目结构。`],
    };
  }

  apply() {
    return { ok: false, engine: this.engineName, changedFiles: [], warnings: [`${this.displayName} 写回尚未实现`] };
  }

  getDefaultConstraints() {
    return { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false, allowMergeWithNext: true, allowSplit: true };
  }
}

module.exports = { BaseStubAdapter };
