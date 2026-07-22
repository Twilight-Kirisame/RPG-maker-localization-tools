/**
 * @file src/main/services/engines/adapters/KirikiriAdapter.js
 * @description Kirikiri / KAG 视觉小说引擎适配器。
 *   识别 data/scenario/*.ks 等脚本，提取对话、选项、标签等可翻译文本。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { EngineAdapter } = require('../EngineAdapter');
const { createLocalizationEntry } = require('../../localization/LocalizationEntry');

class KirikiriAdapter extends EngineAdapter {
  constructor() {
    super('kirikiri');
    this.displayName = 'Kirikiri / KAG';
  }

  detect(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots: [], warnings: [] };
    }
    let confidence = 0;
    let dataRoots = [];
    const warnings = [];

    const hasKs = this._hasKsFiles(rootDir);
    const hasTjs = this._hasTjsFiles(rootDir);
    const hasData = fs.existsSync(path.join(rootDir, 'data'));

    if (hasKs) {
      confidence += 0.7;
      dataRoots = [path.join(rootDir, 'data/scenario').replace(/\\/g, '/')];
    }
    if (hasTjs) confidence += 0.2;
    if (hasData) confidence += 0.1;

    if (confidence <= 0) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots, warnings };
    }
    return {
      ok: true,
      rootDir,
      engine: this.engineName,
      displayName: this.displayName,
      confidence: Math.min(1, confidence),
      dataRoots,
      warnings,
    };
  }

  _hasKsFiles(rootDir) {
    const scenarioDir = path.join(rootDir, 'data/scenario');
    if (!fs.existsSync(scenarioDir)) return false;
    try {
      const entries = fs.readdirSync(scenarioDir, { withFileTypes: true });
      return entries.some((e) => e.isFile() && e.name.endsWith('.ks'));
    } catch {
      return false;
    }
  }

  _hasTjsFiles(rootDir) {
    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      return entries.some((e) => e.isFile() && e.name.endsWith('.tjs'));
    } catch {
      return false;
    }
  }

  async extract(rootDir, options = {}) {
    const detection = this.detect(rootDir);
    if (!detection.ok) {
      return { ok: false, engine: this.engineName, entries: [], groups: [], warnings: ['未识别到 Kirikiri 项目结构'] };
    }
    const entries = [];
    const warnings = [];
    const scenarioDir = path.join(rootDir, 'data/scenario');
    if (!fs.existsSync(scenarioDir)) {
      return { ok: true, engine: this.engineName, entries: [], groups: [], warnings: ['未找到 data/scenario 目录'] };
    }

    const files = await this._listKsFiles(scenarioDir);
    for (const file of files) {
      const relFile = path.relative(rootDir, file).replace(/\\/g, '/');
      try {
        const text = await fsp.readFile(file, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) return;
          const extracted = this._extractLineText(trimmed);
          if (extracted) {
            entries.push(createLocalizationEntry({
              engine: this.engineName,
              projectRoot: rootDir,
              file: relFile,
              key: `L${index + 1}`,
              path: `L${index + 1}`,
              source: extracted,
              textClass: 'contextual',
              textType: 'dialogue-line',
              adapterMeta: { kind: 'dialogue-line', line: index + 1, raw: trimmed },
            }));
          }
        });
      } catch (error) {
        warnings.push(`读取失败：${relFile} (${error.message})`);
      }
    }

    return { ok: true, engine: this.engineName, entries, groups: [], warnings };
  }

  async _listKsFiles(dir) {
    const results = [];
    async function walk(current) {
      let entries = [];
      try {
        entries = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile() && entry.name.endsWith('.ks')) {
          results.push(full);
        }
      }
    }
    await walk(dir);
    return results;
  }

  _extractLineText(line) {
    // 忽略注释、标签、宏/标签行
    if (/^[;*@]/.test(line)) return null;
    if (/^\[/.test(line)) {
      // 提取 [select ...] [link ...] 等
      const match = line.match(/\[(?:select|link)(?:\s+[^\]]*?)?\s+(?:text|exp)=["']([^"']+)["']/i);
      return match ? match[1].trim() : null;
    }
    return line.trim() || null;
  }

  apply() {
    return { ok: false, engine: this.engineName, changedFiles: [], warnings: ['Kirikiri 写回尚未实现'] };
  }

  getDefaultConstraints() {
    return { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false, allowMergeWithNext: true, allowSplit: true };
  }
}

module.exports = { KirikiriAdapter };
