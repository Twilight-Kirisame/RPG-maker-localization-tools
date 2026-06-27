// @ts-nocheck
/**
 * @file src/main/services/translation/TranslationService.js
 * @description 兼容原 AI 翻译设置与调用的翻译服务。
 */

const crypto = require('crypto');
const { projectStoragePath } = require('../storage/StorageService');
const { applyInjection } = require('./GlossaryInjector');
const TranslationCache = require('./TranslationCache');
const AutoSplit = require('./AutoSplit');
const { getConstraints } = require('../validation/EngineConstraints');
const fs = require('fs');
const fsp = fs.promises;

const defaultPrompt = '你是一个专业的 RPG Maker 游戏汉化助手，请将原文自然准确地翻译成简体中文。';
const acgPrompt = '你是一个专业的 ACG 领域日中翻译专家。要求译文地道、活人感强、消除翻译腔。在语境合适时，必须使用中国特有的成语、歇后语或固定短语进行意译（例如将单纯的“力量对抗”转化为“道高一尺，魔高一丈”等具有文学色彩的表达）。不要解释，直接输出译文。';
const baiduTranslateEndpoint = 'https://fanyi-api.baidu.com/api/trans/vip/translate';
const providerDefaults = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    endpoint: '/chat/completions',
    model: 'deepseek-v4-flash',
  },
};

const baiduLanguageMap = {
  'zh-CN': 'zh',
  'zh-cn': 'zh',
  zh_CN: 'zh',
  zh_cn: 'zh',
  'zh-Hans': 'zh',
  'zh-hans': 'zh',
  zh: 'zh',
  cn: 'zh',
  chinese: 'zh',
  ja: 'jp',
  jp: 'jp',
  japanese: 'jp',
  ko: 'kor',
  kr: 'kor',
  kor: 'kor',
  korean: 'kor',
  en: 'en',
  english: 'en',
  auto: 'auto',
};

function normalizeBaiduLanguage(language, fallback) {
  const value = String(language || fallback || '').trim();
  if (!value) return fallback;
  return baiduLanguageMap[value] || baiduLanguageMap[value.toLowerCase()] || value;
}

function normalizeBaiduSettings(settings = {}) {
  return {
    appId: String(settings.baiduAppId || settings.appId || '').trim(),
    secretKey: String(settings.baiduSecretKey || settings.secretKey || '').trim(),
    from: normalizeBaiduLanguage(settings.sourceLang, 'auto'),
    to: normalizeBaiduLanguage(settings.targetLang, 'zh'),
  };
}

function parseBaiduError(json, httpStatus) {
  if (json?.error_code) {
    const code = String(json.error_code);
    const detail = json.error_msg || '未知错误';
    return `百度翻译失败：${code} ${detail}`;
  }
  return `百度翻译失败 HTTP ${httpStatus}`;
}

/**
 * 加载 AI 设置（全局存储）。
 * @returns {Promise<Object>}
 */
async function loadAiSettings() {
  const filePath = appStoragePath('ai-settings.json');
  if (!fs.existsSync(filePath)) return { provider: 'mock', apiKey: '', baseUrl: '', model: '', prompt: defaultPrompt, traditional: {} };
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch {
    return { provider: 'mock', apiKey: '', baseUrl: '', model: '', prompt: defaultPrompt, traditional: {} };
  }
}

/**
 * 保存 AI 设置（全局存储）。
 * @param {Object} settings
 * @returns {Promise<Object>}
 */
async function saveAiSettings(settings) {
  const filePath = appStoragePath('ai-settings.json');
  await fsp.writeFile(filePath, JSON.stringify(settings || {}, null, 2), 'utf8');
  return { ok: true, path: filePath };
}

/**
 * 保存翻译器设置。
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function saveTranslatorSettings(payload) {
  const current = await loadAiSettings();
  const next = payload?.type === 'traditional'
    ? { ...current, traditional: payload.settings || {} }
    : { ...current, ...(payload?.settings || payload || {}) };
  return saveAiSettings(next);
}

/**
 * 百度签名。
 * @param {string} appId
 * @param {string} query
 * @param {string} salt
 * @param {string} secretKey
 * @returns {string}
 */
function createBaiduSign(appId, query, salt, secretKey) {
  return crypto.createHash('md5').update(`${appId}${query}${salt}${secretKey}`).digest('hex');
}

/**
 * 调用传统翻译测试。
 * @param {Object} settings
 * @param {string} sampleText
 * @returns {Promise<Object>}
 */
