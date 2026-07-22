/**
 * @file src/main/services/engines/adapters/RenPyAdapter.js
 * @description Ren'Py 视觉小说引擎适配器。
 *   识别 game/*.rpy 脚本，提取对话、菜单选项、普通字符串等可翻译文本。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { EngineAdapter } = require('../EngineAdapter');
const { createLocalizationEntry } = require('../../localization/LocalizationEntry');

class RenPyAdapter extends EngineAdapter {
  constructor() {
    super('renpy');
    this.displayName = "Ren'Py";
  }

  detect(rootDir) {
    if (!rootDir || !fs.existsSync(rootDir)) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots: [], warnings: [] };
    }
    let confidence = 0;
    let dataRoots = [];

    const gameDir = path.join(rootDir, 'game');
    const hasRpy = fs.existsSync(gameDir) && this._hasRpyFiles(gameDir);
    const hasRenpyDir = fs.existsSync(path.join(rootDir, 'renpy'));

    if (hasRpy) {
      confidence += 0.8;
      dataRoots = [path.join(rootDir, 'game').replace(/\\/g, '/')];
    }
    if (hasRenpyDir) confidence += 0.15;
    if (fs.existsSync(path.join(rootDir, 'project.json'))) confidence += 0.05;

    if (confidence <= 0) {
      return { ok: false, rootDir, engine: this.engineName, displayName: this.displayName, confidence: 0, dataRoots, warnings: [] };
    }
    return {
      ok: true,
      rootDir,
      engine: this.engineName,
      displayName: this.displayName,
      confidence: Math.min(1, confidence),
      dataRoots,
      warnings: [],
    };
  }

  _hasRpyFiles(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.some((e) => e.isFile() && e.name.endsWith('.rpy'));
    } catch {
      return false;
    }
  }

  async extract(rootDir, options = {}) {
    const detection = this.detect(rootDir);
    if (!detection.ok) {
      return { ok: false, engine: this.engineName, entries: [], groups: [], warnings: ["未识别到 Ren'Py 项目结构"] };
    }
    const entries = [];
    const warnings = [];
    const gameDir = path.join(rootDir, 'game');
    if (!fs.existsSync(gameDir)) {
      return { ok: true, engine: this.engineName, entries: [], groups: [], warnings: ['未找到 game 目录'] };
    }

    const files = await this._listRpyFiles(gameDir);
    for (const file of files) {
      const relFile = path.relative(rootDir, file).replace(/\\/g, '/');
      try {
        const text = await fsp.readFile(file, 'utf8');
        const lines = text.split(/\r?\n/);
        lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
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

  async _listRpyFiles(dir) {
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
        } else if (entry.isFile() && entry.name.endsWith('.rpy')) {
          results.push(full);
        }
      }
    }
    await walk(dir);
    return results;
  }

  _extractLineText(line) {
    // 对话：e "Hello" 或 "Hello"
    const dialogueMatch = line.match(/^\w+\s+["']([^"']+)["']\s*$/);
    if (dialogueMatch) return dialogueMatch[1].trim();

    // menu 选项："Choice":
    const menuMatch = line.match(/^\s*["']([^"']+)["']\s*:\s*$/);
    if (menuMatch) return menuMatch[1].trim();

    // 普通字符串赋值：some = "..."（尽量窄匹配，避免代码串）
    const stringMatch = line.match(/^\s*\w+\s*=\s*["']([^"']+)["']\s*$/);
    if (stringMatch) return stringMatch[1].trim();

    return null;
  }

  apply() {
    return { ok: false, engine: this.engineName, changedFiles: [], warnings: ["Ren'Py 写回尚未实现"] };
  }

  getDefaultConstraints() {
    return { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false, allowMergeWithNext: true, allowSplit: true };
  }
}

module.exports = { RenPyAdapter };
