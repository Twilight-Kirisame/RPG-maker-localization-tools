(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;
  const format = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), t(key));
  const trace = (message, kind = 'normal') => {
    if (window.traceCall) window.traceCall('术语库', message, kind);
    else if (window.showToast) window.showToast(message, kind);
  };

  function getTerms() {
    const glossary = state().glossary || { terms: [] };
    return Array.isArray(glossary.terms) ? glossary.terms : [];
  }

  function setTerms(terms) {
    const current = state().glossary || { projectName: '', glossaryName: 'default', terms: [] };
    window.RpgAppStore?.setState?.({ glossary: { ...current, terms: Array.isArray(terms) ? terms : [] } });
  }

  /**
   * 从主进程拉取「同分类聚合后的术语合集」并写回 store。
   * 命中检测（renderEntryList）和 AI 注入都会消费 aggregatedGlossary.terms。
   * 只要保存了任何一个子库 / 改了分类 / 新建删除子库都要调一次，保证多库聚合命中始终是最新的。
   */
  async function refreshAggregatedGlossary() {
    const current = state();
    if (!current.project?.rootDir || !window.rpgWorkbench?.loadAggregatedGlossary) return null;
    try {
      const category = current.glossary?.category || 'default';
      const result = await window.rpgWorkbench.loadAggregatedGlossary({
        project: current.project,
        category,
        currentGlossary: current.glossary,
      });
      if (result?.ok && result.aggregated) {
        window.RpgAppStore?.setState?.({ aggregatedGlossary: result.aggregated });
        // 命中显示依赖术语合集，刷新后立刻重渲染条目列表
        window.RpgApp?.renderEntryList?.();
        renderAggregationHint();
        return result.aggregated;
      }
    } catch (_) {
      // 静默：聚合失败不影响主流程，命中检测会回退到当前库的 terms
    }
    return null;
  }

  function renderAggregationHint() {
    const hintEl = get('glossaryAggregationHint');
    if (!hintEl) return;
    const aggregated = state().aggregatedGlossary;
    if (!aggregated || !Array.isArray(aggregated.contributingGlossaries) || aggregated.contributingGlossaries.length <= 1) {
      hintEl.textContent = '';
      hintEl.classList.add('hidden');
      return;
    }
    hintEl.textContent = format('glossary.aggregationHint', {
      count: aggregated.contributingGlossaries.length,
      category: aggregated.category || 'default',
      terms: (aggregated.terms || []).length,
    });
    hintEl.classList.remove('hidden');
  }

  function syncUI() {
    const current = state();
    const status = get('glossaryStatus');
    const count = get('glossaryCount');
    const hint = get('glossaryHint');
    const nameInput = get('glossaryName');
    const searchInput = get('termSearch');
    const categoryInput = get('glossaryCategoryInput');
    if (nameInput) nameInput.value = current.glossary?.glossaryName || 'default';
    if (status) status.textContent = `${current.glossary?.projectName || t('glossary.currentProject')} / ${current.glossary?.glossaryName || 'default'}`;
    if (count) count.textContent = String(getTerms().length);
    if (hint) hint.textContent = getTerms().length ? format('glossary.termCountHint', { count: getTerms().length }) : t('glossary.emptyHint');
    if (searchInput && document.activeElement !== searchInput) searchInput.value = current.glossaryFilterText || '';
    // 分类输入框反映当前活动术语库的分类，编辑时立即激活"应用分类"按钮
    if (categoryInput && document.activeElement !== categoryInput) categoryInput.value = current.glossary?.category || 'default';
    renderAggregationHint();
  }

  function openTermEditor(index = -1) {
    const terms = getTerms();
    const term = index >= 0 ? terms[index] : { source: '', target: '', note: '' };
    window.RpgAppStore?.setState?.({ editingIndex: index });
    get('termSource').value = term?.source || '';
    get('termTarget').value = term?.target || '';
    get('termNote').value = term?.note || '';
    clearTermFieldError();
    get('termEditorModal')?.classList.remove('hidden');
  }

  function closeTermEditor() {
    clearTermFieldError();
    get('termEditorModal')?.classList.add('hidden');
  }

  function showTermFieldError(messageKey) {
    const errorEl = get('termFieldError');
    if (!errorEl) return;
    errorEl.textContent = t(messageKey);
    errorEl.classList.remove('hidden');
  }

  function clearTermFieldError() {
    const errorEl = get('termFieldError');
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  async function persistGlossary(message) {
    const current = state();
    trace('正在保存术语库…', 'normal');
    const result = await window.rpgWorkbench.saveGlossary({ project: current.project, glossary: current.glossary, glossaryName: current.glossary?.glossaryName || 'default' });
    if (!result?.ok) throw new Error(result?.message || t('glossary.saveFailed'));
    if (message) trace(message, 'success');
    window.RpgProject?.syncStatusFromProject?.({ project: current.project, glossary: result.glossary || current.glossary, aiSettings: current.aiSettings, warnings: [] });
    // 保存后立刻刷新同分类的聚合术语集，保证刚加的术语能在工作区命中
    await refreshAggregatedGlossary();
    return result;
  }

  async function saveTermFromEditor() {
    const sourceInput = get('termSource');
    const targetInput = get('termTarget');
    const source = sourceInput?.value?.trim() || '';
    const target = targetInput?.value?.trim() || '';
    const note = get('termNote')?.value?.trim() || '';
    // 字段缺失时：弹窗提示并把焦点送到第一个为空的字段；同时在弹窗下方保留红字提示作为兜底。
    // 直接 alert 是为了避免用户误以为"确认按钮无反应"——必须给一个明显的视觉/交互反馈。
    if (!source && !target) {
      const msg = t('glossary.fieldRequired');
      showTermFieldError('glossary.fieldRequired');
      window.alert(msg);
      sourceInput?.focus();
      return;
    }
    if (!source) {
      const msg = t('glossary.fieldRequiredSource');
      showTermFieldError('glossary.fieldRequiredSource');
      window.alert(msg);
      sourceInput?.focus();
      return;
    }
    if (!target) {
      const msg = t('glossary.fieldRequiredTarget');
      showTermFieldError('glossary.fieldRequiredTarget');
      window.alert(msg);
      targetInput?.focus();
      return;
    }
    clearTermFieldError();
    const current = state();
    const terms = [...getTerms()];
    const next = { source, target, note, enabled: true };
    const isEdit = current.editingIndex >= 0 && terms[current.editingIndex];
    if (isEdit) terms[current.editingIndex] = { ...terms[current.editingIndex], ...next };
    else terms.push(next);
    setTerms(terms);
    closeTermEditor();
    window.RpgApp?.render?.();
    await persistGlossary(isEdit ? format('glossary.termUpdated', { source, target }) : format('glossary.termAdded', { source, target }));
  }

  async function deleteTerm(index) {
    const terms = [...getTerms()];
    const term = terms[index];
    if (!term) return;
    if (!window.confirm(format('glossary.confirmDeleteTerm', { source: term.source }))) return;
    terms.splice(index, 1);
    setTerms(terms);
    window.RpgApp?.render?.();
    await persistGlossary(format('glossary.termDeleted', { source: term.source }));
  }

  function render() {
    const list = get('glossaryList');
    if (!list) return;
    list.innerHTML = '';
    const current = state();
    const q = (current.filterText || '').trim().toLowerCase();
    const terms = getTerms().filter((term) => !q || `${term.source || ''} ${term.target || ''} ${term.note || ''}`.toLowerCase().includes(q));
    if (!terms.length) {
      list.innerHTML = `<div class="status-box">${t('common.none')}</div>`;
      syncUI();
      return;
    }
    terms.forEach((term) => {
      const realIndex = getTerms().indexOf(term);
      const sourceText = String(term.source || '').trim();
      const targetText = String(term.target || '').trim();
      const row = document.createElement('div');
      row.className = 'glossary-item glossary-row';
      row.innerHTML = `<div class="glossary-text"><strong>${sourceText || t('glossary.untitledSource') || t('common.none')}</strong> → ${targetText || t('glossary.untitledTarget') || t('common.none')}${term.note ? `<div class="glossary-note">${term.note}</div>` : ''}</div><div class="glossary-row-actions"><button class="glossary-edit" type="button">${t('common.edit')}</button><button class="glossary-delete" type="button">${t('common.delete')}</button></div>`;
      row.querySelector('.glossary-edit').addEventListener('click', () => openTermEditor(realIndex));
      row.querySelector('.glossary-delete').addEventListener('click', () => deleteTerm(realIndex).catch((e) => trace(e.message, 'error')));
      list.appendChild(row);
    });
    syncUI();
  }

  function renderGlossaryOptions() {
    const select = get('glossarySelect');
    if (!select) return [];
    const current = state();
    const q = (current.glossaryFilterText || '').trim().toLowerCase();
    const currentName = current.glossary?.glossaryName || 'default';
    const fromState = Array.isArray(current.glossaryNames) ? current.glossaryNames : [];
    const domOptions = Array.from(select.querySelectorAll('option')).map((opt) => opt.value).filter(Boolean);
    const allNames = [...new Set([...fromState, ...domOptions, currentName].filter(Boolean))];
    const matched = allNames.filter((name) => !q || String(name).toLowerCase().includes(q));
    select.innerHTML = '';
    const options = matched.length ? matched : [currentName];
    options.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    select.value = options.includes(currentName) ? currentName : (options[0] || '');
    return options;
  }

  async function refreshList() {
    const current = state();
    const result = await window.rpgWorkbench.listGlossaries({ project: current.project });
    const names = Array.isArray(result?.glossaries) ? result.glossaries : (Array.isArray(result?.glossaryNames) ? result.glossaryNames : []);
    window.RpgAppStore?.setState?.({ glossaryNames: [...new Set(names.length ? names : [current.glossary?.glossaryName || 'default'])] });
    renderGlossaryOptions();
    return window.RpgAppStore?.getState?.().glossaryNames || [];
  }

  function setGlossary(next) {
    const current = state();
    window.RpgAppStore?.setState?.({ glossary: { projectName: next?.projectName || current.glossary?.projectName || '', glossaryName: next?.glossaryName || current.glossary?.glossaryName || 'default', category: next?.category || current.glossary?.category || 'default', terms: Array.isArray(next?.terms) ? next.terms : [] } });
    render();
    // 当前选中的术语库或其内容变化时，重算项目级聚合，避免命中检测对着旧库
    refreshAggregatedGlossary();
  }

  async function loadGlossary(name) {
    const current = state();
    const result = await window.rpgWorkbench.loadGlossary({ project: current.project, glossaryName: String(name || 'default').trim() || 'default' });
    if (result?.ok) setGlossary(result.glossary);
    return result;
  }

  async function saveGlossary() {
    const current = state();
    const select = get('glossarySelect');
    const name = String(select?.value || current.glossary?.glossaryName || 'default').trim() || 'default';
    window.RpgAppStore?.setState?.({ glossary: { ...current.glossary, glossaryName: name } });
    const result = await window.rpgWorkbench.saveGlossary({ project: current.project, glossary: window.RpgAppStore?.getState?.().glossary, glossaryName: name, exportName: name });
    await refreshList();
    syncUI();
    render();
    return result;
  }

  function showNewGlossaryPanel() {
    hideRenameGlossaryPanel();
    const panel = get('newGlossaryInline');
    const input = get('newGlossaryName');
    const categoryInput = get('newGlossaryCategory');
    panel?.classList.remove('hidden');
    if (input) { input.value = ''; input.focus(); }
    // 默认沿用当前活动子库的分类，便于多个子库自然聚合到同一分类
    if (categoryInput) categoryInput.value = state().glossary?.category || 'default';
  }
  function hideNewGlossaryPanel() { get('newGlossaryInline')?.classList.add('hidden'); }
  function showRenameGlossaryPanel() {
    hideNewGlossaryPanel();
    const current = state();
    const select = get('glossarySelect');
    const oldName = String(select?.value || current.glossary?.glossaryName || 'default').trim() || 'default';
    const panel = get('renameGlossaryInline');
    const input = get('renameGlossaryName');
    panel?.classList.remove('hidden');
    if (input) {
      input.value = oldName;
      input.focus();
      input.select();
    }
  }
  function hideRenameGlossaryPanel() { get('renameGlossaryInline')?.classList.add('hidden'); }

  async function createGlossaryFromInline() {
    const current = state();
    const name = String(get('newGlossaryName')?.value || `glossary-${Date.now()}`).trim() || `glossary-${Date.now()}`;
    // 新建子库时让用户指定分类（默认继承当前活动子库的分类，以便归到同一组聚合命中）
    const requestedCategory = String(get('newGlossaryCategory')?.value || '').trim();
    const category = requestedCategory || current.glossary?.category || 'default';
    if (!current.project?.rootDir) throw new Error(t('glossary.loadProjectFirst'));
    if (!window.rpgWorkbench?.saveGlossaryAs) throw new Error(t('glossary.saveAsApiMissing'));
    const nextGlossary = { projectName: current.glossary?.projectName || current.project?.name || '', glossaryName: name, category, terms: [] };
    trace('正在新建术语库…', 'normal');
    const result = await window.rpgWorkbench.saveGlossaryAs({ project: current.project, glossary: nextGlossary, defaultName: name });
    if (!result?.ok) {
      if (!result?.canceled) throw new Error(result?.message || t('glossary.createFailed'));
      trace(t('glossary.createCanceled'), 'normal');
      return result;
    }
    setGlossary(result.glossary || nextGlossary);
    await refreshList();
    renderGlossaryOptions();
    hideNewGlossaryPanel();
    trace(format('glossary.createdAt', { name: window.RpgAppStore?.getState?.().glossary?.glossaryName || name, path: result.path || '' }), 'success');
    render();
    // 新子库即便初始为空也要立刻参与命中聚合（避免后续添加术语时聚合不更新）
    await refreshAggregatedGlossary();
    return result;
  }

  async function exportGlossary() {
    const current = state();
    if (!current.project?.rootDir) throw new Error(t('glossary.loadProjectFirst'));
    if (!window.rpgWorkbench?.exportGlossaryAs) throw new Error(t('glossary.exportApiMissing'));
    await saveGlossary();
    trace('正在导出术语库…', 'normal');
    const result = await window.rpgWorkbench.exportGlossaryAs({ project: current.project, glossary: current.glossary, defaultName: current.glossary?.glossaryName || 'glossary' });
    if (!result?.ok) {
      if (!result?.canceled) throw new Error(result?.message || t('glossary.exportFailed'));
      trace(t('glossary.exportCanceled'), 'normal');
      return result;
    }
    trace(format('glossary.exported', { name: current.glossary?.glossaryName || 'glossary', path: result.path ? ` → ${result.path}` : '' }), 'success');
    return result;
  }

  async function importGlossary() {
    const current = state();
    if (!current.project?.rootDir) throw new Error(t('glossary.loadProjectFirst'));
    if (!window.rpgWorkbench?.pickGlossaryFile) throw new Error(t('glossary.importApiMissing'));
    const file = await window.rpgWorkbench.pickGlossaryFile();
    if (!file?.filePath) return;
    trace('正在导入术语库…', 'normal');
    const result = await window.rpgWorkbench.importGlossary({ project: current.project, filePath: file.filePath });
    if (!result?.ok) throw new Error(result?.message || t('glossary.importFailed'));
    await refreshList();
    setGlossary(result.glossary);
    trace(format('glossary.imported', { name: result.glossaryName }), 'success');
    // 导入后命中聚合需要重新构建
    await refreshAggregatedGlossary();
  }

  async function deleteGlossary() {
    const current = state();
    const select = get('glossarySelect');
    const name = String(select?.value || current.glossary?.glossaryName || 'default').trim() || 'default';
    if (!window.confirm(format('glossary.confirmDeleteGlossary', { name }))) return;
    const result = await window.rpgWorkbench.deleteGlossary({ project: current.project, glossaryName: name });
    if (!result?.ok) throw new Error(result?.message || t('glossary.deleteFailed'));
    const names = await refreshList();
    await loadGlossary(names[0] || 'default');
    trace(format('glossary.deleted', { name }), 'success');
    // 删除子库后聚合应剔除其贡献
    await refreshAggregatedGlossary();
  }

  async function renameCurrentGlossary(nextNameFromInput) {
    const current = state();
    const select = get('glossarySelect');
    const oldName = String(select?.value || current.glossary?.glossaryName || 'default').trim() || 'default';
    const nextName = String(nextNameFromInput || get('renameGlossaryName')?.value || '').trim();
    if (!nextName || nextName === oldName) { hideRenameGlossaryPanel(); return; }
    if (!window.rpgWorkbench?.renameGlossary) throw new Error(t('glossary.renameApiMissing'));
    trace(`正在重命名术语库：${oldName} → ${nextName}`, 'normal');
    const result = await window.rpgWorkbench.renameGlossary({ project: current.project, oldName, newName: nextName, overwrite: false });
    if (!result?.ok) throw new Error(result?.message || t('glossary.renameFailed'));
    hideRenameGlossaryPanel();
    await refreshList();
    await loadGlossary(result.glossaryName || nextName);
    renderGlossaryOptions();
    trace(format('glossary.renamed', { from: oldName, to: result.glossaryName || nextName }), 'success');
    // 重命名后 contributingGlossaries 的 name 会变，重新聚合
    await refreshAggregatedGlossary();
  }

  /**
   * 修改当前术语库的分类标签。从 #glossaryCategoryInput 读取分类名，
   * 调用主进程后刷新当前 store + 列表 + 聚合。
   */
  async function updateCurrentGlossaryCategory() {
    const current = state();
    if (!current.project?.rootDir || !current.glossary?.glossaryName) return;
    if (!window.rpgWorkbench?.updateGlossaryCategory) throw new Error(t('glossary.updateCategoryApiMissing'));
    const input = get('glossaryCategoryInput');
    const nextCategory = String(input?.value || 'default').trim() || 'default';
    if (nextCategory === (current.glossary?.category || 'default')) return;
    trace(format('glossary.categoryUpdating', { name: current.glossary.glossaryName, category: nextCategory }), 'normal');
    const result = await window.rpgWorkbench.updateGlossaryCategory({
      project: current.project,
      glossaryName: current.glossary.glossaryName,
      category: nextCategory,
    });
    if (!result?.ok) throw new Error(result?.message || t('glossary.categoryUpdateFailed'));
    // 更新本地 store 的 glossary.category，避免后续聚合用错分类
    window.RpgAppStore?.setState?.({ glossary: { ...current.glossary, category: result.category } });
    trace(format('glossary.categoryUpdated', { name: current.glossary.glossaryName, category: result.category }), 'success');
    await refreshAggregatedGlossary();
    syncUI();
  }

  function bindGlossaryActions() {
    get('newGlossaryBtn')?.addEventListener('click', () => showNewGlossaryPanel());
    get('confirmNewGlossaryBtn')?.addEventListener('click', () => createGlossaryFromInline().catch((e) => trace(e.message, 'error')));
    get('cancelNewGlossaryBtn')?.addEventListener('click', () => hideNewGlossaryPanel());
    get('newGlossaryName')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createGlossaryFromInline().catch((er) => trace(er.message, 'error')); if (e.key === 'Escape') hideNewGlossaryPanel(); });
    get('renameGlossaryBtn')?.addEventListener('click', () => showRenameGlossaryPanel());
    get('confirmRenameGlossaryBtn')?.addEventListener('click', () => renameCurrentGlossary().catch((e) => trace(e.message, 'error')));
    get('cancelRenameGlossaryBtn')?.addEventListener('click', () => hideRenameGlossaryPanel());
    get('renameGlossaryName')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') renameCurrentGlossary().catch((er) => trace(er.message, 'error')); if (e.key === 'Escape') hideRenameGlossaryPanel(); });
    get('importGlossaryBtn')?.addEventListener('click', () => importGlossary().catch((e) => trace(e.message, 'error')));
    get('exportGlossaryBtn')?.addEventListener('click', () => exportGlossary().catch((e) => trace(e.message, 'error')));
    get('deleteGlossaryBtn')?.addEventListener('click', () => deleteGlossary().catch((e) => trace(e.message, 'error')));
    get('scanDataRootsBtn')?.addEventListener('click', async () => {
      const current = state();
      if (!current.project?.rootDir) { trace(t('project.scanDataRootsMissing'), 'error'); return; }
      trace('正在扫描文本目录…', 'normal');
      const result = await window.rpgWorkbench?.scanProjectDataRoots?.(current.project.rootDir);
      if (!result?.ok) { trace(format('project.scanDataRootsFailed', { message: result?.message || 'unknown' }), 'error'); return; }
      const roots = Array.isArray(result.dataRoots) ? result.dataRoots : [];
      trace(roots.length ? format('project.scanDataRootsDone', { count: roots.length }) : t('project.scanDataRootsEmpty'), roots.length ? 'success' : 'normal');
      if (roots.length) await window.RpgProject?.loadProject?.(current.project.rootDir);
    });
    get('addTermBtn')?.addEventListener('click', () => openTermEditor(-1));
    get('confirmTermBtn')?.addEventListener('click', () => saveTermFromEditor().catch((e) => trace(e.message, 'error')));
    get('cancelTermBtn')?.addEventListener('click', () => closeTermEditor());
    get('termEditorBackdrop')?.addEventListener('click', () => closeTermEditor());
    get('termEditorCloseBtn')?.addEventListener('click', () => closeTermEditor());
    // 用户开始输入即清除原先的红字校验提示，避免修复后还看到旧报错。
    get('termSource')?.addEventListener('input', () => clearTermFieldError());
    get('termTarget')?.addEventListener('input', () => clearTermFieldError());
    // 分类管理：把当前活动子库改入指定分类，所有同分类子库自动聚合命中
    get('applyGlossaryCategoryBtn')?.addEventListener('click', () => updateCurrentGlossaryCategory().catch((e) => trace(e.message, 'error')));
    get('glossaryCategoryInput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') updateCurrentGlossaryCategory().catch((er) => trace(er.message, 'error')); });
    get('glossarySelect')?.addEventListener('change', (e) => loadGlossary(e.target.value).catch((er) => trace(er.message, 'error')));
    const glossarySearchInput = get('glossarySearch');
    glossarySearchInput?.addEventListener('input', () => {
      const current = state();
      window.RpgAppStore?.setState?.({ glossaryFilterText: glossarySearchInput.value || '' });
      const options = renderGlossaryOptions();
      if (options.length && !options.includes(current.glossary?.glossaryName)) loadGlossary(options[0]).catch((er) => trace(er.message, 'error'));
    });
    const searchInput = get('termSearch');
    const searchBtn = get('searchTermBtn');
    const applySearch = () => { window.RpgAppStore?.setState?.({ filterText: searchInput?.value || '' }); window.RpgApp?.renderEntryList?.(); };
    searchInput?.addEventListener('input', applySearch);
    searchBtn?.addEventListener('click', applySearch);
  }

  function updateContext(project, glossary) {
    const current = state();
    window.RpgAppStore?.setState?.({
      project: project || current.project,
      glossary: glossary || current.glossary,
      glossaryFilterText: current.glossaryFilterText || '',
    });
    syncUI();
    // 项目或活动子库变化都会改变聚合范围，刷新一次保证命中检测对得上
    refreshAggregatedGlossary();
  }

  window.RpgGlossaryModule = { syncUI, openTermEditor, closeTermEditor, render, refreshList, loadGlossary, saveGlossary, setGlossary, showNewGlossaryPanel, hideNewGlossaryPanel, showRenameGlossaryPanel, hideRenameGlossaryPanel, createGlossaryFromInline, exportGlossary, importGlossary, deleteGlossary, renameCurrentGlossary, bindGlossaryActions, updateContext, refreshAggregatedGlossary, updateCurrentGlossaryCategory };
})();