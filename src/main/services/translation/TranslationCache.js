/**
 * @file src/main/services/translation/TranslationCache.js
 * @description AI 译文 LRU 哈希缓存：键 = sha1(provider|model|systemPrompt|source)，
 * 值 = {text, ts}。按项目分文件持久化到 userData/projects/<slug>.translation-cache.json。
 * 命中可避免重复消耗 token；切换 provider / model / prompt 自动 miss。
 */

const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { projectStoragePath } = require('../storage/StorageService');

const MAX_ENTRIES = 10_000;
const FLUSH_DEBOUNCE_MS = 800;

const cacheBySlug = new Map();
const dirtySlugs = new Set();
const flushTimers = new Map();

/**
 * 计算缓存 key。
 * @param {{provider: string, model: string, systemPrompt: string, source: string}} params
 * @returns {string}
 */
function keyFor({ provider, model, systemPrompt, source }) {
  return crypto
    .createHash('sha1')
    .update(String(provider || ''))
    .update('')
    .update(String(model || ''))
    .update('')
    .update(String(systemPrompt || ''))
    .update('')
    .update(String(source || ''))
    .digest('hex');
}

/**
 * 用项目 rootDir 推一个 slug 用作 Map key。
 */
function slugFor(project) {
  return String(project?.rootDir || '').trim() || null;
}

function cacheFilePathFor(project) {
  return projectStoragePath(project, 'translation-cache.json');
}

/**
 * 懒加载某个项目的缓存。
 */
async function ensureLoaded(project) {
  const slug = slugFor(project);
  if (!slug) return null;
  if (cacheBySlug.has(slug)) return cacheBySlug.get(slug);
  let parsed = { entries: {} };
  try {
    const filePath = cacheFilePathFor(project);
    if (fs.existsSync(filePath)) {
      const raw = await fsp.readFile(filePath, 'utf8');
      const json = JSON.parse(raw);
      if (json && typeof json === 'object' && json.entries && typeof json.entries === 'object') parsed = json;
    }
  } catch {
    parsed = { entries: {} };
  }
  const map = new Map(Object.entries(parsed.entries || {}));
  cacheBySlug.set(slug, map);
  return map;
}

/**
 * 查询缓存。命中返回 {text, ts}；未命中返回 null。
 */
async function get(project, key) {
  const map = await ensureLoaded(project);
  if (!map || !key) return null;
  const hit = map.get(key);
  if (!hit) return null;
  hit.ts = Date.now();
  scheduleFlush(project);
  return hit;
}

/**
 * 写入缓存。
 */
async function set(project, key, text) {
  const map = await ensureLoaded(project);
  if (!map || !key) return;
  map.set(key, { text: String(text || ''), ts: Date.now() });
  if (map.size > MAX_ENTRIES) evictLru(map);
  scheduleFlush(project);
}

function evictLru(map) {
  const overflow = map.size - MAX_ENTRIES;
  if (overflow <= 0) return;
  const sorted = [...map.entries()].sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  for (let i = 0; i < overflow; i++) map.delete(sorted[i][0]);
}

function scheduleFlush(project) {
  const slug = slugFor(project);
  if (!slug) return;
  dirtySlugs.add(slug);
  if (flushTimers.has(slug)) clearTimeout(flushTimers.get(slug));
  const timer = setTimeout(() => flush(project).catch(() => {}), FLUSH_DEBOUNCE_MS);
  flushTimers.set(slug, timer);
}

/**
 * 主动刷盘（debounce 触发或手动调用均可）。
 */
async function flush(project) {
  const slug = slugFor(project);
  if (!slug) return;
  if (!dirtySlugs.has(slug)) return;
  dirtySlugs.delete(slug);
  flushTimers.delete(slug);
  const map = cacheBySlug.get(slug);
  if (!map) return;
  const filePath = cacheFilePathFor(project);
  const payload = { schema: 'rpg-localization-translation-cache/v1', updatedAt: new Date().toISOString(), entries: Object.fromEntries(map.entries()) };
  try {
    await fsp.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // 写盘失败不应中断翻译流程，下次有变化时会重试
  }
}

/**
 * 清空指定项目的缓存（内存 + 文件）。
 */
async function clear(project) {
  const slug = slugFor(project);
  if (!slug) return;
  cacheBySlug.delete(slug);
  dirtySlugs.delete(slug);
  if (flushTimers.has(slug)) { clearTimeout(flushTimers.get(slug)); flushTimers.delete(slug); }
  const filePath = cacheFilePathFor(project);
  if (fs.existsSync(filePath)) {
    try { await fsp.unlink(filePath); } catch { /* ignore */ }
  }
}

module.exports = { keyFor, get, set, flush, clear };