async function translateWithBaidu(settings, sourceText) {
  const baidu = normalizeBaiduSettings(settings);
  const query = String(sourceText || '').trim();
  if (!query) return { ok: false, provider: 'baidu', message: '缺少待翻译文本' };
  if (!baidu.appId || !baidu.secretKey) return { ok: false, provider: 'baidu', message: '百度 App ID 或密钥未完整配置' };

  const salt = String(Date.now());
  const body = new URLSearchParams();
  body.set('q', query);
  body.set('from', baidu.from);
  body.set('to', baidu.to);
  body.set('appid', baidu.appId);
  body.set('salt', salt);
  body.set('sign', createBaiduSign(baidu.appId, query, salt, baidu.secretKey));

  const response = await fetch(baiduTranslateEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error_code) return { ok: false, provider: 'baidu', message: parseBaiduError(json, response.status) };
  const translatedText = Array.isArray(json.trans_result) ? json.trans_result.map((item) => item.dst || '').join('\n').trim() : '';
  if (!translatedText) return { ok: false, provider: 'baidu', message: '百度翻译未返回译文' };
  return { ok: true, provider: 'baidu', translatedText, message: `百度翻译完成：${translatedText}` };
}

async function translateWithGoogle(settings, sourceText) {
  const query = String(sourceText || '').trim();
  const apiKey = String(settings?.googleApiKey || settings?.apiKey || '').trim();
  if (!query) return { ok: false, provider: 'google', message: '缺少待翻译文本' };
  if (!apiKey) return { ok: false, provider: 'google', message: 'Google API Key 未完整配置' };

  const target = normalizeBaiduLanguage(settings?.targetLang, 'zh-CN');
  const source = String(settings?.sourceLang || 'auto').trim() || 'auto';
  const url = new URL('https://translation.googleapis.com/language/translate/v2');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, source, target, format: 'text' }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.error) return { ok: false, provider: 'google', message: json?.error?.message || `Google 翻译失败 HTTP ${response.status}` };
  const translatedText = json?.data?.translations?.map((item) => item.translatedText || '').join('\n').trim() || '';
  if (!translatedText) return { ok: false, provider: 'google', message: 'Google 翻译未返回译文' };
  return { ok: true, provider: 'google', translatedText, message: `Google 翻译完成：${translatedText}` };
}

async function testTraditional(settings, sampleText = '测试文本') {
  const provider = String(settings?.provider || 'baidu').toLowerCase();
  if (provider === 'google') return translateWithGoogle(settings, sampleText).then((result) => (result.ok ? { ok: true, message: `传统翻译测试成功：${result.translatedText}` } : result));
  const result = await translateWithBaidu(settings, sampleText);
  return result.ok ? { ok: true, message: `传统翻译测试成功：${result.translatedText}` } : result;
}

function normalizeDeepseekBaseUrl(baseUrl) {
  const raw = String(baseUrl || providerDefaults.deepseek.baseUrl).trim().replace(/\/+$/, '');
  if (!raw) return providerDefaults.deepseek.baseUrl;
  if (/^https:\/\/api\.deepseek\.com(?:\/v1)?$/i.test(raw)) return providerDefaults.deepseek.baseUrl;
  if (/^https:\/\/api\.deepseek\.com\/chat\/completions$/i.test(raw)) return providerDefaults.deepseek.baseUrl;
  return raw.replace(/\/v1$/i, '');
}

function normalizeChatCompletionUrl(provider, baseUrl) {
  const defaults = providerDefaults[provider] || {};
  const rawBase = provider === 'deepseek' ? normalizeDeepseekBaseUrl(baseUrl) : String(baseUrl || defaults.baseUrl || '').trim();
  const raw = rawBase.replace(/\/+$/, '');
  if (!raw) return '';
  if (/\/chat\/completions$/i.test(raw)) return raw;
  return `${raw}${defaults.endpoint || '/chat/completions'}`;
}

function normalizeDeepseekModel(model) {
  const value = String(model || '').trim();
  if (value === 'deepseek-chat') return 'deepseek-v4-flash';
  if (value === 'deepseek-reasoner') return 'deepseek-v4-pro';
  return value || providerDefaults.deepseek.model;
}

function buildDeepseekExtraBody(model) {
  const normalized = normalizeDeepseekModel(model);
  if (normalized === 'deepseek-v4-pro') return { thinking: { type: 'enabled' }, reasoning_effort: 'high' };
  if (normalized === 'deepseek-v4-flash') return { thinking: { type: 'disabled' } };
  return {};
}

function parseAiError(json, provider, status) {
  const detail = json?.error?.message || json?.message || json?.msg || '';
  const hint = provider === 'deepseek' && status === 404 ? '；DeepSeek 官方 OpenAI 兼容 base_url 是 https://api.deepseek.com，对话接口为 /chat/completions。请不要把 /v1 或其它不存在路径当作完整接口地址。' : '';
  return detail ? `AI 调用失败 HTTP ${status}：${detail}${hint}` : `AI 调用失败 HTTP ${status}${hint}`;
}

/**
 * 构建 AI 翻译。
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
/**
 * 对成功的 AI 译文做最终化处理：可选自动断行。
 * 缓存里始终存 AI 原始输出；本函数在 cache hit 与新调用两条路径上都跑一次，
 * 保证用户切换 autoSplit 设置后下一次翻译会拿到对应形态。
 * @param {string} rawText
 * @param {Object} settings
 * @param {Object} project
 * @param {Object} entry
 * @returns {{text: string, splitLines?: string[], splitOverflow?: boolean}}
 */
