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
      'aboutProject.title': '关于项目',
      'aboutProject.appName': 'RPG 汉化工作台',
      'aboutProject.author': '由 RPG 汉化社区打造',
      'aboutProject.checkUpdate': '检查更新',
      'aboutProject.website': '官网',
      'aboutProject.featureGuide': '功能导览',
      'aboutProject.updateLatest': '当前已是最新版本 {version}',
      'aboutProject.updateChecking': '正在检查更新…',
      'aboutProject.updateError': '检查更新失败：{message}',
      'featureGuide.title': '功能介绍与教程',
      'featureGuide.module.project': '项目与引擎',
      'featureGuide.module.editor': '双语编辑器',
      'featureGuide.module.translation': '辅助翻译',
      'featureGuide.module.glossary': '术语库',
      'featureGuide.module.export': '导出与写回',
      'featureGuide.module.preview': '游戏预览',
      'featureGuide.module.settings': '个性化设置',
      'workspace.title': '工作区',
      'workspace.noProject': '尚未打开项目',
      'workspace.load': '导出草稿',
      'workspace.exportDraft': '导出草稿',
      'workspace.exportDraftTitle': '将当前翻译进度导出为草稿文件',
      'workspace.draftLoad': '载入草稿',
      'workspace.draftLoadTitle': '从已保存的 JSON 草稿文件恢复翻译内容',
      'workspace.settings': '设置',
      'workspace.export': '导出补丁',
      'workspace.exportTitle': '导出可回写的补丁目录',
      'workspace.resetProject': '重置',
      'workspace.resetProjectTitle': '清空当前项目并回到未加载状态',
      'workspace.resetConfirm': '将当前界面退回到未加载项目状态。已保存的草稿与自动保存内容仍可通过“载入草稿”恢复。是否继续？',
      'workspace.resetDone': '已重置为未加载项目状态。',
      'workspace.ai': '辅助翻译平台',
      'workspace.clearTexts': '清空当前 JSON 翻译',
      'workspace.clearTextsTitle': '清空当前 JSON 文件下所有译文行内容',
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
      'selector.searchScope': '搜索范围',
      'selector.searchScopeCurrent': '当前 JSON',
      'selector.searchScopeAll': '全部 JSON',
      'editor.source': '原文',
      'editor.target': '译文',
      'editor.targetPlaceholder': '输入译文',
      'settings.tabUI': '界面设置',
      'settings.tabTraditional': '传统翻译',
      'settings.tabLLM': '大模型翻译',
      'settings.titleUI': '界面设置',
      'settings.titleTraditional': '传统翻译设置',
      'settings.titleLLM': '大模型翻译设置',
      'settings.tabAccessibility': '辅助功能',
      'settings.titleAccessibility': '辅助功能',
      'settings.timelineGroupTitle': '剧情流程视图',
      'settings.enableTimelineMode': '按剧情流程排列对话（适用于 RPG Maker MV/MZ）',
      'settings.timelineModeHint': '开启后，编辑器会按玩家实际体验的游戏流程（地图/事件/分支）排列 Map 文件中的对话、选项等文本。系统文本（道具、技能等）仍保持原顺序。所有修改仍写回原始物理位置，不影响游戏结构。',
      'settings.timelineModeOn': '剧情流程视图已开启',
      'settings.timelineModeOff': '剧情流程视图已关闭',
      'settings.timelineModeUnsupported': '剧情流程视图仅在 RPG Maker MV/MZ 项目中生效',
      'settings.sceneSeparator': '场景：{scene}',
      'settings.autoSaveGroupTitle': '自动保存',
      'settings.enableAutoSave': '开启术语库与译文草稿自动保存',
      'settings.autoSaveInterval': '自动保存间隔（分钟）',
      'settings.autoSaveDir': '自动保存位置（留空则使用默认位置）',
      'settings.autoSaveDirPlaceholder': '默认：与手动保存同目录，文件名带 auto-save',
      'settings.pickAutoSaveDir': '浏览…',
      'settings.autoSaveHint': '开启后，程序会按间隔自动覆盖写入 auto-save 文件；手动保存的文件不会被覆盖。自动保存文件可用于崩溃恢复。',
      'settings.autoSaveOn': '自动保存已开启',
      'settings.autoSaveOff': '自动保存已关闭',
      'settings.autoSaveRunning': '已自动保存到：{paths}',
      'settings.autoSaveFailed': '自动保存失败：{error}',
      'settings.autoSaveIntervalInvalid': '保存间隔需在 1–120 分钟之间',
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
      'glossary.insertAllHits': '一键插入全部',
      'glossary.insertMode': '插入方式',
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
      'glossary.saving': '正在保存术语库…',
      'glossary.creating': '正在新建术语库…',
      'glossary.exporting': '正在导出术语库…',
      'glossary.importing': '正在导入术语库…',
      'glossary.renaming': '正在重命名术语库：{from} → {to}',
      'glossary.loadProjectFirst': '请先打开项目',
      'glossary.importApiMissing': '导入接口未注册',
      'glossary.saveFailed': '术语库保存失败',
      'glossary.listInitFailed': '术语库列表初始化失败',
      'glossary.listRefreshFailed': '术语库列表刷新失败',
      'glossary.exportFailed': '导出失败',
      'glossary.importFailed': '导入失败',
      'glossary.deleteFailed': '删除失败',
      'validation.tooManyLines': '{actual}/{max} 行',
      'validation.lineTooLong': '第{line}行{actual}/{max}字',
      'validation.missingControlCodes': '缺控制码 {codes}',
      'ai.defaultSystemPrompt': '你是一个专业的 RPG Maker 游戏汉化助手，请将原文自然准确地翻译成简体中文。',
      'glossary.rename': '重命名术语库',
      'glossary.renamePrompt': '请输入新的术语库名称',
      'glossary.renameApiMissing': '重命名接口未注册',
      'glossary.renameFailed': '重命名失败',
      'glossary.renamed': '已将术语库 {from} 重命名为 {to}',
      'glossary.closeEditor': '关闭术语编辑',
      'glossary.category': '分类',
      'glossary.categoryPlaceholder': 'default',
      'glossary.applyCategory': '应用分类',
      'glossary.newCategory': '分类（同分类的子库会一起参与命中）',
      'glossary.aggregationHint': '当前分类「{category}」聚合了 {count} 个子库，共 {terms} 条术语参与命中。',
      'glossary.categoryUpdating': '正在更新术语库 {name} 的分类为 {category}…',
      'glossary.categoryUpdated': '已将术语库 {name} 移入分类 {category}。',
      'glossary.categoryUpdateFailed': '更新分类失败',
      'glossary.updateCategoryApiMissing': '更新分类接口未注册',
      'settings.close': '关闭设置',
      'project.recognized': '已识别',
      'project.recognizedHint': '已识别到项目结构，可继续导入与翻译。',
      'project.dataRootsFound': '已扫描到 {count} 个文本目录',
      'project.dataRootsEmpty': '未扫描到文本目录',
      'project.statusLoaded': '项目已加载',
      'project.statusDraft': '草稿已加载',
      'project.statusLoading': '正在加载项目…',
      'project.ready': '项目已就绪：{path}',
      'trace.projectStatus': '项目状态打点',
      'trace.openProject': '打开项目',
      'trace.loadDraftBtn': '载入草稿按钮',
      'trace.prepareRead': '准备读取：{path}',
      'trace.callSystemDirPicker': '开始调用系统目录选择器',
      'trace.userCancel': '用户取消选择',
      'trace.pickResult': '选择结果 rootDir={rootDir}, engine={engine}',
      'trace.mainProcessReturn': '主进程返回 entries={entries}, warnings={warnings}',
      'trace.startPickDraftFile': '开始选择草稿文件',
      'trace.draftOpened': '已打开 {path}',
      'common.processing': '正在处理',
      'common.unknownError': '未知错误',
      'common.operationFailed': '操作失败',
      'draft.loadFailed': '草稿加载失败',
      'draft.loaded': '已载入草稿：{path}',
      'project.scanDataRoots': '扫描文本位置',
      'project.scanDataRootsDone': '已发现文本目录：{count} 个',
      'project.scanDataRootsEmpty': '未发现可扫描的数据目录，请检查项目结构。',
      'project.scanDataRootsFailed': '扫描文本位置失败：{message}',
      'project.scanDataRootsMissing': '请先打开项目再扫描文本位置。',
      'project.scanningDataRoots': '正在扫描文本目录…',
      'common.none': '暂无条目',
      'common.item': '条',
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
      'trace.project': '项目',
      'trace.aiTranslate': 'AI翻译',
      'trace.traditionalTranslate': '传统翻译',
      'trace.notice': '提示',
      'trace.status': '状态',
      'trace.assistPlatform': '辅助翻译平台',
      'trace.providerSwitched': '已切换至 {provider}',
      'trace.uiSettings': '界面设置',
      'trace.uiSettingsSaved': '界面设置已保存。',
      'trace.backgroundImage': '背景图片',
      'trace.selectFailed': '选择失败',
      'trace.defaultThemeRestored': '已恢复默认外观',
      'trace.waiting': '等待操作…',
      'trace.initFailed': '初始化失败',
      'trace.unknownError': '未知错误',
      'trace.aiSettings': '大模型翻译设置',
      'trace.aiTest': '大模型翻译测试',
      'trace.traditionalSettings': '传统翻译设置',
      'trace.traditionalTest': '传统翻译测试',
      'app.copyright': '© 2026 RPG 汉化工作台，保留所有权利。',
      'ai.providerBaidu': '百度翻译',
      'ai.providerGoogle': '谷歌翻译',
      'ai.providerDeepseek': 'DeepSeek',
      'ai.providerKimi': 'Kimi（月之暗面）',
      'ai.providerGemini': 'Gemini',
      'ai.providerClaude': 'Claude / Anthropic',
      'ai.providerCustom': '自定义接口',
      'ai.apiKeyPlaceholder': '你的 API Key',
      'ai.baseUrlPlaceholder': '接口地址，例如 https://api.deepseek.com',
      'ai.modelPlaceholder': '输入自定义模型名',
      'ai.modelCustom': '自定义模型',
      'ai.deepseekBaseUrlHint': 'DeepSeek 官方 base_url 是 https://api.deepseek.com，程序会自动调用 /chat/completions；请不要填写 /v1/chat/completions。',
      'ai.prompt': '系统提示词',
    
      'action.openProjectFolder': '打开项目目录',
      'action.loadProjectTexts': '载入项目文本',
      'action.saveTranslatorSettings': '保存翻译设置',
      'action.testTranslatorSettings': '测试翻译设置',
      'action.aiTranslate': 'AI 翻译',
      'action.saveProjectLastPosition': '保存翻译位置',
      'action.loadProjectProgressState': '读取项目进度',
      'action.getUiSettings': '读取界面设置',
      'action.saveUiSettings': '保存界面设置',
      'trace.actionStart': '动作开始',
      'trace.actionSuccess': '动作完成',
      'trace.actionFailed': '动作失败',
      'error.projectRequired': '{action}前请先打开并载入项目',
      'error.saveDraftApiMissing': '草稿导出接口未注入',
      'error.exportDraftFailed': '导出草稿失败',
      'error.exportPatchApiMissing': '补丁导出接口未注入',
      'error.exportPatchFailed': '导出补丁失败',
      'error.writebackApiMissing': '写回接口未注入',
      'error.writebackFailed': '写回失败',
      'action.exportDraft': '导出草稿',
      'action.exportPatch': '导出补丁',
      'action.writebackJson': '写回 JSON',
      'export.draftPending': '正在导出草稿…',
      'export.draftSuccess': '草稿导出完成',
      'export.draftError': '草稿导出失败',
      'export.patchPending': '正在导出补丁…',
      'export.patchSuccess': '补丁导出完成',
      'export.patchError': '补丁导出失败',
      'trace.writebackClicked': '点击写回游戏 JSON',
      'action.openPatchDir': '打开补丁目录',
      'error.noPatchDir': '没有可打开的补丁目录',
      'error.openDirApiMissing': '打开目录接口未注入',
      'action.openingPatchDir': '正在打开补丁目录…',
      'action.patchDirOpened': '补丁目录已打开',
      'action.openPatchDirFailed': '打开补丁目录失败',
      'writeback.summary': '已写回 {count} 个 JSON 文件（含 {errors} 条错误）',
    },
    en: {
      'common.none': 'No items', 'common.item': 'item', 'common.edit': 'Edit', 'common.delete': 'Delete', 'common.confirm': 'Confirm', 'common.cancel': 'Cancel',
      'common.processing': 'Processing', 'common.unknownError': 'Unknown error', 'common.operationFailed': 'Operation failed',
      'project.recognized': 'Recognized', 'project.recognizedHint': 'Project structure recognized. You can proceed to import and translate.', 'project.dataRootsFound': 'Found {count} text directories', 'project.dataRootsEmpty': 'No text directories found', 'project.statusLoaded': 'Project loaded', 'project.statusDraft': 'Draft loaded', 'project.statusLoading': 'Loading project…', 'project.ready': 'Project ready: {path}',
      'trace.projectStatus': 'Project status trace', 'trace.openProject': 'Open project', 'trace.loadDraftBtn': 'Load draft button', 'trace.prepareRead': 'Preparing to read: {path}', 'trace.callSystemDirPicker': 'Calling system directory picker', 'trace.userCancel': 'User cancelled selection', 'trace.pickResult': 'Pick result rootDir={rootDir}, engine={engine}', 'trace.mainProcessReturn': 'Main process returned entries={entries}, warnings={warnings}', 'trace.startPickDraftFile': 'Starting draft file selection', 'trace.draftOpened': 'Opened {path}',
      'draft.loadFailed': 'Failed to load draft', 'draft.loaded': 'Draft loaded: {path}',
      'trace.actionStart': 'Action started', 'trace.actionSuccess': 'Action completed', 'trace.actionFailed': 'Action failed',
      'action.openProjectFolder': 'Open project folder', 'action.loadProjectTexts': 'Load project texts', 'action.saveTranslatorSettings': 'Save translator settings', 'action.testTranslatorSettings': 'Test translator settings', 'action.aiTranslate': 'AI translate', 'action.saveProjectLastPosition': 'Save translation position', 'action.loadProjectProgressState': 'Load project progress', 'action.getUiSettings': 'Get UI settings', 'action.saveUiSettings': 'Save UI settings',
      'error.projectRequired': 'Please open and load a project before {action}', 'error.saveDraftApiMissing': 'Draft export API not injected', 'error.exportDraftFailed': 'Export draft failed', 'error.exportPatchApiMissing': 'Patch export API not injected', 'error.exportPatchFailed': 'Export patch failed', 'error.writebackApiMissing': 'Writeback API not injected', 'error.writebackFailed': 'Writeback failed',
      'action.exportDraft': 'Export draft', 'action.exportPatch': 'Export patch', 'action.writebackJson': 'Write back JSON',
      'export.draftPending': 'Exporting draft…', 'export.draftSuccess': 'Draft export completed', 'export.draftError': 'Draft export failed', 'export.patchPending': 'Exporting patch…', 'export.patchSuccess': 'Patch export completed', 'export.patchError': 'Patch export failed',
      'trace.writebackClicked': 'Clicked write back to game JSON', 'action.openPatchDir': 'Open patch directory', 'error.noPatchDir': 'No patch directory to open', 'error.openDirApiMissing': 'Open directory API not injected', 'action.openingPatchDir': 'Opening patch directory…', 'action.patchDirOpened': 'Patch directory opened', 'action.openPatchDirFailed': 'Failed to open patch directory',
      'writeback.summary': 'Wrote back {count} JSON files ({errors} errors)',
      'glossary.currentProject': 'Current Project', 'glossary.emptyHint': 'The current glossary is empty. You can add terms directly.', 'glossary.termCountHint': 'This glossary contains {count} terms.',
      'workspace.ai': 'AI Assist Platform', 'workspace.exportDraft': 'Export Draft', 'workspace.exportDraftTitle': 'Export the current translation progress as a draft file', 'workspace.draftLoad': 'Load Draft', 'workspace.draftLoadTitle': 'Restore translations from a saved JSON draft file', 'workspace.settings': 'Settings', 'workspace.export': 'Export Patch', 'workspace.exportTitle': 'Export a patch directory that can be written back to the game', 'workspace.resetProject': 'Reset', 'workspace.resetProjectTitle': 'Clear the current project and return to an unloaded state', 'workspace.resetConfirm': 'This will return the UI to an unloaded-project state. Saved drafts and autosaved progress can still be recovered via Load Draft. Continue?', 'workspace.resetDone': 'Reset to unloaded-project state.', 'workspace.clearTexts': 'Clear Current JSON Translations', 'workspace.clearTextsTitle': 'Clear all translation lines in the current JSON file', 'workspace.clearConfirm': 'This will clear all translations in the current JSON file and mark them as untranslated. Continue?',
      'stats.groups': 'Text Groups', 'stats.progress': 'Total / Translated', 'stats.translated': 'Translated', 'stats.hits': 'Glossary Hits',
      'ai.status': 'Choose a translation mode to start.',
      'trace.providerSwitched': 'Switched to {provider}',
      'trace.uiSettings': 'UI Settings',
      'trace.uiSettingsSaved': 'UI settings saved.',
      'trace.backgroundImage': 'Background Image',
      'trace.selectFailed': 'Selection failed',
      'trace.defaultThemeRestored': 'Default appearance restored',
      'trace.waiting': 'Waiting for operation…',
      'trace.initFailed': 'Initialization failed',
      'trace.unknownError': 'Unknown error',
      'trace.aiSettings': 'LLM Translation Settings',
      'trace.aiTest': 'LLM Translation Test',
      'trace.traditionalSettings': 'Traditional Translation Settings',
      'trace.traditionalTest': 'Traditional Translation Test',
      'app.copyright': '© 2026 RPG Localization Workbench. All rights reserved.',
      'ai.providerBaidu': 'Baidu Translate', 'ai.providerGoogle': 'Google Translate', 'ai.providerDeepseek': 'DeepSeek', 'ai.providerKimi': 'Kimi (Moonshot AI)', 'ai.providerGemini': 'Gemini', 'ai.providerClaude': 'Claude / Anthropic', 'ai.providerCustom': 'Custom OpenAI-Compatible API',
      'progress.global': 'Project Progress',
      'progress.global': 'Project Progress', 'progress.currentFile': 'Current File Progress', 'progress.file': 'File Progress', 'progress.translated': 'Translated', 'progress.pending': 'Pending', 'progress.reviewed': 'Reviewed', 'progress.warning': 'Warnings', 'progress.lastPosition': 'Last Translation Position', 'progress.continueLast': 'Continue Last Translation', 'progress.gotoLast': 'Go to Last Position', 'progress.nextPending': 'Next Pending', 'progress.previousPending': 'Previous Pending', 'progress.filterPending': 'Pending Only', 'progress.filterWarnings': 'Warnings Only', 'progress.filterContextual': 'Contextual Only', 'progress.filterAtomic': 'Atomic Only', 'progress.noLastPosition': 'No previous translation position', 'progress.noPending': 'No pending entries', 'progress.summary': '{translated}/{total} · {percent}%', 'progress.toggleStatus': 'Click to toggle translated/pending status', 'project.scanningDataRoots': 'Scanning text directories…', 'validation.tooManyLines': '{actual}/{max} lines', 'validation.lineTooLong': 'Line {line}: {actual}/{max} chars', 'validation.missingControlCodes': 'Missing control codes: {codes}', 'ai.defaultSystemPrompt': 'You are a professional RPG Maker game localization assistant. Please translate the source text naturally and accurately into Simplified Chinese.',
      'context.viewMode': 'View Mode', 'context.singleMode': 'Single Entry Mode', 'context.groupMode': 'Context Group Mode', 'context.scrollSync': 'Sync scroll position', 'context.scrollSyncTitle': "When checked, scroll positions of Single Entry and Context Group modes stay in sync; enabling the checkbox aligns the inactive mode's position to the currently active one.", 'context.noGroups': 'No context groups in current file', 'context.groupTargetPlaceholder': 'Enter the translated text for this context group', 'context.groupLineCount': 'How many lines should this be split into', 'context.groupBoundaryTitle': 'Suggested split points', 'context.groupSplitHint': 'Insert ---SPLIT--- inside the combined translation above to mark line breaks. Applying will split by markers or line breaks into selected entries.', 'context.groupSplitOnApply': 'Split by line breaks when applying back', 'context.groupApply': 'Apply to Selected', 'context.groupClear': 'Clear Selection', 'context.groupShort': 'Group',
      'glossary.hitCount': '{count} glossary hits', 'glossary.untitledSource': 'Untitled source', 'glossary.untitledTarget': 'Untitled target', 'glossary.insertMode': 'Insert Mode', 'glossary.insertCursor': 'Insert at Cursor', 'glossary.insertReplace': 'Replace Selection', 'glossary.insertAppend': 'Append to End', 'glossary.insertAll': 'Insert All', 'glossary.insertAllDone': 'Inserted all glossary terms: {count}', 'glossary.insertOne': 'Insert: {source} → {target}', 'glossary.insertOneDone': 'Inserted glossary term into translation: {source}', 'glossary.saving': 'Saving glossary…', 'glossary.creating': 'Creating glossary…', 'glossary.exporting': 'Exporting glossary…', 'glossary.importing': 'Importing glossary…', 'glossary.renaming': 'Renaming glossary: {from} → {to}', 'glossary.loadProjectFirst': 'Please open a project first', 'glossary.importApiMissing': 'Import API not registered', 'glossary.saveFailed': 'Failed to save glossary', 'glossary.exportFailed': 'Export failed', 'glossary.importFailed': 'Import failed', 'glossary.deleteFailed': 'Delete failed', 'glossary.categoryUpdateFailed': 'Failed to update category', 'glossary.updateCategoryApiMissing': 'Category update API is not registered',
      'entry.aiTranslate': 'AI Translate', 'entry.aiTranslateTitle': 'Translate this entry with the currently selected assist provider',
      'textClass.contextual': 'Contextual Text', 'textClass.atomic': 'Atomic Term', 'textClass.mixed': 'Mixed Text', 'textClass.unknown': 'Unknown Type',
      'textType.dialogue-line': 'Dialogue Line', 'textType.dialogue-block': 'Dialogue Group', 'textType.long-description': 'Long Text', 'textType.choice-option': 'Choice', 'textType.actor-name': 'Actor Name', 'textType.actor-description': 'Actor Description', 'textType.enemy-name': 'Enemy Name', 'textType.enemy-description': 'Enemy Description', 'textType.item-name': 'Item Name', 'textType.item-description': 'Item Description', 'textType.items-description': 'Item Description', 'textType.weapon-name': 'Weapon Name', 'textType.weapon-description': 'Weapon Description', 'textType.weapons-description': 'Weapon Description', 'textType.armor-name': 'Armor Name', 'textType.armor-description': 'Armor Description', 'textType.armors-description': 'Armor Description', 'textType.skill-name': 'Skill Name', 'textType.skill-description': 'Skill Description', 'textType.skills-description': 'Skill Description', 'textType.state-name': 'State Name', 'textType.state-description': 'State Description', 'textType.states-description': 'State Description', 'textType.class-name': 'Class Name', 'textType.class-description': 'Class Description', 'textType.classes-description': 'Class Description', 'textType.map-name': 'Map Name', 'textType.system-command': 'System Command', 'textType.system-message': 'System Message', 'textType.system-title': 'System Title', 'textType.currency-unit': 'Currency Unit', 'textType.event-message': 'Event Message', 'textType.speaker': 'Speaker', 'textType.plugin-text': 'Plugin Text', 'textType.generic-text': 'Generic Text',
      'build.testVersion': 'Test Build', 'build.stableVersion': 'Stable Build'
    },
    ja: {
      'common.none': '項目なし', 'common.item': '件', 'common.edit': '編集', 'common.delete': '削除', 'common.confirm': '確認', 'common.cancel': 'キャンセル',
      'common.processing': '処理中', 'common.unknownError': '不明なエラー', 'common.operationFailed': '操作に失敗しました',
      'project.recognized': '認識済み', 'project.recognizedHint': 'プロジェクト構造を認識しました。インポートと翻訳を続行できます。', 'project.dataRootsFound': 'テキストディレクトリ {count} 個を検出', 'project.dataRootsEmpty': 'テキストディレクトリが見つかりません', 'project.statusLoaded': 'プロジェクトを読み込みました', 'project.statusDraft': '下書きを読み込みました', 'project.statusLoading': 'プロジェクトを読み込み中…', 'project.ready': 'プロジェクト準備完了：{path}',
      'trace.projectStatus': 'プロジェクト状態トレース', 'trace.openProject': 'プロジェクトを開く', 'trace.loadDraftBtn': '下書き読み込みボタン', 'trace.prepareRead': '読み込み準備：{path}', 'trace.callSystemDirPicker': 'システムディレクトリ選択器を呼び出し中', 'trace.userCancel': 'ユーザーが選択をキャンセルしました', 'trace.pickResult': '選択結果 rootDir={rootDir}, engine={engine}', 'trace.mainProcessReturn': 'メインプロセスが返却 entries={entries}, warnings={warnings}', 'trace.startPickDraftFile': '下書きファイルの選択を開始', 'trace.draftOpened': '{path} を開きました',
      'draft.loadFailed': '下書きの読み込みに失敗しました', 'draft.loaded': '下書きを読み込みました：{path}',
      'trace.actionStart': 'アクション開始', 'trace.actionSuccess': 'アクション完了', 'trace.actionFailed': 'アクション失敗',
      'action.openProjectFolder': 'プロジェクトフォルダを開く', 'action.loadProjectTexts': 'プロジェクトテキストを読み込む', 'action.saveTranslatorSettings': '翻訳設定を保存', 'action.testTranslatorSettings': '翻訳設定をテスト', 'action.aiTranslate': 'AI 翻訳', 'action.saveProjectLastPosition': '翻訳位置を保存', 'action.loadProjectProgressState': 'プロジェクト進捗を読み込む', 'action.getUiSettings': 'UI 設定を取得', 'action.saveUiSettings': 'UI 設定を保存',
      'error.projectRequired': '{action}前にプロジェクトを開いて読み込んでください', 'error.saveDraftApiMissing': '下書きエクスポート API が未注入です', 'error.exportDraftFailed': '下書きエクスポートに失敗しました', 'error.exportPatchApiMissing': 'パッチエクスポート API が未注入です', 'error.exportPatchFailed': 'パッチエクスポートに失敗しました', 'error.writebackApiMissing': '書き戻し API が未注入です', 'error.writebackFailed': '書き戻しに失敗しました',
      'action.exportDraft': '下書きをエクスポート', 'action.exportPatch': 'パッチをエクスポート', 'action.writebackJson': 'JSON を書き戻す',
      'export.draftPending': '下書きをエクスポート中…', 'export.draftSuccess': '下書きエクスポート完了', 'export.draftError': '下書きエクスポートに失敗しました', 'export.patchPending': 'パッチをエクスポート中…', 'export.patchSuccess': 'パッチエクスポート完了', 'export.patchError': 'パッチエクスポートに失敗しました',
      'trace.writebackClicked': 'ゲーム JSON 書き戻しをクリック', 'action.openPatchDir': 'パッチディレクトリを開く', 'error.noPatchDir': '開くパッチディレクトリがありません', 'error.openDirApiMissing': 'ディレクトリを開く API が未注入です', 'action.openingPatchDir': 'パッチディレクトリを開いています…', 'action.patchDirOpened': 'パッチディレクトリを開きました', 'action.openPatchDirFailed': 'パッチディレクトリを開けませんでした',
      'writeback.summary': '{count} 個の JSON ファイルを書き戻しました（エラー {errors} 件）',
      'glossary.currentProject': '現在のプロジェクト', 'glossary.emptyHint': '現在の用語集は空です。用語を直接追加できます。', 'glossary.termCountHint': 'この用語集には {count} 件の用語があります。',
      'workspace.ai': 'AI 補助翻訳プラットフォーム', 'workspace.exportDraft': '下書きをエクスポート', 'workspace.exportDraftTitle': '現在の翻訳進捗を下書きファイルとしてエクスポート', 'workspace.draftLoad': '下書きを読み込み', 'workspace.draftLoadTitle': '保存済み JSON 下書きから翻訳内容を復元', 'workspace.settings': '設定', 'workspace.export': 'パッチをエクスポート', 'workspace.exportTitle': 'ゲームへ書き戻せるパッチフォルダをエクスポート', 'workspace.resetProject': 'リセット', 'workspace.resetProjectTitle': '現在のプロジェクトをクリアして未読み込み状態に戻す', 'workspace.clearTexts': '現在の JSON 翻訳をクリア', 'workspace.clearTextsTitle': '現在の JSON ファイル内のすべての翻訳行をクリア', 'workspace.clearConfirm': '現在の JSON ファイルのすべての翻訳を消去し、未翻訳に戻します。続行しますか？',
      'stats.groups': 'テキストグループ数', 'stats.progress': '総数 / 翻訳済み', 'stats.translated': '翻訳済み', 'stats.hits': '用語ヒット',
      'ai.providerBaidu': 'Baidu 翻訳', 'ai.providerGoogle': 'Google 翻訳', 'ai.providerDeepseek': 'DeepSeek', 'ai.providerKimi': 'Kimi（Moonshot AI）', 'ai.providerGemini': 'Gemini', 'ai.providerClaude': 'Claude / Anthropic', 'ai.providerCustom': 'OpenAI 互換のカスタム API',
      'trace.providerSwitched': '{provider} に切り替えました',
      'trace.uiSettings': 'UI 設定',
      'trace.uiSettingsSaved': 'UI 設定を保存しました。',
      'trace.backgroundImage': '背景画像',
      'trace.selectFailed': '選択に失敗しました',
      'trace.defaultThemeRestored': 'デフォルトの外観に戻しました',
      'trace.waiting': '操作を待っています…',
      'trace.initFailed': '初期化に失敗しました',
      'trace.unknownError': '不明なエラー',
      'trace.aiSettings': '大規模モデル翻訳設定',
      'trace.aiTest': '大規模モデル翻訳テスト',
      'trace.traditionalSettings': '従来型翻訳設定',
      'trace.traditionalTest': '従来型翻訳テスト',
      'app.copyright': '© 2026 RPG ローカライズ作業台。無断転載を禁じます。',
      'progress.global': 'プロジェクト進捗', 'progress.currentFile': '現在のファイル進捗', 'progress.file': 'ファイル進捗', 'progress.translated': '翻訳済み', 'progress.pending': '未翻訳', 'progress.reviewed': '校正済み', 'progress.warning': '警告', 'progress.lastPosition': '前回の翻訳位置', 'progress.continueLast': '前回の続きから翻訳', 'progress.gotoLast': '前回位置へ移動', 'progress.nextPending': '次の未翻訳', 'progress.previousPending': '前の未翻訳', 'progress.filterPending': '未翻訳のみ', 'progress.filterWarnings': '警告のみ', 'progress.filterContextual': '文脈テキストのみ', 'progress.filterAtomic': '独立語句のみ', 'progress.noLastPosition': '前回の翻訳位置はありません', 'progress.noPending': '未翻訳項目はありません', 'progress.summary': '{translated}/{total} · {percent}%', 'progress.toggleStatus': 'クリックして翻訳済み/未翻訳を切り替え', 'project.scanningDataRoots': 'テキストディレクトリをスキャン中…', 'validation.tooManyLines': '{actual}/{max} 行', 'validation.lineTooLong': '第{line}行{actual}/{max}文字', 'validation.missingControlCodes': '制御コード不足 {codes}', 'ai.defaultSystemPrompt': 'あなたはプロのRPG Makerゲーム漢化アシスタントです。原文を自然かつ正確に簡体字中国語に翻訳してください。',
      'context.viewMode': '表示モード', 'context.singleMode': '単一項目モード', 'context.groupMode': '文脈グループモード', 'context.scrollSync': 'スクロール位置を同期', 'context.scrollSyncTitle': 'チェックすると単一項目モードと文脈グループモードのスクロール位置が同期されます。チェックした瞬間、非アクティブモードの位置は現在のモードの位置に合わせられます。', 'context.noGroups': '現在のファイルには文脈グループがありません', 'context.groupTargetPlaceholder': 'この文脈グループ全体の翻訳を入力', 'context.groupLineCount': '何行に分けるか', 'context.groupBoundaryTitle': '分割候補', 'context.groupSplitHint': '上の結合訳文内に ---SPLIT--- を入れて分割位置を指定します。適用時にマーカーまたは改行で選択項目へ戻します。', 'context.groupSplitOnApply': '適用時に改行で分割', 'context.groupApply': '選択項目に適用', 'context.groupClear': '選択をクリア', 'context.groupShort': '文脈グループ',
      'glossary.hitCount': '用語ヒット {count} 件', 'glossary.untitledSource': '未命名の原文', 'glossary.untitledTarget': '未命名の訳文', 'glossary.insertMode': '挿入方法', 'glossary.insertCursor': 'カーソル位置に挿入', 'glossary.insertReplace': '選択範囲を置換', 'glossary.insertAppend': '末尾に追加', 'glossary.insertAll': 'すべて挿入', 'glossary.insertOne': '挿入：{source} → {target}', 'glossary.saving': '用語集を保存中…', 'glossary.creating': '用語集を作成中…', 'glossary.exporting': '用語集をエクスポート中…', 'glossary.importing': '用語集をインポート中…', 'glossary.renaming': '用語集の名前を変更中：{from} → {to}', 'glossary.loadProjectFirst': 'プロジェクトを先に開いてください', 'glossary.importApiMissing': 'インポート API が未登録です', 'glossary.saveFailed': '用語集の保存に失敗しました', 'glossary.exportFailed': 'エクスポートに失敗しました', 'glossary.importFailed': 'インポートに失敗しました', 'glossary.deleteFailed': '削除に失敗しました', 'glossary.categoryUpdateFailed': 'カテゴリ更新に失敗しました', 'glossary.updateCategoryApiMissing': 'カテゴリ更新 API が未登録です',
      'textClass.contextual': '文脈テキスト', 'textClass.atomic': '独立語句', 'textClass.mixed': '混合テキスト', 'textClass.unknown': '不明な種類',
      'textType.dialogue-line': '会話行', 'textType.dialogue-block': '会話グループ', 'textType.long-description': '長文', 'textType.choice-option': '選択肢', 'textType.actor-name': 'キャラクター名', 'textType.actor-description': 'キャラクター説明', 'textType.enemy-name': '敵名', 'textType.enemy-description': '敵説明', 'textType.item-name': 'アイテム名', 'textType.item-description': 'アイテム説明', 'textType.items-description': 'アイテム説明', 'textType.weapon-name': '武器名', 'textType.weapon-description': '武器説明', 'textType.weapons-description': '武器説明', 'textType.armor-name': '防具名', 'textType.armor-description': '防具説明', 'textType.armors-description': '防具説明', 'textType.skill-name': 'スキル名', 'textType.skill-description': 'スキル説明', 'textType.skills-description': 'スキル説明', 'textType.state-name': 'ステート名', 'textType.state-description': 'ステート説明', 'textType.states-description': 'ステート説明', 'textType.class-name': '職業名', 'textType.class-description': '職業説明', 'textType.classes-description': '職業説明', 'textType.map-name': 'マップ名', 'textType.system-command': 'システムコマンド', 'textType.system-message': 'システムメッセージ', 'textType.system-title': 'システムタイトル', 'textType.currency-unit': '通貨単位', 'textType.event-message': 'イベントメッセージ', 'textType.speaker': '話者', 'textType.plugin-text': 'プラグインテキスト', 'textType.generic-text': '汎用テキスト',
      'build.testVersion': 'テスト版', 'build.stableVersion': '安定版'
    }
  };

  Object.assign(fallbackI18n['zh-CN'], {
    'ai.provider': '提供方', 'ai.providerMock': '本地示例', 'ai.apiKey': 'API Key', 'ai.baseUrl': '接口地址', 'ai.model': '模型', 'ai.save': '保存设置', 'ai.test': '测试 AI',
    'ai.deepseekV4Flash': 'deepseek-v4-flash（官方推荐，非思考）', 'ai.deepseekV4Pro': 'deepseek-v4-pro（官方推荐，思考）', 'ai.deepseekChat': 'deepseek-chat（旧兼容名，将弃用）', 'ai.deepseekReasoner': 'deepseek-reasoner（旧兼容名，将弃用）',
    'app.version': 'v1.2.0', 'language.zhCN': '简体中文', 'language.en': 'English', 'language.ja': '日本語', 'workspace.applyWritebackTitle': '把当前译文按原结构写回新 JSON（不覆盖原文件，输出到 localization_patch/data/）',
    'settings.traditionalProvider': '传统翻译子类型', 'settings.providerBaidu': '百度翻译', 'settings.providerGoogle': '谷歌翻译', 'settings.testTraditional': '测试传统翻译', 'settings.closeBehaviorGroup': '关闭行为', 'settings.closeBehavior': '关闭按钮行为', 'settings.closeBehaviorTray': '最小化到右下角托盘', 'settings.closeBehaviorExit': '直接退出程序', 'settings.closeBehaviorHint': '选择“最小化到托盘”后，点击右上角 X 不会真正退出，而是隐藏到系统托盘；再次打开托盘即可恢复窗口。选择“直接退出程序”则点击 X 会正常关闭应用。',
    'glossary.countLabel': '术语数', 'glossary.search': '搜索术语库', 'glossary.searchPlaceholder': '输入名称筛选术语库', 'glossary.select': '术语库列表', 'glossary.new': '新建术语库', 'glossary.import': '导入术语库', 'glossary.export': '导出术语库', 'glossary.delete': '删除术语库', 'glossary.newName': '新术语库名称', 'glossary.newNamePlaceholder': '例如：怪物名词', 'glossary.termSelect': '查询术语', 'glossary.termSearchPlaceholder': '输入原名或译名', 'glossary.searchTerm': '搜索', 'glossary.add': '添加术语', 'glossary.editTitle': '术语编辑', 'glossary.source': '原名', 'glossary.sourcePlaceholder': '例如：Potion', 'glossary.target': '译名', 'glossary.targetPlaceholder': '例如：药水', 'glossary.note': '术语备注', 'glossary.notePlaceholder': '可选备注', 'glossary.fieldRequired': '原名和译名都不能为空，请补全后再保存。', 'glossary.fieldRequiredSource': '原名不能为空，请填写后再保存。', 'glossary.fieldRequiredTarget': '译名不能为空，请填写后再保存。',
    'findReplace.title': '查找 / 替换', 'findReplace.openBtn': '查找替换', 'findReplace.openTitle': '查找/替换与快速填充重复文本', 'findReplace.close': '关闭查找替换',
    'findReplace.scope': '查找范围', 'findReplace.scopeCurrent': '当前 JSON', 'findReplace.scopeAll': '全部 JSON',
    'findReplace.targetField': '目标字段', 'findReplace.targetSource': '原文', 'findReplace.targetTarget': '译文',
    'findReplace.findLabel': '查找内容', 'findReplace.findPlaceholder': '输入要查找的文本或正则',
    'findReplace.replaceLabel': '替换为', 'findReplace.replacePlaceholder': '输入替换后的文本',
    'findReplace.caseSensitive': '区分大小写', 'findReplace.wholeWord': '全字匹配', 'findReplace.useRegex': '使用正则表达式',
    'findReplace.findBtn': '查找', 'findReplace.prevBtn': '上一个', 'findReplace.nextBtn': '下一个', 'findReplace.replaceCurrentBtn': '替换当前', 'findReplace.replaceAllBtn': '全部替换',
    'findReplace.noMatch': '未找到匹配', 'findReplace.matchInfo': '第 {current} / {total} 条匹配', 'findReplace.regexInvalid': '正则表达式无效',
    'findReplace.repeatableTitle': '快速填充重复定式文本', 'findReplace.repeatableHint': '自动扫描范围内「原文相同、部分已译、部分未译」的条目，一键把已译内容填充到未译条目。',
    'findReplace.refreshList': '刷新列表', 'findReplace.emptyRepeatable': '点击刷新列表查看可填充的重复文本', 'findReplace.noRepeatable': '当前范围内没有可快速填充的重复文本',
    'findReplace.repeatableItem': '{source} （{translated} 条已译 / {pending} 条待填）', 'findReplace.fillBtn': '填充',
    'findReplace.fillDone': '已将 "{source}" 的 {count} 条待填项填充为 "{value}"', 'findReplace.replaceAllDone': '全部替换完成：{count} 条',
    'findReplace.traceTitle': '查找替换', 'findReplace.traceFillTitle': '快速填充',
    'workspace.applyWriteback': '写回游戏 JSON',
    'trace.title': '调用反馈', 'trace.operationStatus': '操作状态',
    'ai.autoSplitGroup': '译文自动断行', 'ai.autoSplit': '对话框（code:401）译文超长时按引擎约束自动拆行', 'ai.autoSplitHint': '仅作用于对话框文本；按标点优先级切分，不破坏控制码。', 'ai.autoSplitDemoTitle': '效果示例（28 字/行，最多 4 行）', 'ai.autoSplitDemoBefore': '未启用：', 'ai.autoSplitDemoAfter': '启用后：',
    'ai.glossaryGroup': '术语库自动注入', 'ai.glossaryMode': '注入模式', 'ai.glossaryModeOff': '不使用（默认）', 'ai.glossaryModeReplace': '强制替换原文（送进 AI 前先替换）', 'ai.glossaryModePrompt': '注入 System Prompt（要求 AI 遵守对照表）',
    'ai.glossaryHint': '命中术语会在每次 AI 调用前介入：替换模式直接改写原文；Prompt 模式把对照表加到系统提示后部。空术语库时所有模式均不生效。',
    'glossary.untitledSource': '未命名原文', 'glossary.untitledTarget': '未命名译名',
    'project.dataRootsLabel': '文本目录：', 'trace.stateRegression': '状态回退',
    'common.actionPending': '{action}中…', 'common.actionSuccess': '{action}完成', 'common.actionError': '{action}失败',
    'settings.previewClickToOpen': '点击查看原图'
  });

  Object.assign(fallbackI18n.en, {
    'app.title': 'RPG Localization Workbench', 'welcome.title': 'Welcome to the Localization Workbench', 'welcome.description': 'Import RPG Maker projects, extract text, maintain glossaries, and export writable localization patches.', 'welcome.start': 'Start Project', 'welcome.demo': 'View Demo Project',
    'project.open': 'Open Game Project', 'project.status': 'Project Status', 'project.unrecognized': 'Unrecognized', 'project.hint': 'Choose a game folder to detect the engine and load text.', 'project.scanDataRoots': 'Scan Text Locations',
    'workspace.title': 'Workspace', 'workspace.noProject': 'No project opened', 'selector.title': 'Bilingual Editor', 'selector.hint': 'Edit source and translation side by side with glossary and AI assistance', 'selector.file': 'JSON File', 'selector.search': 'Search', 'selector.searchPlaceholder': 'Enter keywords to filter', 'selector.searchScope': 'Search Scope', 'selector.searchScopeCurrent': 'Current JSON', 'selector.searchScopeAll': 'All JSON', 'editor.source': 'Source', 'editor.target': 'Translation',
    'settings.tabUI': 'UI Settings', 'settings.tabTraditional': 'Traditional Translation', 'settings.tabLLM': 'LLM Translation', 'settings.titleUI': 'UI Settings', 'settings.titleTraditional': 'Traditional Translation Settings', 'settings.titleLLM': 'LLM Translation Settings', 'settings.tabAccessibility': 'Accessibility', 'settings.titleAccessibility': 'Accessibility', 'settings.timelineGroupTitle': 'Story Flow View', 'settings.enableTimelineMode': 'Arrange dialogue by story flow (for RPG Maker MV/MZ)', 'settings.timelineModeHint': 'When enabled, the editor arranges Map file dialogue, choices, and branch text in the order players actually experience them (map/event/branch). System text (items, skills, etc.) remains in original order. All changes are still written back to their original physical positions, so the game structure stays safe.', 'settings.timelineModeOn': 'Story flow view enabled', 'settings.timelineModeOff': 'Story flow view disabled', 'settings.timelineModeUnsupported': 'Story flow view only works for RPG Maker MV/MZ projects', 'settings.sceneSeparator': 'Scene: {scene}', 'settings.autoSaveGroupTitle': 'Auto Save', 'settings.enableAutoSave': 'Enable auto-save for glossary and translation draft', 'settings.autoSaveInterval': 'Auto-save interval (minutes)', 'settings.autoSaveDir': 'Auto-save location (leave empty for default)', 'settings.autoSaveDirPlaceholder': 'Default: same folder as manual save, with auto-save filename', 'settings.pickAutoSaveDir': 'Browse…', 'settings.autoSaveHint': 'When enabled, the app will overwrite auto-save files at the set interval. Manual save files are not overwritten. Auto-save files can be used for crash recovery.', 'settings.autoSaveOn': 'Auto-save enabled', 'settings.autoSaveOff': 'Auto-save disabled', 'settings.autoSaveRunning': 'Auto-saved to: {paths}', 'settings.autoSaveFailed': 'Auto-save failed: {error}', 'settings.autoSaveIntervalInvalid': 'Interval must be between 1 and 120 minutes', 'settings.language': 'Interface Language', 'settings.themeMode': 'Color Mode', 'settings.themeSystem': 'Follow System', 'settings.themeDark': 'Dark', 'settings.themeLight': 'Light', 'settings.themePalette': 'Accent Color', 'settings.paletteViolet': 'Violet', 'settings.paletteBlue': 'Sky Blue', 'settings.paletteEmerald': 'Emerald', 'settings.paletteRose': 'Rose', 'settings.paletteAmber': 'Amber', 'settings.paletteSlate': 'Slate', 'settings.backgroundImage': 'Background Image', 'settings.backgroundImagePlaceholder': 'Enter an image path or URL; leave empty for solid background', 'settings.backgroundHint': 'Supports local image paths or web image URLs. Leave empty to use the theme background.', 'settings.pickBackground': 'Choose Background Image', 'settings.previewBackground': 'Preview Background', 'settings.applyBackground': 'Apply to Current UI', 'settings.clearBackground': 'Clear Background Image', 'settings.resetTheme': 'Reset Appearance', 'settings.previewTitle': 'Background Preview', 'settings.previewEmpty': 'No background image is set', 'settings.save': 'Save Settings', 'settings.close': 'Close Settings',
    'settings.traditionalProvider': 'Traditional Translation Subtype', 'settings.providerBaidu': 'Baidu Translate', 'settings.providerGoogle': 'Google Translate', 'settings.testTraditional': 'Test Traditional Translation', 'settings.baiduAppId': 'Baidu App ID', 'settings.baiduAppIdPlaceholder': 'Enter Baidu App ID', 'settings.baiduSecret': 'Baidu Secret Key', 'settings.baiduSecretPlaceholder': 'Enter Baidu secret key', 'settings.googleApiKey': 'Google API Key', 'settings.googleApiKeyPlaceholder': 'Enter Google API Key', 'settings.sourceLang': 'Source Language', 'settings.sourceLangPlaceholder': 'auto', 'settings.targetLang': 'Target Language', 'settings.targetLangPlaceholder': 'zh-CN', 'settings.traditionalHint': 'Choose a traditional translation service. Baidu requires App ID and secret; Google requires an API key.', 'settings.llmHint': 'Useful for long text translation, style consistency, and character voice.', 'settings.closeBehaviorGroup': 'Close Behavior', 'settings.closeBehavior': 'Close Button Behavior', 'settings.closeBehaviorTray': 'Minimize to system tray', 'settings.closeBehaviorExit': 'Exit immediately', 'settings.closeBehaviorHint': 'When minimized to tray, the X button hides the window instead of quitting. Exit immediately closes the app normally.',
    'ai.provider': 'Provider', 'ai.providerMock': 'Local Demo', 'ai.apiKey': 'API Key', 'ai.baseUrl': 'Endpoint URL', 'ai.model': 'Model', 'ai.prompt': 'System Prompt', 'ai.save': 'Save Settings', 'ai.test': 'Test AI', 'ai.status': 'Choose a translation mode to start.', 'ai.apiKeyPlaceholder': 'Your API Key', 'ai.baseUrlPlaceholder': 'Endpoint URL, e.g. https://api.deepseek.com', 'ai.modelPlaceholder': 'Enter custom model name', 'ai.modelCustom': 'Custom Model', 'ai.deepseekBaseUrlHint': 'DeepSeek official base_url is https://api.deepseek.com. The app calls /chat/completions automatically; do not enter /v1/chat/completions.',
    'ai.deepseekV4Flash': 'deepseek-v4-flash (official recommended, non-thinking)', 'ai.deepseekV4Pro': 'deepseek-v4-pro (official recommended, thinking)', 'ai.deepseekChat': 'deepseek-chat (legacy name, will be deprecated)', 'ai.deepseekReasoner': 'deepseek-reasoner (legacy name, will be deprecated)',
    'app.version': '· 1.2.0', 'language.zhCN': '简体中文', 'language.en': 'English', 'language.ja': '日本語', 'workspace.applyWritebackTitle': 'Write current translations back to new JSON without overwriting original files (outputs to localization_patch/data/)',
    'glossary.title': 'Glossary', 'glossary.panelHint': 'Open glossary management to create, import, export, edit, and search terms.', 'glossary.manage': 'Manage Glossary', 'glossary.countLabel': 'Terms', 'glossary.search': 'Search Glossaries', 'glossary.searchPlaceholder': 'Filter glossary names', 'glossary.select': 'Glossary List', 'glossary.new': 'New Glossary', 'glossary.rename': 'Rename Glossary', 'glossary.import': 'Import Glossary', 'glossary.export': 'Export Glossary', 'glossary.delete': 'Delete Glossary', 'glossary.newName': 'New Glossary Name', 'glossary.newNamePlaceholder': 'Example: Monster Names', 'glossary.renamePrompt': 'Enter a new glossary name', 'glossary.termSelect': 'Find Term', 'glossary.termSearchPlaceholder': 'Enter source or translation', 'glossary.searchTerm': 'Search', 'glossary.add': 'Add Term', 'glossary.editTitle': 'Term Editor', 'glossary.source': 'Source Name', 'glossary.sourcePlaceholder': 'Example: Potion', 'glossary.target': 'Translated Name', 'glossary.targetPlaceholder': 'Example: Potion', 'glossary.note': 'Term Note', 'glossary.notePlaceholder': 'Optional note', 'glossary.closeEditor': 'Close term editor', 'glossary.fieldRequired': 'Both source and translated names are required before saving.', 'glossary.fieldRequiredSource': 'Source name is required.', 'glossary.fieldRequiredTarget': 'Translated name is required.', 'glossary.category': 'Category', 'glossary.categoryPlaceholder': 'default', 'glossary.applyCategory': 'Apply Category', 'glossary.newCategory': 'Category (sub-glossaries with the same category aggregate for hit detection)', 'glossary.aggregationHint': 'Category "{category}" aggregates {count} sub-glossaries with {terms} terms participating in hit detection.', 'glossary.categoryUpdating': 'Updating category of {name} to {category}…', 'glossary.categoryUpdated': 'Moved glossary {name} into category {category}.', 'glossary.categoryUpdateFailed': 'Failed to update category', 'glossary.updateCategoryApiMissing': 'Category update API is not registered',
    'findReplace.title': 'Find / Replace', 'findReplace.openBtn': 'Find / Replace', 'findReplace.openTitle': 'Find/replace and quickly fill repeated text', 'findReplace.close': 'Close find/replace',
    'findReplace.scope': 'Scope', 'findReplace.scopeCurrent': 'Current JSON', 'findReplace.scopeAll': 'All JSON',
    'findReplace.targetField': 'Target field', 'findReplace.targetSource': 'Source', 'findReplace.targetTarget': 'Translation',
    'findReplace.findLabel': 'Find', 'findReplace.findPlaceholder': 'Enter text or regex',
    'findReplace.replaceLabel': 'Replace with', 'findReplace.replacePlaceholder': 'Enter replacement text',
    'findReplace.caseSensitive': 'Case sensitive', 'findReplace.wholeWord': 'Whole word', 'findReplace.useRegex': 'Use regular expression',
    'findReplace.findBtn': 'Find', 'findReplace.prevBtn': 'Previous', 'findReplace.nextBtn': 'Next', 'findReplace.replaceCurrentBtn': 'Replace current', 'findReplace.replaceAllBtn': 'Replace all',
    'findReplace.noMatch': 'No matches', 'findReplace.matchInfo': 'Match {current} / {total}', 'findReplace.regexInvalid': 'Invalid regular expression',
    'findReplace.repeatableTitle': 'Quick-fill repeated text', 'findReplace.repeatableHint': 'Scan entries with identical source where some are translated and others are not, then fill the untranslated ones with an existing translation.',
    'findReplace.refreshList': 'Refresh list', 'findReplace.emptyRepeatable': 'Click refresh to see fillable repeated text', 'findReplace.noRepeatable': 'No repeatable text to fill in the current scope',
    'findReplace.repeatableItem': '{source} ({translated} translated / {pending} pending)', 'findReplace.fillBtn': 'Fill',
    'findReplace.fillDone': 'Filled {count} pending entries of "{source}" with "{value}"', 'findReplace.replaceAllDone': 'Replace all completed: {count} entries',
    'findReplace.traceTitle': 'Find / Replace', 'findReplace.traceFillTitle': 'Quick-fill repeated text',
    'workspace.applyWriteback': 'Write back to game JSON',
    'trace.title': 'Call Trace', 'trace.operationStatus': 'Operation Status',
    'ai.autoSplitGroup': 'Auto line-break for translations', 'ai.autoSplit': 'Auto-split dialogue translations (code:401) when they exceed engine limits', 'ai.autoSplitHint': 'Only applies to dialogue text; splits by punctuation priority without breaking control codes.', 'ai.autoSplitDemoTitle': 'Example (28 chars/line, max 4 lines)', 'ai.autoSplitDemoBefore': 'Disabled:', 'ai.autoSplitDemoAfter': 'Enabled:',
    'ai.glossaryGroup': 'Glossary auto-injection', 'ai.glossaryMode': 'Injection mode', 'ai.glossaryModeOff': 'Off (default)', 'ai.glossaryModeReplace': 'Force-replace source before sending to AI', 'ai.glossaryModePrompt': 'Inject into system prompt',
    'ai.glossaryHint': 'Matched glossary terms intervene before each AI call: replace mode rewrites the source; prompt mode appends the glossary to the system prompt. No effect when the glossary is empty.',
    'glossary.renameApiMissing': 'Rename API is not registered', 'glossary.renameFailed': 'Rename failed',
    'project.dataRootsLabel': 'Text dirs: ', 'trace.stateRegression': 'State regression',
    'common.actionPending': '{action} in progress…', 'common.actionSuccess': '{action} completed', 'common.actionError': '{action} failed',
    'settings.previewClickToOpen': 'Click to view original image'
  });

  Object.assign(fallbackI18n.ja, {
    'app.title': 'RPG ローカライズ作業台', 'welcome.title': 'ローカライズ作業台へようこそ', 'welcome.description': 'RPG Maker プロジェクトを読み込み、テキスト抽出、用語集管理、書き戻し可能なパッチ出力を行います。', 'welcome.start': '作業を開始', 'welcome.demo': 'デモプロジェクトを見る',
    'project.open': 'ゲームプロジェクトを開く', 'project.status': 'プロジェクト状態', 'project.unrecognized': '未識別', 'project.hint': 'ゲームフォルダを選択すると、エンジンを判定してテキストを読み込みます。', 'project.scanDataRoots': 'テキスト位置をスキャン',
    'workspace.title': 'ワークスペース', 'workspace.noProject': 'プロジェクトは未選択です', 'selector.title': '対訳エディタ', 'selector.hint': '原文と訳文を並べて編集し、用語集と AI 補助翻訳を利用できます', 'selector.file': 'JSON ファイル', 'selector.search': '検索', 'selector.searchPlaceholder': 'キーワードで絞り込み', 'selector.searchScope': '検索範囲', 'selector.searchScopeCurrent': '現在の JSON', 'selector.searchScopeAll': 'すべての JSON', 'editor.source': '原文', 'editor.target': '訳文',
    'settings.tabUI': 'UI 設定', 'settings.tabTraditional': '従来翻訳', 'settings.tabLLM': '大規模モデル翻訳', 'settings.titleUI': 'UI 設定', 'settings.titleTraditional': '従来翻訳設定', 'settings.titleLLM': '大規模モデル翻訳設定', 'settings.tabAccessibility': 'アクセシビリティ', 'settings.titleAccessibility': 'アクセシビリティ', 'settings.timelineGroupTitle': 'ストーリー流れ表示', 'settings.enableTimelineMode': 'プレイ順に会話を並べる（RPG Maker MV/MZ 対象）', 'settings.timelineModeHint': '有効にすると、エディタはプレイヤーが実際に体験するゲームの流れ（マップ/イベント/分岐）に沿って Map ファイルの会話、選択肢などを並べます。システムテキスト（道具、スキルなど）は元の順序のままです。すべての変更は元の物理位置に書き戻されるため、ゲーム構造に影響しません。', 'settings.timelineModeOn': 'ストーリー流れ表示を有効にしました', 'settings.timelineModeOff': 'ストーリー流れ表示を無効にしました', 'settings.timelineModeUnsupported': 'ストーリー流れ表示は RPG Maker MV/MZ プロジェクトでのみ有効です', 'settings.sceneSeparator': 'シーン：{scene}', 'settings.autoSaveGroupTitle': '自動保存', 'settings.enableAutoSave': '用語集と訳文草稿の自動保存を有効にする', 'settings.autoSaveInterval': '自動保存間隔（分）', 'settings.autoSaveDir': '自動保存場所（空欄でデフォルト）', 'settings.autoSaveDirPlaceholder': 'デフォルト：手動保存と同じフォルダ、ファイル名に auto-save を含む', 'settings.pickAutoSaveDir': '参照…', 'settings.autoSaveHint': '有効にすると、設定間隔で auto-save ファイルを上書き保存します。手動保存ファイルは上書きされません。auto-save ファイルはクラッシュ復旧に使用できます。', 'settings.autoSaveOn': '自動保存を有効にしました', 'settings.autoSaveOff': '自動保存を無効にしました', 'settings.autoSaveRunning': '自動保存完了：{paths}', 'settings.autoSaveFailed': '自動保存に失敗しました：{error}', 'settings.autoSaveIntervalInvalid': '保存間隔は 1～120 分の間で指定してください', 'settings.language': '表示言語', 'settings.themeMode': '配色モード', 'settings.themeSystem': 'システムに従う', 'settings.themeDark': 'ダーク', 'settings.themeLight': 'ライト', 'settings.themePalette': 'アクセントカラー', 'settings.paletteViolet': 'バイオレット', 'settings.paletteBlue': 'スカイブルー', 'settings.paletteEmerald': 'エメラルド', 'settings.paletteRose': 'ローズ', 'settings.paletteAmber': 'アンバー', 'settings.paletteSlate': 'スレート', 'settings.backgroundImage': '背景画像', 'settings.backgroundImagePlaceholder': '画像パスまたは URL。空なら単色背景', 'settings.backgroundHint': 'ローカル画像パスまたは Web 画像 URL に対応。空の場合はテーマ背景を使用します。', 'settings.pickBackground': '背景画像を選択', 'settings.previewBackground': '背景をプレビュー', 'settings.applyBackground': '現在の UI に適用', 'settings.clearBackground': '背景画像をクリア', 'settings.resetTheme': '外観を初期化', 'settings.previewTitle': '背景プレビュー', 'settings.previewEmpty': '背景画像は未設定です', 'settings.save': '設定を保存', 'settings.close': '設定を閉じる',
    'settings.traditionalProvider': '従来翻訳の種類', 'settings.providerBaidu': 'Baidu 翻訳', 'settings.providerGoogle': 'Google 翻訳', 'settings.testTraditional': '従来翻訳をテスト', 'settings.baiduAppId': 'Baidu App ID', 'settings.baiduAppIdPlaceholder': 'Baidu App ID を入力', 'settings.baiduSecret': 'Baidu シークレットキー', 'settings.baiduSecretPlaceholder': 'Baidu シークレットキーを入力', 'settings.googleApiKey': 'Google API Key', 'settings.googleApiKeyPlaceholder': 'Google API Key を入力', 'settings.sourceLang': '元言語', 'settings.sourceLangPlaceholder': 'auto', 'settings.targetLang': '対象言語', 'settings.targetLangPlaceholder': 'zh-CN', 'settings.traditionalHint': '従来翻訳サービスを選択できます。Baidu は App ID とシークレット、Google は API Key が必要です。', 'settings.llmHint': '長文翻訳、文体統一、キャラクター口調に適しています。', 'settings.closeBehaviorGroup': '閉じる動作', 'settings.closeBehavior': '閉じるボタンの動作', 'settings.closeBehaviorTray': 'システムトレイに最小化', 'settings.closeBehaviorExit': 'すぐ終了', 'settings.closeBehaviorHint': 'トレイに最小化を選ぶと、X ボタンは終了せずウィンドウを隠します。すぐ終了を選ぶと通常終了します。',
    'ai.provider': '提供元', 'ai.providerMock': 'ローカルデモ', 'ai.apiKey': 'API Key', 'ai.baseUrl': 'エンドポイント URL', 'ai.model': 'モデル', 'ai.prompt': 'システムプロンプト', 'ai.save': '設定を保存', 'ai.test': 'AI をテスト', 'ai.status': '翻訳モードを選択してください。', 'ai.apiKeyPlaceholder': 'API Key', 'ai.baseUrlPlaceholder': '例：https://api.deepseek.com', 'ai.modelPlaceholder': 'カスタムモデル名を入力', 'ai.modelCustom': 'カスタムモデル', 'ai.deepseekBaseUrlHint': 'DeepSeek 公式 base_url は https://api.deepseek.com です。アプリが /chat/completions を自動で呼び出すため、/v1/chat/completions は入力しないでください。',
    'ai.deepseekV4Flash': 'deepseek-v4-flash（公式推奨、非思考）', 'ai.deepseekV4Pro': 'deepseek-v4-pro（公式推奨、思考）', 'ai.deepseekChat': 'deepseek-chat（旧互換名、廃止予定）', 'ai.deepseekReasoner': 'deepseek-reasoner（旧互換名、廃止予定）',
    'app.version': '· 1.2.0', 'language.zhCN': '简体中文', 'language.en': 'English', 'language.ja': '日本語', 'workspace.applyWritebackTitle': '現在の翻訳を新しい JSON に元の構造で書き戻す（元ファイルは上書きせず、localization_patch/data/ に出力）',
    'glossary.title': '用語集', 'glossary.panelHint': '用語集管理を開き、新規作成、インポート、エクスポート、編集、検索ができます。', 'glossary.manage': '用語集を管理', 'glossary.countLabel': '用語数', 'glossary.search': '用語集を検索', 'glossary.searchPlaceholder': '用語集名で絞り込み', 'glossary.select': '用語集一覧', 'glossary.new': '新規用語集', 'glossary.rename': '用語集名を変更', 'glossary.import': '用語集をインポート', 'glossary.export': '用語集をエクスポート', 'glossary.delete': '用語集を削除', 'glossary.newName': '新しい用語集名', 'glossary.newNamePlaceholder': '例：モンスター名', 'glossary.renamePrompt': '新しい用語集名を入力', 'glossary.termSelect': '用語を検索', 'glossary.termSearchPlaceholder': '原文または訳語を入力', 'glossary.searchTerm': '検索', 'glossary.add': '用語を追加', 'glossary.editTitle': '用語編集', 'glossary.source': '原名', 'glossary.sourcePlaceholder': '例：Potion', 'glossary.target': '訳名', 'glossary.targetPlaceholder': '例：ポーション', 'glossary.note': '用語メモ', 'glossary.notePlaceholder': '任意メモ', 'glossary.closeEditor': '用語編集を閉じる', 'glossary.fieldRequired': '原名と訳名はどちらも必須です。入力してから保存してください。', 'glossary.fieldRequiredSource': '原名を入力してください。', 'glossary.fieldRequiredTarget': '訳名を入力してください。', 'glossary.category': 'カテゴリ', 'glossary.categoryPlaceholder': 'default', 'glossary.applyCategory': 'カテゴリを適用', 'glossary.newCategory': 'カテゴリ（同じカテゴリのサブ用語集はまとめてヒット検出に使われます）', 'glossary.aggregationHint': 'カテゴリ「{category}」は {count} 個のサブ用語集を統合し、合計 {terms} 件の用語がヒット検出に参加します。', 'glossary.categoryUpdating': '{name} のカテゴリを {category} に更新中…', 'glossary.categoryUpdated': '用語集 {name} をカテゴリ {category} に移しました。', 'glossary.categoryUpdateFailed': 'カテゴリ更新に失敗しました', 'glossary.updateCategoryApiMissing': 'カテゴリ更新 API が未登録です',
    'findReplace.title': '検索 / 置換', 'findReplace.openBtn': '検索・置換', 'findReplace.openTitle': '検索・置換と定型文の一括入力', 'findReplace.close': '検索・置換を閉じる',
    'findReplace.scope': '検索範囲', 'findReplace.scopeCurrent': '現在の JSON', 'findReplace.scopeAll': 'すべての JSON',
    'findReplace.targetField': '対象フィールド', 'findReplace.targetSource': '原文', 'findReplace.targetTarget': '訳文',
    'findReplace.findLabel': '検索文字列', 'findReplace.findPlaceholder': '検索する文字列または正規表現',
    'findReplace.replaceLabel': '置換後', 'findReplace.replacePlaceholder': '置換後の文字列',
    'findReplace.caseSensitive': '大文字/小文字を区別', 'findReplace.wholeWord': '単語単位', 'findReplace.useRegex': '正規表現を使用',
    'findReplace.findBtn': '検索', 'findReplace.prevBtn': '前へ', 'findReplace.nextBtn': '次へ', 'findReplace.replaceCurrentBtn': '現在を置換', 'findReplace.replaceAllBtn': 'すべて置換',
    'findReplace.noMatch': '一致なし', 'findReplace.matchInfo': '{current} / {total} 件目の一致', 'findReplace.regexInvalid': '正規表現が無効です',
    'findReplace.repeatableTitle': '定型文の一括入力', 'findReplace.repeatableHint': '範囲内で「原文が同じで一部は翻訳済、一部は未翻訳」の項目を自動検出し、翻訳済みの内容を未翻訳項目に一括入力します。',
    'findReplace.refreshList': 'リストを更新', 'findReplace.emptyRepeatable': '更新ボタンを押すと、入力可能な定型文が表示されます', 'findReplace.noRepeatable': '現在の範囲に入力可能な定型文はありません',
    'findReplace.repeatableItem': '{source} （翻訳済 {translated} 件 / 未翻訳 {pending} 件）', 'findReplace.fillBtn': '入力',
    'findReplace.fillDone': '「{source}」の未翻訳 {count} 件を「{value}」で入力しました', 'findReplace.replaceAllDone': 'すべて置換完了：{count} 件',
    'findReplace.traceTitle': '検索・置換', 'findReplace.traceFillTitle': '定型文の一括入力',
    'workspace.applyWriteback': 'ゲーム JSON に書き戻す',
    'trace.title': '呼び出しフィードバック', 'trace.operationStatus': '操作状態',
    'ai.autoSplitGroup': '翻訳文の自動改行', 'ai.autoSplit': 'ダイアログ（code:401）の翻訳が制限を超えたら自動改行', 'ai.autoSplitHint': 'ダイアログテキストのみ；制御コードを壊さず句読点優先で分割します。', 'ai.autoSplitDemoTitle': '効果例（1行28文字、最大4行）', 'ai.autoSplitDemoBefore': '未使用：', 'ai.autoSplitDemoAfter': '使用後：',
    'ai.glossaryGroup': '用語集の自動注入', 'ai.glossaryMode': '注入モード', 'ai.glossaryModeOff': '使用しない（デフォルト）', 'ai.glossaryModeReplace': 'AI 送信前に原文を強制置換', 'ai.glossaryModePrompt': 'システムプロンプトに注入',
    'ai.glossaryHint': 'ヒットした用語は AI 呼び出し前に介入：置換モードは原文を書き換え、プロンプトモードは対照表をシステムプロンプトに追加。用語集が空の場合は無効。',
    'glossary.renameApiMissing': '名前変更 API が未登録です', 'glossary.renameFailed': '名前変更に失敗しました',
    'project.dataRootsLabel': 'テキストディレクトリ：', 'trace.stateRegression': '状態回退',
    'common.actionPending': '{action}中…', 'common.actionSuccess': '{action}完了', 'common.actionError': '{action}失敗',
    'settings.previewClickToOpen': '元画像を表示'
  });

  Object.assign(fallbackI18n['zh-CN'], {
    'progress.fileProgressTitle': '当前 JSON 文件的翻译百分比'
  });
  Object.assign(fallbackI18n.en, {
    'progress.fileProgressTitle': 'Translation percentage of the current JSON file'
  });
  Object.assign(fallbackI18n.ja, {
    'progress.fileProgressTitle': '現在の JSON ファイルの翻訳率'
  });

  function mergeI18nFallbacks() {
    window.RpgI18n = window.RpgI18n || {};
    Object.entries(fallbackI18n).forEach(([lang, dict]) => {
      window.RpgI18n[lang] = { ...(dict || {}), ...(window.RpgI18n[lang] || {}) };
    });
  }

  function translate(key, vars = {}) {
    const lang = localStorage.getItem('rpg-workbench-language') || 'zh-CN';
    const current = window.RpgI18n?.[lang] || {};
    const zh = window.RpgI18n?.['zh-CN'] || {};
    const fallback = fallbackI18n[lang] || fallbackI18n['zh-CN'];
    let text = current[key] || fallback[key] || zh[key] || fallbackI18n['zh-CN'][key] || key;
    Object.entries(vars).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, String(v)); });
    return text;
  }
  const t = translate;

  function applyRuntimeI18n() {
    mergeI18nFallbacks();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      if (['projectPath', 'engineBadge', 'engineHint', 'projectStatus', 'callTraceStatus'].includes(el.id)) return;
      const key = el.getAttribute('data-i18n');
      const text = translate(key);
      if (text && text !== key) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = translate(key);
      if (text && text !== key) el.setAttribute('placeholder', text);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const text = translate(key);
      if (text && text !== key) el.setAttribute('title', text);
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      const text = translate(key);
      if (text && text !== key) el.setAttribute('aria-label', text);
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

  function setStatusBox(id, msg, kind = 'normal', traceTitle = '') {
    const el = $(id);
    if (el) { el.textContent = msg; el.dataset.kind = kind; }
    if (traceTitle) appendTrace(traceTitle, msg, kind);
  }

  function clearPointerSelection() {
    document.querySelectorAll('.selected, .is-active-pointer').forEach((el) => el.classList.remove('selected', 'is-active-pointer'));
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
  }

  function runUiAction(label, task, { pending, success, error, statusId, traceTitle } = {}) {
    const pendingText = pending || label;
    const successText = success || `${label}成功`;
    const errorText = error || `${label}失败`;
    clearPointerSelection();
    if (statusId) setStatusBox(statusId, pendingText, 'pending', traceTitle || label);
    else appendTrace(traceTitle || label, pendingText, 'pending');
    return Promise.resolve().then(task).then((result) => {
      clearPointerSelection();
      if (statusId) setStatusBox(statusId, successText, 'success', traceTitle || label);
      else appendTrace(traceTitle || label, successText, 'success');
      return result;
    }).catch((err) => {
      clearPointerSelection();
      const message = err?.message || errorText;
      if (statusId) setStatusBox(statusId, message, 'error', traceTitle || label);
      else appendTrace(traceTitle || label, message, 'error');
      throw err;
    });
  }

  window.showProjectStatus = (msg, kind = 'normal') => setStatusBox('projectStatus', msg, kind, translate('trace.project'));
  window.showAiStatus = (msg, kind = 'normal') => setStatusBox('aiStatus', msg, kind, translate('trace.aiTranslate'));
  window.showTraditionalStatus = (msg, kind = 'normal') => setStatusBox('traditionalStatus', msg, kind, translate('trace.traditionalTranslate'));
  window.showToast = (msg, kind = 'normal') => setStatusBox('projectStatus', msg, kind, translate('trace.notice'));
  window.traceCall = (title, detail = '', kind = 'normal') => appendTrace(title, detail, kind);
  window.setCallTraceStatus = (msg, kind = 'normal') => setStatusBox('callTraceStatus', msg, kind, t('trace.status'));
  window.runUiAction = runUiAction;
  window.setVersionLabel = () => {
    const t = translate;
    const badge = $('appVersionBadge'); if (badge) badge.textContent = 'v1.2.0';
    const aboutVersion = $('aboutProjectVersion'); if (aboutVersion) aboutVersion.textContent = 'v1.2.0';
    const copyright = $('appCopyright'); if (copyright) copyright.textContent = t('app.copyright');
  };

  function syncGlobalAiModeSelect() {
    const select = $('globalAiModeSelect');
    if (!select) return;
    const modes = ['baidu', 'google', 'deepseek', 'kimi', 'gemini', 'claude', 'custom'];
    const labels = {
      baidu: translate('ai.providerBaidu'), google: translate('ai.providerGoogle'), deepseek: translate('ai.providerDeepseek'),
      kimi: translate('ai.providerKimi'),
      gemini: translate('ai.providerGemini'), claude: translate('ai.providerClaude'), custom: translate('ai.providerCustom')
    };
    const label = $('globalAiModeLabel'); if (label) label.textContent = translate('workspace.ai');
    const currentValue = select.value || getState().aiSettings?.lastEntryAiMode || getState().aiSettings?.provider || 'baidu';
    const isFocused = document.activeElement === select;
    const previousSelection = select.value;
    if (!select.dataset.bound) {
      select.addEventListener('change', () => {
        const provider = select.value || 'baidu';
        const current = getState();
        const next = { ...(current.aiSettings || {}), provider, lastEntryAiMode: provider };
        if (provider === 'baidu' || provider === 'google') next.traditional = { ...(current.aiSettings?.traditional || {}), provider };
        window.RpgAppStore?.setState?.({ ...current, aiSettings: next });
        const t = translate;
        setStatusBox('aiStatus', t('trace.providerSwitched', { provider }), 'success', t('trace.assistPlatform'));
        appendTrace(t('trace.assistPlatform'), t('trace.providerSwitched', { provider }));
      });
      select.dataset.bound = '1';
    }
    select.innerHTML = '';
    modes.forEach((id) => { const opt = document.createElement('option'); opt.value = id; opt.textContent = labels[id] || id; select.appendChild(opt); });
    select.value = modes.includes(currentValue) ? currentValue : 'baidu';
    if (isFocused && previousSelection && modes.includes(previousSelection)) select.value = previousSelection;
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

  function switchFeatureGuideModule(module) {
    document.querySelectorAll('.feature-guide-nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.module === module));
    document.querySelectorAll('.feature-guide-section').forEach((section) => section.classList.toggle('active', section.dataset.module === module));
  }
  function openFeatureGuide(module = 'project') {
    $('featureGuideModal')?.classList.remove('hidden');
    switchFeatureGuideModule(module);
  }
  function closeFeatureGuide() { $('featureGuideModal')?.classList.add('hidden'); }

  async function openExternalLink(url) {
    try {
      if (window.rpgWorkbench?.openExternalLink) {
        await window.rpgWorkbench.openExternalLink(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error('Failed to open external link:', e);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  const PROJECT_WEBSITE_URL = 'https://github.com/ranBI/RPG-Localization';
  const PROJECT_GITHUB_URL = 'https://github.com/ranBI/RPG-Localization';

  async function checkForUpdates() {
    const t = translate;
    const statusEl = $('aboutCheckUpdateBtn');
    const originalText = statusEl?.innerHTML;
    if (statusEl) {
      statusEl.disabled = true;
      statusEl.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 21h5v-5"/>
        </svg>
        <span>${t('aboutProject.updateChecking')}</span>`;
    }
    try {
      // 简单本地版本检查：当前版本 v1.2.0，后续可替换为网络请求对比 GitHub releases
      const currentVersion = 'v1.2.0';
      await new Promise((resolve) => setTimeout(resolve, 600));
      window.showToast?.(t('aboutProject.updateLatest', { version: currentVersion }), 'success');
    } catch (e) {
      window.showToast?.(t('aboutProject.updateError', { message: e.message || t('common.unknownError') }), 'error');
    } finally {
      if (statusEl) {
        statusEl.disabled = false;
        statusEl.innerHTML = originalText;
      }
    }
  }

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
  function getSelectedAiModel() {
    const select = $('aiModelSelect');
    const customInput = $('aiModel');
    if (select?.value === 'custom') return customInput?.value?.trim() || '';
    return select?.value || customInput?.value?.trim() || '';
  }
  function syncAiModelSelector(model = '') {
    const select = $('aiModelSelect');
    const customInput = $('aiModel');
    if (!select || !customInput) return;
    const known = Array.from(select.options).map((option) => option.value).filter((value) => value && value !== 'custom');
    const nextModel = String(model || 'deepseek-v4-flash').trim();
    const isKnown = known.includes(nextModel);
    select.value = isKnown ? nextModel : 'custom';
    customInput.value = isKnown ? '' : nextModel;
    customInput.classList.toggle('hidden', isKnown);
  }
  function updateAiProviderDefaults({ preserveUserInput = true } = {}) {
    const provider = $('aiProvider')?.value || 'deepseek';
    const baseUrlInput = $('aiBaseUrl');
    if (provider === 'deepseek') {
      if (baseUrlInput && (!preserveUserInput || !baseUrlInput.value.trim() || /api\.deepseek\.com\/v1\/?$/i.test(baseUrlInput.value.trim()))) baseUrlInput.value = 'https://api.deepseek.com';
      if (!getSelectedAiModel()) syncAiModelSelector('deepseek-v4-flash');
    } else if (provider === 'kimi') {
      // Kimi 有两条独立的端点，密钥不通用：
      //   · platform.moonshot.cn（国内官方）→ https://api.moonshot.cn/v1
      //   · platform.kimi.ai       （国际官方）→ https://api.moonshot.ai/v1
      // 我们只在字段为空时填一个默认（.ai），绝不改写用户已经填好的 .cn / .ai / 自建镜像，
      // 避免"用国内 Key 却被强制打到国际端点"这种 401。
      if (baseUrlInput && (!preserveUserInput || !baseUrlInput.value.trim())) {
        baseUrlInput.value = 'https://api.moonshot.ai/v1';
      }
      if (!getSelectedAiModel()) syncAiModelSelector('moonshot-v1-8k');
    }
  }

  // ============ AI 配置作用域隔离 ============
  // 单一事实源是 aiSettings.providers[provider] 桶。切换 provider 时先把当前表单值写回旧桶，
  // 再从新桶读值回填表单；写盘时保留所有桶；发到主进程时把当前桶字段"平铺"到顶层做兼容。
  const LLM_PROVIDER_KEYS = ['mock', 'deepseek', 'kimi', 'openai', 'gemini', 'claude', 'custom'];
  const emptyProviderBucket = () => ({ apiKey: '', baseUrl: '', model: '', prompt: '' });
  const providerDefaultBaseUrl = { deepseek: 'https://api.deepseek.com', kimi: 'https://api.moonshot.ai/v1' };
  const providerDefaultModel = { deepseek: 'deepseek-v4-flash', kimi: 'moonshot-v1-8k' };
  // 按 provider 提供模型下拉预设。用户仍可选"自定义"手动输入。
  // Kimi 型号来自官网 https://platform.kimi.ai/docs/models（2026 年在售，kimi-latest 已停用）。
  const PROVIDER_MODEL_PRESETS = {
    deepseek: [
      { value: 'deepseek-v4-flash', label: 'deepseek-v4-flash（官方推荐，非思考）' },
      { value: 'deepseek-v4-pro',   label: 'deepseek-v4-pro（官方推荐，思考）' },
      { value: 'deepseek-chat',     label: 'deepseek-chat（旧兼容名，将弃用）' },
      { value: 'deepseek-reasoner', label: 'deepseek-reasoner（旧兼容名，将弃用）' },
    ],
    kimi: [
      { value: 'moonshot-v1-8k',            label: 'moonshot-v1-8k（8K 上下文，最便宜，推荐日常翻译）' },
      { value: 'moonshot-v1-32k',           label: 'moonshot-v1-32k（32K 上下文）' },
      { value: 'moonshot-v1-128k',          label: 'moonshot-v1-128k（128K 上下文，长文本）' },
      { value: 'kimi-k2.6',                 label: 'kimi-k2.6（旗舰智能，多模态，256K）' },
      { value: 'kimi-k2.7-code',            label: 'kimi-k2.7-code（代码/结构化输出最强）' },
      { value: 'kimi-k2.7-code-highspeed',  label: 'kimi-k2.7-code-highspeed（高速版）' },
    ],
    openai: [],
    gemini: [],
    claude: [],
    custom: [],
    mock:   [],
  };

  // 根据当前 provider 重建模型下拉的 <option> 列表；末尾始终追加"自定义模型"。
  function refreshAiModelOptions(provider, selectedModel) {
    const select = $('aiModelSelect');
    if (!select) return;
    const preset = PROVIDER_MODEL_PRESETS[provider] || [];
    const customLabel = window.RpgView?.t?.('ai.modelCustom') || '自定义模型';
    select.innerHTML = '';
    preset.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = customLabel;
    customOpt.setAttribute('data-i18n', 'ai.modelCustom');
    select.appendChild(customOpt);
    syncAiModelSelector(selectedModel || '');
  }

  function migrateAiSettingsShape(raw) {
    const settings = { ...(raw || {}) };
    const provider = settings.provider || 'deepseek';
    const providers = { ...(settings.providers || {}) };
    LLM_PROVIDER_KEYS.forEach((key) => {
      providers[key] = { ...emptyProviderBucket(), ...(providers[key] || {}) };
    });
    // 旧配置迁移：若当前 provider 桶为空但顶层有旧值，把旧值搬进去（一次性）
    const legacyBucket = {
      apiKey: settings.apiKey || '',
      baseUrl: settings.baseUrl || '',
      model: settings.model || '',
      prompt: settings.prompt || '',
    };
    const existing = providers[provider] || emptyProviderBucket();
    const existingHasValue = Boolean(existing.apiKey || existing.baseUrl || existing.model || existing.prompt);
    if (!existingHasValue) providers[provider] = { ...existing, ...legacyBucket };
    settings.providers = providers;
    return settings;
  }

  function getActiveBucket(settings, provider) {
    const p = provider || settings?.provider || 'deepseek';
    const bucket = settings?.providers?.[p] || emptyProviderBucket();
    return { ...emptyProviderBucket(), ...bucket };
  }

  // 发送给主进程时把当前 provider 桶字段平铺到顶层，兼容既有的旧代码路径。
  function flattenAiSettingsForBackend(settings) {
    const s = migrateAiSettingsShape(settings);
    const bucket = getActiveBucket(s, s.provider);
    return { ...s, ...bucket };
  }

  // 演示用轻量版自动断行算法，与主进程 AutoSplit.js 保持一致（仅用于设置面板示例）。
  function demoAutoSplit(text, constraint) {
    const CJK_PUNCT = /[，。！？；：、]/;
    const ASCII_PUNCT = /[,.!?;:]/;
    const src = String(text || '');
    const maxChars = Math.max(0, Number(constraint?.maxCharsPerLine) || 0);
    const maxLines = Math.max(0, Number(constraint?.maxLines) || 0);
    if (!maxChars || src.length <= maxChars) return { lines: [src], overflow: false };
    const lines = [];
    let rest = src;
    while (rest.length > maxChars) {
      if (maxLines && lines.length >= maxLines - 1) break;
      const slice = rest.slice(0, maxChars);
      let breakAt = -1;
      for (let i = slice.length - 1; i >= Math.floor(maxChars / 2); i--) {
        if (CJK_PUNCT.test(slice[i])) { breakAt = i + 1; break; }
      }
      if (breakAt === -1) {
        for (let i = slice.length - 1; i >= Math.floor(maxChars / 2); i--) {
          if (ASCII_PUNCT.test(slice[i])) { breakAt = i + 1; break; }
        }
      }
      if (breakAt === -1) {
        for (let i = slice.length - 1; i >= Math.floor(maxChars / 2); i--) {
          if (slice[i] === ' ') { breakAt = i + 1; break; }
        }
      }
      if (breakAt === -1) breakAt = maxChars;
      lines.push(rest.slice(0, breakAt).trim());
      rest = rest.slice(breakAt).replace(/^\s+/, '');
    }
    if (rest) lines.push(rest);
    const overflow = maxLines > 0 && lines.length > maxLines;
    if (overflow) {
      const tail = lines.slice(maxLines - 1).join('');
      lines.splice(maxLines - 1, lines.length - (maxLines - 1), tail);
    }
    return { lines: lines.filter((line) => line.length > 0), overflow };
  }

  function updateAutoSplitDemo(enabled) {
    const demoText = '你好，冒险者！欢迎来到这个被诅咒的村庄。这里的居民都在等待一位能够解开古老封印的英雄，你愿意接受这份命运的挑战吗？';
    const beforeEl = $('autoSplitDemoBefore');
    const afterEl = $('autoSplitDemoAfter');
    if (!beforeEl || !afterEl) return;
    beforeEl.textContent = demoText;
    if (enabled) {
      const { lines } = demoAutoSplit(demoText, { maxCharsPerLine: 28, maxLines: 4 });
      afterEl.textContent = lines.join('\n');
      afterEl.classList.remove('is-raw');
    } else {
      afterEl.textContent = demoText;
      afterEl.classList.add('is-raw');
    }
  }

  // 从当前表单值组装出"新旧融合"的完整设置：只覆盖当前 provider 桶，其它桶保持不变。
  function collectAiSettings() {
    const current = migrateAiSettingsShape(getState().aiSettings || {});
    const provider = $('aiProvider')?.value || current.provider || 'deepseek';
    // deepseek 与 kimi 的 baseUrl 有官方约定；用户在这些 provider 下的 baseUrl 输入按官方值回滚
    // （deepseek 强制官方短地址；kimi 至少要带 /v1）
    let formBaseUrl;
    if (provider === 'deepseek') formBaseUrl = providerDefaultBaseUrl.deepseek;
    else if (provider === 'kimi') {
      const typed = ($('aiBaseUrl')?.value || '').trim();
      formBaseUrl = typed || providerDefaultBaseUrl.kimi;
    } else {
      formBaseUrl = $('aiBaseUrl')?.value || '';
    }
    const formModel = getSelectedAiModel() || (provider === 'deepseek' ? providerDefaultModel.deepseek : (provider === 'kimi' ? providerDefaultModel.kimi : ''));
    const nextBucket = {
      apiKey: $('aiApiKey')?.value || '',
      baseUrl: formBaseUrl,
      model: formModel,
      prompt: $('aiPrompt')?.value || '',
    };
    const nextProviders = { ...(current.providers || {}), [provider]: nextBucket };
    const bucketMirror = nextProviders[provider] || emptyProviderBucket();
    return {
      ...current,
      provider,
      providers: nextProviders,
      // 顶层影像仅供旧代码路径读；保存后端时会 flatten 一次覆盖
      apiKey: bucketMirror.apiKey,
      baseUrl: bucketMirror.baseUrl,
      model: bucketMirror.model,
      prompt: bucketMirror.prompt,
      traditional: collectTraditionalSettings(),
      lastEntryAiMode: $('globalAiModeSelect')?.value || current.lastEntryAiMode || current.provider || 'baidu',
      glossaryInjectionMode: $('aiGlossaryMode')?.value || current.glossaryInjectionMode || 'off',
      autoSplit: $('aiAutoSplit') ? !!$('aiAutoSplit').checked : !!current.autoSplit,
    };
  }

  function syncAiSettingsFields(settings = getState().aiSettings || {}) {
    const normalized = migrateAiSettingsShape(settings);
    const activeProvider = normalized.provider || 'deepseek';
    const bucket = getActiveBucket(normalized, activeProvider);
    if ($('traditionalProvider')) $('traditionalProvider').value = normalized.traditional?.provider || 'baidu';
    if ($('baiduAppId')) $('baiduAppId').value = normalized.traditional?.baiduAppId || normalized.traditional?.appId || '';
    if ($('baiduSecretKey')) $('baiduSecretKey').value = normalized.traditional?.baiduSecretKey || normalized.traditional?.secretKey || '';
    if ($('googleApiKey')) $('googleApiKey').value = normalized.traditional?.googleApiKey || normalized.traditional?.apiKey || '';
    if ($('translateSourceLang')) $('translateSourceLang').value = normalized.traditional?.sourceLang || 'auto';
    if ($('translateTargetLang')) $('translateTargetLang').value = normalized.traditional?.targetLang || 'zh-CN';
    if ($('aiProvider')) $('aiProvider').value = activeProvider;
    // 关键：apiKey / baseUrl / model / prompt 都从"当前 provider 的桶"里取，而不是顶层字段
    if ($('aiApiKey')) $('aiApiKey').value = bucket.apiKey || '';
    if ($('aiBaseUrl')) {
      $('aiBaseUrl').value = activeProvider === 'deepseek'
        ? providerDefaultBaseUrl.deepseek
        : activeProvider === 'kimi'
          ? (bucket.baseUrl || providerDefaultBaseUrl.kimi)
          : (bucket.baseUrl || '');
    }
    // 按当前 provider 重建下拉的可选模型列表；把桶里的 model 值选中，未命中就回落到"自定义"
    refreshAiModelOptions(activeProvider, bucket.model || (activeProvider === 'deepseek' ? providerDefaultModel.deepseek : activeProvider === 'kimi' ? providerDefaultModel.kimi : ''));
    if ($('aiPrompt')) $('aiPrompt').value = bucket.prompt || '';
    if ($('globalAiModeSelect')) $('globalAiModeSelect').value = normalized.lastEntryAiMode || activeProvider || 'baidu';
    if ($('aiGlossaryMode')) $('aiGlossaryMode').value = normalized.glossaryInjectionMode || 'off';
    if ($('aiAutoSplit')) $('aiAutoSplit').checked = !!normalized.autoSplit;
    updateAutoSplitDemo(!!normalized.autoSplit);
    updateTraditionalProviderUI();
    updateAiProviderDefaults();
    // 按 provider 显隐对应的教程提示块
    refreshProviderTutorialVisibility(activeProvider);
  }

  // 教程提示块的显隐：只显示当前 provider 对应的那一块，避免用户在切换 provider 时看到多套说明
  function refreshProviderTutorialVisibility(provider) {
    const nodes = document.querySelectorAll('[data-ai-tutorial]');
    nodes.forEach((el) => {
      const scope = el.getAttribute('data-ai-tutorial');
      el.classList.toggle('hidden', scope !== provider);
    });
  }

  async function saveTraditionalSettings() {
    return window.runUiAction?.(t('trace.traditionalSettings'), async () => {
      const settings = collectTraditionalSettings(); const current = getState();
      window.RpgAppStore?.setState?.({ aiSettings: { ...(current.aiSettings || {}), traditional: settings } });
      const result = await window.rpgWorkbench?.saveTranslatorSettings?.({ type: 'traditional', settings });
      if (!result?.ok) throw new Error(result?.message || t('common.aiSaveFailed'));
      return result;
    }, { pending: t('common.aiPending'), success: t('common.aiSaved'), error: t('common.aiSaveFailed'), statusId: 'traditionalStatus', traceTitle: t('trace.traditionalSettings') });
  }
  async function testTraditionalSettings() {
    return window.runUiAction?.(t('trace.traditionalTest'), async () => {
      const settings = collectTraditionalSettings();
      const result = await window.rpgWorkbench?.testTranslatorSettings?.({ type: 'traditional', settings, sampleText: 'こんにちは、世界。' });
      if (!result?.ok) throw new Error(result?.message || t('common.aiTestFail'));
      return result;
    }, { pending: t('common.aiPending'), success: t('common.aiTestSuccess'), error: t('common.aiTestFail'), statusId: 'traditionalStatus', traceTitle: t('trace.traditionalTest') });
  }
  async function saveAiSettings() {
    return window.runUiAction?.(t('trace.aiSettings'), async () => {
      const settings = collectAiSettings(); const current = getState();
      window.RpgAppStore?.setState?.({ aiSettings: settings });
      // 送到主进程时做一次 flatten：既写入完整的 providers 分桶，也把当前桶字段平铺到顶层供旧路径读
      const result = await window.rpgWorkbench?.saveAiSettings?.(flattenAiSettingsForBackend(settings));
      if (!result?.ok) throw new Error(result?.message || t('common.aiSaveFailed'));
      // 主进程 saveAiSettings 会返回 normalized 后的 settings —— 用它覆盖 store，保持前后端形状一致
      if (result?.settings) {
        window.RpgAppStore?.setState?.({ aiSettings: migrateAiSettingsShape(result.settings) });
      }
      syncGlobalAiModeSelect();
      syncAiSettingsFields(getState().aiSettings || settings);
      return result;
    }, { pending: t('common.aiPending'), success: t('common.aiSaved'), error: t('common.aiSaveFailed'), statusId: 'aiStatus', traceTitle: t('trace.aiSettings') });
  }
  async function testAiSettings() {
    return window.runUiAction?.(t('trace.aiTest'), async () => {
      const settings = collectAiSettings();
      const result = await window.rpgWorkbench?.aiTranslate?.({ sourceText: 'こんにちは、世界。', settings: flattenAiSettingsForBackend(settings) });
      if (!result?.ok) throw new Error(result?.message || t('common.aiTestFail'));
      return result;
    }, { pending: t('common.aiPending'), success: t('common.aiTestSuccess'), error: t('common.aiTestFail'), statusId: 'aiStatus', traceTitle: t('trace.aiTest') });
  }

  async function loadAndApplyAiSettings() {
    try {
      const result = await window.rpgWorkbench?.getAiSettings?.();
      if (result?.ok && result.settings) {
        // 加载后立即 migrate 到分桶结构，保证内存里永远只有一份规范形状
        const migrated = migrateAiSettingsShape(result.settings);
        window.RpgAppStore?.setState?.({ ...getState(), aiSettings: migrated });
        syncAiSettingsFields(migrated);
      }
    } catch (_) {}
  }

  function render() {
    window.RpgGlossaryModule?.render?.();
    window.RpgEntries?.renderFileSelect?.();
    window.RpgEntries?.renderEntryList?.();
    window.RpgEntries?.renderCurrentEntry?.();
    window.RpgEntries?.updateCounts?.();
    window.RpgProject?.syncProjectStatusFromState?.();
    applyRuntimeI18n();
  }

  /**
   * 切换主进程的剧情流线/物理顺序视图，并用返回的条目重建前端 groupedFiles。
   * 由于主进程保证两个视图共享同一批对象指针，前端重建后修改译文仍会同步回物理池。
   */
  async function applyViewMode(mode = 'physical') {
    const current = getState();
    const project = current.project;
    if (!project?.rootDir) return { ok: false, message: t('error.projectRequired', { action: t('action.loadProjectTexts') }) };
    const result = await window.rpgWorkbench?.setViewMode?.(mode);
    if (!result?.ok) return result || { ok: false };

    document.body.classList.remove('view-mode-physical', 'view-mode-timeline');
    document.body.classList.add(mode === 'timeline' ? 'view-mode-timeline' : 'view-mode-physical');

    const chapterTreePanel = document.getElementById('chapterTreePanel');
    if (chapterTreePanel) {
      chapterTreePanel.classList.toggle('hidden', mode !== 'timeline');
    }
    if (mode === 'timeline') {
      const treeResult = await window.rpgWorkbench?.getChapterTree?.();
      if (!treeResult?.ok) return treeResult || { ok: false };

      window.RpgAppStore?.setState?.({
        viewMode: mode,
        chapterTree: treeResult.groups || [],
        entryRenderLimit: 100,
        currentEntryIndex: 0,
      });

      window.RpgEntries?.renderChapterTree?.();

      const firstGroup = treeResult.groups?.[0];
      if (firstGroup) {
        const firstSubGroup = firstGroup.subGroups?.[0];
        await window.RpgEntries?.selectChapterGroup?.(firstGroup.id, firstSubGroup?.id || '');
      } else {
        window.RpgEntries?.renderEntryList?.();
        window.RpgEntries?.renderCurrentEntry?.();
      }
      return { ok: true, mode, total: result.total };
    }

    const entriesResult = await window.rpgWorkbench?.getViewModeEntries?.({ page: 1, pageSize: 100000 });
    if (!entriesResult?.ok) return entriesResult || { ok: false };
    const entries = entriesResult.entries || [];
    window.RpgEntries?.buildGroupedFiles?.(entries);
    window.RpgAppStore?.setState?.({
      viewMode: mode,
      chapterTree: [],
      currentChapterGroup: '',
      currentChapterSubGroup: '',
      entryRenderLimit: 100,
      currentEntryIndex: 0,
    });
    window.RpgEntries?.renderFileSelect?.();
    window.RpgEntries?.renderEntryList?.();
    window.RpgEntries?.renderCurrentEntry?.();
    return { ok: true, mode, total: entriesResult.total };
  }

  async function applyTimelineModeFromSetting() {
    const settings = window.RpgView?.getStoredUiSettings?.() || {};
    const enabled = settings.timelineModeEnabled === true;
    const current = getState();
    const project = current.project;
    if (!project?.rootDir) return;
    if (project.useLazyLoad || current.fileList?.length) return; // 懒加载模式暂不支持剧情流线
    const isRpgMaker = /RPG Maker|rpg-maker|rpgmaker/i.test(project.engine || project.displayName || '');
    const mode = enabled && isRpgMaker ? 'timeline' : 'physical';
    if (current.viewMode === mode) return;
    await applyViewMode(mode);
  }

  function updateTimelineModeStatus(message, kind = 'normal') {
    const statusBox = $('timelineModeStatus');
    if (!statusBox) return;
    statusBox.textContent = message || '';
    statusBox.dataset.kind = kind;
    statusBox.classList.toggle('hidden', !message);
  }

  // ===== 自动保存 =====
  let _autoSaveTimer = null;
  let _lastAutoSavedAt = 0;

  function updateAutoSaveStatus(message, kind = 'normal') {
    const statusBox = $('autoSaveStatus');
    if (!statusBox) return;
    statusBox.textContent = message || '';
    statusBox.dataset.kind = kind;
    statusBox.classList.toggle('hidden', !message);
  }

  function clearAutoSaveTimer() {
    if (_autoSaveTimer) {
      clearInterval(_autoSaveTimer);
      _autoSaveTimer = null;
    }
  }

  async function performAutoSave({ silent = false } = {}) {
    const current = getState();
    const project = current.project;
    if (!project?.rootDir) return { ok: false, error: 'no project' };
    if (project.useLazyLoad || current.fileList?.length) return { ok: false, error: 'lazy load' };
    const settings = window.RpgView?.getStoredUiSettings?.() || {};
    if (!settings.autoSaveEnabled) return { ok: false, error: 'disabled' };
    const entries = window.RpgEntries?.getExportEntries?.() || current.entries || [];
    const payload = {
      project,
      entries,
      glossary: current.glossary || { terms: [] },
      aiSettings: current.aiSettings || {},
      progressState: current.progressState || null,
      groups: current.contextGroups || [],
      autoSaveDir: settings.autoSaveDir || '',
    };
    try {
      const result = await window.rpgWorkbench?.autoSaveAll?.(payload);
      if (!result?.ok) throw new Error(result?.errors?.join('; ') || 'auto-save failed');
      _lastAutoSavedAt = Date.now();
      const paths = [result.draft?.path, result.glossary?.path].filter(Boolean).join('、');
      if (!silent) updateAutoSaveStatus(t('settings.autoSaveRunning', { paths }), 'success');
      return { ok: true, paths };
    } catch (error) {
      if (!silent) updateAutoSaveStatus(t('settings.autoSaveFailed', { error: error.message }), 'error');
      return { ok: false, error: error.message };
    }
  }

  function restartAutoSaveTimer() {
    clearAutoSaveTimer();
    const settings = window.RpgView?.getStoredUiSettings?.() || {};
    if (!settings.autoSaveEnabled) return;
    const minutes = Number(settings.autoSaveIntervalMinutes) || 5;
    const ms = Math.max(60000, minutes * 60 * 1000);
    _autoSaveTimer = setInterval(() => performAutoSave({ silent: true }), ms);
  }

  async function saveAccessibilitySettings() {
    const timelineCheck = $('timelineModeCheck');
    const autoSaveCheck = $('autoSaveEnabledCheck');
    const autoSaveIntervalInput = $('autoSaveIntervalInput');
    const enabled = timelineCheck ? timelineCheck.checked : false;
    const autoSaveEnabled = autoSaveCheck ? autoSaveCheck.checked : false;
    const interval = Number(autoSaveIntervalInput?.value);
    if (autoSaveEnabled && (!Number.isFinite(interval) || interval < 1 || interval > 120)) {
      updateAutoSaveStatus(t('settings.autoSaveIntervalInvalid'), 'error');
      return null;
    }
    const settings = window.RpgView?.persistUiSettings?.({ persist: true }) || {};
    const current = getState();
    const project = current.project;
    let statusMsg = '';
    let statusKind = 'normal';
    if (project?.rootDir) {
      const isRpgMaker = /RPG Maker|rpg-maker|rpgmaker/i.test(project.engine || project.displayName || '');
      if (enabled && !isRpgMaker) {
        statusMsg = t('settings.timelineModeUnsupported');
        statusKind = 'warning';
      } else if (project.useLazyLoad || current.fileList?.length) {
        statusMsg = enabled ? t('settings.timelineModeUnsupported') : t('settings.timelineModeOff');
        statusKind = enabled ? 'warning' : 'success';
      } else {
        try {
          const result = await applyViewMode(enabled ? 'timeline' : 'physical');
          statusMsg = enabled ? t('settings.timelineModeOn') : t('settings.timelineModeOff');
          statusKind = result?.ok ? 'success' : 'error';
          if (!result?.ok) statusMsg = result?.message || t('common.operationFailed');
        } catch (error) {
          statusMsg = error?.message || t('common.operationFailed');
          statusKind = 'error';
        }
      }
    }
    updateTimelineModeStatus(statusMsg, statusKind);
    // 自动保存开关变更后重启/停止定时器
    restartAutoSaveTimer();
    updateAutoSaveStatus(autoSaveEnabled ? t('settings.autoSaveOn') : t('settings.autoSaveOff'), autoSaveEnabled ? 'success' : 'normal');
    window.RpgView?.updateWorkspaceLayout?.();
    if (statusKind === 'success') {
      setStatusBox('projectStatus', t('trace.uiSettingsSaved'), 'success', t('trace.uiSettings'));
    }
    return settings;
  }

  function bindShellActions() {
    const t = translate;
    // 密钥输入框的"眼睛"切换按钮：点击时把对应 input 的 type 在 password / text 之间翻转。
    // 用事件委托挂到 document，避免设置面板重新构建时监听器丢失。
    if (!document.body.dataset.secretToggleBound) {
      document.body.dataset.secretToggleBound = '1';
      document.addEventListener('click', (event) => {
        const btn = event.target.closest?.('.secret-toggle');
        if (!btn) return;
        const inputId = btn.getAttribute('data-secret-toggle');
        const input = inputId ? document.getElementById(inputId) : null;
        if (!input) return;
        const willReveal = input.type === 'password';
        input.type = willReveal ? 'text' : 'password';
        btn.classList.toggle('revealed', willReveal);
        btn.setAttribute('aria-pressed', willReveal ? 'true' : 'false');
        const t = window.RpgView?.t;
    const nextTitle = willReveal
          ? (t('ai.toggleKeyHide') || '隐藏密钥')
          : (t('ai.toggleKeyShow') || '显示密钥');
        btn.setAttribute('title', nextTitle);
        btn.setAttribute('aria-label', nextTitle);
      });
    }
    $('settingsBtn')?.addEventListener('click', () => openSettings('ui'));
    $('openGlossaryManagerBtn')?.addEventListener('click', () => openSettings('glossary'));
    $('settingsCloseBtn')?.addEventListener('click', () => closeSettings());
    $('settingsBackdrop')?.addEventListener('click', () => closeSettings());
    document.querySelectorAll('.settings-tab').forEach((btn) => btn.addEventListener('click', () => switchSettingsTab(btn.dataset.tab || 'ui')));

    // 关于项目 / 功能导览
    $('aboutFeatureGuideBtn')?.addEventListener('click', () => openFeatureGuide('project'));
    $('featureGuideCloseBtn')?.addEventListener('click', () => closeFeatureGuide());
    $('featureGuideBackdrop')?.addEventListener('click', () => closeFeatureGuide());
    document.querySelectorAll('.feature-guide-nav-item').forEach((btn) => btn.addEventListener('click', () => switchFeatureGuideModule(btn.dataset.module || 'project')));
    $('aboutGitHubBtn')?.addEventListener('click', () => openExternalLink(PROJECT_GITHUB_URL));
    $('aboutWebsiteBtn')?.addEventListener('click', () => openExternalLink(PROJECT_WEBSITE_URL));
    $('aboutCheckUpdateBtn')?.addEventListener('click', () => checkForUpdates().catch(() => {}));

    $('traditionalProvider')?.addEventListener('change', updateTraditionalProviderUI);
    // provider 切换：先把当前表单里的 apiKey/baseUrl/model/prompt 写回旧 provider 桶，
    // 再把新 provider 桶的值回填到表单。中间不走 backend、不覆盖顶层影像的其它 provider 桶。
    $('aiProvider')?.addEventListener('change', () => {
      const current = migrateAiSettingsShape(getState().aiSettings || {});
      const prevProvider = current.provider || 'deepseek';
      const nextProvider = $('aiProvider')?.value || prevProvider;
      // 1) 快照当前表单值到旧 provider 桶（不修改其它桶）
      const capturedOldBucket = {
        apiKey: $('aiApiKey')?.value || '',
        baseUrl: prevProvider === 'deepseek'
          ? providerDefaultBaseUrl.deepseek
          : prevProvider === 'kimi'
            ? (($('aiBaseUrl')?.value || '').trim() || providerDefaultBaseUrl.kimi)
            : ($('aiBaseUrl')?.value || ''),
        model: getSelectedAiModel() || (prevProvider === 'deepseek' ? providerDefaultModel.deepseek : prevProvider === 'kimi' ? providerDefaultModel.kimi : ''),
        prompt: $('aiPrompt')?.value || '',
      };
      const nextProviders = { ...(current.providers || {}), [prevProvider]: capturedOldBucket };
      // 2) 切换到新 provider 并回填新桶
      const newBucket = getActiveBucket({ ...current, providers: nextProviders }, nextProvider);
      const nextSettings = {
        ...current,
        provider: nextProvider,
        providers: nextProviders,
        apiKey: newBucket.apiKey,
        baseUrl: newBucket.baseUrl,
        model: newBucket.model,
        prompt: newBucket.prompt,
      };
      window.RpgAppStore?.setState?.({ aiSettings: nextSettings });
      // 3) 视图同步：直接从 nextSettings 读桶（不去 preserve 现有输入，因为我们要"回填"新 provider 的历史值）
      syncAiSettingsFields(nextSettings);
      updateAiProviderDefaults({ preserveUserInput: false });
    });
    $('aiModelSelect')?.addEventListener('change', () => syncAiModelSelector(getSelectedAiModel()));
    $('aiAutoSplit')?.addEventListener('change', () => updateAutoSplitDemo($('aiAutoSplit')?.checked));
    $('saveTraditionalSettingsBtn')?.addEventListener('click', () => saveTraditionalSettings().catch((e) => setStatus('traditionalStatus', e.message || t('common.operationFailed'), 'error')));
    $('testTraditionalBtn')?.addEventListener('click', () => testTraditionalSettings().catch((e) => setStatus('traditionalStatus', e.message || t('common.operationFailed'), 'error')));
    $('saveAiSettingsBtn')?.addEventListener('click', () => saveAiSettings().catch((e) => setStatus('aiStatus', e.message || t('common.operationFailed'), 'error')));
    $('testAiBtn')?.addEventListener('click', () => testAiSettings().catch((e) => setStatus('aiStatus', e.message || t('common.operationFailed'), 'error')));
    $('globalAiModeSelect')?.addEventListener('change', () => {
      const provider = $('globalAiModeSelect')?.value || 'baidu';
      const current = getState(); const next = { ...(current.aiSettings || {}), provider, lastEntryAiMode: provider };
      if (provider === 'baidu' || provider === 'google') next.traditional = { ...(current.aiSettings?.traditional || {}), provider };
      window.RpgAppStore?.setState?.({ aiSettings: next }); appendTrace(t('trace.assistPlatform'), t('trace.providerSwitched', { provider }));
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
    $('saveUiSettingsBtn')?.addEventListener('click', () => { window.RpgView?.persistUiSettings?.({ persist: true }); setStatusBox('projectStatus', t('trace.uiSettingsSaved'), 'success', t('trace.uiSettings')); });
    $('pickThemeBackgroundBtn')?.addEventListener('click', async () => {
      try { const result = await window.rpgWorkbench?.pickThemeImageFile?.(); if (result?.filePath && $('themeBackgroundInput')) { $('themeBackgroundInput').value = result.filePath; window.RpgView?.persistUiSettings?.({ persist: false }); } } catch (e) { appendTrace(t('trace.backgroundImage'), e.message || t('trace.selectFailed'), 'error'); }
    });
    $('previewThemeBackgroundBtn')?.addEventListener('click', () => window.RpgView?.updateThemePreview?.());
    $('resetUiThemeBtn')?.addEventListener('click', () => { window.RpgView?.resetUiSettings?.(); applyRuntimeI18n(); syncGlobalAiModeSelect(); render(); setStatusBox('projectStatus', t('trace.defaultThemeRestored'), 'success', t('trace.uiSettings')); });
    $('timelineModeCheck')?.addEventListener('change', () => {
      // 切换开关时立即给出视觉反馈，但真正生效需要点击“保存设置”
      updateTimelineModeStatus('');
    });
    $('autoSaveEnabledCheck')?.addEventListener('change', () => {
      window.RpgView?.updateAutoSaveControlsDisabledState?.();
      updateAutoSaveStatus('');
    });
    $('autoSaveIntervalInput')?.addEventListener('input', () => updateAutoSaveStatus(''));
    $('pickAutoSaveDirBtn')?.addEventListener('click', async () => {
      try {
        const result = await window.rpgWorkbench?.pickAutoSaveDir?.();
        if (result?.ok && result.dir) {
          const input = $('autoSaveDirInput');
          if (input) input.value = result.dir;
          updateAutoSaveStatus('');
        }
      } catch (e) {
        updateAutoSaveStatus(e.message || t('common.operationFailed'), 'error');
      }
    });
    $('saveAccessibilitySettingsBtn')?.addEventListener('click', () => saveAccessibilitySettings().catch((e) => updateTimelineModeStatus(e.message || t('common.operationFailed'), 'error')));

    // 其他设置：草稿目录与编辑器字体
    $('pickDraftDirBtn')?.addEventListener('click', async () => {
      try {
        const current = getState();
        const result = await window.rpgWorkbench?.pickDraftDir?.(current.project?.rootDir);
        if (result?.ok && result.filePath) {
          const input = $('draftDirInput');
          if (input) input.value = result.filePath;
        }
      } catch (e) {
        appendTrace(t('trace.draftDir'), e.message || t('common.operationFailed'), 'error');
      }
    });
    $('uiFontSelect')?.addEventListener('change', () => {
      const value = $('uiFontSelect')?.value || 'system';
      window.RpgView?.applyUiFont?.(value);
    });
    $('importFontBtn')?.addEventListener('click', async () => {
      try {
        const pickResult = await window.rpgWorkbench?.pickImportFontFile?.();
        if (!pickResult?.ok || pickResult.canceled) return;
        const filePath = pickResult.filePath;
        const defaultName = String(filePath).replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') || 'Imported Font';
        const name = prompt(t('settings.importFontTitle') || '导入 .ttf/.otf/.woff/.woff2 字体文件', defaultName);
        if (!name) return;
        const importResult = await window.rpgWorkbench?.importFont?.({ name, familyName: name, filePath });
        if (importResult?.ok && importResult.font) {
          const current = window.RpgView?.getStoredUiSettings?.() || {};
          const importedFonts = current.importedFonts || [];
          importedFonts.push(importResult.font);
          localStorage.setItem('rpg-workbench-imported-fonts', JSON.stringify(importedFonts));
          window.RpgView?.syncUiSettingsFields?.();
          const select = $('uiFontSelect');
          if (select) select.value = importResult.font.key;
          window.RpgView?.applyUiFont?.(importResult.font.key);
          window.RpgView?.persistUiSettings?.({ persist: true });
          appendTrace(t('settings.importFont') || '导入字体', (t('settings.importFontSuccess') || '已导入字体：{name}').replace('{name}', name), 'success');
        } else {
          appendTrace(t('settings.importFont') || '导入字体', (t('settings.importFontFailed') || '字体导入失败：{reason}').replace('{reason}', importResult?.message || t('common.unknownError') || '未知错误'), 'error');
        }
      } catch (e) {
        appendTrace(t('settings.importFont') || '导入字体', e.message || t('common.operationFailed') || '操作失败', 'error');
      }
    });
    $('maskIntensitySlider')?.addEventListener('input', () => {
      const slider = $('maskIntensitySlider');
      const display = $('maskIntensityValue');
      if (display && slider) display.textContent = `${slider.value}%`;
      window.RpgView?.persistUiSettings?.({ persist: false });
    });
    $('backgroundBlurSlider')?.addEventListener('input', () => {
      const slider = $('backgroundBlurSlider');
      const display = $('backgroundBlurValue');
      if (display && slider) display.textContent = `${slider.value}px`;
      window.RpgView?.persistUiSettings?.({ persist: false });
    });

    async function saveOthersSettings() {
      const current = getState();
      const project = current.project;
      if (project?.rootDir) {
        await window.rpgWorkbench?.saveProjectSettings?.({
          project,
          settings: { draftDir: $('draftDirInput')?.value?.trim() || '' },
        });
        // 把草稿目录同步回 store 中的 project，使后续保存立即生效
        window.RpgAppStore?.setState?.({ project: { ...project, draftDir: $('draftDirInput')?.value?.trim() || '' } });
      }
      window.RpgView?.persistUiSettings?.({ persist: true });
      setStatusBox('projectStatus', t('trace.othersSettingsSaved'), 'success', t('trace.othersSettings'));
    }

    $('saveOthersSettingsBtn')?.addEventListener('click', () => saveOthersSettings().catch((e) => setStatusBox('projectStatus', e.message || t('common.operationFailed'), 'error', t('trace.othersSettings'))));

    $('openDraftDirBtn')?.addEventListener('click', async () => {
      try {
        const current = getState();
        const rootDir = current.project?.rootDir;
        if (!rootDir) throw new Error(t('error.projectRequired', { action: t('settings.openDraftDir') }));
        const customDir = $('draftDirInput')?.value?.trim();
        const targetDir = customDir || rootDir.replace(/\/$/, '') + '/localization_drafts';
        const result = await window.rpgWorkbench?.openFolder?.(targetDir);
        if (result && !result.ok) throw new Error(result.message || t('common.operationFailed'));
      } catch (e) {
        setStatusBox('projectStatus', e.message || t('common.operationFailed'), 'error', t('trace.draftDir'));
      }
    });

    $('resetDraftDirBtn')?.addEventListener('click', async () => {
      try {
        const input = $('draftDirInput');
        if (input) input.value = '';
        await saveOthersSettings();
      } catch (e) {
        setStatusBox('projectStatus', e.message || t('common.operationFailed'), 'error', t('trace.othersSettings'));
      }
    });
  }

  window.RpgApp = {
    syncGlobalAiModeSelect, openSettings, closeSettings, switchSettingsTab, render,
    applyI18n: applyRuntimeI18n,
    syncUiSettingsFields: (...args) => window.RpgView?.syncUiSettingsFields?.(...args),
    collectUiSettings: (...args) => window.RpgView?.persistUiSettings?.(...args),
    collectTraditionalSettings, collectAiSettings, syncAiSettingsFields, updateTraditionalProviderUI,
    flattenAiSettingsForBackend, migrateAiSettingsShape,
    buildGroupedFiles: (...args) => window.RpgEntries?.buildGroupedFiles?.(...args),
    renderFileSelect: (...args) => window.RpgEntries?.renderFileSelect?.(...args),
    renderEntryList: (...args) => window.RpgEntries?.renderEntryList?.(...args),
    renderCurrentEntry: (...args) => window.RpgEntries?.renderCurrentEntry?.(...args),
    restartAutoSaveTimer,
    performAutoSave,
  };

  // 让其它 renderer 模块（如 project.js）也能直接调用
  window.applyTimelineModeFromSetting = applyTimelineModeFromSetting;
  window.restartAutoSaveTimer = restartAutoSaveTimer;
  window.performAutoSave = performAutoSave;

  const init = async () => {
    const savedLang = localStorage.getItem('rpg-workbench-language') || 'zh-CN';
    const langSelect = $('languageSelect'); if (langSelect) langSelect.value = ['zh-CN', 'en', 'ja'].includes(savedLang) ? savedLang : 'zh-CN';
    mergeI18nFallbacks(); window.RpgView = window.RpgView || {}; window.RpgView.t = translate;
    await window.RpgView?.refreshImportedFonts?.();
    window.RpgView?.syncUiSettingsFields?.(); window.RpgView?.updateWorkspaceLayout?.(); applyRuntimeI18n(); switchSettingsTab('ui'); closeSettings();
    await loadAndApplyAiSettings(); syncGlobalAiModeSelect(); bindShellActions();
    window.RpgGlossaryModule?.bindGlossaryActions?.(); window.RpgEntries?.bindEntryActions?.(); window.RpgProject?.bindProjectActions?.(); window.RpgFindReplace?.bindActions?.();
    if (window.RpgExportModule?.init) window.RpgExportModule.init(() => { const s = getState(); return { project: s.project, glossary: s.glossary, aiSettings: s.aiSettings, progressState: s.progressState, groups: s.contextGroups || [], entries: window.RpgEntries?.getExportEntries?.() || s.entries || [], draftPath: s.draftPath || '', lastPatchDir: s.lastPatchDir || '' }; });
    window.setVersionLabel?.(); window.setCallTraceStatus?.(t('trace.waiting'), 'normal'); render(); window.RpgAppStore?.subscribe?.(() => { window.RpgProject?.syncProjectStatusFromState?.(); render(); });
  };

  init().catch((e) => appendTrace(t('trace.initFailed'), e.message || t('trace.unknownError'), 'error'));
})();
