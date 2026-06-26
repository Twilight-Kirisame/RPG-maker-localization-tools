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
      .map(([file, items]) => ({ file, items: items.map((item, index) => ({ ...item, localIndex: index, sourceDraft: '', targetDraft: item.targetDraft ?? item.target ?? '' })) }));
    const currentFile = current.currentFile || groupedFiles[0]?.file || '';
    window.RpgAppStore?.setState?.({
      ...current,
      groupedFiles,
      currentFile,
      currentEntryIndex: current.currentEntryIndex || 0,
      project: current.project || null,
      status: current.status || (current.project?.rootDir ? 'project-loaded' : 'idle'),
    });
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
    entry.progress = { ...(entry.progress || {}), translated, lastEditedAt: translated ? new Date().toISOString() : (entry.progress?.lastEditedAt || '') };
  }

  function persistLastPosition(entry) {
    const current = state();
    if (!entry || !current.project?.rootDir || !isTranslated(entry)) return Promise.resolve(null);
    const globalIndex = (current.groupedFiles || []).flatMap((group) => group.items || []).findIndex((item) => item.id === entry.id);
    const payload = { project: current.project, entry, index: entry.localIndex ?? globalIndex };
    const api = window.RpgAppController?.saveProjectLastPosition || window.rpgWorkbench?.saveProjectLastPosition;
    return api?.(payload).then((result) => {
      if (result?.state) {
        const progressState = result.state;
        window.RpgAppStore?.setState?.({ progressState, lastPosition: progressState.global || null });
        renderProgressDashboard();
        renderFileSelect();
      }
      return result;
    }).catch(() => null);
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
    const clientProgress = calculateClientProgress();
    const sourceProgress = (current.fileProgress && current.fileProgress.length ? current.fileProgress : clientProgress.fileProgress) || [];
    sourceProgress.forEach((file) => {
      const option = document.createElement('option');
      option.value = file.file;
      const percent = Number.isFinite(file.percent) ? `${file.percent}%` : '0%';
      const warnings = file.warningCount ? ` · ${t('progress.warning')} ${file.warningCount}` : '';
      option.textContent = `[${percent}] ${file.file} (${file.translated || 0}/${file.total || 0})${warnings}`;
      fileSelect.appendChild(option);
    });
    if (!sourceProgress.length) fileSelect.innerHTML = `<option value="">${t('common.none')}</option>`;
    if (current.currentFile) fileSelect.value = current.currentFile;
  }

  function getSearchScope() {
    return get('entrySearchScope')?.value || state().searchScope || 'current';
  }

  function matchesSearch(entry, q) {
    if (!q) return true;
    const haystack = `${entry.key || ''} ${entry.source || ''} ${entry.targetDraft || entry.target || ''} ${entry.file || ''} ${entry.textType || ''} ${entry.textClass || ''}`.toLowerCase();
    return haystack.includes(q);
  }

  function getFilteredItems() {
    const current = state();
    const q = (current.searchText || '').trim().toLowerCase();
    const scope = getSearchScope();
    const groups = current.groupedFiles || [];
    if (scope === 'all') {
      return groups.flatMap((group) => (group.items || []).filter((entry) => matchesSearch(entry, q)).map((entry) => ({ ...entry, _searchScope: 'all' })));
    }
    const group = groups.find((g) => g.file === current.currentFile);
    if (!group) return [];
    return group.items.filter((entry) => matchesSearch(entry, q));
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

  function runEntryAction(label, task, statusId = 'aiStatus') {
    return window.runUiAction?.(label, task, { pending: `${label}中…`, success: `${label}完成`, error: `${label}失败`, statusId, traceTitle: label });
  }

  function renderEntryAiAction(entry, targetCell) {
    const bar = document.createElement('div');
    bar.className = 'paired-ai-bar';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'secondary-btn paired-ai-btn';
    btn.textContent = t('entry.aiTranslate');
    btn.title = t('entry.aiTranslateTitle');
    btn.addEventListener('click', async (event) => {
      event.stopPropagation();
      await runEntryAction(t('entry.aiTranslate'), async () => {
        window.RpgAppStore?.setState?.({ ...window.RpgAppStore?.getState?.(), currentEntryIndex: entry.localIndex });
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
        if (!result?.ok) throw new Error(result?.message || t('common.aiTestFail'));
        entry.target = result.translatedText || '';
        entry.targetDraft = entry.target;
        targetCell.value = entry.target;
        targetCell.classList.toggle('empty', !targetCell.value.trim());
        await persistLastPosition(entry);
        renderEntryList();
        renderCurrentEntry();
        return result;
      });
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
    title.textContent = t('glossary.hitCount').replace('{count}', hits.length);
    container.appendChild(title);
    const controls = document.createElement('div');
    controls.className = 'glossary-inline-controls';
    const modeLabel = document.createElement('label');
    modeLabel.className = 'glossary-insert-mode-label';
    modeLabel.appendChild(document.createTextNode(t('glossary.insertMode')));
    const modeSelect = document.createElement('select');
    modeSelect.className = 'glossary-insert-mode';
    modeSelect.innerHTML = `<option value="cursor">${t('glossary.insertCursor')}</option><option value="replace">${t('glossary.insertReplace')}</option><option value="append">${t('glossary.insertAppend')}</option>`;
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
    allBtn.textContent = t('glossary.insertAll');
    allBtn.addEventListener('click', () => {
      runEntryAction(t('glossary.insertAll'), async () => {
        insertAllGlossaryHits(entry, targetCell, modeSelect.value);
        window.showAiStatus?.(t('glossary.insertAllDone').replace('{count}', hits.length), 'success');
      });
    });
    actions.appendChild(allBtn);
    hits.forEach((term) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'glossary-inline-btn';
      item.textContent = t('glossary.insertOne').replace('{source}', term.source).replace('{target}', term.target);
      item.addEventListener('click', () => {
        runEntryAction(t('glossary.insertOne'), async () => {
          const next = insertTextIntoTarget(targetCell, term.target || '', modeSelect.value);
          entry.targetDraft = next;
          entry.target = next;
          window.showAiStatus?.(t('glossary.insertOneDone').replace('{source}', term.source), 'success');
          renderEntryList();
          renderCurrentEntry();
        });
      });
      actions.appendChild(item);
    });
    container.appendChild(actions);
  }

  function getContextGroupSelectionKey(entry) {
    return `${entry.file || ''}::${entry.id || entry.localIndex || ''}`;
  }

  function getContextGroupSelection() {
    const current = state();
    return new Set(Array.isArray(current.contextGroupSelection) ? current.contextGroupSelection : []);
  }

  function updateContextGroupSelection(nextSelection) {
    const current = state();
    window.RpgAppStore?.setState?.({ ...current, contextGroupSelection: [...nextSelection] });
  }

  function normalizeSplitPositions(positions, maxSplitCount) {
    const sorted = [...new Set((positions || []).map((item) => Math.max(1, Math.min(99, Number(item) || 0))))]
      .sort((a, b) => a - b)
      .slice(0, Math.max(0, maxSplitCount));
    return sorted.map((value, index) => {
      const min = index === 0 ? 1 : sorted[index - 1] + 1;
      const max = index === sorted.length - 1 ? 99 : sorted[index + 1] - 1;
      return Math.max(min, Math.min(max, value));
    });
  }

  function splitGroupTranslation(text, count, positions = []) {
    const value = String(text || '').trim();
    if (!count) return [];
    if (!value) return Array.from({ length: count }, () => '');

    // 优先按 ---SPLIT--- 标记拆分
    if (value.includes('---SPLIT---')) {
      const segments = value.split('---SPLIT---').map(s => s.trim());
      while (segments.length < count) segments.push('');
      return segments.slice(0, count);
    }

    // 其次按换行拆分
    if (value.includes('\n')) {
      const segments = value.split('\n').map(s => s.trim()).filter(s => s);
      while (segments.length < count) segments.push('');
      return segments.slice(0, count);
    }

    // 最后按百分比位置拆分
    const splitPositions = normalizeSplitPositions(positions, count - 1);
    if (!splitPositions.length) return [value, ...Array.from({ length: count - 1 }, () => '')];
    const cuts = splitPositions.map((percent) => Math.round((value.length * percent) / 100));
    const result = [];
    let start = 0;
    cuts.forEach((cut) => {
      result.push(value.slice(start, cut).trim());
      start = cut;
    });
    result.push(value.slice(start).trim());
    while (result.length < count) result.push('');
    return result.slice(0, count);
  }

  function applyContextGroupTranslation(entries, targetValue, { splitLines = false, splitPositions = [] } = {}) {
    const nextValues = splitLines ? splitGroupTranslation(targetValue, entries.length, splitPositions) : entries.map(() => targetValue);
    entries.forEach((entry, index) => {
      const next = nextValues[index] ?? '';
      entry.target = next;
      entry.targetDraft = next;
      markTranslated(entry, Boolean(String(next || '').trim()));
    });
    renderEntryList();
    renderCurrentEntry();
    updateCounts();
  }

  function renderGroupMode() {
    const entryList = get('entryList');
    const items = getFilteredItems();
    const selection = getContextGroupSelection();
    const selectedEntries = items.filter((entry) => selection.has(getContextGroupSelectionKey(entry)));
    const panel = document.createElement('div');
    panel.className = 'context-group-panel';

    const summary = document.createElement('div');
    summary.className = 'status-box context-group-summary';
    summary.textContent = selectedEntries.length
      ? `${t('context.groupMode')} · ${selectedEntries.length} ${t('common.item')} · ${selectedEntries.map((entry) => entry.key).join(' / ')}`
      : t('context.noGroups');
    panel.appendChild(summary);

    if (selectedEntries.length) {
      const sourceBlock = document.createElement('div');
      sourceBlock.className = 'context-group-source-block';
      sourceBlock.textContent = selectedEntries.map((entry) => entry.source || '—').join('\n\n');
      const targetCell = document.createElement('textarea');
      targetCell.className = 'paired-cell target context-group-target';
      targetCell.placeholder = t('context.groupTargetPlaceholder') || '输入该上下文组的整体译文';
      const sharedTarget = selectedEntries[0]?.targetDraft || selectedEntries[0]?.target || '';
      targetCell.value = sharedTarget;

      // 译文预览区域（可视化分行）
      const previewContainer = document.createElement('div');
      previewContainer.className = 'context-group-preview-container';

      const previewLabel = document.createElement('div');
      previewLabel.className = 'context-group-preview-label';
      previewLabel.textContent = t('context.groupPreviewLabel') || '译文预览（点击行间插入分行标记）';

      const previewLines = document.createElement('div');
      previewLines.className = 'context-group-preview-lines';

      // 渲染预览行的函数
      function renderPreviewLines() {
        previewLines.innerHTML = '';
        const textValue = targetCell.value || '';
        const segments = textValue.split('---SPLIT---');

        segments.forEach((segment, index) => {
          const lineRow = document.createElement('div');
          lineRow.className = 'preview-line-row';

          const lineContent = document.createElement('div');
          lineContent.className = 'preview-line-content';
          lineContent.textContent = segment.trim() || '（空行）';

          lineRow.appendChild(lineContent);
          previewLines.appendChild(lineRow);

          // 在行之间添加分隔条（可点击插入/删除分行标记）
          if (index < segments.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator active';
            separator.title = '点击移除分行标记';
            separator.addEventListener('click', () => {
              // 删除这个位置的 ---SPLIT---
              const parts = targetCell.value.split('---SPLIT---');
              parts.splice(index + 1, 1); // 删除下一个元素
              targetCell.value = parts.join('---SPLIT---');
              renderPreviewLines();
            });
            previewLines.appendChild(separator);
          } else if (index === segments.length - 1 && segments.length < selectedEntries.length) {
            // 最后一行后，如果还需要更多分段，显示可点击的分隔条
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator';
            separator.title = '点击插入分行标记';
            separator.addEventListener('click', () => {
              // 在末尾插入 ---SPLIT---
              targetCell.value = targetCell.value + '---SPLIT---';
              renderPreviewLines();
            });
            previewLines.appendChild(separator);
          }
        });

        // 如果分段数不足，继续添加可点击的分隔区
        for (let i = segments.length; i < selectedEntries.length; i++) {
          const lineRow = document.createElement('div');
          lineRow.className = 'preview-line-row empty';

          const lineContent = document.createElement('div');
          lineContent.className = 'preview-line-content';
          lineContent.textContent = '（空行）';

          lineRow.appendChild(lineContent);
          previewLines.appendChild(lineRow);

          if (i < selectedEntries.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator';
            separator.title = '点击插入分行标记';
            separator.addEventListener('click', () => {
              targetCell.value = targetCell.value + '---SPLIT---';
              renderPreviewLines();
            });
            previewLines.appendChild(separator);
          }
        }
      }

      // 监听textarea输入，实时更新预览
      targetCell.addEventListener('input', () => {
        renderPreviewLines();
      });

      renderPreviewLines();

      previewContainer.appendChild(previewLabel);
      previewContainer.appendChild(previewLines);

      const splitHint = document.createElement('div');
      splitHint.className = 'settings-hint context-group-split-hint';
      splitHint.textContent = t('context.groupSplitHint');
      const actions = document.createElement('div');
      actions.className = 'inline-actions context-group-actions';
      const aiBtn = document.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'secondary-btn paired-ai-btn';
      aiBtn.textContent = t('entry.aiTranslate');
      aiBtn.title = t('entry.aiTranslateTitle');
      aiBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await runEntryAction(t('entry.aiTranslate'), async () => {
          const current = state();
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
          const groupSourceText = selectedEntries.map((entry) => entry.source || '').join('\n');
          window.traceCall?.('编组翻译', `使用 ${selectedProvider} 翻译编组：${selectedEntries.length} 条`, 'pending');
          const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({
            sourceText: groupSourceText,
            settings,
          });
          if (!result?.ok) throw new Error(result?.message || t('common.aiTestFail'));
          targetCell.value = result.translatedText || '';
          renderPreviewLines();
          window.showAiStatus?.(result.message || `已使用 ${result.provider} 完成编组翻译。`, 'success');
          return result;
        });
      });
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'primary-btn';
      applyBtn.textContent = t('context.groupApply') || '应用到所选';
      applyBtn.addEventListener('click', () => applyContextGroupTranslation(selectedEntries, targetCell.value, { splitLines: true }));
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'secondary-btn';
      clearBtn.textContent = t('context.groupClear') || '清空选择';
      clearBtn.addEventListener('click', () => updateContextGroupSelection(new Set()));
      actions.appendChild(aiBtn);
      actions.appendChild(applyBtn);
      actions.appendChild(clearBtn);
      panel.appendChild(sourceBlock);
      panel.appendChild(targetCell);
      panel.appendChild(previewContainer);
      panel.appendChild(actions);
    }

    const list = document.createElement('div');
    list.className = 'context-group-entry-list';
    if (!items.length) {
      list.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
    } else {
      items.forEach((entry) => {
        const row = document.createElement('div');
        row.className = `paired-row context-group-select-row ${selection.has(getContextGroupSelectionKey(entry)) ? 'selected' : ''}`;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selection.has(getContextGroupSelectionKey(entry));
        checkbox.addEventListener('change', () => {
          const next = getContextGroupSelection();
          const key = getContextGroupSelectionKey(entry);
          if (checkbox.checked) next.add(key); else next.delete(key);
          updateContextGroupSelection(next);
          renderEntryList();
        });
        const sourceCell = document.createElement('label');
        sourceCell.className = 'paired-cell source context-group-source';
        sourceCell.appendChild(checkbox);
        const text = document.createElement('span');
        text.textContent = entry.source || '—';
        sourceCell.appendChild(text);
        const meta = document.createElement('div');
        meta.className = 'paired-meta';
        meta.textContent = `#${String(entry.localIndex + 1).padStart(3, '0')} · ${entry.key}`;
        row.appendChild(sourceCell);
        row.appendChild(meta);
        list.appendChild(row);
      });
    }
    panel.appendChild(list);
    entryList.appendChild(panel);
  }

  function renderEntryList() {
    const entryList = get('entryList');
    if (!entryList) return;
    entryList.innerHTML = '';
    const currentMode = state().entryViewMode || 'single';
    if (currentMode === 'group') { renderGroupMode(); return; }
    const items = getFilteredItems();
    if (!items.length) {
      entryList.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
      return;
    }
    items.forEach((entry) => {
      const current = state();
      const sourceEntry = entry._searchScope === 'all' ? (current.groupedFiles || []).flatMap((group) => group.items || []).find((item) => item.id === entry.id) || entry : entry;
      sourceEntry.glossaryHits = (current.glossary?.terms || []).filter((term) => term.enabled !== false && term.source && sourceEntry.source.includes(term.source));
      const row = document.createElement('div');
      const translated = isTranslated(sourceEntry);
      const hitCount = (sourceEntry.glossaryHits || []).length;
      const controlCharHit = /\\[VNCP]\[\d+\]/.test(sourceEntry.source || '');
      row.className = `paired-row ${sourceEntry.localIndex === current.currentEntryIndex && sourceEntry.file === current.currentFile ? 'active' : ''} ${translated ? 'translated' : 'untranslated'} ${hitCount ? 'has-hits' : ''} ${controlCharHit ? 'has-controls' : ''}`;
      const sourceCell = document.createElement('div');
      sourceCell.className = 'paired-cell source';
      sourceCell.setAttribute('tabindex', '0');
      const fallbackSource = String(sourceEntry.source || '').trim();
      sourceCell.textContent = fallbackSource || t('common.none');
      const sourceClickSelect = () => {
        const current = state();
        window.RpgAppStore?.setState?.({
          ...current,
          currentFile: sourceEntry.file,
          currentEntryIndex: sourceEntry.localIndex,
          searchScope: sourceEntry._searchScope === 'all' ? 'all' : (current.searchScope || 'current'),
          project: current.project || null,
          status: current.status || (current.project?.rootDir ? 'project-loaded' : 'idle'),
        });
        document.querySelectorAll('.paired-row.active').forEach((activeRow) => activeRow.classList.remove('active'));
        row.classList.add('active');
      };
      sourceCell.addEventListener('click', sourceClickSelect);
      sourceCell.addEventListener('mouseup', () => sourceCell.classList.add('selected'));
      sourceCell.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') sourceCell.classList.add('selected'); });
      const targetCell = document.createElement('textarea');
      targetCell.className = `paired-cell target ${translated ? '' : 'empty'}`.trim();
      targetCell.placeholder = sourceEntry.source || t('editor.targetPlaceholder');
      targetCell.value = sourceEntry.targetDraft || sourceEntry.target || '';
      targetCell.addEventListener('click', (e) => e.stopPropagation());
      targetCell.addEventListener('mousedown', (e) => e.stopPropagation());
      targetCell.addEventListener('keydown', (e) => e.stopPropagation());
      targetCell.addEventListener('input', () => {
        sourceEntry.targetDraft = targetCell.value;
        sourceEntry.target = targetCell.value;
        markTranslated(sourceEntry, Boolean(targetCell.value.trim()));
        row.classList.toggle('translated', isTranslated(sourceEntry));
        row.classList.toggle('untranslated', !isTranslated(sourceEntry));
        targetCell.classList.toggle('empty', !targetCell.value.trim());
        updateCounts();
      });
      targetCell.addEventListener('focus', () => targetCell.classList.remove('selected'));
      targetCell.addEventListener('blur', () => targetCell.classList.remove('selected'));
      targetCell.addEventListener('focus', () => {
        document.querySelectorAll('.paired-row.active').forEach((activeRow) => activeRow.classList.remove('active'));
        row.classList.add('active');
      });
      targetCell.addEventListener('blur', async () => {
        sourceEntry.target = targetCell.value;
        sourceEntry.targetDraft = targetCell.value;
      });
      const aiBar = renderEntryAiAction(sourceEntry, targetCell);
      const meta = document.createElement('div');
      meta.className = 'paired-meta';
      const keyInfo = document.createElement('span');
      keyInfo.textContent = `${sourceEntry._searchScope === 'all' ? '[ALL] ' : ''}#${String(sourceEntry.localIndex + 1).padStart(3, '0')} · ${sourceEntry.key}`;
      const tags = document.createElement('span');
      tags.className = 'row-tags';
      const statusBtn = document.createElement('button');
      statusBtn.type = 'button';
      statusBtn.className = `tag status-toggle ${translated ? 'success-tag' : 'pending-tag'}`;
      statusBtn.textContent = translated ? t('stats.translated') : t('progress.pending');
      statusBtn.title = t('progress.toggleStatus');
      statusBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const nextTranslated = !isTranslated(sourceEntry);
        markTranslated(sourceEntry, nextTranslated);
        if (sourceEntry !== entry) markTranslated(entry, nextTranslated);
        row.classList.toggle('translated', nextTranslated);
        row.classList.toggle('untranslated', !nextTranslated);
        statusBtn.classList.toggle('success-tag', nextTranslated);
        statusBtn.classList.toggle('pending-tag', !nextTranslated);
        statusBtn.textContent = nextTranslated ? t('stats.translated') : t('progress.pending');
        updateCounts();
      });
      tags.appendChild(statusBtn);
      const classTag = document.createElement('em');
      classTag.className = 'tag class-tag';
      classTag.textContent = t(`textClass.${sourceEntry.textClass || 'unknown'}`);
      tags.appendChild(classTag);
      const typeTag = document.createElement('em');
      typeTag.className = 'tag type-tag';
      typeTag.textContent = t(`textType.${sourceEntry.textType || 'generic-text'}`);
      tags.appendChild(typeTag);
      if (sourceEntry.groupId) {
        const groupTag = document.createElement('em');
        groupTag.className = 'tag group-tag';
        groupTag.textContent = `${t('context.groupShort')}: ${sourceEntry.groupId.slice(0, 10)}`;
        groupTag.title = sourceEntry.groupId;
        tags.appendChild(groupTag);
      }
      const warnings = Array.isArray(sourceEntry.warnings) ? sourceEntry.warnings : [];
      if (warnings.length) {
        const warningTag = document.createElement('em');
        warningTag.className = 'tag warning-tag';
        warningTag.textContent = `${t('progress.warning')}: ${warnings.length}`;
        warningTag.title = warnings.map((warning) => warning.message || warning.type || '').filter(Boolean).join('\n');
        tags.appendChild(warningTag);
      }
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
      row.addEventListener('click', (e) => { if (e.target === targetCell || e.target === aiBar.querySelector('button') || e.target === sourceCell || e.target.closest?.('.glossary-inline') || e.target.closest?.('.status-toggle')) return; const current = state(); window.RpgAppStore?.setState?.({ ...current, currentFile: sourceEntry.file, currentEntryIndex: sourceEntry.localIndex, searchScope: sourceEntry._searchScope === 'all' ? 'all' : (current.searchScope || 'current'), project: current.project || null, status: current.status || (current.project?.rootDir ? 'project-loaded' : 'idle') }); renderEntryList(); renderCurrentEntry(); });
      row.appendChild(sourceCell);
      row.appendChild(targetCell);
      row.appendChild(aiBar);
      row.appendChild(meta);
      entryList.appendChild(row);
      renderGlossaryInline(row, entry, targetCell);
    });
  }

  function calculateClientProgress() {
    const current = state();
    const allEntries = (current.groupedFiles || []).flatMap((group) => group.items || []);
    const fileProgress = (current.groupedFiles || []).map((group) => {
      const total = group.items.length;
      const translated = group.items.filter((entry) => isTranslated(entry)).length;
      const warningCount = group.items.reduce((sum, entry) => sum + (Array.isArray(entry.warnings) ? entry.warnings.length : 0), 0);
      return { file: group.file, total, translated, pending: total - translated, warningCount, percent: total ? Number(((translated / total) * 100).toFixed(2)) : 0 };
    });
    const total = allEntries.length;
    const translated = allEntries.filter((entry) => isTranslated(entry)).length;
    const globalProgress = { totalEntries: total, translatedEntries: translated, pendingEntries: total - translated, percent: total ? Number(((translated / total) * 100).toFixed(2)) : 0 };
    return { allEntries, fileProgress, globalProgress };
  }

  function renderProgressDashboard() {
    const current = state();
    const { allEntries, fileProgress, globalProgress } = calculateClientProgress();
    const file = fileProgress.find((item) => item.file === current.currentFile) || { total: 0, translated: 0, pending: 0, percent: 0 };
    const globalText = get('globalProgressText');
    const currentFileText = get('currentFileProgressText');
    const lastPositionText = get('lastPositionText');
    const nextPendingText = get('nextPendingText');
    if (globalText) globalText.textContent = t('progress.summary').replace('{translated}', globalProgress.translatedEntries).replace('{total}', globalProgress.totalEntries).replace('{percent}', globalProgress.percent);
    if (currentFileText) currentFileText.textContent = t('progress.summary').replace('{translated}', file.translated || 0).replace('{total}', file.total || 0).replace('{percent}', file.percent || 0);
    const last = current.progressState?.global || current.lastPosition || {};
    if (lastPositionText) {
      lastPositionText.textContent = last.lastTranslatedFile ? `${last.lastTranslatedFile} · #${Number(last.lastTranslatedIndex ?? -1) + 1} · ${last.lastTranslatedKey || ''}` : t('progress.noLastPosition');
      lastPositionText.title = [last.lastTranslatedSource, last.lastTranslatedTarget].filter(Boolean).join('\n');
    }
    const currentFileEntries = allEntries.filter((entry) => entry.file === current.currentFile);
    const nextIndex = currentFileEntries.findIndex((entry, index) => index >= (current.currentEntryIndex || 0) && !isTranslated(entry));
    if (nextPendingText) nextPendingText.textContent = nextIndex >= 0 ? `${t('progress.nextPending')}: #${String(nextIndex + 1).padStart(3, '0')}` : t('progress.noPending');
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
    renderProgressDashboard();
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
    const entrySearchScope = get('entrySearchScope');
    const aiTranslateBtn = get('aiTranslateBtn');
    const saveEntryBtn = get('saveEntryBtn');
    const clearTextsBtn = get('clearTextsBtn');

    fileSelect?.addEventListener('change', () => {
      const current = state();
      window.RpgAppStore?.setState?.({
        ...current,
        currentFile: fileSelect.value,
        currentEntryIndex: 0,
        project: current.project || null,
        status: current.status || 'project-loaded',
      });
      renderEntryList();
      renderCurrentEntry();
    });
    entrySearch?.addEventListener('input', () => { window.RpgAppStore?.setState?.({ searchText: entrySearch.value }); renderEntryList(); });
    entrySearchScope?.addEventListener('change', () => { window.RpgAppStore?.setState?.({ searchScope: entrySearchScope.value }); renderEntryList(); });
    get('singleEntryModeBtn')?.addEventListener('click', () => { window.RpgAppStore?.setState?.({ entryViewMode: 'single' }); get('singleEntryModeBtn')?.classList.add('active'); get('contextGroupModeBtn')?.classList.remove('active'); renderEntryList(); });
    get('contextGroupModeBtn')?.addEventListener('click', () => { window.RpgAppStore?.setState?.({ entryViewMode: 'group' }); get('contextGroupModeBtn')?.classList.add('active'); get('singleEntryModeBtn')?.classList.remove('active'); renderEntryList(); });
    get('gotoLastPositionBtn')?.addEventListener('click', () => {
      const current = state();
      const last = current.progressState?.global || current.lastPosition || {};
      if (!last.lastTranslatedFile) return;
      const group = (current.groupedFiles || []).find((item) => item.file === last.lastTranslatedFile);
      const fallbackIndex = Math.max(0, Number(last.lastTranslatedIndex || 0));
      const matchedIndex = group?.items?.findIndex((entry) => entry.id === last.lastTranslatedEntryId) ?? -1;
      window.RpgAppStore?.setState?.({ currentFile: last.lastTranslatedFile, currentEntryIndex: matchedIndex >= 0 ? matchedIndex : fallbackIndex });
      renderFileSelect();
      renderEntryList();
      renderCurrentEntry();
    });
    get('nextPendingBtn')?.addEventListener('click', () => {
      const current = state();
      const group = (current.groupedFiles || []).find((item) => item.file === current.currentFile);
      if (!group) return;
      const start = Math.max(0, Number(current.currentEntryIndex || 0) + 1);
      let nextIndex = group.items.findIndex((entry, index) => index >= start && !isTranslated(entry));
      if (nextIndex < 0) nextIndex = group.items.findIndex((entry) => !isTranslated(entry));
      if (nextIndex < 0) return;
      window.RpgAppStore?.setState?.({ currentEntryIndex: nextIndex });
      renderEntryList();
      renderCurrentEntry();
    });
    if (aiTranslateBtn) aiTranslateBtn.addEventListener('click', async () => { const entry = getCurrentEntry(); if (!entry) return; window.showAiStatus?.(t('common.aiPending'), 'pending'); const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({ sourceText: entry.source, settings: window.RpgAppStore?.getState?.().aiSettings || {} }); if (result?.ok) { entry.target = result.translatedText || ''; entry.targetDraft = entry.target; renderEntryList(); renderCurrentEntry(); window.showAiStatus?.(result.message || `已使用 ${result.provider} 完成翻译。`, 'success'); } else { window.showAiStatus?.(result?.message || t('common.aiTestFail'), 'error'); } });
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', async () => {
      const entry = getCurrentEntry();
      if (!entry) return;
      return runEntryAction(t('settings.save'), async () => {
        entry.target = (entry.targetDraft || entry.target || '').trim();
        entry.targetDraft = entry.target;
        renderEntryList();
        renderCurrentEntry();
        await persistLastPosition(entry);
        window.showToast?.(t('common.aiSaved'), 'success');
      }, 'projectStatus');
    });
    clearTextsBtn?.addEventListener('click', () => clearAllTranslations());
  }

  window.RpgEntries = { getCurrentEntry, buildGroupedFiles, getExportEntries, renderFileSelect, getFilteredItems, renderEntryList, updateCounts, renderCurrentEntry, clearAllTranslations, syncListState, bindEntryActions };
})();
