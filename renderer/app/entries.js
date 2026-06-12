(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;

  function getCurrentEntry() {
    const current = state();
    const fileGroup = (current.groupedFiles || []).find((g) => g.file === current.currentFile);
    return fileGroup ? fileGroup.items[current.currentEntryIndex] || null : null;
  }

  function buildGroupedFiles(nextEntries) {
    const current = state();
    const map = new Map();
    nextEntries.forEach((entry) => {
      if (!map.has(entry.file)) map.set(entry.file, []);
      map.get(entry.file).push(entry);
    });
    const groupedFiles = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], document.getElementById('languageSelect')?.value === 'ja' ? 'ja' : 'zh-Hans-CN'))
      .map(([file, items]) => ({ file, items: items.map((item, index) => ({ ...item, localIndex: index, sourceDraft: '', targetDraft: item.target || '' })) }));
    const currentFile = current.currentFile || groupedFiles[0]?.file || '';
    window.RpgAppStore?.setState?.({ groupedFiles, currentFile, currentEntryIndex: current.currentEntryIndex || 0 });
    return groupedFiles;
  }

  function isTranslated(entry) {
    const target = String(entry?.targetDraft ?? entry?.target ?? '').trim();
    const status = entry?.translationStatus || entry?.draftStatus || '';
    if (status === 'translated') return true;
    if (status === 'pending') return false;
    return Boolean(target);
  }

  function markTranslated(entry, translated) {
    const status = translated ? 'translated' : 'pending';
    entry.translationStatus = status;
    entry.draftStatus = status;
  }

  function getExportEntries() {
    const current = state();
    return (current.groupedFiles || []).flatMap((group) => group.items.map((entry) => {
      const target = String(entry.targetDraft ?? entry.target ?? '');
      return { ...entry, target, targetDraft: target, translationStatus: isTranslated(entry) ? 'translated' : 'pending', draftStatus: isTranslated(entry) ? 'translated' : 'pending' };
    }));
  }

  function renderFileSelect() {
    const current = state();
    const fileSelect = get('fileSelect');
    if (!fileSelect) return;
    fileSelect.innerHTML = '';
    (current.groupedFiles || []).forEach((group) => {
      const option = document.createElement('option');
      option.value = group.file;
      option.textContent = `${group.file} (${group.items.length})`;
      fileSelect.appendChild(option);
    });
    if (!(current.groupedFiles || []).length) fileSelect.innerHTML = `<option value="">${t('common.none')}</option>`;
    if (current.currentFile) fileSelect.value = current.currentFile;
  }

  function getFilteredItems() {
    const current = state();
    const group = (current.groupedFiles || []).find((g) => g.file === current.currentFile);
    if (!group) return [];
    const q = (current.searchText || '').trim().toLowerCase();
    return group.items.filter((entry) => !q || `${entry.key} ${entry.source} ${entry.targetDraft || ''}`.toLowerCase().includes(q));
  }

  function insertTextIntoTarget(targetCell, insertText, mode = 'cursor') {
    const currentText = targetCell.value || '';
    const start = typeof targetCell.selectionStart === 'number' ? targetCell.selectionStart : currentText.length;
    const end = typeof targetCell.selectionEnd === 'number' ? targetCell.selectionEnd : currentText.length;
    const hasSelection = start !== end;
    let next = '';
    let caret = 0;
    if (mode === 'append') {
      const spacer = currentText && !currentText.endsWith(' ') ? ' ' : '';
      next = `${currentText}${spacer}${insertText}`;
      caret = next.length;
    } else if (mode === 'replace' && hasSelection) {
      next = `${currentText.slice(0, start)}${insertText}${currentText.slice(end)}`;
      caret = start + insertText.length;
    } else {
      next = `${currentText.slice(0, start)}${insertText}${currentText.slice(start)}`;
      caret = start + insertText.length;
    }
    targetCell.value = next;
    targetCell.focus();
    targetCell.setSelectionRange(caret, caret);
    targetCell.dispatchEvent(new Event('input', { bubbles: true }));
    return next;
  }

  function insertAllGlossaryHits(entry, targetCell, mode = 'cursor') {
    const hits = Array.isArray(entry.glossaryHits) ? entry.glossaryHits.filter((term) => term?.target) : [];
    if (!hits.length) return;
    const inserts = hits.map((term) => term.target).filter(Boolean);
    const text = inserts.filter((item, index, arr) => arr.indexOf(item) === index).join(' ');
    const next = insertTextIntoTarget(targetCell, text, mode);
    entry.targetDraft = next;
    entry.target = next;
    renderEntryList();
    renderCurrentEntry();
  }

  function renderEntryAiAction(entry, targetCell) {
    const bar = document.createElement('div');
    bar.className = 'paired-ai-bar';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-btn paired-ai-btn';
    btn.textContent = 'AI翻译';
    btn.title = '使用当前选择的辅助翻译平台翻译本条文本';
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      window.RpgAppStore?.setState?.({ currentEntryIndex: entry.localIndex });
      window.showAiStatus?.(t('common.aiPending'), 'pending');
      try {
        const current = window.RpgAppStore?.getState?.() || {};
        const selectedProvider = document.getElementById('globalAiModeSelect')?.value || current.aiSettings?.lastEntryAiMode || current.aiSettings?.provider || 'baidu';
        const settings = {
          ...(current.aiSettings || {}),
          provider: selectedProvider,
          lastEntryAiMode: selectedProvider,
        };
        if (selectedProvider === 'baidu' || selectedProvider === 'google') {
          settings.traditional = { ...(current.aiSettings?.traditional || {}), provider: selectedProvider };
        }
        window.RpgAppStore?.setState?.({ aiSettings: settings });
        window.traceCall?.('辅助翻译', `使用 ${selectedProvider} 翻译：${entry.key || entry.source?.slice(0, 20) || ''}`, 'pending');
        const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({
          sourceText: entry.source,
          settings,
        });
        if (result?.ok) {
          entry.target = result.translatedText || '';
          entry.targetDraft = entry.target;
          targetCell.value = entry.target;
          targetCell.classList.toggle('empty', !targetCell.value.trim());
          window.showAiStatus?.(result.message || `已使用 ${result.provider || 'AI'} 完成翻译。`, 'success');
          window.traceCall?.('辅助翻译', result.message || `已使用 ${result.provider || 'AI'} 完成翻译。`, 'success');
          renderEntryList();
          renderCurrentEntry();
        } else {
          window.showAiStatus?.(result?.message || t('common.aiTestFail'), 'error');
          window.traceCall?.('辅助翻译', result?.message || t('common.aiTestFail'), 'error');
        }
      } catch (error) {
        window.showAiStatus?.(error.message || t('common.aiTestFail'), 'error');
        window.traceCall?.('辅助翻译', error.message || t('common.aiTestFail'), 'error');
      }
    });
    bar.appendChild(btn);
    return bar;
  }

  function renderGlossaryInline(row, entry, targetCell) {
    const hits = Array.isArray(entry.glossaryHits) ? entry.glossaryHits.filter((term) => term?.target) : [];
    let container = row.querySelector('.glossary-inline');
    if (!container) {
      container = document.createElement('div');
      container.className = 'glossary-inline';
      row.appendChild(container);
    }
    if (!hits.length) {
      container.innerHTML = '';
      container.classList.toggle('hidden', true);
      return;
    }
    container.classList.remove('hidden');
    container.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'glossary-inline-title';
    title.textContent = `术语命中 ${hits.length} 条`;
    container.appendChild(title);
    const controls = document.createElement('div');
    controls.className = 'glossary-inline-controls';
    const modeLabel = document.createElement('label');
    modeLabel.className = 'glossary-insert-mode-label';
    modeLabel.appendChild(document.createTextNode('插入方式'));
    const modeSelect = document.createElement('select');
    modeSelect.className = 'glossary-insert-mode';
    modeSelect.innerHTML = '<option value="cursor">插入到光标处</option><option value="replace">替换选中文本</option><option value="append">追加到末尾</option>';
    ['mousedown', 'click', 'change', 'focus'].forEach((eventName) => modeSelect.addEventListener(eventName, (e) => e.stopPropagation()));
    modeLabel.addEventListener('click', (e) => e.stopPropagation());
    modeLabel.appendChild(modeSelect);
    controls.appendChild(modeLabel);
    container.appendChild(controls);
    const actions = document.createElement('div');
    actions.className = 'glossary-inline-actions';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'glossary-inline-btn glossary-inline-btn-all';
    allBtn.textContent = '一键插入全部';
    allBtn.addEventListener('click', () => {
      insertAllGlossaryHits(entry, targetCell, modeSelect.value);
      window.showAiStatus?.(`已插入全部术语，共 ${hits.length} 条。`, 'success');
    });
    actions.appendChild(allBtn);
    hits.forEach((term) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'glossary-inline-btn';
      item.textContent = `插入：${term.source} → ${term.target}`;
      item.addEventListener('click', () => {
        const next = insertTextIntoTarget(targetCell, term.target || '', modeSelect.value);
        entry.targetDraft = next;
        entry.target = next;
        window.showAiStatus?.(`已将术语插入译文：${term.source}`, 'success');
        renderEntryList();
        renderCurrentEntry();
      });
      actions.appendChild(item);
    });
    container.appendChild(actions);
  }

  function renderEntryList() {
    const entryList = get('entryList');
    if (!entryList) return;
    entryList.innerHTML = '';
    const items = getFilteredItems();
    if (!items.length) {
      entryList.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
      return;
    }
    items.forEach((entry) => {
      const current = state();
      entry.glossaryHits = (current.glossary?.terms || []).filter((term) => term.enabled !== false && term.source && entry.source.includes(term.source));
      const row = document.createElement('div');
      const translated = isTranslated(entry);
      const hitCount = (entry.glossaryHits || []).length;
      const controlCharHit = /\\[VNCP]\[\d+\]/.test(entry.source || '');
      row.className = `paired-row ${entry.localIndex === current.currentEntryIndex ? 'active' : ''} ${translated ? 'translated' : 'untranslated'} ${hitCount ? 'has-hits' : ''} ${controlCharHit ? 'has-controls' : ''}`;
      const sourceCell = document.createElement('div');
      sourceCell.className = 'paired-cell source';
      sourceCell.setAttribute('tabindex', '0');
      sourceCell.textContent = entry.source || '—';
      const sourceClickSelect = () => {
        const current = state();
        current.currentEntryIndex = entry.localIndex;
        document.querySelectorAll('.paired-row.active').forEach((activeRow) => activeRow.classList.remove('active'));
        row.classList.add('active');
      };
      sourceCell.addEventListener('click', sourceClickSelect);
      sourceCell.addEventListener('mousedown', sourceClickSelect);
      sourceCell.addEventListener('mouseup', () => sourceCell.classList.add('selected'));
      sourceCell.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') sourceCell.classList.add('selected'); });
      const targetCell = document.createElement('textarea');
      targetCell.className = `paired-cell target ${translated ? '' : 'empty'}`.trim();
      targetCell.placeholder = entry.source || t('editor.targetPlaceholder');
      targetCell.value = entry.targetDraft || entry.target || '';
      targetCell.addEventListener('click', (e) => e.stopPropagation());
      targetCell.addEventListener('mousedown', (e) => e.stopPropagation());
      targetCell.addEventListener('keydown', (e) => e.stopPropagation());
      targetCell.addEventListener('input', () => {
        entry.targetDraft = targetCell.value;
        entry.target = targetCell.value;
        if (targetCell.value.trim() && entry.translationStatus !== 'pending') markTranslated(entry, true);
        row.classList.toggle('translated', isTranslated(entry));
        row.classList.toggle('untranslated', !isTranslated(entry));
        targetCell.classList.toggle('empty', !targetCell.value.trim());
        updateCounts();
      });
      targetCell.addEventListener('focus', () => {
        const current = state();
        current.currentEntryIndex = entry.localIndex;
        document.querySelectorAll('.paired-row.active').forEach((activeRow) => activeRow.classList.remove('active'));
        row.classList.add('active');
      });
      targetCell.addEventListener('blur', () => {
        entry.target = targetCell.value;
        entry.targetDraft = targetCell.value;
        renderCurrentEntry();
      });
      const aiBar = renderEntryAiAction(entry, targetCell);
      const meta = document.createElement('div');
      meta.className = 'paired-meta';
      const keyInfo = document.createElement('span');
      keyInfo.textContent = `#${String(entry.localIndex + 1).padStart(3, '0')} · ${entry.key}`;
      const tags = document.createElement('span');
      tags.className = 'row-tags';
      const statusBtn = document.createElement('button');
      statusBtn.type = 'button';
      statusBtn.className = `tag status-toggle ${translated ? 'success-tag' : 'pending-tag'}`;
      statusBtn.textContent = translated ? t('stats.translated') : '未翻译';
      statusBtn.title = '点击切换已翻译/未翻译状态';
      statusBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        markTranslated(entry, !isTranslated(entry));
        renderEntryList();
        renderCurrentEntry();
      });
      tags.appendChild(statusBtn);
      if (hitCount) {
        const hitTag = document.createElement('em');
        hitTag.className = 'tag hit-tag';
        hitTag.textContent = `${t('stats.hits')}: ${hitCount}`;
        tags.appendChild(hitTag);
      }
      if (controlCharHit) {
        const controlTag = document.createElement('em');
        controlTag.className = 'tag control-tag';
        controlTag.textContent = 'CTRL';
        tags.appendChild(controlTag);
      }
      meta.appendChild(keyInfo);
      meta.appendChild(tags);
      row.addEventListener('click', (e) => { if (e.target === targetCell || e.target === aiBar.querySelector('button') || e.target === sourceCell || e.target.closest?.('.glossary-inline') || e.target.closest?.('.status-toggle')) return; window.RpgAppStore?.setState?.({ currentEntryIndex: entry.localIndex }); renderEntryList(); renderCurrentEntry(); });
      row.appendChild(sourceCell);
      row.appendChild(targetCell);
      row.appendChild(aiBar);
      row.appendChild(meta);
      entryList.appendChild(row);
      renderGlossaryInline(row, entry, targetCell);
    });
  }

  function updateCounts() {
    const current = state();
    const entryCount = get('entryCount');
    const translatedCount = get('translatedCount');
    const glossaryHitCount = get('glossaryHitCount');
    const allEntries = (current.groupedFiles || []).flatMap((group) => group.items || []);
    const total = allEntries.length || (current.entries || []).length;
    const translated = allEntries.filter((item) => isTranslated(item)).length;
    if (entryCount) entryCount.textContent = String((current.groupedFiles || []).length);
    if (translatedCount) translatedCount.textContent = `${total}/${translated}`;
    if (glossaryHitCount) glossaryHitCount.textContent = String((current.entries || []).reduce((sum, item) => sum + ((item.glossaryHits || []).length), 0));
  }

  function renderCurrentEntry() {
    const entry = getCurrentEntry();
    if (!entry) { updateCounts(); return; }
    const current = state();
    entry.glossaryHits = (current.glossary?.terms || []).filter((term) => term.enabled !== false && term.source && entry.source.includes(term.source));
    updateCounts();
  }

  function clearAllTranslations() {
    const current = state();
    const allEntries = (current.groupedFiles || []).flatMap((group) => group.items || []);
    if (!allEntries.length) return;
    const ok = window.confirm(t('workspace.clearConfirm'));
    if (!ok) return;
    allEntries.forEach((entry) => {
      entry.target = '';
      entry.targetDraft = '';
      entry.translationStatus = 'pending';
      entry.draftStatus = 'pending';
    });
    window.RpgAppStore?.setState?.({ entries: allEntries });
    renderEntryList();
    renderCurrentEntry();
    window.traceCall?.('清空', `已清空 ${allEntries.length} 条译文`, 'success');
  }

  function syncListState({ entries = [], currentFile = '', currentEntryIndex = 0 } = {}) {
    const current = state();
    window.RpgAppStore?.setState?.({ entries, currentFile, currentEntryIndex, groupedFiles: current.groupedFiles || [] });
    renderEntryList();
    renderCurrentEntry();
  }

  function bindEntryActions() {
    const fileSelect = get('fileSelect');
    const entrySearch = get('entrySearch');
    const aiTranslateBtn = get('aiTranslateBtn');
    const saveEntryBtn = get('saveEntryBtn');
    const clearTextsBtn = get('clearTextsBtn');

    fileSelect?.addEventListener('change', () => { window.RpgAppStore?.setState?.({ currentFile: fileSelect.value, currentEntryIndex: 0 }); renderEntryList(); renderCurrentEntry(); });
    entrySearch?.addEventListener('input', () => { window.RpgAppStore?.setState?.({ searchText: entrySearch.value }); renderEntryList(); });
    if (aiTranslateBtn) aiTranslateBtn.addEventListener('click', async () => { const entry = getCurrentEntry(); if (!entry) return; window.showAiStatus?.(t('common.aiPending'), 'pending'); const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({ sourceText: entry.source, settings: window.RpgAppStore?.getState?.().aiSettings || {} }); if (result?.ok) { entry.target = result.translatedText || ''; entry.targetDraft = entry.target; renderEntryList(); renderCurrentEntry(); window.showAiStatus?.(result.message || `已使用 ${result.provider} 完成翻译。`, 'success'); } else { window.showAiStatus?.(result?.message || t('common.aiTestFail'), 'error'); } });
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', () => { const entry = getCurrentEntry(); if (!entry) return; entry.target = (entry.targetDraft || entry.target || '').trim(); entry.targetDraft = entry.target; renderEntryList(); renderCurrentEntry(); window.showToast?.(t('common.aiSaved'), 'success'); });
    clearTextsBtn?.addEventListener('click', () => clearAllTranslations());
  }

  window.RpgEntries = { getCurrentEntry, buildGroupedFiles, getExportEntries, renderFileSelect, getFilteredItems, renderEntryList, updateCounts, renderCurrentEntry, clearAllTranslations, syncListState, bindEntryActions };
})();
