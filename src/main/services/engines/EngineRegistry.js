/**
 * @file src/main/services/engines/EngineRegistry.js
 * @description 引擎适配器注册与路由。
 */

const { RpgMakerAdapter } = require('./adapters/RpgMakerAdapter');
const { UnityAdapterStub } = require('./adapters/UnityAdapter.stub');
const { TyranoBuilderAdapter } = require('./adapters/TyranoBuilderAdapter');
const { KirikiriAdapter } = require('./adapters/KirikiriAdapter');
const { RenPyAdapter } = require('./adapters/RenPyAdapter');
const { RpgMakerOldAdapter } = require('./adapters/RpgMakerOldAdapter');
const { MkxpAdapter } = require('./adapters/MkxpAdapter');
const { WolfRpgAdapter } = require('./adapters/WolfRpgAdapter');
const { SrpgStudioAdapter } = require('./adapters/SrpgStudioAdapter');
const { SmileGameBuilderAdapter } = require('./adapters/SmileGameBuilderAdapter');
const { BakinAdapter } = require('./adapters/BakinAdapter');
const { PixelGameMakerMvAdapter } = require('./adapters/PixelGameMakerMvAdapter');

/**
 * 懒加载阈值：满足任一条件即对项目启用文件级懒加载。
 * - 单个 JSON 文件大小超过 LAZY_LOAD_FILE_SIZE_BYTES 时，该文件单独懒加载。
 * - 项目 JSON 文件总大小超过 LAZY_LOAD_TOTAL_SIZE_BYTES 时，整个项目启用懒加载。
 */
const LAZY_LOAD_FILE_SIZE_BYTES = 512 * 1024; // 512 KB
const LAZY_LOAD_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const LAZY_LOAD_TOTAL_ENTRIES = 50000;

const adapters = new Map();

function registerAdapter(adapter) {
  if (!adapter?.engineName) throw new Error('适配器缺少 engineName');
  adapters.set(adapter.engineName, adapter);
  return adapter;
}

function getAdapter(engineName) {
  return adapters.get(engineName) || adapters.get('rpg-maker') || null;
}

function detectEngine(rootDir) {
  let best = null;
  for (const adapter of adapters.values()) {
    const result = adapter.detect(rootDir);
    if (result?.ok && (!best || Number(result.confidence || 0) > Number(best.confidence || 0))) best = result;
  }
  return best || { ok: false, rootDir, engine: 'unknown', displayName: 'unknown', confidence: 0, dataRoots: [], warnings: ['未识别到支持的游戏数据结构'] };
}

function shouldUseLazyLoad(files, totalEntries) {
  if (!Array.isArray(files) || !files.length) return false;
  if (typeof totalEntries === 'number' && totalEntries >= LAZY_LOAD_TOTAL_ENTRIES) return true;
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  if (totalSize >= LAZY_LOAD_TOTAL_SIZE_BYTES) return true;
  if (files.some((file) => (file.size || 0) >= LAZY_LOAD_FILE_SIZE_BYTES)) return true;
  return false;
}

function listProjectFiles(rootDir, options = {}) {
  const detection = detectEngine(rootDir);
  const adapter = getAdapter(detection.engine);
  if (!adapter) return { ok: false, ...detection, files: [], warnings: ['未找到匹配的引擎适配器'] };
  if (typeof adapter.listFiles !== 'function') {
    return { ok: false, ...detection, files: [], warnings: ['当前引擎适配器不支持文件级懒加载'] };
  }
  return adapter.listFiles(rootDir, options);
}

function extractProjectFile(rootDir, filePath, options = {}) {
  const detection = detectEngine(rootDir);
  const adapter = getAdapter(detection.engine);
  if (!adapter) return { ok: false, file: filePath, entries: [], groups: [], warnings: ['未找到匹配的引擎适配器'] };
  if (typeof adapter.extractFile !== 'function') {
    return { ok: false, file: filePath, entries: [], groups: [], warnings: ['当前引擎适配器不支持按文件提取'] };
  }
  return adapter.extractFile(rootDir, filePath, options);
}

function extractProjectTexts(rootDir, options = {}) {
  const detection = detectEngine(rootDir);
  const adapter = getAdapter(detection.engine);
  if (!adapter) return { ok: false, ...detection, entries: [], groups: [], warnings: ['未找到匹配的引擎适配器'] };
  return adapter.extract(rootDir, options);
}

function applyProjectTexts(rootDir, entries, options = {}) {
  const detection = detectEngine(rootDir);
  const adapter = getAdapter(detection.engine);
  if (!adapter) return { ok: false, ...detection, changedFiles: [], warnings: ['未找到匹配的引擎适配器'] };
  return adapter.apply(rootDir, entries, options);
}

registerAdapter(new RpgMakerAdapter());
registerAdapter(new UnityAdapterStub());
registerAdapter(new TyranoBuilderAdapter());
registerAdapter(new KirikiriAdapter());
registerAdapter(new RenPyAdapter());
registerAdapter(new RpgMakerOldAdapter());
registerAdapter(new MkxpAdapter());
registerAdapter(new WolfRpgAdapter());
registerAdapter(new SrpgStudioAdapter());
registerAdapter(new SmileGameBuilderAdapter());
registerAdapter(new BakinAdapter());
registerAdapter(new PixelGameMakerMvAdapter());

module.exports = { registerAdapter, getAdapter, detectEngine, listProjectFiles, extractProjectFile, extractProjectTexts, applyProjectTexts, shouldUseLazyLoad, LAZY_LOAD_FILE_SIZE_BYTES, LAZY_LOAD_TOTAL_SIZE_BYTES, LAZY_LOAD_TOTAL_ENTRIES };
