(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;

  // 与主进程 EngineConstraints.js 保持同步。每按键校验，不走 IPC。
  const ENGINE_CONSTRAINTS = {
    'RPG Maker MV/MZ': {
      dialogueLine: { maxCharsPerLine: 28, maxLines: 4, preserveControlCodes: true },
      choice: { maxCharsPerLine: 16, maxLines: 1, preserveControlCodes: true },
      'choice-branch': { maxCharsPerLine: 16, maxLines: 1, preserveControlCodes: true },
      speaker: { maxCharsPerLine: 12, maxLines: 1, preserveControlCodes: false },
      system: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
      default: { maxCharsPerLine: 0, maxLines: 0, preserveControlCodes: false },
    },
  };
  const KIND_KEY = { 'dialogue-line': 'dialogueLine', choice: 'choice', 'choice-branch': 'choice-branch', speaker: 'speaker' };
  const CTRL_RE = /\\[A-Za-z]+(?:\[[^\]]*\])?/g;
  function getConstraints(engine, kind) {
    const table = ENGINE_CONSTRAINTS[engine] || ENGINE_CONSTRAINTS['RPG Maker MV/MZ'];
    const key = KIND_KEY[kind] || kind;
    return table[key] || (String(kind || '').startsWith('system') ? table.system : null) || table.default;
  }
  function validateLocal(entry, engine) {
    const warnings = [];
    if (!entry) return warnings;
    const target = String(entry.target ?? '');
    if (!target.trim()) return warnings;
    const c = getConstraints(engine || 'RPG Maker MV/MZ', entry.kind);
    if (!c) return warnings;
    const lines = target.split(/\r?\n/);
    if (c.maxLines > 0 && lines.length > c.maxLines) warnings.push({ code: 'too-many-lines', message: `${lines.length}/${c.maxLines} 行`, actual: lines.length, max: c.maxLines });
    if (c.maxCharsPerLine > 0) {
      lines.forEach((line, idx) => {
        if (line.length > c.maxCharsPerLine) warnings.push({ code: 'line-too-long', message: `第${idx + 1}行${line.length}/${c.maxCharsPerLine}字`, line: idx + 1, length: line.length, max: c.maxCharsPerLine });
      });
    }
    if (c.preserveControlCodes) {
      const src = String(entry.source || '').match(CTRL_RE) || [];
      const dst = new Set(target.match(CTRL_RE) || []);
      const missing = src.filter((code) => !dst.has(code));
      if (missing.length) warnings.push({ code: 'control-char-missing', message: `缺控制码 ${missing.join(' ')}`, missing });
    }
    return warnings;
  }
  function getProjectEngine() {
    return state().project?.engine || 'RPG Maker MV/MZ';
  }

  function renderWarningTags(tagsEl, warnings) {
    if (!tagsEl) return;
    tagsEl.querySelectorAll('.warning-tag').forEach((el) => el.remove());
    (warnings || []).forEach((w) => {
      const tag = document.createElement('em');
      tag.className = `tag warning-tag warning-${w.code || 'unknown'}`;
      tag.textContent = w.message || w.code || '警告';
      tag.title = w.message || '';
      tagsEl.appendChild(tag);
    });
  }

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
    const prevValue = fileSelect.value || current.currentFile || '';
    fileSelect.innerHTML = '';
    (current.groupedFiles || []).forEach((group) => {
      const items = group.items || [];
      const total = items.length;
      const translated = items.filter((item) => isTranslated(item)).length;
      const percent = total ? Math.round((translated / total) * 100) : 0;
      const option = document.createElement('option');
      option.value = group.file;
      option.textContent = `${group.file}  (${translated}/${total} · ${percent}%)`;
      option.dataset.percent = String(percent);
      if (percent === 100) option.dataset.status = 'done';
      else if (percent > 0) option.dataset.status = 'partial';
      else option.dataset.status = 'pending';
      fileSelect.appendChild(option);
    });
    if (!(current.groupedFiles || []).length) fileSelect.innerHTML = `<option value="">${t('common.none')}</option>`;
    if (prevValue) fileSelect.value = prevValue;
    // 当前文件徽标（如果 HTML 里挂了 #currentFileProgressBadge 占位就更新它，没挂也无害）
    const badge = get('currentFileProgressBadge');
    if (badge) {
      const cur = (current.groupedFiles || []).find((g) => g.file === fileSelect.value);
      if (cur) {
        const total = (cur.items || []).length;
        const done = (cur.items || []).filter(isTranslated).length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        badge.textContent = `${done}/${total} · ${pct}%`;
        badge.dataset.status = pct === 100 ? 'done' : pct > 0 ? 'partial' : 'pending';
      } else {
        badge.textContent = '';
      }
    }
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
          glossary: current.glossary || null,
          project: current.project || null,
          entry: { file: entry.file, key: entry.key, kind: entry.kind, code: entry.code, path: entry.path },
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

  // ===== 上下文行模式（多行合并翻译） =====

  function getContextGroupSelectionKey(entry) {
    return `${entry.file || ''}::${entry.id || entry.localIndex || ''}`;
  }

  function getContextGroupSelection() {
    const current = state();
    return new Set(Array.isArray(current.contextGroupSelection) ? current.contextGroupSelection : []);
  }

  function updateContextGroupSelection(nextSelection) {
    window.RpgAppStore?.setState?.({ contextGroupSelection: [...nextSelection] });
  }

  // 上下文组分隔符：用 \N（两字符）作为快捷标记。
  //   - 正则负向预查 (?!\[) 是为了让 \N[1]（RPG Maker 角色名引用）不会被误切
  //   - 旧草稿里的 ---SPLIT--- 仍向后兼容
  const SPLIT_MARKER = '\\N';
  const SPLIT_RE = /\\N(?!\[)/g;
  const LEGACY_SPLIT_MARKER = '---SPLIT---';

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

  /**
   * 把任意分隔符标记统一归一化为 \N，方便后续 split。
   * 兼容旧草稿的 ---SPLIT---。
   */
  function normalizeSplitMarkers(value) {
    return String(value || '').split(LEGACY_SPLIT_MARKER).join(SPLIT_MARKER);
  }

  function splitGroupTranslation(text, count, positions = []) {
    const value = normalizeSplitMarkers(String(text || '').trim());
    if (!count) return [];
    if (!value) return Array.from({ length: count }, () => '');
    if (SPLIT_RE.test(value)) {
      SPLIT_RE.lastIndex = 0;
      const segments = value.split(SPLIT_RE).map((s) => s.trim());
      while (segments.length < count) segments.push('');
      return segments.slice(0, count);
    }
    if (value.includes('\n')) {
      const segments = value.split('\n').map((s) => s.trim()).filter((s) => s);
      while (segments.length < count) segments.push('');
      return segments.slice(0, count);
    }
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
    if (!entryList) return;
    const items = getFilteredItems();
    const selection = getContextGroupSelection();
    const selectedEntries = items.filter((entry) => selection.has(getContextGroupSelectionKey(entry)));
    const panel = document.createElement('div');
    panel.className = 'context-group-panel';

    const summary = document.createElement('div');
    summary.className = 'status-box context-group-summary';
    summary.textContent = selectedEntries.length
      ? `上下文组 · ${selectedEntries.length} 条 · ${selectedEntries.map((entry) => entry.key).join(' / ')}`
      : '勾选下方条目组成上下文组，可整体翻译并按 \\N 标记自动拆回各行。';
    panel.appendChild(summary);

    if (selectedEntries.length) {
      const sourceBlock = document.createElement('div');
      sourceBlock.className = 'context-group-source-block';
      sourceBlock.textContent = selectedEntries.map((entry) => entry.source || '—').join('\n\n');

      const targetCell = document.createElement('textarea');
      targetCell.className = 'paired-cell target context-group-target';
      targetCell.placeholder = '输入该上下文组的整体译文，使用 \\N 快速分行';
      const sharedTarget = selectedEntries[0]?.targetDraft || selectedEntries[0]?.target || '';
      targetCell.value = sharedTarget;

      const previewContainer = document.createElement('div');
      previewContainer.className = 'context-group-preview-container';
      const previewLabel = document.createElement('div');
      previewLabel.className = 'context-group-preview-label';
      previewLabel.textContent = '译文预览（点击行间分隔条插入 / 移除 \\N 分行标记；可直接在上方输入 \\N）';
      const previewLines = document.createElement('div');
      previewLines.className = 'context-group-preview-lines';

      function renderPreviewLines() {
        previewLines.innerHTML = '';
        const textValue = normalizeSplitMarkers(targetCell.value || '');
        const segments = textValue.split(SPLIT_RE);
        segments.forEach((segment, index) => {
          const lineRow = document.createElement('div');
          lineRow.className = 'preview-line-row';
          const lineContent = document.createElement('div');
          lineContent.className = 'preview-line-content';
          lineContent.textContent = segment.trim() || '（空行）';
          lineRow.appendChild(lineContent);
          previewLines.appendChild(lineRow);

          if (index < segments.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator active';
            separator.title = '点击移除 \\N 分行标记';
            separator.addEventListener('click', () => {
              // 同时兼容删除旧 ---SPLIT--- 与新 \N：先归一化再按 \N 切分、删除第 index+1 段、再用 \N 重组
              const normalized = normalizeSplitMarkers(targetCell.value || '');
              const parts = normalized.split(SPLIT_RE);
              parts.splice(index + 1, 1);
              targetCell.value = parts.join(SPLIT_MARKER);
              renderPreviewLines();
            });
            previewLines.appendChild(separator);
          } else if (index === segments.length - 1 && segments.length < selectedEntries.length) {
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator';
            separator.title = '点击插入 \\N 分行标记';
            separator.addEventListener('click', () => {
              targetCell.value = normalizeSplitMarkers(targetCell.value || '') + SPLIT_MARKER;
              renderPreviewLines();
            });
            previewLines.appendChild(separator);
          }
        });

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
            separator.title = '点击插入 \\N 分行标记';
            separator.addEventListener('click', () => {
              targetCell.value = normalizeSplitMarkers(targetCell.value || '') + SPLIT_MARKER;
              renderPreviewLines();
            });
            previewLines.appendChild(separator);
          }
        }
      }

      // input 事件天然就会在用户键入 \N 后触发，于是分行预览实时更新
      targetCell.addEventListener('input', () => renderPreviewLines());
      renderPreviewLines();
      previewContainer.appendChild(previewLabel);
      previewContainer.appendChild(previewLines);

      const splitHint = document.createElement('div');
      splitHint.className = 'settings-hint context-group-split-hint';
      splitHint.textContent = '应用时按 \\N > 换行 > 百分比顺序自动拆分到所选条目；\\N[1] 等 RPG Maker 控制码不会被误切。术语库注入与字数校验仍生效。';

      const actions = document.createElement('div');
      actions.className = 'inline-actions context-group-actions';

      const aiBtn = document.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'secondary-btn paired-ai-btn';
      aiBtn.textContent = 'AI 翻译整组';
      aiBtn.title = '把所选条目原文合并为一段，调用当前 AI 翻译，结果填回上方文本框';
      aiBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
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
          const groupSourceText = selectedEntries.map((entry) => entry.source || '').join('\n');
          window.traceCall?.('编组翻译', `使用 ${selectedProvider} 翻译编组：${selectedEntries.length} 条`, 'pending');
          const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({
            sourceText: groupSourceText,
            settings,
            glossary: current.glossary || null,
            project: current.project || null,
            entry: { file: selectedEntries[0]?.file, key: selectedEntries.map((e) => e.key).join('+'), kind: 'context-group', code: null, path: '' },
          });
          if (!result?.ok) throw new Error(result?.message || t('common.aiTestFail'));
          targetCell.value = result.translatedText || '';
          renderPreviewLines();
          window.showAiStatus?.(result.message || `已使用 ${result.provider || 'AI'} 完成编组翻译。`, 'success');
        } catch (error) {
          window.showAiStatus?.(error.message || t('common.aiTestFail'), 'error');
          window.traceCall?.('编组翻译', error.message || t('common.aiTestFail'), 'error');
        }
      });

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'primary-btn';
      applyBtn.textContent = '应用到所选';
      applyBtn.addEventListener('click', () => applyContextGroupTranslation(selectedEntries, targetCell.value, { splitLines: true }));

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'secondary-btn';
      clearBtn.textContent = '清空选择';
      clearBtn.addEventListener('click', () => { updateContextGroupSelection(new Set()); renderEntryList(); });

      actions.appendChild(aiBtn);
      actions.appendChild(applyBtn);
      actions.appendChild(clearBtn);
      const editorRow = document.createElement('div');
      editorRow.className = 'context-group-editor';
      editorRow.appendChild(sourceBlock);
      editorRow.appendChild(targetCell);
      panel.appendChild(editorRow);
      panel.appendChild(previewContainer);
      panel.appendChild(splitHint);
      panel.appendChild(actions);
    }

    const list = document.createElement('div');
    list.className = 'context-group-entry-list';
    if (!items.length) {
      list.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
    } else {
      items.forEach((entry) => {
        const row = document.createElement('div');
        row.className = `context-group-select-row ${selection.has(getContextGroupSelectionKey(entry)) ? 'selected' : ''}`;
        const checkboxWrap = document.createElement('label');
        checkboxWrap.className = 'context-group-source';
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
        checkboxWrap.appendChild(checkbox);
        const text = document.createElement('span');
        text.className = 'context-group-source-text';
        text.textContent = entry.source || '—';
        checkboxWrap.appendChild(text);
        const meta = document.createElement('span');
        meta.className = 'context-group-row-meta';
        meta.textContent = `#${String(entry.localIndex + 1).padStart(3, '0')} · ${entry.key}`;
        row.appendChild(checkboxWrap);
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
        entry.targetDraft = targetCell.value;
        entry.target = targetCell.value;
        if (targetCell.value.trim() && entry.translationStatus !== 'pending') markTranslated(entry, true);
        entry.warnings = validateLocal(entry, getProjectEngine());
        row.classList.toggle('translated', isTranslated(entry));
        row.classList.toggle('untranslated', !isTranslated(entry));
        row.classList.toggle('has-warnings', (entry.warnings || []).length > 0);
        targetCell.classList.toggle('empty', !targetCell.value.trim());
        renderWarningTags(tags, entry.warnings || []);
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
      entry.warnings = validateLocal(entry, getProjectEngine());
      if ((entry.warnings || []).length) row.classList.add('has-warnings');
      renderWarningTags(tags, entry.warnings || []);
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
    const percent = total ? Math.round((translated / total) * 100) : 0;
    if (entryCount) entryCount.textContent = String((current.groupedFiles || []).length);
    if (translatedCount) translatedCount.textContent = `${translated}/${total} · ${percent}%`;
    if (glossaryHitCount) glossaryHitCount.textContent = String((current.entries || []).reduce((sum, item) => sum + ((item.glossaryHits || []).length), 0));
    // 同步刷新文件下拉里每个 JSON 的百分比
    renderFileSelect();
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
    if (aiTranslateBtn) aiTranslateBtn.addEventListener('click', async () => { const entry = getCurrentEntry(); if (!entry) return; const cur = window.RpgAppStore?.getState?.() || {}; window.showAiStatus?.(t('common.aiPending'), 'pending'); const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({ sourceText: entry.source, settings: cur.aiSettings || {}, glossary: cur.glossary || null, project: cur.project || null, entry: { file: entry.file, key: entry.key, kind: entry.kind, code: entry.code, path: entry.path } }); if (result?.ok) { entry.target = result.translatedText || ''; entry.targetDraft = entry.target; renderEntryList(); renderCurrentEntry(); window.showAiStatus?.(result.message || `已使用 ${result.provider} 完成翻译。`, 'success'); } else { window.showAiStatus?.(result?.message || t('common.aiTestFail'), 'error'); } });
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', () => { const entry = getCurrentEntry(); if (!entry) return; entry.target = (entry.targetDraft || entry.target || '').trim(); entry.targetDraft = entry.target; renderEntryList(); renderCurrentEntry(); window.showToast?.(t('common.aiSaved'), 'success'); });
    clearTextsBtn?.addEventListener('click', () => clearAllTranslations());

    const singleBtn = get('singleEntryModeBtn');
    const groupBtn = get('contextGroupModeBtn');
    const reflectMode = (mode) => {
      singleBtn?.classList.toggle('active', mode === 'single');
      groupBtn?.classList.toggle('active', mode === 'group');
    };
    reflectMode(state().entryViewMode || 'single');
    singleBtn?.addEventListener('click', () => {
      window.RpgAppStore?.setState?.({ entryViewMode: 'single' });
      reflectMode('single');
      renderEntryList();
    });
    groupBtn?.addEventListener('click', () => {
      window.RpgAppStore?.setState?.({ entryViewMode: 'group' });
      reflectMode('group');
      renderEntryList();
    });
  }

  window.RpgEntries = { getCurrentEntry, buildGroupedFiles, getExportEntries, renderFileSelect, getFilteredItems, renderEntryList, updateCounts, renderCurrentEntry, clearAllTranslations, syncListState, bindEntryActions };
})();
