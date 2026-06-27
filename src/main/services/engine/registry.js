/**
 * @file src/main/services/engine/registry.js
 * @description 引擎适配器注册与按目录置信度自动选择。
 */

const { assertAdapter } = require('./EngineAdapter');
const RpgMakerAdapter = require('./RpgMakerAdapter');
const UnityAdapter = require('./UnityAdapter');

const adapters = [
  assertAdapter(RpgMakerAdapter),
  assertAdapter(UnityAdapter),
];

/**
 * 列出全部适配器（不含探测结果）。
 */
function listAdapters() {
  return adapters.map((a) => ({ id: a.id, displayName: a.displayName }));
}

/**
 * 按 rootDir 探测所有适配器，返回置信度最高的那个；全部为 0 时退回 RpgMaker（向后兼容）。
 */
function pickAdapter(rootDir) {
  let best = null;
  for (const adapter of adapters) {
    const probe = adapter.detect(rootDir) || { confidence: 0 };
    if (!best || probe.confidence > best.probe.confidence) best = { adapter, probe };
  }
  if (!best || best.probe.confidence <= 0) return { adapter: RpgMakerAdapter, probe: { confidence: 0, info: null }, fallback: true };
  return { ...best, fallback: false };
}

/**
 * 按 id 获取适配器。
 */
function getAdapterById(id) {
  return adapters.find((a) => a.id === id) || null;
}

module.exports = { listAdapters, pickAdapter, getAdapterById };
