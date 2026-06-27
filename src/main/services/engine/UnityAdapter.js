/**
 * @file src/main/services/engine/UnityAdapter.js
 * @description Unity 引擎适配器（占位 stub）。当前仅识别引擎、未实现文本提取。
 *
 * 未来扩展方向：
 *  - 明文 I18N.csv / LocalizationData.json / TextMeshPro 资源
 *  - 二进制 .assets/.bundle（依赖 AssetStudio CLI 等外部工具）
 */

const fs = require('fs');
const path = require('path');
const { getConstraints } = require('../validation/EngineConstraints');

/**
 * 检测：
 *  - 找到 *_Data 目录 + UnityPlayer.dll → 0.95
 *  - 仅找到 Assembly-CSharp.dll → 0.7
 *  - 否则 → 0
 */
function detect(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return { confidence: 0, info: null };
  let entries = [];
  try { entries = fs.readdirSync(rootDir, { withFileTypes: true }); } catch { return { confidence: 0, info: null }; }
  const names = entries.map((e) => e.name);
  const hasUnityPlayer = names.includes('UnityPlayer.dll');
  const hasDataDir = entries.some((e) => e.isDirectory() && /_Data$/i.test(e.name));
  const hasAssembly = names.some((name) => /^Assembly-CSharp\.dll$/i.test(name)) || entries.some((e) => e.isDirectory() && /_Data$/i.test(e.name) && fs.existsSync(path.join(rootDir, e.name, 'Managed', 'Assembly-CSharp.dll')));
  let confidence = 0;
  if (hasUnityPlayer && hasDataDir) confidence = 0.95;
  else if (hasDataDir) confidence = 0.8;
  else if (hasAssembly) confidence = 0.7;
  return { confidence, info: { hasUnityPlayer, hasDataDir, hasAssembly } };
}

function extract(rootDir) {
  return {
    rootDir,
    engine: 'Unity',
    files: [],
    features: {},
    dataRoots: [],
    entries: [],
    warnings: ['Unity 引擎文本提取尚未实现，敬请等待后续版本。'],
  };
}

function apply() {
  return Promise.resolve({ ok: false, message: 'Unity 引擎写回尚未实现', files: [], errors: [{ reason: 'Unity adapter not implemented' }], skipped: 0 });
}

module.exports = {
  id: 'unity',
  displayName: 'Unity',
  detect,
  extract,
  apply,
  getConstraints: (kind) => getConstraints('Unity', kind),
};
