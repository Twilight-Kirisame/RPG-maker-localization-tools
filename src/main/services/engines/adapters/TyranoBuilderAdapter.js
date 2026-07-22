/**
 * @file src/main/services/engines/adapters/TyranoBuilderAdapter.js
 * @description TyranoBuilder 视觉小说引擎适配器。
 *   识别 data/scenario/*.ks 等脚本，提取对话、选项、标签等可翻译文本。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { EngineAdapter } = require('../EngineAdapter');
const { createLocalizationEntry } = require('../../localization/LocalizationEntry');

class TyranoBuilderAdapter extends EngineAdapter {
  constructor() {
    super('tyrano-builder');
    this.displayName = 'TyranoBuilder';
  }

  detect(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots: [], warnings: [] };
    }
    let confidence = 0;
    let dataRoots = [];
    const warnings = [];

    // TyranoBuilder 常见特征
    const markers = [
      'data/scenario',
      'tyrano',
      'index.html',
    ];
    const found = [];
    for (const marker of markers) {
      const full = path.join(rootDir, marker);
      if (fs.existsSync(full)) found.push(marker);
    }

    const hasKs = this._hasKsFiles(rootDir);
    const hasTyranoDir = found.includes('tyrano');
    const hasIndexHtml = found.includes('index.html');

    // 必须有 tyrano 目录或 index.html，否则容易和 Kirikiri 混淆
    if (!hasKs || (!hasTyranoDir && !hasIndexHtml)) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots, warnings };
    }

    confidence += 0.7;
    dataRoots = [path.join(rootDir, 'data/scenario').replace(/\\/g, '/')];
    if (hasTyranoDir) confidence += 0.2;
    if (hasIndexHtml) confidence += 0.1;

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

  async extract(rootDir, options = {}) {
    const detection = this.detect(rootDir);
    if (!detection.ok) {
      return { ok: false, engine: this.engineName, entries: [], groups: [], warnings: ['未识别到 TyranoBuilder 项目结构'] };
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

    return { ok: true, engine: this.engineName, entries, groups: this._buildGroups(entries), warnings };
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
    if (/^[;*@#]/.test(line)) return null;
    if (/^\[/.test(line)) {
      // 提取 [select text="..."] [link text="..."] 等
      const match = line.match(/\[(?:select|link)(?:\s+[^\]]*?)?\s+(?:text|exp)=["']([^"']+)["']/i);
      return match ? match[1].trim() : null;
    }
    // 普通对话行
    return line.trim() || null;
  }

  _buildGroups(entries) {
    // TyranoBuilder 脚本按文件简单分组即可
    return [];
  }

  apply() {
    return { ok: false, engine: this.engineName, changedFiles: [], warnings: ['TyranoBuilder 写回尚未实现'] };
  }

  getDefaultConstraints() {
    return { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false, allowMergeWithNext: true, allowSplit: true };
  }
}

module.exports = { TyranoBuilderAdapter };
