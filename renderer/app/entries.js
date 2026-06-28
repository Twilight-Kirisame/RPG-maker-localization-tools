(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;
  // i18n 格式化：把 {key} 占位符替换为 params 中对应值；若 t() 找不到 key 则原样返回
  const tf = (key, params = {}) => {
    let text = t(key);
    Object.keys(params || {}).forEach((k) => {
      text = text.split(`{${k}}`).join(String(params[k] ?? ''));
    });
    return text;
  };

  // 上下文组备选列表的局部 UI 状态，跨 renderEntryList re-render 保留
  let _ctxGroupListFilter = '';
  let _ctxGroupListScroll = 0;
  let _ctxGroupListFilterFocused = false;
  let _ctxGroupListFilterCaret = 0;

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
      .map(([file, items]) => ({ file, items: items.map((item, index) => {
        // 老草稿迁移：旧版数据可能只有 target、缺少 translationStatus，沿用原"有内容即已翻译"语义。
        // 这里在 build 阶段一次性物化为 'translated'，让后续 isTranslated 严格依据 status 判断，
        // 避免 AI 写入后又被 fallback 自动判定为已翻译。
        const targetText = String(item.targetDraft ?? item.target ?? '');
        const existingStatus = item.translationStatus || item.draftStatus || '';
        const resolvedStatus = existingStatus || (targetText.trim() ? 'translated' : 'pending');
        return { ...item, localIndex: index, sourceDraft: '', targetDraft: targetText, translationStatus: resolvedStatus, draftStatus: resolvedStatus };
      }) }));
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
    // 状态由用户通过状态按钮 / 草稿迁移显式设定。AI 写入和用户编辑只动 target，不动 status，
    // 因此这里严格依据 status 判断，不再回退到"有 target 即视为已翻译"。
    const status = entry?.translationStatus || entry?.draftStatus || '';
    return status === 'translated';
  }

  function markTranslated(entry, translated) {
    const status = translated ? 'translated' : 'pending';
    entry.translationStatus = status;
    entry.draftStatus = status;
    entry.progress = { ...(entry.progress || {}), translated, lastEditedAt: translated ? new Date().toISOString() : (entry.progress?.lastEditedAt || '') };
  }

  // 把"AI 翻译填入"或"用户编辑"等仅写入草稿文本的动作，与「已翻译/未翻译」状态解耦：
  // 只更新 target / targetDraft，不修改 translationStatus。状态切换属于行尾的状态按钮。
  function applyDraftWithoutMarking(entry, nextText) {
    if (!entry) return;
    entry.target = nextText;
    entry.targetDraft = nextText;
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
          // 把同分类聚合后的术语集传给 AI 注入（GlossaryInjector），让多子库的术语都参与 replace / prompt 注入
          glossary: current.aggregatedGlossary || current.glossary || null,
          project: current.project || null,
          entry: { file: entry.file, key: entry.key, kind: entry.kind, code: entry.code, path: entry.path },
        });
        if (!result?.ok) throw new Error(result?.message || t('common.aiTestFail'));
        // AI 写入的内容只更新草稿文本，不擅自把状态切到「已翻译」——保持当前状态由用户通过状态按钮确认。
        applyDraftWithoutMarking(entry, result.translatedText || '');
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

  // ===== 上下文组 AI 翻译协议 · 程序级 Prompt 包装器 + 控制码保护 + 段数校验 =====
  //
  // 与"用户系统提示词"完全解耦：用户的 prompt 只负责风格 / 术语 / 语气，分句协议与控制码
  // 占位规则全部由本层在调用前自动拼接。
  //
  // 强约束分两层：
  //   1. System prompt 末尾：分句协议 + few-shot 示例（设定背景规则）
  //   2. User message 末尾：本次任务的硬性指令"输入 X 行，必须返回 X 行，用 \N 分隔"
  //      —— OpenAI 的 user role 对模型注意力更高，重试时也在此处追加诊断性提醒
  //
  // 传输分隔符使用 \N（与用户在 textarea 中看到的一致，最短，2 字符）；
  // 旧 `---SPLIT---` 与中间方案 `|||` 都保留向后兼容解析，不会破坏历史草稿。
  const GROUP_DELIMITER = '\\N';
  const GROUP_DELIMITER_RE_SAFE = GROUP_DELIMITER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 形如 \N[1]、\V[3]、\C[10]、\FS[12]、\C 这类 RPG Maker 控制码；与分句标记 \N 区分的
  // 关键：本正则只在「\N(不带 [）已被替换为占位符之后」运行，剩下的 \X[...] 一定是真控制码。
  // 注意：\N 作为分句标记本身不能被这里 mask，否则 AI 看不到分隔符。所以 mask 时显式排除 \N（不带 [）。
  const RPG_CODE_MASK_RE = /\\[A-Za-z][A-Za-z0-9]*\[[^\]]*\]/g;
  const RPG_CODE_PLACEHOLDER_RE = /\{\{RPG_CODE_(\d+)\}\}/g;

  /**
   * 把原文中的 RPG Maker 控制码替换成 {{RPG_CODE_n}} 占位符，并返回一个 restore() 用于
   * 把译文中的占位符还原回原始控制码。模型几乎不会改占位符的字面（{{...}} 视觉特征强），
   * 所以可以最大程度防止 \N[1] / \V[3] 被合并、翻译或丢失。
   */
  function protectControlCodes(text) {
    const codes = [];
    const masked = String(text || '').replace(RPG_CODE_MASK_RE, (match) => {
      const idx = codes.length;
      codes.push(match);
      return `{{RPG_CODE_${idx}}}`;
    });
    return {
      masked,
      restore(translated) {
        return String(translated || '').replace(RPG_CODE_PLACEHOLDER_RE, (full, idx) => {
          const code = codes[Number(idx)];
          return typeof code === 'string' ? code : full;
        });
      },
    };
  }

  // 判定是否为 OpenAI 兼容的 LLM 提供方（支持 response_format: json_object）
  // baidu / google / traditional-baidu / mock 不属于此类，必须走文本协议。
  function isOpenAiCompatibleProvider(provider) {
    const p = String(provider || '').toLowerCase();
    return !['baidu', 'google', 'traditional-baidu', 'mock', ''].includes(p);
  }

  /**
   * 【JSON 协议】把所选条目原文打包成显式编号 JSON：{"1": "原文A", "2": "原文B", ...}。
   * 控制码先全部 mask 为 {{RPG_CODE_n}}，避免被模型篡改；mask 在整个 JSON 字符串外做一次即可，
   * 因为 mask 正则只匹配 \X[Y]，不会撞 JSON 语法（{}"":,）。
   * 返回 { payload, restore, segmentCount, expectedKeys }；payload 是要发给 AI 的 user message 主体。
   */
  function buildGroupSourcePayloadJson(editedSource) {
    const normalized = normalizeSplitMarkers(String(editedSource || ''));
    const segments = normalized.split(SPLIT_RE).map((s) => s.trim()).filter(Boolean);
    const obj = {};
    segments.forEach((seg, i) => { obj[String(i + 1)] = seg; });
    const rawJson = JSON.stringify(obj, null, 2);
    const { masked, restore: restoreCodes } = protectControlCodes(rawJson);
    const expectedKeys = segments.map((_, i) => String(i + 1));
    return {
      payload: masked,
      segmentCount: segments.length,
      expectedKeys,
      // restore(rawTranslatedJson): 把模型返回的 JSON 字符串解析、按 expectedKeys 顺序取值、再在每个值内还原控制码
      // 顺序很关键：必须先 parse JSON，再在 string value 里 restore 占位符 —— 否则 \N[1] 还原后会注入 JSON 文本破坏 parse
      // 返回 { ok, segments, reason }
      restore(rawTranslated) {
        const text = String(rawTranslated || '').trim();
        if (!text) return { ok: false, segments: [], reason: 'empty' };
        // 容错：模型偶尔在 JSON 前后裹说明文字或 ```json``` 代码块，启发式抓取首个 {...} 块再 parse
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        const candidate = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
        let parsed;
        try {
          parsed = JSON.parse(candidate);
        } catch (_) {
          return { ok: false, segments: [], reason: 'json-parse-error' };
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return { ok: false, segments: [], reason: 'json-not-object' };
        }
        const out = [];
        for (const key of expectedKeys) {
          const v = parsed[key];
          if (typeof v !== 'string') {
            return { ok: false, segments: out, reason: `missing-key-${key}` };
          }
          // 在 parsed string 值内还原控制码（{{RPG_CODE_n}} → \N[1] 等）
          out.push(restoreCodes(v).trim());
        }
        return { ok: true, segments: out, reason: 'json-strict' };
      },
    };
  }

  /**
   * 【JSON 协议】专用 system prompt：明确告诉模型输入 / 输出都是 JSON 对象，且键必须一对一。
   */
  function buildGroupSystemPromptJson(basePrompt, expectedCount) {
    const userPart = String(basePrompt || '你是一个专业的 RPG Maker 游戏汉化助手，请将原文自然准确地翻译成简体中文。').trim();
    const protocol = [
      '',
      '====== [上下文组翻译协议 · JSON 结构化模式 · 程序自动注入] ======',
      `本次输入是一个 JSON 对象，包含 ${expectedCount} 个字符串值，键名为 "1" 到 "${expectedCount}"。`,
      '每个值是一段需要翻译的原文。',
      '',
      '【硬性输出要求】',
      `  1. 你的输出必须是、且只能是一个合法的 JSON 对象，键名必须严格等于输入的键名（"1" 到 "${expectedCount}"）。`,
      `  2. 每个键对应的值是该段原文的译文（字符串类型）。`,
      `  3. 不要新增任何键、不要遗漏任何键、不要改变键名顺序或大小写。`,
      `  4. 不要在 JSON 对象前后输出任何解释性文字、不要使用 Markdown 代码块包裹（不要写 \`\`\`json）。`,
      '  5. 直接输出 JSON 对象本身。',
      '',
      '【控制码占位符规则】',
      '  原文中可能出现形如 {{RPG_CODE_0}}、{{RPG_CODE_1}} 这样的占位符（是 RPG Maker 控制码的临时替换）。',
      '  译文中必须原样保留这些占位符的字面、大小写、序号，绝对不能删除、修改、翻译或重新编号。',
      '  位置可以在自然语义合适的地方移动，但每一个占位符都必须在对应译文中出现。',
      '',
      '【示例】',
      '输入：',
      '{',
      '  "1": "おはようございます。",',
      '  "2": "今日もよろしくお願いします、{{RPG_CODE_0}}さん。",',
      '  "3": "では、行ってきます。"',
      '}',
      '',
      '正确输出：',
      '{',
      '  "1": "早上好。",',
      '  "2": "{{RPG_CODE_0}}，今天也请多关照。",',
      '  "3": "那么，我出发了。"',
      '}',
      '====== [协议结束] ======',
    ].join('\n');
    return `${userPart}\n${protocol}`;
  }

  /**
   * 【JSON 协议】user message 末尾追加硬性约束。重试时把上次返回作为错误样本附上。
   */
  function buildGroupUserMessageJson(payloadJsonText, expectedCount, retryDiagnostic = null) {
    const parts = [payloadJsonText];
    if (retryDiagnostic) {
      parts.push('');
      parts.push(`【系统提示 · 上次输出不合格】`);
      parts.push(`原因：${retryDiagnostic.reason}。本次必须返回一个合法的 JSON 对象，包含且仅包含 "1" 到 "${expectedCount}" 共 ${expectedCount} 个字符串键。`);
      if (retryDiagnostic.previousOutput) {
        const snippet = String(retryDiagnostic.previousOutput).slice(0, 400);
        parts.push(`【上一次错误输出节选（请勿重复这种错误）】`);
        parts.push(snippet);
      }
    }
    parts.push('');
    parts.push(`【任务要求 · 必读 · 优先级最高】`);
    parts.push(`请将上面 JSON 对象的每个值翻译，并以同样结构的 JSON 对象返回（${expectedCount} 个键："1" 到 "${expectedCount}"）。不要输出解释、不要用 Markdown 包裹、直接给 JSON。`);
    return parts.join('\n');
  }


  /**
   * 【文本协议 · legacy / 传统翻译走这条】把用户在原文 textarea 中编辑的整段
   * （含 \N 分句标记 + 控制码）转换为"AI 协议层"格式：
   *   1. 兼容旧 ---SPLIT---，统一归一为 \N；
   *   2. 按 \N（不带 [）切段，trim 后去掉空段，得到段数组；
   *   3. 段间插入显式 \N 分隔块（前后各空行，让模型一眼识别为分隔符）；
   *   4. 对最终文本做控制码 masking（只 mask 带括号的 \X[Y] 形式，bare \N 是分隔符保留）。
   * 返回 { payload, restore, segmentCount }。
   */
  function buildGroupSourcePayload(editedSource) {
    const normalized = normalizeSplitMarkers(String(editedSource || ''));
    const segments = normalized.split(SPLIT_RE).map((s) => s.trim()).filter(Boolean);
    const joined = segments.join(`\n\n${GROUP_DELIMITER}\n\n`);
    const { masked, restore } = protectControlCodes(joined);
    return { payload: masked, restore, segmentCount: segments.length };
  }

  /**
   * 程序级系统提示词包装器：在用户原始 prompt 之后追加分句协议、占位符协议、few-shot 示例。
   * 仅在本次调用使用，不写回全局 aiSettings。
   * 注意：本函数只负责"背景规则"；本次任务的硬性段数约束放到 user message 末尾
   *      （见 buildGroupUserMessage），因为非思考型模型对 user role 的注意力更高。
   */
  function buildGroupSystemPrompt(basePrompt) {
    const userPart = String(basePrompt || '你是一个专业的 RPG Maker 游戏汉化助手，请将原文自然准确地翻译成简体中文。').trim();
    const protocol = [
      '',
      '====== [上下文组翻译协议 · 程序自动注入，请严格遵守] ======',
      `输入格式：多段原文之间用一行 "${GROUP_DELIMITER}" 分隔（分隔符前后各有一行空行）。`,
      `输出格式：必须按相同段数返回译文，段与段之间同样用一行 "${GROUP_DELIMITER}" 分隔。`,
      '',
      '【硬性输出要求】',
      `  1. 严格保持输入段数 = 输出段数。一段也不能多、一段也不能少。`,
      `  2. 段与段之间必须用一行 "${GROUP_DELIMITER}" 分隔，分隔符前后各换一行空行。`,
      '  3. 不要合并段落、不要拆分段落、不要新增段号或编号、不要使用引号或 Markdown 包裹。',
      '  4. 不要解释、不要附加任何说明文字，直接输出译文正文。',
      '',
      '【控制码占位符规则】',
      '  原文中可能出现形如 {{RPG_CODE_0}}、{{RPG_CODE_1}} 这样的占位符，它们是游戏控制码',
      '  （角色名、变量、颜色切换等）的临时替换。译文中必须原样保留这些占位符的字面、',
      '  大小写、序号，绝对不能删除、修改、翻译或重新编号。位置可以在自然语义合适的地方移动，',
      '  但每一个占位符都必须在输出中出现一次且只出现一次。',
      '',
      '【参考示例：输入 3 段，输出必须也 3 段】',
      '输入：',
      'おはようございます。',
      '',
      GROUP_DELIMITER,
      '',
      '今日もよろしくお願いします、{{RPG_CODE_0}}さん。',
      '',
      GROUP_DELIMITER,
      '',
      'では、行ってきます。',
      '',
      '正确输出：',
      '早上好。',
      '',
      GROUP_DELIMITER,
      '',
      '{{RPG_CODE_0}}，今天也请多关照。',
      '',
      GROUP_DELIMITER,
      '',
      '那么，我出发了。',
      '====== [协议结束] ======',
    ].join('\n');
    return `${userPart}\n${protocol}`;
  }

  /**
   * 把"硬性段数约束"和"重试诊断"以 user message 末尾追加的形式拼到原文后面。
   * - 首次调用：只追加"输入 X 段必须返回 X 段"的强约束
   * - 重试调用：先附上"上次返回 N 段不匹配 + 实际错误输出节选"作为反例，再附约束
   * 这样模型在 user role 中直接看到正确做法与错误做法的对照，比纯 system 改写更有效。
   */
  function buildGroupUserMessage(maskedSource, expectedCount, retryDiagnostic = null) {
    const parts = [maskedSource];
    if (retryDiagnostic) {
      parts.push('');
      parts.push(`【系统提示 · 上次输出不合格】`);
      parts.push(`上次返回的译文行数 = ${retryDiagnostic.actual}，但应当严格 = ${expectedCount} 行。请重新检查原文行数，逐段对应翻译并严格按要求分行输出。`);
      if (retryDiagnostic.previousOutput) {
        const snippet = String(retryDiagnostic.previousOutput).slice(0, 400);
        parts.push(`【上一次错误输出节选（请勿重复这种错误）】`);
        parts.push(snippet);
      }
    }
    parts.push('');
    parts.push(`【任务要求 · 必读 · 优先级最高】`);
    parts.push(`本输入包含 ${expectedCount} 行原文，你必须严格返回且仅返回 ${expectedCount} 行译文，每行译文之间使用一行 "${GROUP_DELIMITER}" 进行分隔（前后各空一行）。禁止合并段落，禁止拆分段落，禁止输出任何解释性文本、引号或 Markdown 包裹。直接输出 ${expectedCount} 段译文。`);
    return parts.join('\n');
  }

  /**
   * 解析 AI 返回：优先按 ---SPLIT--- 切，兼容 \N 与裸换行兜底。返回 { ok, segments }。
   * segments 已经过控制码 restore，可以直接写回条目槽。
   */
  function parseGroupResponse(rawText, expectedCount, restoreFn) {
    const text = String(rawText || '').trim();
    if (!text) return { ok: false, segments: [], actual: 0, expected: expectedCount, reason: 'empty' };

    const trySplit = (regex) => text.split(regex).map((s) => s.trim()).filter(Boolean);

    // 1) 优先按当前 GROUP_DELIMITER（\N，不带 [）切。RE_SAFE 已 escape，对 \N 等价于 /\s*\\\\N\s*/g
    //    但我们要额外避开 \N[ 形式 —— 所以这里直接用 SPLIT_RE 类的负向预查
    let segments = trySplit(/\s*\\N(?!\[)\s*/g);
    let how = 'delimiter';
    // 2) 兼容：模型沿用旧 ||| 分隔符
    if (segments.length !== expectedCount) {
      const fallbackByPipe = trySplit(/\s*\|\|\|\s*/g);
      if (fallbackByPipe.length === expectedCount) { segments = fallbackByPipe; how = 'pipe-legacy'; }
    }
    // 3) 兼容：模型沿用更旧的 ---SPLIT---
    if (segments.length !== expectedCount) {
      const fallbackByLegacy = trySplit(/\s*---SPLIT---\s*/g);
      if (fallbackByLegacy.length === expectedCount) { segments = fallbackByLegacy; how = 'legacy-split'; }
    }
    // 4) 兼容：模型按双换行切段
    if (segments.length !== expectedCount) {
      const fallbackByBlank = trySplit(/\n\s*\n+/g);
      if (fallbackByBlank.length === expectedCount) { segments = fallbackByBlank; how = 'blank-line'; }
    }

    const restored = segments.map((s) => restoreFn(s));
    return {
      ok: restored.length === expectedCount,
      segments: restored,
      actual: restored.length,
      expected: expectedCount,
      reason: restored.length === expectedCount ? `ok-via-${how}` : 'count-mismatch',
    };
  }

  /**
   * 【传统翻译分流】百度 / 谷歌等通用翻译 API 不能理解 \N 分句标记或 JSON 协议，
   * 强行整段发送只会被当成普通字符串翻译，破坏对齐。
   *
   * 解决方案：把上下文组按 \N 拆成 segments，对每一段独立调一次 aiTranslate（每段独立 mask
   * 控制码），用 Promise.all 并发完成 N 个 API 调用，再按原顺序组装回译文数组。
   *
   * 失败语义：任一段失败 → 整组 fail；已成功的段拼到 textarea 供用户参考但不写回条目槽。
   * 接口层不重试（传统 API 失败重试也是同样的失败）。
   *
   * 注意：高并发可能触发 QPS 限制（百度个人版仅 1 QPS）。如果需要降速，把 Promise.all
   * 改成串行 for + delay 即可。
   */
  async function translateGroupWithTraditional({ editedSource, expectedCount, baseSettings, project, glossary, onProgress = () => {} }) {
    const normalized = normalizeSplitMarkers(String(editedSource || ''));
    const segments = normalized.split(SPLIT_RE).map((s) => s.trim()).filter(Boolean);
    if (!segments.length) {
      return { ok: false, segments: [], message: t('context.sourceEmpty'), attempts: 0 };
    }
    if (segments.length !== expectedCount) {
      onProgress(tf('context.aiSegmentCountWarn', { input: segments.length, expected: expectedCount }));
    }

    const total = segments.length;
    let completed = 0;
    onProgress(tf('context.aiTradBatchProgress', { current: 0, total }));

    const tasks = segments.map(async (seg, i) => {
      const { masked, restore } = protectControlCodes(seg);
      const settings = { ...(baseSettings || {}) };
      if (settings.provider === 'baidu' || settings.provider === 'google') {
        settings.traditional = { ...(baseSettings?.traditional || {}), provider: settings.provider };
      }
      const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({
        sourceText: masked,
        settings,
        glossary: glossary || null,
        project: project || null,
        entry: { file: '', key: '', kind: 'context-group-traditional', code: null, path: '' },
      });
      completed += 1;
      onProgress(tf('context.aiTradBatchProgress', { current: completed, total }));
      return { index: i, result, restore };
    });

    const settled = await Promise.all(tasks);

    const out = new Array(total).fill('');
    let provider = '';
    let firstError = null;
    for (const { index, result, restore } of settled) {
      if (!result?.ok) {
        if (!firstError) firstError = { index: index + 1, message: result?.message || t('common.aiTestFail') };
        continue;
      }
      provider = provider || result.provider || baseSettings?.provider || '';
      out[index] = restore(result.translatedText || '').trim();
    }

    if (firstError) {
      return {
        ok: false,
        segments: out,  // 保留 sparse 数组，让用户看到哪段失败（空槽）
        message: tf('context.aiTradBatchFailed', { index: firstError.index, reason: firstError.message }),
        attempts: total,
        provider,
      };
    }
    return { ok: true, segments: out, provider, attempts: total, message: 'traditional-batch' };
  }

  /**
   * 带"诊断性重试"的上下文组翻译。
   *
   * 协议选择（自动）：
   *   - OpenAI 兼容 LLM（deepseek / openai / claude / custom / gemini）：JSON 结构化协议
   *     · 输入是 {"1":"...","2":"..."} 形式，response_format: 'json_object' 强制返回 JSON
   *     · 解析器严格按键名校验，"1".."N" 缺一就 fail
   *   - 传统翻译（baidu / google）：逐条并发分流
   *     · 把 segments 拆开，每段独立调一次 API，再按序组装
   *     · 这些 API 不支持 JSON 模式，也不会保留 \N 分隔符
   *
   * 重试时携带"上次失败原因 + 上次错误输出节选"，让模型看到反例后纠错。
   * 接口层 HTTP / 鉴权失败不重试。段数不匹配最多重试 maxRetries 次（共 maxRetries+1 次往返）。
   *
   * 返回 { ok, segments, provider, attempts, message }
   */
  async function translateGroupWithRetry({ editedSource, expectedCount, baseSettings, project, glossary, maxRetries = 2, onProgress = () => {} }) {
    const provider = String(baseSettings?.provider || '').toLowerCase();

    // 分流：传统翻译走逐条并发，不进入 JSON / 文本协议重试循环
    if (!isOpenAiCompatibleProvider(provider)) {
      return translateGroupWithTraditional({ editedSource, expectedCount, baseSettings, project, glossary, onProgress });
    }

    const useJson = true;

    // 根据协议选择 payload / prompt 构造器
    const payload = useJson
      ? buildGroupSourcePayloadJson(editedSource)
      : buildGroupSourcePayload(editedSource);

    const { segmentCount: inputSegCount } = payload;
    if (!payload.payload || !payload.payload.trim()) {
      return { ok: false, segments: [], message: t('context.sourceEmpty'), attempts: 0 };
    }
    if (inputSegCount !== expectedCount) {
      onProgress(tf('context.aiSegmentCountWarn', { input: inputSegCount, expected: expectedCount }));
    }

    // 构造 system prompt（一次构造、复用所有重试）
    const systemPrompt = useJson
      ? buildGroupSystemPromptJson(baseSettings?.prompt || '', expectedCount)
      : buildGroupSystemPrompt(baseSettings?.prompt || '');
    const settings = { ...(baseSettings || {}), prompt: systemPrompt };
    if (useJson) {
      // 强制 OpenAI 兼容端点返回 JSON 对象
      settings.responseFormat = 'json_object';
    }
    if (settings.provider === 'baidu' || settings.provider === 'google') {
      settings.traditional = { ...(baseSettings?.traditional || {}), provider: settings.provider };
    }

    let lastMessage = '';
    let lastSegments = [];
    let lastProvider = '';
    let lastActual = 0;
    let lastRawText = '';
    let lastReason = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 构造 user message（含本次任务硬约束 + 重试诊断）
      const retryDiag = attempt === 0 ? null : { actual: lastActual, previousOutput: lastRawText, reason: lastReason };
      const userMessage = useJson
        ? buildGroupUserMessageJson(payload.payload, expectedCount, retryDiag)
        : buildGroupUserMessage(payload.payload, expectedCount, retryDiag);

      onProgress(attempt === 0
        ? tf('context.aiCalling', { provider: settings.provider || 'unknown' })
        : tf('context.aiRetrying', { actual: lastActual, expected: expectedCount, attempt, max: maxRetries }));

      const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({
        sourceText: userMessage,
        settings,
        glossary: glossary || null,
        project: project || null,
        entry: { file: '', key: '', kind: 'context-group', code: null, path: '' },
      });

      if (!result?.ok) {
        lastMessage = result?.message || 'AI 调用失败';
        return { ok: false, segments: [], message: lastMessage, attempts: attempt + 1 };
      }

      lastProvider = result.provider || lastProvider;
      lastRawText = result.translatedText || '';

      let parsed;
      if (useJson) {
        const r = payload.restore(lastRawText);
        parsed = { ok: r.ok, segments: r.segments, actual: r.segments?.length || 0, expected: expectedCount, reason: r.reason };
      } else {
        parsed = parseGroupResponse(lastRawText, expectedCount, payload.restore);
      }
      lastSegments = parsed.segments;
      lastActual = parsed.actual;
      lastReason = parsed.reason || '';

      if (parsed.ok) {
        return { ok: true, segments: parsed.segments, provider: lastProvider, attempts: attempt + 1, message: parsed.reason };
      }
      lastMessage = tf('context.aiSegmentMismatch', { actual: parsed.actual, expected: parsed.expected });
    }

    return { ok: false, segments: lastSegments, message: tf('context.aiRetryExhausted', { reason: lastMessage, max: maxRetries }), attempts: maxRetries + 1, provider: lastProvider };
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
      ? tf('context.groupSummary', { count: selectedEntries.length, keys: selectedEntries.map((entry) => entry.key).join(' / ') })
      : t('context.groupEmpty');
    panel.appendChild(summary);

    if (selectedEntries.length) {
      const sourceBlock = document.createElement('textarea');
      sourceBlock.className = 'context-group-source-block context-group-source-editable';
      sourceBlock.placeholder = t('context.sourcePlaceholder');
      sourceBlock.value = selectedEntries.map((entry) => entry.source || '').join('\n\\N\n');
      // 阻止冒泡，避免点击/键盘事件触发外层 row 的选中切换
      ['click', 'mousedown', 'keydown'].forEach((evt) => sourceBlock.addEventListener(evt, (e) => e.stopPropagation()));

      const targetCell = document.createElement('textarea');
      targetCell.className = 'paired-cell target context-group-target';
      targetCell.placeholder = t('context.targetPlaceholder');
      const sharedTarget = selectedEntries[0]?.targetDraft || selectedEntries[0]?.target || '';
      targetCell.value = sharedTarget;

      const previewContainer = document.createElement('div');
      previewContainer.className = 'context-group-preview-container';
      const previewLabel = document.createElement('div');
      previewLabel.className = 'context-group-preview-label';
      previewLabel.textContent = t('context.previewLabel');
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
          lineContent.textContent = segment.trim() || t('context.previewEmptyLine');
          lineRow.appendChild(lineContent);
          previewLines.appendChild(lineRow);

          if (index < segments.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator active';
            separator.title = t('context.previewRemove');
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
            separator.title = t('context.previewInsert');
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
          lineContent.textContent = t('context.previewEmptyLine');
          lineRow.appendChild(lineContent);
          previewLines.appendChild(lineRow);
          if (i < selectedEntries.length - 1) {
            const separator = document.createElement('div');
            separator.className = 'preview-line-separator';
            separator.title = t('context.previewInsert');
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
      splitHint.textContent = t('context.splitHint');

      const actions = document.createElement('div');
      actions.className = 'inline-actions context-group-actions';

      const aiBtn = document.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'secondary-btn paired-ai-btn';
      aiBtn.textContent = t('context.aiTranslateGroup');
      aiBtn.title = t('context.aiTranslateGroupTitle');
      aiBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        window.showAiStatus?.(t('common.aiPending'), 'pending');
        try {
          const current = window.RpgAppStore?.getState?.() || {};
          const selectedProvider = document.getElementById('globalAiModeSelect')?.value || current.aiSettings?.lastEntryAiMode || current.aiSettings?.provider || 'baidu';
          const editedSource = (sourceBlock.value || '').trim();
          if (!editedSource) {
            window.showAiStatus?.(t('context.sourceEmpty'), 'error');
            return;
          }
          // 仅把 provider 写回全局（让单条模式后续也用这个 provider），prompt 不写回
          window.RpgAppStore?.setState?.({ aiSettings: { ...(current.aiSettings || {}), provider: selectedProvider, lastEntryAiMode: selectedProvider } });

          const baseSettings = {
            ...(current.aiSettings || {}),
            provider: selectedProvider,
            lastEntryAiMode: selectedProvider,
          };
          window.traceCall?.(t('context.aiTraceLabel'), tf('context.aiTracePending', { provider: selectedProvider, count: selectedEntries.length }), 'pending');

          const result = await translateGroupWithRetry({
            editedSource,
            expectedCount: selectedEntries.length,
            baseSettings,
            project: current.project || null,
            // 上下文组同样优先使用聚合术语集，保证多子库的术语都对 AI 可见
            glossary: current.aggregatedGlossary || current.glossary || null,
            maxRetries: 2,
            onProgress: (msg) => window.showAiStatus?.(msg, 'pending'),
          });

          if (!result.ok) {
            // 失败：把"尽力"结果回填到 textarea 供用户参考，但不写回条目槽
            if (Array.isArray(result.segments) && result.segments.length) {
              targetCell.value = result.segments.join(`\n${SPLIT_MARKER}\n`);
              renderPreviewLines();
            }
            window.showAiStatus?.(tf('context.aiFailRetained', { reason: result.message || t('common.aiTestFail'), attempts: result.attempts }), 'error');
            window.traceCall?.(t('context.aiTraceLabel'), `${result.message}；attempts=${result.attempts}`, 'error');
            return;
          }

          // 成功：把对齐的 N 段译文用 \N 拼回 textarea + 精准回填到每个条目
          targetCell.value = result.segments.join(`\n${SPLIT_MARKER}\n`);
          renderPreviewLines();
          selectedEntries.forEach((entry, idx) => {
            const seg = result.segments[idx] || '';
            // AI 写入只更新草稿文本，不自动转为「已翻译」——后续点击「应用到选中」或单行的状态按钮才会切换状态。
            applyDraftWithoutMarking(entry, seg);
          });
          renderEntryList();
          renderCurrentEntry();
          updateCounts();
          const msgKey = result.attempts > 1 ? 'context.aiSuccessWithRetry' : 'context.aiSuccess';
          window.showAiStatus?.(tf(msgKey, {
            provider: result.provider || 'AI',
            count: result.segments.length,
            expected: selectedEntries.length,
            retried: result.attempts - 1,
          }), 'success');
          window.traceCall?.(t('context.aiTraceLabel'), tf('context.aiTraceSuccess', {
            count: result.segments.length,
            expected: selectedEntries.length,
            attempts: result.attempts,
            reason: result.message,
          }), 'success');
        } catch (error) {
          window.showAiStatus?.(error.message || t('common.aiTestFail'), 'error');
          window.traceCall?.(t('context.aiTraceLabel'), error.message || t('common.aiTestFail'), 'error');
        }
      });

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'primary-btn';
      applyBtn.textContent = t('context.applyToSelected');
      applyBtn.addEventListener('click', () => applyContextGroupTranslation(selectedEntries, targetCell.value, { splitLines: true }));

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'secondary-btn';
      clearBtn.textContent = t('context.clearSelection');
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

    // 列表工具栏：局部搜索 + 回到顶部
    const listToolbar = document.createElement('div');
    listToolbar.className = 'context-group-list-toolbar';
    const filterInput = document.createElement('input');
    filterInput.type = 'search';
    filterInput.className = 'context-group-list-filter';
    filterInput.placeholder = t('context.listFilterPlaceholder');
    filterInput.value = _ctxGroupListFilter;
    filterInput.addEventListener('input', () => {
      _ctxGroupListFilter = filterInput.value;
      _ctxGroupListFilterFocused = true;
      _ctxGroupListFilterCaret = filterInput.selectionStart || filterInput.value.length;
      renderListItems();
    });
    filterInput.addEventListener('focus', () => { _ctxGroupListFilterFocused = true; });
    filterInput.addEventListener('blur', () => { _ctxGroupListFilterFocused = false; });
    const backToTopBtn = document.createElement('button');
    backToTopBtn.type = 'button';
    backToTopBtn.className = 'secondary-btn context-group-back-to-top';
    backToTopBtn.textContent = t('context.backToTop');
    backToTopBtn.title = t('context.backToTopTitle');
    backToTopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      list.scrollTop = 0;
      _ctxGroupListScroll = 0;
    });
    listToolbar.appendChild(filterInput);
    listToolbar.appendChild(backToTopBtn);
    panel.appendChild(listToolbar);

    function matchesLocalFilter(entry) {
      const q = _ctxGroupListFilter.trim().toLowerCase();
      if (!q) return true;
      return `${entry.key || ''} ${entry.source || ''}`.toLowerCase().includes(q);
    }

    function renderListItems() {
      list.innerHTML = '';
      const filtered = items.filter(matchesLocalFilter);
      if (!filtered.length) {
        list.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
        return;
      }
      filtered.forEach((entry) => {
        const row = document.createElement('div');
        row.className = `context-group-select-row ${selection.has(getContextGroupSelectionKey(entry)) ? 'selected' : ''}`;
        const checkboxWrap = document.createElement('label');
        checkboxWrap.className = 'context-group-source';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selection.has(getContextGroupSelectionKey(entry));
        checkbox.addEventListener('change', () => {
          // 抓取当前滚动位置 + 搜索框焦点 / 光标，re-render 后恢复
          _ctxGroupListScroll = list.scrollTop;
          _ctxGroupListFilterFocused = document.activeElement === filterInput;
          _ctxGroupListFilterCaret = filterInput.selectionStart || filterInput.value.length;
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

    if (!items.length) {
      list.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
    } else {
      renderListItems();
    }
    panel.appendChild(list);
    entryList.appendChild(panel);

    // 恢复 re-render 前抓取的滚动 / 焦点 / 光标
    requestAnimationFrame(() => {
      if (_ctxGroupListScroll && list.isConnected) list.scrollTop = _ctxGroupListScroll;
      if (_ctxGroupListFilterFocused && filterInput.isConnected) {
        filterInput.focus();
        try { filterInput.setSelectionRange(_ctxGroupListFilterCaret, _ctxGroupListFilterCaret); } catch (_) { /* noop */ }
      }
    });
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
      // 命中检测优先用"同分类聚合"的术语合集；缺失时回退到当前活动子库的术语，保持向后兼容。
      const hitTerms = (current.aggregatedGlossary?.terms || current.glossary?.terms || []);
      sourceEntry.glossaryHits = hitTerms.filter((term) => term.enabled !== false && term.source && sourceEntry.source.includes(term.source));
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
        // 用户编辑只更新草稿文本，不擅自翻转「已翻译/未翻译」状态——这一切换权属于行尾的状态按钮。
        applyDraftWithoutMarking(entry, targetCell.value);
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
    // 同步刷新文件下拉里每个 JSON 的百分比，以及顶部进度面板的三个文本与"下一未翻译"指针。
    // 顶部面板曾只在 persistLastPosition 之后刷新，导致状态按钮切换 / 用户输入 / AI 回填后
    // 全局/当前文件/下一未翻译三组数字与实际列表脱节，这里把它们绑到 updateCounts 链路上。
    renderFileSelect();
    renderProgressDashboard();
  }

  function renderCurrentEntry() {
    const entry = getCurrentEntry();
    if (!entry) { updateCounts(); return; }
    const current = state();
    const hitTerms = (current.aggregatedGlossary?.terms || current.glossary?.terms || []);
    entry.glossaryHits = hitTerms.filter((term) => term.enabled !== false && term.source && entry.source.includes(term.source));
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
    if (aiTranslateBtn) aiTranslateBtn.addEventListener('click', async () => { const entry = getCurrentEntry(); if (!entry) return; const cur = window.RpgAppStore?.getState?.() || {}; window.showAiStatus?.(t('common.aiPending'), 'pending'); const result = await (window.RpgAppController?.aiTranslate || window.rpgWorkbench?.aiTranslate)?.({ sourceText: entry.source, settings: cur.aiSettings || {}, glossary: cur.aggregatedGlossary || cur.glossary || null, project: cur.project || null, entry: { file: entry.file, key: entry.key, kind: entry.kind, code: entry.code, path: entry.path } }); if (result?.ok) { applyDraftWithoutMarking(entry, result.translatedText || ''); renderEntryList(); renderCurrentEntry(); window.showAiStatus?.(result.message || `已使用 ${result.provider} 完成翻译。`, 'success'); } else { window.showAiStatus?.(result?.message || t('common.aiTestFail'), 'error'); } });
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

    // 跳转：通用工具，确保组模式 → 单条模式，定位文件 + 索引，滚动到目标行
    function jumpTo(targetFile, targetIndex) {
      if (!targetFile || targetIndex < 0) return false;
      const cur = state();
      const fileGroup = (cur.groupedFiles || []).find((g) => g.file === targetFile);
      if (!fileGroup || !fileGroup.items[targetIndex]) {
        window.showAiStatus?.(t('progress.jumpFail') || t('progress.noLastPosition'), 'warning');
        return false;
      }
      window.RpgAppStore?.setState?.({
        ...cur,
        entryViewMode: 'single',
        currentFile: targetFile,
        currentEntryIndex: targetIndex,
        project: cur.project || null,
        status: cur.status || 'project-loaded',
      });
      reflectMode('single');
      // 同步顶部文件选择器
      const fileSelectEl = get('fileSelect');
      if (fileSelectEl && fileSelectEl.value !== targetFile) fileSelectEl.value = targetFile;
      renderEntryList();
      renderCurrentEntry();
      // 滚动到对应行
      requestAnimationFrame(() => {
        const activeRow = document.querySelector('.paired-row.active');
        if (activeRow && typeof activeRow.scrollIntoView === 'function') {
          activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      return true;
    }

    const gotoLastPositionBtn = get('gotoLastPositionBtn');
    gotoLastPositionBtn?.addEventListener('click', () => {
      const cur = state();
      const last = cur.progressState?.global || cur.lastPosition || {};
      const targetFile = last.lastTranslatedFile || '';
      const targetIndex = Number(last.lastTranslatedIndex ?? -1);
      if (!targetFile || targetIndex < 0) {
        window.showAiStatus?.(t('progress.noLastPosition'), 'warning');
        return;
      }
      const ok = jumpTo(targetFile, targetIndex);
      if (ok) window.showAiStatus?.(tf('progress.gotoLastDone', { action: t('progress.gotoLast'), file: targetFile, index: targetIndex + 1 }), 'success');
    });

    const nextPendingBtn = get('nextPendingBtn');
    nextPendingBtn?.addEventListener('click', () => {
      const cur = state();
      // 在当前文件中先找；找不到就跨文件按 groupedFiles 顺序找
      const groups = cur.groupedFiles || [];
      const currentFile = cur.currentFile || groups[0]?.file || '';
      const currentIdx = cur.currentEntryIndex || 0;
      const findInGroup = (group, startIdx) => {
        const items = group?.items || [];
        for (let i = startIdx; i < items.length; i++) if (!isTranslated(items[i])) return i;
        return -1;
      };
      const currentGroup = groups.find((g) => g.file === currentFile);
      let nextIdx = findInGroup(currentGroup, currentIdx + 1);
      let targetFile = currentFile;
      if (nextIdx < 0) {
        // 跨文件向后扫
        const fileOrder = groups.map((g) => g.file);
        const startPos = fileOrder.indexOf(currentFile);
        for (let p = startPos + 1; p < fileOrder.length; p++) {
          const g = groups[p];
          const found = findInGroup(g, 0);
          if (found >= 0) { targetFile = g.file; nextIdx = found; break; }
        }
        // 跨文件向前回环
        if (nextIdx < 0) {
          for (let p = 0; p <= startPos; p++) {
            const g = groups[p];
            const startIdx = p === startPos ? 0 : 0;
            const found = findInGroup(g, startIdx);
            if (found >= 0 && !(p === startPos && found === currentIdx)) { targetFile = g.file; nextIdx = found; break; }
          }
        }
      }
      if (nextIdx < 0) {
        window.showAiStatus?.(t('progress.noPending'), 'warning');
        return;
      }
      const ok = jumpTo(targetFile, nextIdx);
      if (ok) window.showAiStatus?.(tf('progress.gotoLastDone', { action: t('progress.nextPending'), file: targetFile, index: nextIdx + 1 }), 'success');
    });
  }

  window.RpgEntries = { getCurrentEntry, buildGroupedFiles, getExportEntries, renderFileSelect, getFilteredItems, renderEntryList, updateCounts, renderCurrentEntry, clearAllTranslations, syncListState, bindEntryActions };
})();
