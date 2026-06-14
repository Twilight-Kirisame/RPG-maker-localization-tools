(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;
  const format = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), t(key));

  function getTerms() {
    const glossary = state().glossary || { terms: [] };
    return Array.isArray(glossary.terms) ? glossary.terms : [];
  }

  function setTerms(terms) {
    const current = state().glossary || { projectName: '', glossaryName: 'default', terms: [] };
    window.RpgAppStore?.setState?.({ glossary: { ...current, terms: Array.isArray(terms) ? terms : [] } });
  }

  function syncUI() {
    const current = state();
    const status = get('glossaryStatus');
    const count = get('glossaryCount');
    const hint = get('glossaryHint');
    const nameInput = get('glossaryName');
    const searchInput = get('termSearch');
    if (nameInput) nameInput.value = current.glossary?.glossaryName || 'default';
    if (status) status.textContent = `${current.glossary?.projectName || t('glossary.currentProject')} / ${current.glossary?.glossaryName || 'default'}`;
    if (count) count.textContent = String(getTerms().length);
    if (hint) hint.textContent = getTerms().length ? format('glossary.termCountHint', { count: getTerms().length }) : t('glossary.emptyHint');
    if (searchInput && document.activeElement !== searchInput) searchInput.value = current.glossaryFilterText || '';
  }

  function openTermEditor(index = -1) {
    const terms = getTerms();
    const term = index >= 0 ? terms[index] : { source: '', target: '', note: '' };
    window.RpgAppStore?.setState?.({ editingIndex: index });
    get('termSource').value = term?.source || '';
    get('termTarget').value = term?.target || '';
    get('termNote').value = term?.note || '';
    get('termEditorModal')?.classList.remove('hidden');
  }

  function closeTermEditor() {
    get('termEditorModal')?.classList.add('hidden');
  }

  async function persistGlossary(message) {
    const current = state();
    const result = await window.rpgWorkbench.saveGlossary({ project: current.project, glossary: current.glossary, glossaryName: current.glossary?.glossaryName || 'default' });
    if (!result?.ok) throw new Error(result?.message || t('glossary.saveFailed'));
    if (message) window.__rpgTrace?.(message, 'success');
    window.RpgProject?.syncStatusFromProject?.({ project: current.project, glossary: result.glossary || current.glossary, aiSettings: current.aiSettings, warnings: [] });
    return result;
  }

  async function saveTermFromEditor() {
    const source = get('termSource')?.value?.trim() || '';
    const target = get('termTarget')?.value?.trim() || '';
    const note = get('termNote')?.value?.trim() || '';
    if (!source || !target) return;
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
      const row = document.createElement('div');
      row.className = 'glossary-item glossary-row';
      row.innerHTML = `<div class="glossary-text"><strong>${term.source || '—'}</strong> → ${term.target || '—'}${term.note ? `<div class="glossary-note">${term.note}</div>` : ''}</div><div class="glossary-row-actions"><button class="glossary-edit" type="button">${t('common.edit')}</button><button class="glossary-delete" type="button">${t('common.delete')}</button></div>`;
      row.querySelector('.glossary-edit').addEventListener('click', () => openTermEditor(realIndex));
      row.querySelector('.glossary-delete').addEventListener('click', () => deleteTerm(realIndex).catch((e) => window.__rpgTrace?.(e.message, 'error')));
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
    window.RpgAppStore?.setState?.({ glossary: { projectName: next?.projectName || current.glossary?.projectName || '', glossaryName: next?.glossaryName || current.glossary?.glossaryName || 'default', terms: Array.isArray(next?.terms) ? next.terms : [] } });
    render();
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

  function showNewGlossaryPanel() { const panel = get('newGlossaryInline'); const input = get('newGlossaryName'); panel?.classList.remove('hidden'); if (input) { input.value = ''; input.focus(); } }
  function hideNewGlossaryPanel() { get('newGlossaryInline')?.classList.add('hidden'); }

  async function createGlossaryFromInline() {
    const current = state();
    const name = String(get('newGlossaryName')?.value || `glossary-${Date.now()}`).trim() || `glossary-${Date.now()}`;
    if (!current.project?.rootDir) throw new Error(t('glossary.loadProjectFirst'));
    if (!window.rpgWorkbench?.saveGlossaryAs) throw new Error(t('glossary.saveAsApiMissing'));
    const nextGlossary = { projectName: current.glossary?.projectName || current.project?.name || '', glossaryName: name, terms: [] };
    const result = await window.rpgWorkbench.saveGlossaryAs({ project: current.project, glossary: nextGlossary, defaultName: name });
    if (!result?.ok) {
      if (!result?.canceled) throw new Error(result?.message || t('glossary.createFailed'));
      window.__rpgTrace?.(t('glossary.createCanceled'), 'normal');
      return result;
    }
    setGlossary(result.glossary || nextGlossary);
    await refreshList();
    renderGlossaryOptions();
    hideNewGlossaryPanel();
    window.__rpgTrace?.(format('glossary.createdAt', { name: window.RpgAppStore?.getState?.().glossary?.glossaryName || name, path: result.path || '' }), 'success');
    render();
    return result;
  }

  async function exportGlossary() {
    const current = state();
    if (!current.project?.rootDir) throw new Error(t('glossary.loadProjectFirst'));
    if (!window.rpgWorkbench?.exportGlossaryAs) throw new Error(t('glossary.exportApiMissing'));
    await saveGlossary();
    const result = await window.rpgWorkbench.exportGlossaryAs({ project: current.project, glossary: current.glossary, defaultName: current.glossary?.glossaryName || 'glossary' });
    if (!result?.ok) {
      if (!result?.canceled) throw new Error(result?.message || t('glossary.exportFailed'));
      window.__rpgTrace?.(t('glossary.exportCanceled'), 'normal');
      return result;
    }
    window.__rpgTrace?.(format('glossary.exported', { name: current.glossary?.glossaryName || 'glossary', path: result.path ? ` → ${result.path}` : '' }), 'success');
    return result;
  }

  async function importGlossary() {
    const current = state();
    if (!current.project?.rootDir) throw new Error(t('glossary.loadProjectFirst'));
    if (!window.rpgWorkbench?.pickGlossaryFile) throw new Error(t('glossary.importApiMissing'));
    const file = await window.rpgWorkbench.pickGlossaryFile();
    if (!file?.filePath) return;
    const result = await window.rpgWorkbench.importGlossary({ project: current.project, filePath: file.filePath });
    if (!result?.ok) throw new Error(result?.message || t('glossary.importFailed'));
    await refreshList();
    setGlossary(result.glossary);
    window.__rpgTrace?.(format('glossary.imported', { name: result.glossaryName }), 'success');
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
    window.__rpgTrace?.(format('glossary.deleted', { name }), 'success');
  }

  async function renameCurrentGlossary() {
    const current = state();
    const select = get('glossarySelect');
    const oldName = String(select?.value || current.glossary?.glossaryName || 'default').trim() || 'default';
    const nextName = String(window.prompt(t('glossary.renamePrompt') || '请输入新的术语库名称', oldName) || '').trim();
    if (!nextName || nextName === oldName) return;
    if (!window.rpgWorkbench?.renameGlossary) throw new Error(t('glossary.renameApiMissing'));
    const result = await window.rpgWorkbench.renameGlossary({ project: current.project, oldName, newName: nextName, overwrite: false });
    if (!result?.ok) throw new Error(result?.message || t('glossary.renameFailed'));
    await refreshList();
    await loadGlossary(result.glossaryName || nextName);
    window.__rpgTrace?.(format('glossary.renamed', { from: oldName, to: result.glossaryName || nextName }), 'success');
  }

  function bindGlossaryActions() {
    get('newGlossaryBtn')?.addEventListener('click', () => showNewGlossaryPanel());
    get('confirmNewGlossaryBtn')?.addEventListener('click', () => createGlossaryFromInline().catch((e) => window.__rpgTrace?.(e.message, 'error')));
    get('cancelNewGlossaryBtn')?.addEventListener('click', () => hideNewGlossaryPanel());
    get('newGlossaryName')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') createGlossaryFromInline().catch((er) => window.__rpgTrace?.(er.message, 'error')); if (e.key === 'Escape') hideNewGlossaryPanel(); });
    get('importGlossaryBtn')?.addEventListener('click', () => importGlossary().catch((e) => window.__rpgTrace?.(e.message, 'error')));
    get('exportGlossaryBtn')?.addEventListener('click', () => exportGlossary().catch((e) => window.__rpgTrace?.(e.message, 'error')));
    get('deleteGlossaryBtn')?.addEventListener('click', () => deleteGlossary().catch((e) => window.__rpgTrace?.(e.message, 'error')));
    get('renameGlossaryBtn')?.addEventListener('click', () => renameCurrentGlossary().catch((e) => window.__rpgTrace?.(e.message, 'error')));
    get('scanDataRootsBtn')?.addEventListener('click', async () => {
      const current = state();
      if (!current.project?.rootDir) { window.__rpgTrace?.(t('project.scanDataRootsMissing'), 'error'); return; }
      const result = await window.rpgWorkbench?.scanProjectDataRoots?.(current.project.rootDir);
      if (!result?.ok) { window.__rpgTrace?.(format('project.scanDataRootsFailed', { message: result?.message || 'unknown' }), 'error'); return; }
      const roots = Array.isArray(result.dataRoots) ? result.dataRoots : [];
      window.__rpgTrace?.(roots.length ? format('project.scanDataRootsDone', { count: roots.length }) : t('project.scanDataRootsEmpty'), roots.length ? 'success' : 'normal');
      if (roots.length) await window.RpgProject?.loadProject?.(current.project.rootDir);
    });
    get('addTermBtn')?.addEventListener('click', () => openTermEditor(-1));
    get('confirmTermBtn')?.addEventListener('click', () => saveTermFromEditor().catch((e) => window.__rpgTrace?.(e.message, 'error')));
    get('cancelTermBtn')?.addEventListener('click', () => closeTermEditor());
    get('termEditorBackdrop')?.addEventListener('click', () => closeTermEditor());
    get('termEditorCloseBtn')?.addEventListener('click', () => closeTermEditor());
    get('glossarySelect')?.addEventListener('change', (e) => loadGlossary(e.target.value).catch((er) => window.__rpgTrace?.(er.message, 'error')));
    const glossarySearchInput = get('glossarySearch');
    glossarySearchInput?.addEventListener('input', () => {
      const current = state();
      window.RpgAppStore?.setState?.({ glossaryFilterText: glossarySearchInput.value || '' });
      const options = renderGlossaryOptions();
      if (options.length && !options.includes(current.glossary?.glossaryName)) loadGlossary(options[0]).catch((er) => window.__rpgTrace?.(er.message, 'error'));
    });
    const searchInput = get('termSearch');
    const searchBtn = get('searchTermBtn');
    const applySearch = () => { window.RpgAppStore?.setState?.({ filterText: searchInput?.value || '' }); window.RpgApp?.renderEntryList?.(); };
    searchInput?.addEventListener('input', applySearch);
    searchBtn?.addEventListener('click', applySearch);
  }

  window.RpgGlossaryModule = { syncUI, openTermEditor, closeTermEditor, render, refreshList, loadGlossary, saveGlossary, setGlossary, showNewGlossaryPanel, hideNewGlossaryPanel, createGlossaryFromInline, exportGlossary, importGlossary, deleteGlossary, renameCurrentGlossary, bindGlossaryActions };
})();
