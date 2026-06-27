/**
 * @file src/main/services/engine/EngineAdapter.js
 * @description 引擎适配器接口契约。所有具体引擎适配器需实现下列方法。
 *
 * detect(rootDir)            → {confidence: 0..1, info: object}
 * extract(rootDir)           → 与原 collectProjectTexts 返回形状一致 (rootDir, engine, files,
 *                              features, dataRoots, entries, warnings)
 * apply(payload)             → {ok, outputDir, files, errors, skipped}
 * getConstraints(kind)       → {maxCharsPerLine, maxLines, preserveControlCodes}
 */

const REQUIRED = ['id', 'displayName', 'detect', 'extract', 'apply', 'getConstraints'];

/**
 * 运行时检查 adapter 接口完整性。
 */
function assertAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new Error('Adapter 必须是对象');
  for (const key of REQUIRED) {
    if (!(key in adapter)) throw new Error(`Adapter 缺少字段：${key}`);
  }
  for (const key of ['detect', 'extract', 'apply', 'getConstraints']) {
    if (typeof adapter[key] !== 'function') throw new Error(`Adapter.${key} 必须是函数`);
  }
  return adapter;
}

module.exports = { assertAdapter, REQUIRED };
