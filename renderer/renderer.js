(() => {
  const $ = (id) => document.getElementById(id);
  const getState = () => window.RpgAppStore?.getState?.() || {};

  const fallbackI18n = {
    'zh-CN': {
      'app.title': 'RPG 汉化工作台',
      'app.subtitle': '释放 · 提取 · 校对 · 术语库 · 导出',
      'welcome.title': '欢迎使用汉化工作台',
      'welcome.description': '读取 RPG Maker 项目、提取文本、维护术语库，并生成可回写的汉化补丁。',
      'welcome.start': '开始项目',
      'welcome.demo': '查看示例项目',
      'project.open': '打开游戏项目',
      'project.status': '项目状态',
      'project.unrecognized': '未识别',
      'project.hint': '请选择游戏目录，将自动判断引擎并加载文本。',
      'features.title': '主要能力',
      'features.import': '导入 MV / MZ 项目资源',
      'features.extract': '自动提取对话、选项、名词表文本',
      'features.glossary': '术语库本地保存，可导入导出',
      'features.export': '导出半成品草稿与汉化补丁目录',
      'workspace.title': '工作区',
      'workspace.noProject': '尚未打开项目',
      'workspace.load': '导出草稿',
      'workspace.exportDraft': '导出草稿',
      'workspace.draftLoad': '载入草稿',
      'workspace.settings': '设置',
      'workspace.export': '导出补丁',
      'workspace.ai': '辅助翻译平台',
      'workspace.clearTexts': '清空当前 JSON 翻译',
      'workspace.clearConfirm': '此操作会清空当前 JSON 文件的所有译文，并将这些条目标记为未翻译。建议先导出草稿备份。确认继续？',
      'stats.groups': '文本组数',
      'stats.progress': '总文本数/已翻译数',
      'stats.translated': '已翻译',
      'stats.hits': '术语命中',
      'selector.title': '双语编辑器',
      'selector.hint': '原文译文对照编辑，支持术语与辅助翻译',
      'selector.file': 'JSON 文件',
      'selector.search': '搜索',
      'selector.searchPlaceholder': '输入关键词过滤',
      'editor.source': '原文',
      'editor.target': '译文',
      'editor.targetPlaceholder': '输入译文',
      'settings.tabUI': '界面设置',
      'settings.tabTraditional': '传统翻译',
      'settings.tabLLM': '大模型翻译',
      'settings.titleUI': '界面设置',
      'settings.titleTraditional': '传统翻译设置',
      'settings.titleLLM': '大模型翻译设置',
      'settings.language': '界面语言',
      'settings.themeMode': '颜色模式',
      'settings.themeSystem': '跟随系统',
      'settings.themeDark': '深色',
      'settings.themeLight': '浅色',
      'settings.themePalette': '主题强调色',
      'settings.paletteViolet': '紫罗兰',
      'settings.paletteBlue': '天空蓝',
      'settings.paletteEmerald': '翡翠绿',
      'settings.paletteRose': '蔷薇红',
      'settings.paletteAmber': '暖琥珀',
      'settings.paletteSlate': '高级灰',
      'settings.backgroundImage': '图片背景',
      'settings.backgroundImagePlaceholder': '输入图片路径或 URL，留空使用纯色背景',
      'settings.backgroundHint': '支持本地图片路径或网络图片 URL，留空时使用主题色背景。',
      'settings.pickBackground': '选择背景图片',
      'settings.previewBackground': '预览当前背景图',
      'settings.applyBackground': '应用到当前界面',
      'settings.clearBackground': '清除背景图',
      'settings.resetTheme': '恢复默认界面',
      'settings.previewTitle': '背景预览',
      'settings.previewEmpty': '当前未设置图片背景',
      'settings.save': '保存设置',
      'settings.close': '关闭',
      'settings.baiduAppId': '百度 App ID',
      'settings.baiduAppIdPlaceholder': '请输入百度 App ID',
      'settings.baiduSecret': '百度密钥',
      'settings.baiduSecretPlaceholder': '请输入百度密钥',
      'settings.googleApiKey': 'Google API Key',
      'settings.googleApiKeyPlaceholder': '请输入 Google API Key',
      'settings.sourceLang': '源语言',
      'settings.sourceLangPlaceholder': 'auto',
      'settings.targetLang': '目标语言',
      'settings.targetLangPlaceholder': 'zh-CN',
      'settings.traditionalHint': '可选择传统翻译服务；百度需要开放平台 App ID 与密钥，Google 需要 API Key。',
      'settings.llmHint': '适合长文本翻译、风格统一和角色语气。',
      'glossary.title': '术语库',
      'glossary.panelHint': '点击按钮打开术语库管理，支持新建术语库、导入、导出和删改查。',
      'glossary.manage': '管理术语库',
      'glossary.currentProject': '当前项目',
      'glossary.emptyHint': '当前术语库为空，可直接添加术语。',
      'glossary.termCountHint': '当前术语库含 {count} 条术语。',
      'glossary.confirmDeleteTerm': '确认删除术语 {source}？',
      'glossary.confirmDeleteGlossary': '确认删除术语库 {name}？',
      'glossary.termAdded': '已添加并保存术语：{source} → {target}',
      'glossary.termUpdated': '已更新并保存术语：{source} → {target}',
      'glossary.termDeleted': '已删除并保存术语：{source}',
      'glossary.created': '已新建术语库：{name}',
      'glossary.createdAt': '已新建术语库：{name} → {path}',
      'glossary.createCanceled': '已取消新建术语库。',
      'glossary.createFailed': '新建术语库失败',
      'glossary.saveAsApiMissing': '术语库另存接口未注册',
      'glossary.exportApiMissing': '术语库导出接口未注册',
      'glossary.exportCanceled': '已取消导出术语库。',
      'glossary.exported': '已导出术语库：{name}{path}',
      'glossary.imported': '已导入术语库：{name}',
      'glossary.deleted': '已删除术语库：{name}',
      'glossary.loadProjectFirst': '请先打开项目',
      'glossary.importApiMissing': '导入接口未注册',
      'glossary.saveFailed': '术语库保存失败',
      'glossary.listInitFailed': '术语库列表初始化失败',
      'glossary.listRefreshFailed': '术语库列表刷新失败',
      'glossary.exportFailed': '导出失败',
      'glossary.importFailed': '导入失败',
      'glossary.deleteFailed': '删除失败',
      'glossary.rename': '重命名术语库',
      'glossary.renamePrompt': '请输入新的术语库名称',
      'glossary.renameApiMissing': '重命名接口未注册',
      'glossary.renameFailed': '重命名失败',
      'glossary.renamed': '已将术语库 {from} 重命名为 {to}',
      'project.scanDataRoots': '扫描文本位置',
      'project.scanDataRootsDone': '已发现文本目录：{count} 个',
      'project.scanDataRootsEmpty': '未发现可扫描的数据目录，请检查项目结构。',
      'project.scanDataRootsFailed': '扫描文本位置失败：{message}',
      'project.scanDataRootsMissing': '请先打开项目再扫描文本位置。',
      'common.none': '暂无条目',
      'common.edit': '编辑',
      'common.delete': '删除',
      'common.confirm': '确认',
      'common.cancel': '取消',
      'common.aiPending': '正在调用 AI 模型...',
      'common.aiSaved': 'AI 设置已保存。',
      'common.aiSaveFailed': 'AI 设置保存失败。',
      'common.aiTestFail': 'AI 测试失败。',
      'common.aiTestSuccess': 'AI 测试成功。',
      'common.aiTestEmpty': 'AI 测试返回为空。',
      'ai.status': '请选择翻译模式后开始翻译。',
      'ai.providerBaidu': '百度翻译',
      'ai.providerGoogle': '谷歌翻译',
      'ai.providerDeepseek': 'DeepSeek',
      'ai.providerGemini': 'Gemini',
      'ai.providerClaude': 'Claude / Anthropic',
      'ai.providerCustom': '自定义接口',
      'ai.apiKeyPlaceholder': '你的 API Key',
      'ai.baseUrlPlaceholder': '接口地址，例如 https://api.deepseek.com/chat/completions',
      'ai.modelPlaceholder': '模型名称，例如 deepseek-chat',
      'ai.prompt': '系统提示词'
    },
    en: {
      'common.none': 'No items', 'common.edit': 'Edit', 'common.delete': 'Delete', 'common.confirm': 'Confirm', 'common.cancel': 'Cancel',
      'glossary.currentProject': 'Current Project', 'glossary.emptyHint': 'The current glossary is empty. You can add terms directly.', 'glossary.termCountHint': 'This glossary contains {count} terms.',
      'workspace.ai': 'AI Assist Platform', 'workspace.clearTexts': 'Clear Current JSON Translations', 'workspace.clearConfirm': 'This will clear all translations in the current JSON file and mark them as untranslated. Continue?',
      'stats.groups': 'Text Groups', 'stats.progress': 'Total / Translated', 'stats.translated': 'Translated', 'stats.hits': 'Glossary Hits',
      'ai.providerBaidu': 'Baidu Translate', 'ai.providerGoogle': 'Google Translate', 'ai.providerDeepseek': 'DeepSeek', 'ai.providerGemini': 'Gemini', 'ai.providerClaude': 'Claude / Anthropic', 'ai.providerCustom': 'Custom API'
    },
    ja: {
      'common.none': '項目なし', 'common.edit': '編集', 'common.delete': '削除', 'common.confirm': '確認', 'common.cancel': 'キャンセル',
      'glossary.currentProject': '現在のプロジェクト', 'glossary.emptyHint': '現在の用語集は空です。用語を直接追加できます。', 'glossary.termCountHint': 'この用語集には {count} 件の用語があります。',
      'workspace.ai': 'AI 補助翻訳プラットフォーム', 'workspace.clearTexts': '現在の JSON 翻訳をクリア', 'workspace.clearConfirm': '現在の JSON ファイルのすべての翻訳を消去し、未翻訳に戻します。続行しますか？',
      'stats.groups': 'テキストグループ数', 'stats.progress': '総数 / 翻訳済み', 'stats.translated': '翻訳済み', 'stats.hits': '用語ヒット',
      'ai.providerBaidu': 'Baidu 翻訳', 'ai.providerGoogle': 'Google 翻訳', 'ai.providerDeepseek': 'DeepSeek', 'ai.providerGemini': 'Gemini', 'ai.providerClaude': 'Claude / Anthropic', 'ai.providerCustom': 'カスタム API'
    }
  };

  function mergeI18nFallbacks() {
    window.RpgI18n = window.RpgI18n || {};
    Object.entries(fallbackI18n).forEach(([lang, dict]) => {
      window.RpgI18n[lang] = { ...(dict || {}), ...(window.RpgI18n[lang] || {}) };
    });
  }

  function translate(key) {
    const lang = localStorage.getItem('rpg-workbench-language') || 'zh-CN';
    const current = window.RpgI18n?.[lang] || {};
    const zh = window.RpgI18n?.['zh-CN'] || {};
    const fallback = fallbackI18n[lang] || fallbackI18n['zh-CN'];
    return current[key] || fallback[key] || zh[key] || fallbackI18n['zh-CN'][key] || key;
  }

  function applyRuntimeI18n() {
    mergeI18nFallbacks();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const text = translate(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = translate(key);
      if (text && text !== key) el.setAttribute('placeholder', text);
    });
    document.querySelectorAll('option, .status-box, .stat-label, .glossary-status, .glossary-hint, button, span, div').forEach((el) => {
      if (el.children.length) return;
      const raw = (el.textContent || '').trim();
      if (!/^[a-z]+\.[a-zA-Z0-9_.-]+$/.test(raw)) return;
      const text = translate(raw);
      if (text && text !== raw) el.textContent = text;
    });
  }

  function appendTrace(title, detail = '', kind = 'normal') {
    const box = $('callTrace');
    if (!box) return;
    const placeholder = box.querySelector('.call-trace-placeholder');
    if (placeholder) placeholder.remove();
    const item = document.createElement('div');
    item.className = 'call-trace-item status-box';
    item.dataset.kind = kind;
    const time = new Date().toLocaleTimeString();
    item.textContent = detail ? `[${time}] ${title}：${detail}` : `[${time}] ${title}`;
    box.appendChild(item);
    box.scrollTop = box.scrollHeight;
  }

  window.showProjectStatus = (msg, kind = 'normal') => { const el = $('aiStatus'); if (el) { el.textContent = msg; el.dataset.kind = kind; } appendTrace('项目', msg, kind); };
  window.showAiStatus = (msg, kind = 'normal') => { const el = $('aiStatus'); if (el) { el.textContent = msg; el.dataset.kind = kind; } appendTrace('AI翻译', msg, kind); };
  window.showTraditionalStatus = (msg, kind = 'normal') => { const el = $('traditionalStatus'); if (el) { el.textContent = msg; el.dataset.kind = kind; } appendTrace('传统翻译', msg, kind); };
  window.showToast = (msg, kind = 'normal') => { const el = $('aiStatus'); if (el) { el.textContent = msg; el.dataset.kind = kind; } appendTrace('提示', msg, kind); };
  window.traceCall = (title, detail = '', kind = 'normal') => appendTrace(title, detail, kind);
  window.setCallTraceStatus = (msg, kind = 'normal') => appendTrace('状态', msg, kind);
  window.setVersionLabel = () => {
    const badge = $('appVersionBadge'); if (badge) badge.textContent = '· 1.2.0';
    const copyright = $('appCopyright'); if (copyright) copyright.textContent = '© 2026 RPG 汉化工作台，保留所有权利。';
  };

  function syncGlobalAiModeSelect() {
    const select = $('globalAiModeSelect');
    if (!select) return;
    const modes = ['baidu', 'google', 'deepseek', 'gemini', 'claude', 'custom'];
    const labels = {
      baidu: translate('ai.providerBaidu'), google: translate('ai.providerGoogle'), deepseek: translate('ai.providerDeepseek'),
      gemini: translate('ai.providerGemini'), claude: translate('ai.providerClaude'), custom: translate('ai.providerCustom')
    };
    const label = $('globalAiModeLabel'); if (label) label.textContent = translate('workspace.ai');
    const currentValue = select.value || getState().aiSettings?.lastEntryAiMode || getState().aiSettings?.provider || 'baidu';
    select.innerHTML = '';
    modes.forEach((id) => { const opt = document.createElement('option'); opt.value = id; opt.textContent = labels[id] || id; select.appendChild(opt); });
    select.value = modes.includes(currentValue) ? currentValue : 'baidu';
  }

  function updateTraditionalProviderUI() {
    const provider = $('traditionalProvider')?.value || 'baidu';
    $('traditionalProviderBaidu')?.classList.toggle('hidden', provider !== 'baidu');
    $('traditionalProviderGoogle')?.classList.toggle('hidden', provider !== 'google');
  }

  function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    document.querySelectorAll('.settings-pane').forEach((pane) => pane.classList.toggle('hidden', pane.dataset.pane !== tab));
    if (tab === 'glossary') { window.RpgGlossaryModule?.render?.(); window.RpgGlossaryModule?.refreshList?.().catch?.(() => {}); }
    if (tab === 'traditional') updateTraditionalProviderUI();
  }
  function openSettings(tab = 'ui') { $('settingsModal')?.classList.remove('hidden'); switchSettingsTab(tab); }
  function closeSettings() { $('settingsModal')?.classList.add('hidden'); }

  function collectTraditionalSettings() {
    return {
      provider: $('traditionalProvider')?.value || 'baidu',
      baiduAppId: $('baiduAppId')?.value || '',
      baiduSecretKey: $('baiduSecretKey')?.value || '',
      googleApiKey: $('googleApiKey')?.value || '',
      sourceLang: $('translateSourceLang')?.value || 'auto',
      targetLang: $('translateTargetLang')?.value || 'zh-CN',
    };
  }
  function collectAiSettings() {
    const current = getState().aiSettings || {};
    return {
      ...current,
      provider: $('aiProvider')?.value || current.provider || 'deepseek',
      apiKey: $('aiApiKey')?.value || '',
      baseUrl: $('aiBaseUrl')?.value || '',
      model: $('aiModel')?.value || '',
      prompt: $('aiPrompt')?.value || '',
      traditional: collectTraditionalSettings(),
      lastEntryAiMode: $('globalAiModeSelect')?.value || current.lastEntryAiMode || current.provider || 'baidu',
    };
  }
  function syncAiSettingsFields(settings = getState().aiSettings || {}) {
    if ($('traditionalProvider')) $('traditionalProvider').value = settings.traditional?.provider || 'baidu';
    if ($('baiduAppId')) $('baiduAppId').value = settings.traditional?.baiduAppId || settings.traditional?.appId || '';
    if ($('baiduSecretKey')) $('baiduSecretKey').value = settings.traditional?.baiduSecretKey || settings.traditional?.secretKey || '';
    if ($('googleApiKey')) $('googleApiKey').value = settings.traditional?.googleApiKey || settings.traditional?.apiKey || '';
    if ($('translateSourceLang')) $('translateSourceLang').value = settings.traditional?.sourceLang || 'auto';
    if ($('translateTargetLang')) $('translateTargetLang').value = settings.traditional?.targetLang || 'zh-CN';
    if ($('aiProvider')) $('aiProvider').value = settings.provider || 'deepseek';
    if ($('aiApiKey')) $('aiApiKey').value = settings.apiKey || '';
    if ($('aiBaseUrl')) $('aiBaseUrl').value = settings.baseUrl || '';
    if ($('aiModel')) $('aiModel').value = settings.model || '';
    if ($('aiPrompt')) $('aiPrompt').value = settings.prompt || '';
    if ($('globalAiModeSelect')) $('globalAiModeSelect').value = settings.lastEntryAiMode || settings.provider || 'baidu';
    updateTraditionalProviderUI();
  }

  function setStatus(id, message, kind = 'normal') {
    const el = $(id); if (el) { el.textContent = message; el.dataset.kind = kind; }
    appendTrace(id === 'traditionalStatus' ? '传统翻译' : '大模型翻译', message, kind);
  }
  async function saveTraditionalSettings() {
    const settings = collectTraditionalSettings(); const current = getState();
    setStatus('traditionalStatus', '正在保存传统翻译设置…', 'pending');
    window.RpgAppStore?.setState?.({ aiSettings: { ...(current.aiSettings || {}), traditional: settings } });
    const result = await window.rpgWorkbench?.saveTranslatorSettings?.({ project: current.project, type: 'traditional', settings });
    if (!result?.ok) throw new Error(result?.message || '传统翻译设置保存失败');
    setStatus('traditionalStatus', '传统翻译设置已保存。', 'success');
  }
  async function testTraditionalSettings() {
    const settings = collectTraditionalSettings(); setStatus('traditionalStatus', '正在测试传统翻译…', 'pending');
    const result = await window.rpgWorkbench?.testTranslatorSettings?.({ type: 'traditional', settings, sampleText: 'こんにちは、世界。' });
    if (!result?.ok) throw new Error(result?.message || '传统翻译测试失败');
    setStatus('traditionalStatus', result.message || '传统翻译测试成功。', 'success');
  }
  async function saveAiSettings() {
    const settings = collectAiSettings(); const current = getState();
    setStatus('aiStatus', '正在保存大模型翻译设置…', 'pending');
    window.RpgAppStore?.setState?.({ aiSettings: settings });
    const result = await window.rpgWorkbench?.saveAiSettings?.({ project: current.project, ...settings });
    if (!result?.ok) throw new Error(result?.message || '大模型翻译设置保存失败');
    setStatus('aiStatus', '大模型翻译设置已保存。', 'success');
    syncGlobalAiModeSelect(); syncAiSettingsFields(settings);
  }
  async function testAiSettings() {
    const settings = collectAiSettings(); setStatus('aiStatus', '正在测试大模型翻译…', 'pending');
    const result = await window.rpgWorkbench?.aiTranslate?.({ sourceText: 'こんにちは、世界。', settings });
    if (!result?.ok) throw new Error(result?.message || '大模型翻译测试失败');
    setStatus('aiStatus', result.message || `测试成功：${result.translatedText || ''}`, 'success');
  }

  async function loadAndApplyAiSettings() {
    try {
      const result = await window.rpgWorkbench?.getAiSettings?.({ project: getState().project || {} });
      if (result?.ok && result.settings) { window.RpgAppStore?.setState?.({ aiSettings: result.settings }); syncAiSettingsFields(result.settings); }
    } catch (_) {}
  }

  function render() {
    window.RpgGlossaryModule?.render?.();
    window.RpgEntries?.renderFileSelect?.();
    window.RpgEntries?.renderEntryList?.();
    window.RpgEntries?.renderCurrentEntry?.();
    window.RpgEntries?.updateCounts?.();
    applyRuntimeI18n();
  }

  function bindShellActions() {
    $('settingsBtn')?.addEventListener('click', () => openSettings('ui'));
    $('openGlossaryManagerBtn')?.addEventListener('click', () => openSettings('glossary'));
    $('settingsCloseBtn')?.addEventListener('click', () => closeSettings());
    $('settingsBackdrop')?.addEventListener('click', () => closeSettings());
    document.querySelectorAll('.settings-tab').forEach((btn) => btn.addEventListener('click', () => switchSettingsTab(btn.dataset.tab || 'ui')));
    $('traditionalProvider')?.addEventListener('change', updateTraditionalProviderUI);
    $('saveTraditionalSettingsBtn')?.addEventListener('click', () => saveTraditionalSettings().catch((e) => setStatus('traditionalStatus', e.message || '保存失败', 'error')));
    $('testTraditionalBtn')?.addEventListener('click', () => testTraditionalSettings().catch((e) => setStatus('traditionalStatus', e.message || '测试失败', 'error')));
    $('saveAiSettingsBtn')?.addEventListener('click', () => saveAiSettings().catch((e) => setStatus('aiStatus', e.message || '保存失败', 'error')));
    $('testAiBtn')?.addEventListener('click', () => testAiSettings().catch((e) => setStatus('aiStatus', e.message || '测试失败', 'error')));
    $('globalAiModeSelect')?.addEventListener('change', () => {
      const provider = $('globalAiModeSelect')?.value || 'baidu';
      const current = getState(); const next = { ...(current.aiSettings || {}), provider, lastEntryAiMode: provider };
      if (provider === 'baidu' || provider === 'google') next.traditional = { ...(current.aiSettings?.traditional || {}), provider };
      window.RpgAppStore?.setState?.({ aiSettings: next }); appendTrace('辅助翻译平台', `已切换至 ${provider}`);
    });
    $('languageSelect')?.addEventListener('change', () => {
      window.RpgView?.persistUiSettings?.({ persist: true });
      mergeI18nFallbacks(); window.RpgView.t = translate; applyRuntimeI18n(); syncGlobalAiModeSelect(); render();
    });
    $('themeModeSelect')?.addEventListener('change', () => window.RpgView?.persistUiSettings?.({ persist: false }));
    $('themePaletteSelect')?.addEventListener('change', () => window.RpgView?.persistUiSettings?.({ persist: false }));
    $('themeBackgroundInput')?.addEventListener('input', () => window.RpgView?.updateThemePreview?.());
    $('applyThemeBackgroundBtn')?.addEventListener('click', () => window.RpgView?.persistUiSettings?.({ persist: false }));
    $('clearThemeBackgroundBtn')?.addEventListener('click', () => { if ($('themeBackgroundInput')) $('themeBackgroundInput').value = ''; window.RpgView?.persistUiSettings?.({ persist: false }); });
    $('saveUiSettingsBtn')?.addEventListener('click', () => { window.RpgView?.persistUiSettings?.({ persist: true }); appendTrace('界面设置', '界面设置已保存。', 'success'); });
    $('pickThemeBackgroundBtn')?.addEventListener('click', async () => {
      try { const result = await window.rpgWorkbench?.pickThemeImageFile?.(); if (result?.filePath && $('themeBackgroundInput')) { $('themeBackgroundInput').value = result.filePath; window.RpgView?.persistUiSettings?.({ persist: false }); } } catch (e) { appendTrace('背景图片', e.message || '选择失败', 'error'); }
    });
    $('previewThemeBackgroundBtn')?.addEventListener('click', () => window.RpgView?.updateThemePreview?.());
    $('resetUiThemeBtn')?.addEventListener('click', () => { window.RpgView?.resetUiSettings?.(); applyRuntimeI18n(); syncGlobalAiModeSelect(); render(); appendTrace('界面设置', '已恢复默认外观', 'success'); });
  }

  window.RpgApp = {
    syncGlobalAiModeSelect, openSettings, closeSettings, switchSettingsTab, render,
    applyI18n: applyRuntimeI18n,
    syncUiSettingsFields: (...args) => window.RpgView?.syncUiSettingsFields?.(...args),
    collectUiSettings: (...args) => window.RpgView?.persistUiSettings?.(...args),
    collectTraditionalSettings, collectAiSettings, syncAiSettingsFields, updateTraditionalProviderUI,
    buildGroupedFiles: (...args) => window.RpgEntries?.buildGroupedFiles?.(...args),
    renderFileSelect: (...args) => window.RpgEntries?.renderFileSelect?.(...args),
    renderEntryList: (...args) => window.RpgEntries?.renderEntryList?.(...args),
    renderCurrentEntry: (...args) => window.RpgEntries?.renderCurrentEntry?.(...args),
  };

  const init = async () => {
    const savedLang = localStorage.getItem('rpg-workbench-language') || 'zh-CN';
    const langSelect = $('languageSelect'); if (langSelect) langSelect.value = ['zh-CN', 'en', 'ja'].includes(savedLang) ? savedLang : 'zh-CN';
    mergeI18nFallbacks(); window.RpgView = window.RpgView || {}; window.RpgView.t = translate;
    window.RpgView?.syncUiSettingsFields?.(); applyRuntimeI18n(); switchSettingsTab('ui'); closeSettings();
    await loadAndApplyAiSettings(); syncGlobalAiModeSelect(); bindShellActions();
    window.RpgGlossaryModule?.bindGlossaryActions?.(); window.RpgEntries?.bindEntryActions?.(); window.RpgProject?.bindProjectActions?.();
    if (window.RpgExportModule?.init) window.RpgExportModule.init(() => { const s = getState(); return { project: s.project, glossary: s.glossary, aiSettings: s.aiSettings, entries: window.RpgEntries?.getExportEntries?.() || s.entries || [], draftPath: s.draftPath || '', lastPatchDir: s.lastPatchDir || '' }; });
    window.setVersionLabel?.(); window.setCallTraceStatus?.('等待操作…', 'normal'); render(); window.RpgAppStore?.subscribe?.(() => render());
  };

  init().catch((e) => appendTrace('初始化失败', e.message || '未知错误', 'error'));
})();