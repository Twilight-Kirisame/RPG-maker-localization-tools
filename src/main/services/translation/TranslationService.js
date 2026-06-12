// @ts-nocheck
/**
 * @file src/main/services/translation/TranslationService.js
 * @description 兼容原 AI 翻译设置与调用的翻译服务。
 */

const crypto = require('crypto');
const { projectStoragePath } = require('../storage/StorageService');
const fs = require('fs');
const fsp = fs.promises;

const defaultPrompt = '你是一个专业的 RPG Maker 游戏汉化助手，请将原文自然准确地翻译成简体中文。';
const acgPrompt = '你是一个专业的 ACG 领域日中翻译专家。要求译文地道、活人感强、消除翻译腔。在语境合适时，必须使用中国特有的成语、歇后语或固定短语进行意译（例如将单纯的“力量对抗”转化为“道高一尺，魔高一丈”等具有文学色彩的表达）。不要解释，直接输出译文。';
const baiduTranslateEndpoint = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

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
 * 加载 AI 设置。
 * @param {Object} project
 * @returns {Promise<Object>}
 */
async function loadAiSettings(project) {
  const filePath = projectStoragePath(project, 'ai-settings.json');
  if (!fs.existsSync(filePath)) return { provider: 'mock', apiKey: '', baseUrl: '', model: '', prompt: defaultPrompt, traditional: {} };
  try {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
  } catch {
    return { provider: 'mock', apiKey: '', baseUrl: '', model: '', prompt: defaultPrompt, traditional: {} };
  }
}

/**
 * 保存 AI 设置。
 * @param {Object} project
 * @param {Object} settings
 * @returns {Promise<Object>}
 */
async function saveAiSettings(project, settings) {
  const filePath = projectStoragePath(project, 'ai-settings.json');
  await fsp.writeFile(filePath, JSON.stringify(settings || {}, null, 2), 'utf8');
  return { ok: true, path: filePath };
}

/**
 * 保存翻译器设置。
 * @param {Object} project
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function saveTranslatorSettings(project, payload) {
  const current = await loadAiSettings(project);
  const next = payload?.type === 'traditional'
    ? { ...current, traditional: payload.settings || {} }
    : { ...current, ...(payload?.settings || payload || {}) };
  return saveAiSettings(project, next);
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

/**
 * 构建 AI 翻译。
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
async function buildAiTranslate(payload) {
  const { sourceText, settings = {} } = payload || {};
  const provider = settings.provider || 'mock';
  if (!sourceText) return { ok: false, provider, message: '缺少待翻译文本' };
  if (provider === 'mock') return { ok: true, provider, translatedText: `[示例译文] ${sourceText}`, message: '本地示例翻译完成。' };
  if (provider === 'baidu' || provider === 'traditional-baidu') return translateWithBaidu(settings.traditional || settings, sourceText);
  if (!settings.apiKey) return { ok: false, provider, message: 'API Key 未配置' };

  const baseUrl = settings.baseUrl || (provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : '');
  const model = settings.model || (provider === 'deepseek' ? 'deepseek-chat' : '');
  if (!baseUrl || !model) return { ok: false, provider, message: '接口地址或模型未配置' };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model,
        temperature: provider === 'deepseek' ? 1.2 : 0.7,
        messages: [
          { role: 'system', content: provider === 'deepseek' ? acgPrompt : (settings.prompt || defaultPrompt) },
          { role: 'user', content: sourceText },
        ],
      }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, provider, message: json?.error?.message || `AI 调用失败 HTTP ${response.status}` };
    return { ok: true, provider, translatedText: json?.choices?.[0]?.message?.content?.trim() || '', message: `已使用 ${provider} 完成翻译。` };
  } catch (error) {
    return { ok: false, provider, message: `AI 调用失败：${error.message}` };
  }
}

module.exports = { loadAiSettings, saveAiSettings, saveTranslatorSettings, testTraditional, buildAiTranslate };