function finalizeTranslated(rawText, settings, project, entry) {
  const text = String(rawText || '');
  if (!text) return { text };
  if (!settings?.autoSplit) return { text };
  if (!entry || Number(entry.code ?? entry?.adapterMeta?.code) !== 401) return { text };
  const engine = project?.engine || 'RPG Maker MV/MZ';
  const c = getConstraints(engine, entry.kind || entry?.adapterMeta?.kind || entry?.textType || 'dialogue-line');
  if (!c || !c.maxCharsPerLine) return { text };
  const { lines, overflow } = AutoSplit.split(text, c);
  if (lines.length <= 1) return { text };
  return { text: lines.join('\n'), splitLines: lines, splitOverflow: overflow };
}

async function buildAiTranslate(payload) {
  const { sourceText, settings = {}, glossary = null, project = null, entry = null } = payload || {};
  const provider = settings.provider || 'mock';
  if (!sourceText) return { ok: false, provider, message: '缺少待翻译文本' };

  const injectionMode = settings.glossaryInjectionMode || 'off';
  const basePrompt = settings.prompt || defaultPrompt;
  const injection = applyInjection({ sourceText, systemPrompt: basePrompt, glossary, mode: injectionMode });
  const effectiveSource = injection.effectiveSource;
  const systemPrompt = injection.systemPrompt;
  const glossaryMeta = injection.hits.length
    ? { glossaryMode: injectionMode, glossaryHitCount: injection.hits.length, glossaryHits: injection.hits.map((t) => ({ source: t.source, target: t.target })) }
    : { glossaryMode: injectionMode, glossaryHitCount: 0 };

  // 缓存查询：mock 不参与缓存（避免污染调试结果）
  const modelForCache = provider === 'deepseek'
    ? normalizeDeepseekModel(settings.model)
    : (provider === 'baidu' || provider === 'traditional-baidu' ? `baidu:${(settings.traditional || settings).targetLang || 'zh'}` : String(settings.model || ''));
  const cacheKey = provider !== 'mock' && project?.rootDir
    ? TranslationCache.keyFor({ provider, model: modelForCache, systemPrompt, source: effectiveSource })
    : null;
  if (cacheKey) {
    const hit = await TranslationCache.get(project, cacheKey);
    if (hit && hit.text) {
      const finalized = finalizeTranslated(hit.text, settings, project, entry);
      return { ok: true, provider, translatedText: finalized.text, splitLines: finalized.splitLines, splitOverflow: finalized.splitOverflow, message: '命中本地翻译缓存', cached: true, ...glossaryMeta };
    }
  }

  if (provider === 'mock') {
    const raw = `[示例译文] ${effectiveSource}`;
    const finalized = finalizeTranslated(raw, settings, project, entry);
    return { ok: true, provider, translatedText: finalized.text, splitLines: finalized.splitLines, splitOverflow: finalized.splitOverflow, message: '本地示例翻译完成。', ...glossaryMeta };
  }
  if (provider === 'baidu' || provider === 'traditional-baidu') {
    const result = await translateWithBaidu(settings.traditional || settings, effectiveSource);
    if (result.ok && cacheKey) await TranslationCache.set(project, cacheKey, result.translatedText);
    if (!result.ok) return result;
    const finalized = finalizeTranslated(result.translatedText, settings, project, entry);
    return { ...result, translatedText: finalized.text, splitLines: finalized.splitLines, splitOverflow: finalized.splitOverflow, ...glossaryMeta };
  }
  if (!settings.apiKey) return { ok: false, provider, message: 'API Key 未配置' };

  const normalizedBaseUrl = provider === 'deepseek'
    ? normalizeDeepseekBaseUrl(settings.baseUrl)
    : String(settings.baseUrl || '').trim();
  const baseUrl = normalizeChatCompletionUrl(provider, normalizedBaseUrl);
  const model = provider === 'deepseek' ? normalizeDeepseekModel(settings.model) : String(settings.model || '').trim();
  if (!baseUrl || !model) return { ok: false, provider, message: '接口地址或模型未配置' };

  try {
    const payloadBody = {
      model,
      temperature: provider === 'deepseek' ? 0.2 : 0.7,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: effectiveSource },
      ],
    };
    if (provider === 'deepseek') Object.assign(payloadBody, buildDeepseekExtraBody(model));
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify(payloadBody),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, provider, message: parseAiError(json, provider, response.status) };
    const translatedText = json?.choices?.[0]?.message?.content?.trim() || '';
    if (!translatedText) return { ok: false, provider, message: 'AI 未返回译文' };
    if (cacheKey) await TranslationCache.set(project, cacheKey, translatedText);
    const finalized = finalizeTranslated(translatedText, settings, project, entry);
    return { ok: true, provider, translatedText: finalized.text, splitLines: finalized.splitLines, splitOverflow: finalized.splitOverflow, message: `已使用 ${provider} 完成翻译。`, ...glossaryMeta };
  } catch (error) {
    return { ok: false, provider, message: `AI 调用失败：${error.message}` };
  }
}

module.exports = { loadAiSettings, saveAiSettings, saveTranslatorSettings, testTraditional, buildAiTranslate };
