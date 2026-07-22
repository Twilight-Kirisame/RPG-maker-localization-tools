/**
 * @file src/main/services/engine/registry.js
 * @description 引擎适配器注册与按目录置信度自动选择。
 */

const { assertAdapter } = require('./EngineAdapter');
const RpgMakerAdapter = require('./RpgMakerAdapter');
const UnityAdapter = require('./UnityAdapter');
const { TyranoBuilderAdapter } = require('../engines/adapters/TyranoBuilderAdapter');
const { KirikiriAdapter } = require('../engines/adapters/KirikiriAdapter');
const { RenPyAdapter } = require('../engines/adapters/RenPyAdapter');
const { RpgMakerOldAdapter } = require('../engines/adapters/RpgMakerOldAdapter');
const { MkxpAdapter } = require('../engines/adapters/MkxpAdapter');
const { WolfRpgAdapter } = require('../engines/adapters/WolfRpgAdapter');
const { SrpgStudioAdapter } = require('../engines/adapters/SrpgStudioAdapter');
const { SmileGameBuilderAdapter } = require('../engines/adapters/SmileGameBuilderAdapter');
const { BakinAdapter } = require('../engines/adapters/BakinAdapter');
const { PixelGameMakerMvAdapter } = require('../engines/adapters/PixelGameMakerMvAdapter');
const { getConstraints } = require('../validation/EngineConstraints');

function wrapModernAdapter(AdapterClass) {
  const instance = new AdapterClass();
  return {
    id: instance.engineName,
    displayName: instance.displayName,
    detect: (rootDir) => {
      const result = instance.detect(rootDir);
      return { confidence: result.ok ? (result.confidence || 0.6) : 0, info: result };
    },
    extract: (rootDir) => instance.extract(rootDir),
    apply: (payload) => instance.apply(payload),
    getConstraints: (kind) => instance.getDefaultConstraints(),
  };
}

const adapters = [
  assertAdapter(RpgMakerAdapter),
  assertAdapter(UnityAdapter),
  assertAdapter(wrapModernAdapter(TyranoBuilderAdapter)),
  assertAdapter(wrapModernAdapter(KirikiriAdapter)),
  assertAdapter(wrapModernAdapter(RenPyAdapter)),
  assertAdapter(wrapModernAdapter(RpgMakerOldAdapter)),
  assertAdapter(wrapModernAdapter(MkxpAdapter)),
  assertAdapter(wrapModernAdapter(WolfRpgAdapter)),
  assertAdapter(wrapModernAdapter(SrpgStudioAdapter)),
  assertAdapter(wrapModernAdapter(SmileGameBuilderAdapter)),
  assertAdapter(wrapModernAdapter(BakinAdapter)),
  assertAdapter(wrapModernAdapter(PixelGameMakerMvAdapter)),
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
