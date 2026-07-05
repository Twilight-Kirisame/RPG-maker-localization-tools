(() => {
  const $ = (id) => document.getElementById(id);
  const getState = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;
  const tf = (key, params = {}) => {
    let text = t(key);
    Object.keys(params || {}).forEach((k) => {
      text = text.split(`{${k}}`).join(String(params[k] ?? ''));
    });
    return text;
  };

  let currentMatches = [];
  let currentMatchIndex = -1;
  let repeatableCache = [];

  function getScope() {
    return $('findReplaceScope')?.value || 'current';
  }

  function getTargetField() {
    return $('findReplaceTarget')?.value || 'source';
  }

  function getSearchEntries() {
    const state = getState();
    const groups = state.groupedFiles || [];
    if (getScope() === 'all') {
      return groups.flatMap((group) => group.items || []);
    }
    const currentFile = state.currentFile || groups[0]?.file || '';
    const group = groups.find((g) => g.file === currentFile);
    return group ? group.items || [] : [];
  }

  function buildSearchRegex(pattern, { caseSensitive, wholeWord, useRegex }) {
    if (!pattern) return null;
    let source = pattern;
    if (!useRegex) {
      source = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (wholeWord) {
      source = `(?<!\\w)${source}(?!\\w)`;
    }
    try {
      return new RegExp(source, caseSensitive ? 'g' : 'gi');
    } catch {
      return null;
    }
  }

  function findMatches() {
    const pattern = $('findReplaceInput')?.value || '';
    if (!pattern) {
      currentMatches = [];
      currentMatchIndex = -1;
      updateMatchInfo();
      return;
    }
    const options = {
      caseSensitive: $('findReplaceCaseSensitive')?.checked || false,
      wholeWord: $('findReplaceWholeWord')?.checked || false,
      useRegex: $('findReplaceUseRegex')?.checked || false,
    };
    const regex = buildSearchRegex(pattern, options);
    if (!regex) {
      updateMatchInfo(t('findReplace.regexInvalid'));
      return;
    }
    const field = getTargetField();
    const entries = getSearchEntries();
    currentMatches = entries.filter((entry) => {
      regex.lastIndex = 0;
      return regex.test(String(entry[field] || ''));
    });
    currentMatchIndex = currentMatches.length ? 0 : -1;
    updateMatchInfo();
    if (currentMatches.length) {
      jumpToMatch(currentMatches[0]);
    }
  }

  function replaceCurrent() {
    if (currentMatchIndex < 0 || currentMatchIndex >= currentMatches.length) return;
    const entry = currentMatches[currentMatchIndex];
    const replaced = applyReplacement(entry);
    if (!replaced) return;
    findMatches();
  }

  function replaceAll() {
    const pattern = $('findReplaceInput')?.value || '';
    const replacement = $('replaceWithInput')?.value || '';
    if (!pattern) return;
    const options = {
      caseSensitive: $('findReplaceCaseSensitive')?.checked || false,
      wholeWord: $('findReplaceWholeWord')?.checked || false,
      useRegex: $('findReplaceUseRegex')?.checked || false,
    };
    const regex = buildSearchRegex(pattern, options);
    if (!regex) return;
    const field = getTargetField();
    const isTarget = field === 'target';
    const entries = getSearchEntries();
    let count = 0;
    entries.forEach((entry) => {
      const text = String(entry[field] || '');
      if (!regex.test(text)) return;
      regex.lastIndex = 0;
      const next = text.replace(regex, replacement);
      if (isTarget) {
        entry.target = next;
        entry.targetDraft = next;
        if (next.trim()) {
          entry.translationStatus = 'translated';
          entry.draftStatus = 'translated';
        }
      } else {
        entry.source = next;
      }
      count += 1;
    });
    window.RpgEntries?.renderEntryList?.();
    window.RpgEntries?.updateCounts?.();
    window.RpgEntries?.renderCurrentEntry?.();
    findMatches();
    window.traceCall?.(t('findReplace.traceTitle'), tf('findReplace.replaceAllDone', { count }), 'success');
  }

  function applyReplacement(entry) {
    const pattern = $('findReplaceInput')?.value || '';
    const replacement = $('replaceWithInput')?.value || '';
    const options = {
      caseSensitive: $('findReplaceCaseSensitive')?.checked || false,
      wholeWord: $('findReplaceWholeWord')?.checked || false,
      useRegex: $('findReplaceUseRegex')?.checked || false,
    };
    const regex = buildSearchRegex(pattern, options);
    if (!regex) return false;
    const field = getTargetField();
    const text = String(entry[field] || '');
    regex.lastIndex = 0;
    if (!regex.test(text)) return false;
    regex.lastIndex = 0;
    const next = text.replace(regex, replacement);
    if (field === 'target') {
      entry.target = next;
      entry.targetDraft = next;
      if (next.trim()) {
        entry.translationStatus = 'translated';
        entry.draftStatus = 'translated';
      }
    } else {
      entry.source = next;
    }
    window.RpgEntries?.renderEntryList?.();
    window.RpgEntries?.updateCounts?.();
    window.RpgEntries?.renderCurrentEntry?.();
    return true;
  }

  function jumpToMatch(entry) {
    if (!entry) return;
    const state = getState();
    window.RpgAppStore?.setState?.({
      ...state,
      currentFile: entry.file,
      currentEntryIndex: entry.localIndex ?? 0,
      searchScope: 'current',
    });
    const fileSelect = $('fileSelect');
    if (fileSelect && fileSelect.value !== entry.file) fileSelect.value = entry.file;
    window.RpgEntries?.renderFileSelect?.();
    window.RpgEntries?.renderEntryList?.();
    window.RpgEntries?.renderCurrentEntry?.();
    requestAnimationFrame(() => {
      const activeRow = document.querySelector('.paired-row.active');
      if (activeRow && typeof activeRow.scrollIntoView === 'function') {
        activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function updateMatchInfo(extra) {
    const el = $('findReplaceMatchInfo');
    if (!el) return;
    if (extra) {
      el.textContent = extra;
      return;
    }
    if (!currentMatches.length) {
      el.textContent = t('findReplace.noMatch');
      return;
    }
    el.textContent = tf('findReplace.matchInfo', {
      current: currentMatchIndex + 1,
      total: currentMatches.length,
    });
  }

  function nextMatch() {
    if (!currentMatches.length) return;
    currentMatchIndex = (currentMatchIndex + 1) % currentMatches.length;
    updateMatchInfo();
    jumpToMatch(currentMatches[currentMatchIndex]);
  }

  function prevMatch() {
    if (!currentMatches.length) return;
    currentMatchIndex = (currentMatchIndex - 1 + currentMatches.length) % currentMatches.length;
    updateMatchInfo();
    jumpToMatch(currentMatches[currentMatchIndex]);
  }

  function scanRepeatableSources() {
    const entries = getSearchEntries();
    const map = new Map();
    entries.forEach((entry) => {
      const source = String(entry.source || '').trim();
      if (!source) return;
      if (!map.has(source)) map.set(source, []);
      map.get(source).push(entry);
    });
    const result = [];
    map.forEach((items, source) => {
      const translated = items.filter((e) => String(e.target || e.targetDraft || '').trim());
      const pending = items.filter((e) => !String(e.target || e.targetDraft || '').trim());
      if (!translated.length || !pending.length) return;
      const candidates = [...new Set(translated.map((e) => String(e.target || e.targetDraft || '').trim()))];
      result.push({ source, total: items.length, translatedCount: translated.length, pendingCount: pending.length, candidates, items, pendingItems: pending });
    });
    result.sort((a, b) => b.pendingCount - a.pendingCount);
    repeatableCache = result;
    return result;
  }

  function renderRepeatableList() {
    const list = $('repeatableList');
    if (!list) return;
    list.innerHTML = '';
    if (!repeatableCache.length) {
      list.innerHTML = `<div class="status-box">${t('findReplace.noRepeatable')}</div>`;
      return;
    }
    repeatableCache.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'repeatable-row';
      const header = document.createElement('div');
      header.className = 'repeatable-header';
      header.textContent = tf('findReplace.repeatableItem', {
        source: item.source,
        translated: item.translatedCount,
        pending: item.pendingCount,
      });
      row.appendChild(header);
      const controls = document.createElement('div');
      controls.className = 'repeatable-controls';
      const select = document.createElement('select');
      select.className = 'repeatable-select';
      item.candidates.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
      const fillBtn = document.createElement('button');
      fillBtn.type = 'button';
      fillBtn.className = 'secondary-btn';
      fillBtn.textContent = t('findReplace.fillBtn');
      fillBtn.addEventListener('click', () => {
        const value = select.value;
        item.pendingItems.forEach((entry) => {
          entry.target = value;
          entry.targetDraft = value;
          entry.translationStatus = 'translated';
          entry.draftStatus = 'translated';
        });
        window.RpgEntries?.renderEntryList?.();
        window.RpgEntries?.updateCounts?.();
        window.RpgEntries?.renderCurrentEntry?.();
        window.traceCall?.(
          t('findReplace.traceFillTitle'),
          tf('findReplace.fillDone', { source: item.source, count: item.pendingCount, value }),
          'success'
        );
        scanRepeatableSources();
        renderRepeatableList();
      });
      controls.appendChild(select);
      controls.appendChild(fillBtn);
      row.appendChild(controls);
      list.appendChild(row);
    });
  }

  function openModal() {
    $('findReplaceModal')?.classList.remove('hidden');
    scanRepeatableSources();
    renderRepeatableList();
    $('findReplaceInput')?.focus();
  }

  function closeModal() {
    $('findReplaceModal')?.classList.add('hidden');
  }

  function bindActions() {
    $('openFindReplaceBtn')?.addEventListener('click', openModal);
    $('findReplaceCloseBtn')?.addEventListener('click', closeModal);
    $('findReplaceBackdrop')?.addEventListener('click', closeModal);
    $('findReplaceBtn')?.addEventListener('click', findMatches);
    $('findReplaceNextBtn')?.addEventListener('click', nextMatch);
    $('findReplacePrevBtn')?.addEventListener('click', prevMatch);
    $('replaceCurrentBtn')?.addEventListener('click', replaceCurrent);
    $('replaceAllBtn')?.addEventListener('click', replaceAll);
    $('refreshRepeatableBtn')?.addEventListener('click', () => { scanRepeatableSources(); renderRepeatableList(); });
    $('findReplaceScope')?.addEventListener('change', () => { scanRepeatableSources(); renderRepeatableList(); findMatches(); });

    $('findReplaceInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') findMatches();
    });
    $('replaceWithInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') replaceAll();
    });
  }

  window.RpgFindReplace = { openModal, closeModal, bindActions };
})();
