/**
 * @file src/main/services/engines/EngineAdapter.js
 * @description 引擎适配器抽象基类。
 */

class EngineAdapter {
  constructor(engineName = 'unknown') {
    this.engineName = engineName;
  }

  detect() {
    return { ok: false, engine: this.engineName, confidence: 0 };
  }

  extract() {
    return { ok: false, engine: this.engineName, entries: [], groups: [], warnings: [] };
  }

  apply() {
    return { ok: false, engine: this.engineName, changedFiles: [], warnings: [] };
  }

  validateEntry(entry) {
    return { ok: true, entry, warnings: [] };
  }

  getDefaultConstraints() {
    return { maxCharsPerLine: 28, maxLines: 4, preserveControlCodes: true, allowMergeWithNext: true, allowSplit: true };
  }
}

module.exports = { EngineAdapter };
