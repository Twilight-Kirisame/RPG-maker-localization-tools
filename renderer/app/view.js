(() => {
  const storageKeys = {
    language: 'rpg-workbench-language',
    themeMode: 'rpg-workbench-theme-mode',
    palette: 'rpg-workbench-theme-palette',
    backgroundImage: 'rpg-workbench-background-image',
    closeBehavior: 'rpg-workbench-close-behavior',
  };

  const defaults = {
    language: 'zh-CN',
    themeMode: 'system',
    palette: 'violet',
    backgroundImage: '',
    closeBehavior: 'minimize-to-tray',
  };

  function getStoredUiSettings() {
    return {
      language: localStorage.getItem(storageKeys.language) || defaults.language,
      themeMode: localStorage.getItem(storageKeys.themeMode) || defaults.themeMode,
      palette: localStorage.getItem(storageKeys.palette) || defaults.palette,
      backgroundImage: localStorage.getItem(storageKeys.backgroundImage) || defaults.backgroundImage,
      closeBehavior: localStorage.getItem(storageKeys.closeBehavior) || defaults.closeBehavior,
    };
  }

  function applyThemeSettings(settings = getStoredUiSettings()) {
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches;
    const resolvedMode = settings.themeMode === 'system' ? (prefersLight ? 'light' : 'dark') : settings.themeMode;
    const palette = settings.palette || defaults.palette;
    document.documentElement.dataset.theme = resolvedMode === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.palette = palette;
    const paletteVars = {
      violet: ['#7c8cff', '#905cff'],
      blue: ['#4ea1ff', '#2f6fff'],
      emerald: ['#31c48d', '#12b981'],
      rose: ['#ff6b9a', '#ff4d73'],
      amber: ['#ffb347', '#ff8f1f'],
      slate: ['#8a94a6', '#64748b'],
    };
    const [accentA, accentB] = paletteVars[palette] || paletteVars.violet;
    document.documentElement.style.setProperty('--accent-a', accentA);
    document.documentElement.style.setProperty('--accent-b', accentB);
    const background = String(settings.backgroundImage || '').trim();
    if (background) {
      const normalized = /^https?:\/\//i.test(background) || /^file:/i.test(background) ? background : background.replace(/\\/g, '/');
      document.documentElement.style.setProperty('--theme-image', `url("${normalized}")`);
      document.documentElement.classList.add('has-theme-image');
    } else {
      document.documentElement.style.removeProperty('--theme-image');
      document.documentElement.classList.remove('has-theme-image');
    }
  }

  function applyI18n() {
    const current = window.RpgAppStore?.getState?.() || {};
    const language = localStorage.getItem(storageKeys.language) || defaults.language;
    const dict = window.RpgI18n?.[language] || window.RpgI18n?.[defaults.language] || {};
    const fallbackDict = window.RpgI18n?.[defaults.language] || {};
    const t = (key, fallback = '') => dict[key] || fallbackDict[key] || fallback || key;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const fallback = el.textContent || '';
      const translated = t(key, fallback);
      if (translated && translated !== key) el.textContent = translated;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      const fallback = el.getAttribute('placeholder') || '';
      const translated = t(key, fallback);
      if (translated && translated !== key) el.placeholder = translated;
    });
    window.RpgView?.updateLocalText?.(current, t);
    return t;
  }

  function syncUiSettingsFields({ preserveBackground = false } = {}) {
    const settings = getStoredUiSettings();
    const languageSelect = document.getElementById('languageSelect');
    const themeModeSelect = document.getElementById('themeModeSelect');
    const themePaletteSelect = document.getElementById('themePaletteSelect');
    const themeBackgroundInput = document.getElementById('themeBackgroundInput');
    const closeBehaviorSelect = document.getElementById('closeBehaviorSelect');
    if (languageSelect) languageSelect.value = ['zh-CN', 'en', 'ja'].includes(settings.language) ? settings.language : defaults.language;
    if (themeModeSelect) themeModeSelect.value = ['system', 'dark', 'light'].includes(settings.themeMode) ? settings.themeMode : defaults.themeMode;
    if (themePaletteSelect) themePaletteSelect.value = ['violet', 'blue', 'emerald', 'rose', 'amber', 'slate'].includes(settings.palette) ? settings.palette : defaults.palette;
    if (themeBackgroundInput && !preserveBackground) themeBackgroundInput.value = settings.backgroundImage || '';
    if (closeBehaviorSelect) closeBehaviorSelect.value = ['minimize-to-tray', 'exit-immediately'].includes(settings.closeBehavior) ? settings.closeBehavior : defaults.closeBehavior;
    applyThemeSettings({ ...settings, backgroundImage: preserveBackground ? themeBackgroundInput?.value || '' : settings.backgroundImage });
    updateThemePreview(preserveBackground ? themeBackgroundInput?.value || '' : settings.backgroundImage);
  }

  function persistUiSettings({ persist = true } = {}) {
    const languageSelect = document.getElementById('languageSelect');
    const themeModeSelect = document.getElementById('themeModeSelect');
    const themePaletteSelect = document.getElementById('themePaletteSelect');
    const themeBackgroundInput = document.getElementById('themeBackgroundInput');
    const closeBehaviorSelect = document.getElementById('closeBehaviorSelect');
    const settings = {
      language: languageSelect?.value || defaults.language,
      themeMode: themeModeSelect?.value || defaults.themeMode,
      palette: themePaletteSelect?.value || defaults.palette,
      backgroundImage: themeBackgroundInput?.value?.trim() || '',
      closeBehavior: closeBehaviorSelect?.value || defaults.closeBehavior,
    };
    if (persist) {
      localStorage.setItem(storageKeys.language, settings.language);
      localStorage.setItem(storageKeys.themeMode, settings.themeMode);
      localStorage.setItem(storageKeys.palette, settings.palette);
      localStorage.setItem(storageKeys.backgroundImage, settings.backgroundImage);
      localStorage.setItem(storageKeys.closeBehavior, settings.closeBehavior);
      window.rpgWorkbench?.saveUiSettings?.(settings).catch?.(() => {});
    }
    applyThemeSettings(settings);
    applyI18n();
    updateThemePreview(settings.backgroundImage);
    return settings;
  }

  function getCloseBehavior() {
    return localStorage.getItem(storageKeys.closeBehavior) || defaults.closeBehavior;
  }

  function setCloseBehavior(value) {
    const next = ['minimize-to-tray', 'exit-immediately'].includes(value) ? value : defaults.closeBehavior;
    localStorage.setItem(storageKeys.closeBehavior, next);
    const select = document.getElementById('closeBehaviorSelect');
    if (select) select.value = next;
    return next;
  }

  function resetUiSettings() {
    localStorage.setItem(storageKeys.language, defaults.language);
    localStorage.setItem(storageKeys.themeMode, defaults.themeMode);
    localStorage.setItem(storageKeys.palette, defaults.palette);
    localStorage.setItem(storageKeys.backgroundImage, defaults.backgroundImage);
    localStorage.setItem(storageKeys.closeBehavior, defaults.closeBehavior);
    syncUiSettingsFields();
    return getStoredUiSettings();
  }

  function getCloseBehaviorLabel(value = getCloseBehavior()) {
    return value === 'exit-immediately' ? (window.RpgView?.t?.('settings.closeBehaviorExit') || '直接退出程序') : (window.RpgView?.t?.('settings.closeBehaviorTray') || '最小化到右下角托盘');
  }

  function updateThemePreview(backgroundImage = document.getElementById('themeBackgroundInput')?.value || '') {
    const preview = document.getElementById('themeBackgroundPreview');
    const image = document.getElementById('themeBackgroundPreviewImage');
    const text = document.getElementById('themeBackgroundPreviewText');
    if (!preview || !image || !text) return;
    const value = String(backgroundImage || '').trim();
    if (!value) {
      preview.classList.remove('has-image', 'can-open');
      image.style.backgroundImage = 'none';
      text.textContent = (window.RpgI18n?.[localStorage.getItem(storageKeys.language) || defaults.language] || {})['settings.previewEmpty'] || '当前未设置图片背景';
      preview.dataset.previewUrl = '';
      return;
    }
    const normalized = /^https?:\/\//i.test(value) || /^file:/i.test(value) ? value : value.replace(/\\/g, '/');
    preview.classList.add('has-image', 'can-open');
    image.style.backgroundImage = `url("${normalized}")`;
    text.textContent = value;
    preview.dataset.previewUrl = normalized;
  }

  function installTransientScrollbars() {
    const timers = new WeakMap();
    const mark = (target) => {
      if (!(target instanceof Element)) return;
      target.classList.add('is-scrolling');
      if (timers.has(target)) clearTimeout(timers.get(target));
      timers.set(target, setTimeout(() => target.classList.remove('is-scrolling'), 900));
    };
    document.addEventListener('scroll', (event) => mark(event.target === document ? document.scrollingElement : event.target), true);
    document.addEventListener('wheel', (event) => mark(event.target), true);
  }

  window.RpgView = {
    ...(window.RpgView || {}),
    getStoredUiSettings,
    applyThemeSettings,
    applyI18n,
    syncUiSettingsFields,
    persistUiSettings,
    getCloseBehavior,
    setCloseBehavior,
    updateThemePreview,
    resetUiSettings,
    installTransientScrollbars,
    updateLocalText: window.RpgView?.updateLocalText || (() => {}),
  };
})();
