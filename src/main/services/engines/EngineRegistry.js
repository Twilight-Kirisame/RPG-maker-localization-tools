/**
 * @file src/main/services/engines/EngineRegistry.js
 * @description 引擎适配器注册与路由。
 */

const { RpgMakerAdapter } = require('./adapters/RpgMakerAdapter');
const { UnityAdapterStub } = require('./adapters/UnityAdapter.stub');

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

module.exports = { registerAdapter, getAdapter, detectEngine, extractProjectTexts, applyProjectTexts };
