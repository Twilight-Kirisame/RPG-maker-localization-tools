(() => {
  const storageKeys = {
    language: 'rpg-workbench-language',
    themeMode: 'rpg-workbench-theme-mode',
    palette: 'rpg-workbench-theme-palette',
    backgroundImage: 'rpg-workbench-background-image',
    closeBehavior: 'rpg-workbench-close-behavior',
    enableGamePreview: 'rpg-workbench-enable-game-preview',
    previewWindowMode: 'rpg-workbench-preview-window-mode',
    showPreviewNotification: 'rpg-workbench-show-preview-notification',
    previewNotificationPosition: 'rpg-workbench-preview-notification-position',
    timelineModeEnabled: 'rpg-workbench-timeline-mode-enabled',
    autoSaveEnabled: 'rpg-workbench-auto-save-enabled',
    autoSaveIntervalMinutes: 'rpg-workbench-auto-save-interval',
    autoSaveDir: 'rpg-workbench-auto-save-dir',
    uiFont: 'rpg-workbench-ui-font',
    importedFonts: 'rpg-workbench-imported-fonts',
    maskIntensity: 'rpg-workbench-mask-intensity',
    backgroundBlur: 'rpg-workbench-background-blur',
  };

  const defaults = {
    language: 'zh-CN',
    themeMode: 'system',
    palette: 'violet',
    backgroundImage: '',
    closeBehavior: 'minimize-to-tray',
    enableGamePreview: true,
    previewWindowMode: 'popup',
    showPreviewNotification: true,
    previewNotificationPosition: 'top-center',
    timelineModeEnabled: false,
    autoSaveEnabled: false,
    autoSaveIntervalMinutes: 5,
    autoSaveDir: '',
    uiFont: 'auto',
    importedFonts: [],
    maskIntensity: 55,
    backgroundBlur: 0,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || min));
  }

  function getStoredUiSettings() {
    const rawEnable = localStorage.getItem(storageKeys.enableGamePreview);
    const rawMode = localStorage.getItem(storageKeys.previewWindowMode);
    const rawShowNotification = localStorage.getItem(storageKeys.showPreviewNotification);
    const rawNotificationPosition = localStorage.getItem(storageKeys.previewNotificationPosition);
    const rawTimelineMode = localStorage.getItem(storageKeys.timelineModeEnabled);
    const rawAutoSave = localStorage.getItem(storageKeys.autoSaveEnabled);
    const rawAutoSaveInterval = localStorage.getItem(storageKeys.autoSaveIntervalMinutes);
    const rawAutoSaveDir = localStorage.getItem(storageKeys.autoSaveDir);
    const rawUiFont = localStorage.getItem(storageKeys.uiFont);
    const rawImportedFonts = localStorage.getItem(storageKeys.importedFonts);
    const rawMaskIntensity = localStorage.getItem(storageKeys.maskIntensity);
    const rawBackgroundBlur = localStorage.getItem(storageKeys.backgroundBlur);
    const interval = Number(rawAutoSaveInterval);
    return {
      language: localStorage.getItem(storageKeys.language) || defaults.language,
      themeMode: localStorage.getItem(storageKeys.themeMode) || defaults.themeMode,
      palette: localStorage.getItem(storageKeys.palette) || defaults.palette,
      backgroundImage: localStorage.getItem(storageKeys.backgroundImage) || defaults.backgroundImage,
      closeBehavior: localStorage.getItem(storageKeys.closeBehavior) || defaults.closeBehavior,
      enableGamePreview: rawEnable === null ? defaults.enableGamePreview : rawEnable === 'true',
      previewWindowMode: ['popup', 'embedded'].includes(rawMode) ? rawMode : defaults.previewWindowMode,
      showPreviewNotification: rawShowNotification === null ? defaults.showPreviewNotification : rawShowNotification === 'true',
      previewNotificationPosition: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(rawNotificationPosition) ? rawNotificationPosition : defaults.previewNotificationPosition,
      timelineModeEnabled: rawTimelineMode === null ? defaults.timelineModeEnabled : rawTimelineMode === 'true',
      autoSaveEnabled: rawAutoSave === null ? defaults.autoSaveEnabled : rawAutoSave === 'true',
      autoSaveIntervalMinutes: Number.isFinite(interval) && interval >= 1 && interval <= 120 ? interval : defaults.autoSaveIntervalMinutes,
      autoSaveDir: rawAutoSaveDir || defaults.autoSaveDir,
      uiFont: rawUiFont || defaults.uiFont,
      importedFonts: (() => {
        try { return JSON.parse(rawImportedFonts || '[]'); } catch { return []; }
      })(),
      maskIntensity: rawMaskIntensity !== null ? clamp(Number(rawMaskIntensity), 0, 100) : defaults.maskIntensity,
      backgroundBlur: rawBackgroundBlur !== null ? clamp(Number(rawBackgroundBlur), 0, 20) : defaults.backgroundBlur,
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
      const maskIntensity = Number.isFinite(settings.maskIntensity) ? settings.maskIntensity : defaults.maskIntensity;
      const backgroundBlur = Number.isFinite(settings.backgroundBlur) ? settings.backgroundBlur : defaults.backgroundBlur;
      document.documentElement.style.setProperty('--theme-mask-opacity', String(clamp(maskIntensity, 0, 100) / 100));
      document.documentElement.style.setProperty('--theme-blur', `${clamp(backgroundBlur, 0, 20)}px`);
    } else {
      document.documentElement.style.removeProperty('--theme-image');
      document.documentElement.classList.remove('has-theme-image');
      document.documentElement.style.removeProperty('--theme-mask-opacity');
      document.documentElement.style.removeProperty('--theme-blur');
    }
  }

  function injectImportedFontFaces(importedFonts = []) {
    if (!importedFonts.length) {
      const existing = document.getElementById('imported-font-faces');
      if (existing) existing.textContent = '';
      return;
    }
    let styleEl = document.getElementById('imported-font-faces');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'imported-font-faces';
      document.head.appendChild(styleEl);
    }
    const formatOf = (filePath = '') => {
      const ext = String(filePath).split('.').pop().toLowerCase();
      const map = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' };
      return map[ext] || 'truetype';
    };
    styleEl.textContent = importedFonts.map((f) => {
      const family = f.familyName || f.name || f.key;
      const src = String(f.filePath || '').replace(/\\/g, '/');
      return `@font-face { font-family: '${family.replace(/'/g, "\\'")}'; src: url("${src}") format('${formatOf(f.filePath)}'); font-display: swap; }`;
    }).join('\n');
  }

  function applyUiFont(fontValue = getStoredUiSettings().uiFont) {
    const settings = getStoredUiSettings();
    const importedFonts = settings.importedFonts || [];
    const importedKeys = importedFonts.map((f) => f.key);
    const presetFonts = ['auto', 'system', 'source-han', 'noto-sans', 'noto-serif', 'microsoft', 'pingfang', 'yugothic', 'meiryo', 'jingnan-maiyuan', 'rounded', 'kaiti', 'songti'];
    const validFonts = [...presetFonts, ...importedKeys];
    const value = validFonts.includes(fontValue) ? fontValue : defaults.uiFont;
    const lang = localStorage.getItem(storageKeys.language) || defaults.language;

    const baseFallback = "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif";
    const jaFallback = "'Yu Gothic', 'Meiryo', 'Hiragino Kaku Gothic ProN', 'MS PGothic', 'Noto Sans CJK JP', sans-serif";
    const koFallback = "'Malgun Gothic', 'Noto Sans CJK KR', 'Microsoft YaHei', sans-serif";

    const families = {
      'source-han': {
        ui: "'Source Han Sans SC', 'Source Han Sans CN', 'Segoe UI', 'Microsoft YaHei', sans-serif",
        zh: "'Source Han Sans SC', 'Source Han Sans CN', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        ja: "'Yu Gothic', 'Meiryo', 'Hiragino Kaku Gothic ProN', 'Source Han Sans SC', 'MS PGothic', sans-serif",
        ko: "'Malgun Gothic', 'Source Han Sans SC', 'Noto Sans CJK KR', sans-serif",
        en: "'Source Han Sans SC', 'Source Han Sans CN', 'Segoe UI', sans-serif",
      },
      'noto-sans': {
        ui: "'Noto Sans CJK SC', 'Segoe UI', 'Microsoft YaHei', sans-serif",
        zh: "'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif",
        ja: "'Noto Sans CJK JP', 'Yu Gothic', 'Meiryo', 'Hiragino Kaku Gothic ProN', sans-serif",
        ko: "'Noto Sans CJK KR', 'Malgun Gothic', 'Microsoft YaHei', sans-serif",
        en: "'Noto Sans CJK SC', 'Segoe UI', sans-serif",
      },
      'noto-serif': {
        ui: "'Noto Serif CJK SC', 'Georgia', 'Source Han Sans SC', serif",
        zh: "'Noto Serif CJK SC', 'Noto Serif CJK TC', 'Source Han Sans SC', serif",
        ja: "'Noto Serif CJK JP', 'Yu Mincho', 'MS Mincho', 'Source Han Sans SC', serif",
        ko: "'Noto Serif CJK KR', 'Malgun Gothic', 'Source Han Sans SC', serif",
        en: "'Noto Serif CJK SC', 'Georgia', serif",
      },
      'microsoft': {
        ui: "'Microsoft YaHei', 'Segoe UI', 'PingFang SC', sans-serif",
        zh: "'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', sans-serif",
        ja: "'Microsoft YaHei', 'Yu Gothic', 'Meiryo', sans-serif",
        ko: "'Microsoft YaHei', 'Malgun Gothic', sans-serif",
        en: "'Segoe UI', 'Microsoft YaHei', sans-serif",
      },
      'pingfang': {
        ui: "'PingFang SC', 'Segoe UI', 'Microsoft YaHei', sans-serif",
        zh: "'PingFang SC', 'PingFang TC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
        ja: "'PingFang SC', 'Yu Gothic', 'Meiryo', sans-serif",
        ko: "'PingFang SC', 'Malgun Gothic', sans-serif",
        en: "'PingFang SC', 'Segoe UI', sans-serif",
      },
      'yugothic': {
        ui: "'Yu Gothic', 'Segoe UI', 'Microsoft YaHei', sans-serif",
        zh: "'Yu Gothic', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        ja: "'Yu Gothic', 'Yu Gothic UI', 'Hiragino Kaku Gothic ProN', 'Meiryo', 'MS PGothic', sans-serif",
        ko: "'Yu Gothic', 'Malgun Gothic', sans-serif",
        en: "'Yu Gothic', 'Segoe UI', sans-serif",
      },
      'meiryo': {
        ui: "'Meiryo', 'Segoe UI', 'Microsoft YaHei', sans-serif",
        zh: "'Meiryo', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        ja: "'Meiryo', 'Meiryo UI', 'MS PGothic', 'Yu Gothic', sans-serif",
        ko: "'Meiryo', 'Malgun Gothic', sans-serif",
        en: "'Meiryo', 'Segoe UI', sans-serif",
      },
      'jingnan-maiyuan': {
        ui: "'Jingnan Maiyuan Ti', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif",
        zh: "'Jingnan Maiyuan Ti', 'Source Han Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        ja: "'Jingnan Maiyuan Ti', 'Yu Gothic', 'Meiryo', 'Source Han Sans SC', sans-serif",
        ko: "'Jingnan Maiyuan Ti', 'Malgun Gothic', 'Source Han Sans SC', sans-serif",
        en: "'Jingnan Maiyuan Ti', 'Segoe UI', 'Source Han Sans SC', sans-serif",
      },
      'rounded': {
        ui: "'Rounded Font', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif",
        zh: "'Rounded Font', 'Source Han Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif",
        ja: "'Rounded Font', 'Yu Gothic', 'Meiryo', 'Source Han Sans SC', sans-serif",
        ko: "'Rounded Font', 'Malgun Gothic', 'Source Han Sans SC', sans-serif",
        en: "'Rounded Font', 'Segoe UI', 'Source Han Sans SC', sans-serif",
      },
      'kaiti': {
        ui: "'Kaiti Font', 'Source Han Sans SC', 'Microsoft YaHei', serif",
        zh: "'Kaiti Font', 'Source Han Sans SC', 'KaiTi', 'STKaiti', serif",
        ja: "'Kaiti Font', 'Yu Mincho', 'MS Mincho', 'Source Han Sans SC', serif",
        ko: "'Kaiti Font', 'Malgun Gothic', 'Source Han Sans SC', serif",
        en: "'Kaiti Font', 'Georgia', 'Source Han Sans SC', serif",
      },
      'songti': {
        ui: "'Songti Font', 'Source Han Sans SC', 'Microsoft YaHei', serif",
        zh: "'Songti Font', 'Source Han Sans SC', 'SimSun', 'STSong', serif",
        ja: "'Songti Font', 'Yu Mincho', 'MS Mincho', 'Source Han Sans SC', serif",
        ko: "'Songti Font', 'Malgun Gothic', 'Source Han Sans SC', serif",
        en: "'Songti Font', 'Georgia', 'Source Han Sans SC', serif",
      },
    };

    injectImportedFontFaces(importedFonts);

    let selected;
    if (value === 'system') {
      selected = { ui: baseFallback, zh: baseFallback, ja: baseFallback, ko: baseFallback, en: baseFallback };
    } else if (value === 'auto') {
      const autoByLang = {
        'zh-CN': { ui: families['source-han'].zh, zh: families['source-han'].zh, ja: jaFallback, ko: koFallback, en: baseFallback },
        'ja': { ui: families['source-han'].ja, zh: families['source-han'].zh, ja: jaFallback, ko: koFallback, en: baseFallback },
        'en': { ui: baseFallback, zh: families['source-han'].zh, ja: jaFallback, ko: koFallback, en: baseFallback },
      };
      selected = autoByLang[lang] || autoByLang['en'];
    } else if (importedKeys.includes(value)) {
      const imported = importedFonts.find((f) => f.key === value) || {};
      const family = imported.familyName || imported.name || value;
      const safeFamily = family.replace(/'/g, "\\'");
      selected = {
        ui: `'${safeFamily}', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif`,
        zh: `'${safeFamily}', 'Source Han Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif`,
        ja: `'${safeFamily}', 'Yu Gothic', 'Meiryo', 'Source Han Sans SC', sans-serif`,
        ko: `'${safeFamily}', 'Malgun Gothic', 'Source Han Sans SC', sans-serif`,
        en: `'${safeFamily}', 'Segoe UI', 'Source Han Sans SC', sans-serif`,
      };
    } else {
      selected = families[value] || families['source-han'];
    }

    document.documentElement.style.setProperty('--ui-font-stack', selected.ui);
    document.documentElement.style.setProperty('--editor-font-zh', selected.zh);
    document.documentElement.style.setProperty('--editor-font-ja', selected.ja);
    document.documentElement.style.setProperty('--editor-font-ko', selected.ko);
    document.documentElement.style.setProperty('--editor-font-en', selected.en);
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
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const fallback = el.getAttribute('title') || '';
      const translated = t(key, fallback);
      if (translated && translated !== key) el.title = translated;
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      const fallback = el.getAttribute('aria-label') || '';
      const translated = t(key, fallback);
      if (translated && translated !== key) el.setAttribute('aria-label', translated);
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
    const enableGamePreviewCheck = document.getElementById('enableGamePreviewCheck');
    const previewWindowModeSelect = document.getElementById('previewWindowModeSelect');
    const showPreviewNotificationCheck = document.getElementById('showPreviewNotificationCheck');
    const previewNotificationPositionSelect = document.getElementById('previewNotificationPositionSelect');
    const timelineModeCheck = document.getElementById('timelineModeCheck');
    const autoSaveEnabledCheck = document.getElementById('autoSaveEnabledCheck');
    const autoSaveIntervalInput = document.getElementById('autoSaveIntervalInput');
    const autoSaveDirInput = document.getElementById('autoSaveDirInput');
    const uiFontSelect = document.getElementById('uiFontSelect');
    const maskIntensitySlider = document.getElementById('maskIntensitySlider');
    const maskIntensityValue = document.getElementById('maskIntensityValue');
    const backgroundBlurSlider = document.getElementById('backgroundBlurSlider');
    const backgroundBlurValue = document.getElementById('backgroundBlurValue');
    const backgroundEffectsGroup = document.getElementById('backgroundEffectsGroup');
    if (languageSelect) languageSelect.value = ['zh-CN', 'en', 'ja'].includes(settings.language) ? settings.language : defaults.language;
    if (themeModeSelect) themeModeSelect.value = ['system', 'dark', 'light'].includes(settings.themeMode) ? settings.themeMode : defaults.themeMode;
    if (themePaletteSelect) themePaletteSelect.value = ['violet', 'blue', 'emerald', 'rose', 'amber', 'slate'].includes(settings.palette) ? settings.palette : defaults.palette;
    if (themeBackgroundInput && !preserveBackground) themeBackgroundInput.value = settings.backgroundImage || '';
    if (closeBehaviorSelect) closeBehaviorSelect.value = ['minimize-to-tray', 'exit-immediately'].includes(settings.closeBehavior) ? settings.closeBehavior : defaults.closeBehavior;
    if (enableGamePreviewCheck) enableGamePreviewCheck.checked = Boolean(settings.enableGamePreview);
    if (previewWindowModeSelect) previewWindowModeSelect.value = ['popup', 'embedded'].includes(settings.previewWindowMode) ? settings.previewWindowMode : defaults.previewWindowMode;
    if (showPreviewNotificationCheck) showPreviewNotificationCheck.checked = Boolean(settings.showPreviewNotification);
    if (previewNotificationPositionSelect) previewNotificationPositionSelect.value = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(settings.previewNotificationPosition) ? settings.previewNotificationPosition : defaults.previewNotificationPosition;
    if (timelineModeCheck) timelineModeCheck.checked = Boolean(settings.timelineModeEnabled);
    if (autoSaveEnabledCheck) autoSaveEnabledCheck.checked = Boolean(settings.autoSaveEnabled);
    if (autoSaveIntervalInput) autoSaveIntervalInput.value = String(settings.autoSaveIntervalMinutes);
    if (autoSaveDirInput) autoSaveDirInput.value = settings.autoSaveDir || '';
    if (uiFontSelect) {
      const presetFonts = ['auto', 'system', 'source-han', 'noto-sans', 'noto-serif', 'microsoft', 'pingfang', 'yugothic', 'meiryo', 'jingnan-maiyuan', 'rounded', 'kaiti', 'songti'];
      const importedFonts = settings.importedFonts || [];
      importedFonts.forEach((f) => {
        if (uiFontSelect.querySelector(`option[value="${f.key}"]`)) return;
        const option = document.createElement('option');
        option.value = f.key;
        option.textContent = f.name || f.familyName || f.key;
        uiFontSelect.appendChild(option);
      });
      // Remove orphaned imported options that no longer exist in storage
      Array.from(uiFontSelect.options).forEach((opt) => {
        if (presetFonts.includes(opt.value)) return;
        if (!importedFonts.some((f) => f.key === opt.value)) opt.remove();
      });
      uiFontSelect.value = settings.uiFont || defaults.uiFont;
    }
    if (maskIntensitySlider) maskIntensitySlider.value = String(settings.maskIntensity);
    if (maskIntensityValue) maskIntensityValue.textContent = `${settings.maskIntensity}%`;
    if (backgroundBlurSlider) backgroundBlurSlider.value = String(settings.backgroundBlur);
    if (backgroundBlurValue) backgroundBlurValue.textContent = `${settings.backgroundBlur}px`;
    if (backgroundEffectsGroup) backgroundEffectsGroup.classList.toggle('hidden', !settings.backgroundImage);
    populateImportedFontsList(settings.importedFonts);
    updateAutoSaveControlsDisabledState();
    applyThemeSettings({ ...settings, backgroundImage: preserveBackground ? themeBackgroundInput?.value || '' : settings.backgroundImage });
    applyUiFont(settings.uiFont);
    updateThemePreview(preserveBackground ? themeBackgroundInput?.value || '' : settings.backgroundImage);
  }

  function populateImportedFontsList(importedFonts = []) {
    const container = document.getElementById('importedFontsList');
    if (!container) return;
    if (!importedFonts.length) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = importedFonts.map((f) => `
      <div class="imported-font-item" data-font-key="${f.key}">
        <span class="imported-font-item-name">${f.name || f.familyName || f.key}</span>
        <button type="button" class="secondary-btn delete-imported-font" data-font-key="${f.key}" data-i18n="common.delete">删除</button>
      </div>
    `).join('');
    container.querySelectorAll('.delete-imported-font').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.fontKey;
        try {
          await window.rpgWorkbench?.deleteImportedFont?.(key);
        } catch (e) {
          console.error('Failed to delete imported font:', e);
        }
        const current = getStoredUiSettings();
        const updated = current.importedFonts.filter((f) => f.key !== key);
        localStorage.setItem(storageKeys.importedFonts, JSON.stringify(updated));
        if (current.uiFont === key) {
          localStorage.setItem(storageKeys.uiFont, defaults.uiFont);
        }
        syncUiSettingsFields();
      });
    });
  }

  function updateAutoSaveControlsDisabledState() {
    const enabled = document.getElementById('autoSaveEnabledCheck')?.checked ?? false;
    const intervalInput = document.getElementById('autoSaveIntervalInput');
    const dirInput = document.getElementById('autoSaveDirInput');
    const pickDirBtn = document.getElementById('pickAutoSaveDirBtn');
    [intervalInput, dirInput, pickDirBtn].forEach((el) => { if (el) el.disabled = !enabled; });
  }

  function persistUiSettings({ persist = true } = {}) {
    const languageSelect = document.getElementById('languageSelect');
    const themeModeSelect = document.getElementById('themeModeSelect');
    const themePaletteSelect = document.getElementById('themePaletteSelect');
    const themeBackgroundInput = document.getElementById('themeBackgroundInput');
    const closeBehaviorSelect = document.getElementById('closeBehaviorSelect');
    const enableGamePreviewCheck = document.getElementById('enableGamePreviewCheck');
    const previewWindowModeSelect = document.getElementById('previewWindowModeSelect');
    const showPreviewNotificationCheck = document.getElementById('showPreviewNotificationCheck');
    const previewNotificationPositionSelect = document.getElementById('previewNotificationPositionSelect');
    const timelineModeCheck = document.getElementById('timelineModeCheck');
    const autoSaveEnabledCheck = document.getElementById('autoSaveEnabledCheck');
    const autoSaveIntervalInput = document.getElementById('autoSaveIntervalInput');
    const autoSaveDirInput = document.getElementById('autoSaveDirInput');
    const uiFontSelect = document.getElementById('uiFontSelect');
    const maskIntensitySlider = document.getElementById('maskIntensitySlider');
    const backgroundBlurSlider = document.getElementById('backgroundBlurSlider');
    const interval = Number(autoSaveIntervalInput?.value);
    const maskIntensity = Number(maskIntensitySlider?.value);
    const backgroundBlur = Number(backgroundBlurSlider?.value);
    const currentSettings = getStoredUiSettings();
    const settings = {
      language: languageSelect?.value || defaults.language,
      themeMode: themeModeSelect?.value || defaults.themeMode,
      palette: themePaletteSelect?.value || defaults.palette,
      backgroundImage: themeBackgroundInput?.value?.trim() || '',
      closeBehavior: closeBehaviorSelect?.value || defaults.closeBehavior,
      enableGamePreview: enableGamePreviewCheck ? enableGamePreviewCheck.checked : defaults.enableGamePreview,
      previewWindowMode: ['popup', 'embedded'].includes(previewWindowModeSelect?.value) ? previewWindowModeSelect.value : defaults.previewWindowMode,
      showPreviewNotification: showPreviewNotificationCheck ? showPreviewNotificationCheck.checked : defaults.showPreviewNotification,
      previewNotificationPosition: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(previewNotificationPositionSelect?.value) ? previewNotificationPositionSelect.value : defaults.previewNotificationPosition,
      timelineModeEnabled: timelineModeCheck ? timelineModeCheck.checked : defaults.timelineModeEnabled,
      autoSaveEnabled: autoSaveEnabledCheck ? autoSaveEnabledCheck.checked : defaults.autoSaveEnabled,
      autoSaveIntervalMinutes: Number.isFinite(interval) && interval >= 1 && interval <= 120 ? interval : defaults.autoSaveIntervalMinutes,
      autoSaveDir: autoSaveDirInput?.value?.trim() || '',
      uiFont: uiFontSelect?.value || defaults.uiFont,
      importedFonts: currentSettings.importedFonts || [],
      maskIntensity: Number.isFinite(maskIntensity) ? clamp(maskIntensity, 0, 100) : defaults.maskIntensity,
      backgroundBlur: Number.isFinite(backgroundBlur) ? clamp(backgroundBlur, 0, 20) : defaults.backgroundBlur,
    };
    if (persist) {
      localStorage.setItem(storageKeys.language, settings.language);
      localStorage.setItem(storageKeys.themeMode, settings.themeMode);
      localStorage.setItem(storageKeys.palette, settings.palette);
      localStorage.setItem(storageKeys.backgroundImage, settings.backgroundImage);
      localStorage.setItem(storageKeys.closeBehavior, settings.closeBehavior);
      localStorage.setItem(storageKeys.enableGamePreview, String(settings.enableGamePreview));
      localStorage.setItem(storageKeys.previewWindowMode, settings.previewWindowMode);
      localStorage.setItem(storageKeys.showPreviewNotification, String(settings.showPreviewNotification));
      localStorage.setItem(storageKeys.previewNotificationPosition, settings.previewNotificationPosition);
      localStorage.setItem(storageKeys.timelineModeEnabled, String(settings.timelineModeEnabled));
      localStorage.setItem(storageKeys.autoSaveEnabled, String(settings.autoSaveEnabled));
      localStorage.setItem(storageKeys.autoSaveIntervalMinutes, String(settings.autoSaveIntervalMinutes));
      localStorage.setItem(storageKeys.autoSaveDir, settings.autoSaveDir);
      localStorage.setItem(storageKeys.uiFont, settings.uiFont);
      localStorage.setItem(storageKeys.maskIntensity, String(settings.maskIntensity));
      localStorage.setItem(storageKeys.backgroundBlur, String(settings.backgroundBlur));
      window.rpgWorkbench?.saveUiSettings?.(settings).catch?.(() => {});
    }
    applyThemeSettings(settings);
    applyUiFont(settings.uiFont);
    applyI18n();
    window.RpgApp?.render?.();
    window.RpgGlossaryModule?.render?.();
    updateThemePreview(settings.backgroundImage);
    updateWorkspaceLayout();
    updateAutoSaveControlsDisabledState();
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
    localStorage.setItem(storageKeys.enableGamePreview, String(defaults.enableGamePreview));
    localStorage.setItem(storageKeys.previewWindowMode, defaults.previewWindowMode);
    localStorage.setItem(storageKeys.showPreviewNotification, String(defaults.showPreviewNotification));
    localStorage.setItem(storageKeys.previewNotificationPosition, defaults.previewNotificationPosition);
    localStorage.setItem(storageKeys.timelineModeEnabled, String(defaults.timelineModeEnabled));
    localStorage.setItem(storageKeys.autoSaveEnabled, String(defaults.autoSaveEnabled));
    localStorage.setItem(storageKeys.autoSaveIntervalMinutes, String(defaults.autoSaveIntervalMinutes));
    localStorage.setItem(storageKeys.autoSaveDir, defaults.autoSaveDir);
    localStorage.setItem(storageKeys.uiFont, defaults.uiFont);
    localStorage.setItem(storageKeys.importedFonts, JSON.stringify(defaults.importedFonts));
    localStorage.setItem(storageKeys.maskIntensity, String(defaults.maskIntensity));
    localStorage.setItem(storageKeys.backgroundBlur, String(defaults.backgroundBlur));
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
    const previewHint = window.RpgView?.t?.('settings.previewClickToOpen') || '点击查看原图';
    if (!value) {
      preview.classList.remove('has-image', 'can-open');
      image.style.backgroundImage = 'none';
      image.dataset.previewHint = previewHint;
      text.textContent = (window.RpgI18n?.[localStorage.getItem(storageKeys.language) || defaults.language] || {})['settings.previewEmpty'] || '当前未设置图片背景';
      preview.dataset.previewUrl = '';
      return;
    }
    const normalized = /^https?:\/\//i.test(value) || /^file:/i.test(value) ? value : value.replace(/\\/g, '/');
    preview.classList.add('has-image', 'can-open');
    image.style.backgroundImage = `url("${normalized}")`;
    image.dataset.previewHint = previewHint;
    text.textContent = value;
    preview.dataset.previewUrl = normalized;
  }

  function updateWorkspaceLayout() {
    const settings = getStoredUiSettings();
    const stage = document.getElementById('workspaceStage');
    const panel = document.getElementById('gamePreviewContainer');
    const host = document.getElementById('gamePreviewHost');
    const tvSet = document.getElementById('tvSet');
    const led = document.querySelector('.tv-led');
    const placeholder = document.getElementById('gamePreviewPlaceholder');
    const shouldSplit = Boolean(settings.enableGamePreview && settings.previewWindowMode === 'embedded');

    if (stage) stage.classList.toggle('has-embedded-preview', shouldSplit);
    if (panel) panel.classList.toggle('hidden', !shouldSplit);

    if (shouldSplit) {
      const isRunning = Boolean((window.RpgAppStore?.getState?.() || {}).previewRunning);
      if (tvSet) tvSet.dataset.previewActive = isRunning ? 'true' : 'false';
      if (led) led.dataset.state = isRunning ? 'on' : 'off';
      if (placeholder) placeholder.style.display = isRunning ? 'none' : '';
      if (host && !isRunning) {
        host.textContent = '';
        host.removeAttribute('data-placeholder');
      }
    } else if (placeholder) {
      placeholder.style.display = '';
    }
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

  async function refreshImportedFonts() {
    try {
      const result = await window.rpgWorkbench?.listImportedFonts?.();
      if (result?.ok && Array.isArray(result.fonts)) {
        localStorage.setItem(storageKeys.importedFonts, JSON.stringify(result.fonts));
        injectImportedFontFaces(result.fonts);
      }
    } catch (e) {
      console.error('Failed to refresh imported fonts:', e);
    }
  }

  window.RpgView = {
    ...(window.RpgView || {}),
    getStoredUiSettings,
    applyThemeSettings,
    applyUiFont,
    applyI18n,
    syncUiSettingsFields,
    persistUiSettings,
    getCloseBehavior,
    setCloseBehavior,
    updateThemePreview,
    updateWorkspaceLayout,
    updateAutoSaveControlsDisabledState,
    resetUiSettings,
    refreshImportedFonts,
    installTransientScrollbars,
    updateLocalText: window.RpgView?.updateLocalText || (() => {}),
  };
})();
