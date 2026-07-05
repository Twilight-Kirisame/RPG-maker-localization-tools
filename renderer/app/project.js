(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;
  const tf = (key, params = {}) => {
    let text = t(key);
    Object.keys(params || {}).forEach((k) => {
      text = text.split(`{${k}}`).join(String(params[k] ?? ''));
    });
    return text;
  };

  /**
   * 渲染项目状态 UI（projectPath + engineBadge + engineHint）。
   * @param {{project:Object, recognized:boolean, displayName:string, hasDataRoots:boolean, warnings:string[], status:string}} params
   */
  function refreshProjectStatusUi({ project = {}, recognized = false, displayName = 'unknown', hasDataRoots = false, warnings = [], status = '' } = {}) {
    const projectPath = get('projectPath');
    const engineBadge = get('engineBadge');
    const engineHint = get('engineHint');
    if (projectPath) projectPath.textContent = project.rootDir || t('workspace.noProject');
    if (engineBadge) {
      engineBadge.textContent = recognized ? (displayName === 'unknown' ? t('project.recognized') : displayName) : t('project.unrecognized');
      engineBadge.className = `badge ${recognized ? 'success' : 'warn'}`;
      engineBadge.dataset.projectSignature = project.rootDir
        ? [project.rootDir || '', project.engine || '', displayName || '', (project.dataRoots || []).join('|')].join('::')
        : '';
    }
    if (engineHint) {
      const dataRootText = hasDataRoots
        ? `${t('project.dataRootsLabel')}${(project.dataRoots || []).map((dir) => String(dir).replace(project.rootDir || '', '').replace(/^[/\\]/, '') || '.').join('；')}`
        : '';
      const scanStatus = hasDataRoots ? tf('project.dataRootsFound', { count: (project.dataRoots || []).length }) : t('project.dataRootsEmpty');
      const stateText = status === 'project-loaded' ? t('project.statusLoaded') : status === 'draft-loaded' ? t('project.statusDraft') : status === 'loading-project' ? t('project.statusLoading') : '';
      engineHint.textContent = dataRootText
        || `${stateText ? `${stateText}；` : ''}${scanStatus}；${warnings.length ? warnings.join('；') : (recognized ? t('project.recognizedHint') : t('project.hint'))}`;
      engineHint.dataset.projectSignature = engineBadge?.dataset.projectSignature || '';
    }
  }

  /**
   * 兜底刷新：从当前 store 推回 hero/sidebar 三件套。
   * 任何路径只要改了 state.project 都可以调用本函数让 UI 即时同步。
   */
  function syncProjectStatusFromState() {
    const current = state();
    const project = current.project || {};
    const hasDataRoots = Array.isArray(project.dataRoots) && project.dataRoots.length > 0;
    const hasEntries = (current.entries || []).length > 0;
    const hasGroupedFiles = (current.groupedFiles || []).length > 0;
    const hasFileList = (current.fileList || []).length > 0;
    const recognized = Boolean(project.rootDir) && (hasDataRoots || hasEntries || hasGroupedFiles || hasFileList || (project.engine && project.engine !== 'unknown') || (project.displayName && project.displayName !== 'unknown') || current.status === 'project-loaded' || current.status === 'draft-loaded');
    const displayName = project.displayName || project.engine || (recognized ? t('project.recognized') : 'unknown');
    const status = current.loading ? 'loading-project' : (current.status || (recognized ? 'project-loaded' : 'project-empty'));
    refreshProjectStatusUi({ project, recognized, displayName, hasDataRoots, warnings: current.loading ? [t('project.statusLoading')] : [], status });
  }

  /**
   * 合并主进程返回的 project info 与当前 store 中的 project，再回写并刷新 UI。
   * 适用于 pickProjectFolder / loadProjectTexts / loadDraftFile 三类入口的返回值。
   * @returns {{recognized:boolean, project:Object, glossary:Object, aiSettings:Object, projectSignature:string}}
   */
  function syncStatusFromProject(info) {
    const current = state();
    const currentProject = current.project || {};
    const incomingProject = info?.project || info || {};
    const project = {
      ...currentProject,
      ...incomingProject,
      rootDir: incomingProject.rootDir || incomingProject.projectRoot || currentProject.rootDir || '',
      dataRoots: Array.isArray(incomingProject.dataRoots) && incomingProject.dataRoots.length ? incomingProject.dataRoots : (Array.isArray(currentProject.dataRoots) ? currentProject.dataRoots : []),
      engine: incomingProject.engine || currentProject.engine || 'unknown',
      adapterId: incomingProject.adapterId || currentProject.adapterId || '',
      displayName: incomingProject.displayName || currentProject.displayName || incomingProject.engine || currentProject.engine || 'unknown',
    };
    const glossary = info?.glossary || current.glossary;
    // 项目加载 / 草稿加载时主进程会把"按分类聚合的术语合集"一并返回。命中检测与 AI 注入都走聚合版，
    // 这样多个子库（如「角色名」「物品名」）只要分类相同就能同时参与命中。
    const aggregatedGlossary = info?.aggregatedGlossary || current.aggregatedGlossary || null;
    const aiSettings = info?.aiSettings || current.aiSettings || {};
    if (!aiSettings.traditional) aiSettings.traditional = {};
    const hasProjectRoot = Boolean(project.rootDir);
    const hasDataRoots = Array.isArray(project.dataRoots) && project.dataRoots.length > 0;
    const hasLoadedEntries = Array.isArray(info?.entries) ? info.entries.length > 0 : Array.isArray(current.entries) && current.entries.length > 0;
    const hasGroupedFiles = (current.groupedFiles || []).length > 0 || (info?.groupedFiles || []).length > 0;
    const hasFileList = Array.isArray(info?.files) ? info.files.length > 0 : Array.isArray(current.fileList) && current.fileList.length > 0;
    const engine = project.engine || (hasDataRoots ? 'RPG Maker MV/MZ' : 'unknown');
    const displayName = project.displayName || engine;
    const recognized = hasProjectRoot && (hasDataRoots || hasLoadedEntries || hasGroupedFiles || hasFileList || engine !== 'unknown' || displayName !== 'unknown');
    const projectSignature = [project.rootDir || '', project.engine || '', project.displayName || '', (project.dataRoots || []).join('|')].join('::');
    const prevSignature = current.activeProjectSignature || '';
    const switchedProject = recognized && prevSignature && prevSignature !== projectSignature;

    window.RpgAppStore?.setState?.({
      project,
      projectSignature,
      glossary,
      aggregatedGlossary,
      aiSettings,
      entries: Array.isArray(info?.entries) ? info.entries : (Array.isArray(info?.project?.entries) ? info.project.entries : current.entries || []),
      status: recognized ? (info?.draft ? 'draft-loaded' : 'project-loaded') : 'project-empty',
      activeProjectSignature: recognized ? projectSignature : prevSignature,
      // 切换到不同项目时清空与上一个项目绑定的工作区状态
      ...(switchedProject ? { currentFile: '', currentEntryIndex: 0, contextGroupSelection: [], entryViewMode: 'single' } : {}),
    });

    refreshProjectStatusUi({ project, recognized, displayName, hasDataRoots, warnings: info?.warnings || [] });
    window.RpgView?.syncUiSettingsFields?.({ preserveBackground: true });
    window.RpgApp?.syncGlobalAiModeSelect?.();
    window.RpgGlossaryModule?.updateContext?.(project, glossary);
    if (window.setCallTraceStatus) window.setCallTraceStatus(project.rootDir ? tf('project.ready', { path: project.rootDir }) : t('workspace.noProject'), recognized ? 'success' : 'warning');
    window.renderTraditionalStatus?.();
    window.setVersionLabel?.();
    window.traceCall?.(t('trace.projectStatus'), `rootDir=${project.rootDir || ''} | engine=${engine} | displayName=${displayName} | dataRoots=${project.dataRoots?.length || 0} | recognized=${recognized}`, recognized ? 'success' : 'warning');
    return { recognized, project, glossary, aiSettings, projectSignature };
  }

  async function loadFile(file) {
    const current = window.RpgAppStore?.getState?.() || {};
    const rootDir = current.project?.rootDir;
    if (!rootDir || !file) return;
    const fileInfo = (current.fileList || []).find((f) => f.file === file);
    const isLoaded = fileInfo?.loaded;
    const alreadyInGroup = (current.groupedFiles || []).some((g) => g.file === file);
    // 已加载过的文件直接切换，不再请求主进程
    if (isLoaded && alreadyInGroup) {
      window.RpgAppStore?.setState?.({ currentFile: file, currentEntryIndex: 0 });
      window.RpgApp?.renderFileSelect?.();
      window.RpgApp?.renderEntryList?.();
      window.RpgApp?.renderCurrentEntry?.();
      return;
    }
    window.traceCall?.(t('trace.openProject'), tf('trace.prepareRead', { path: `${rootDir} > ${file}` }), 'pending');
    const result = window.RpgAppController?.loadFileEntries
      ? await window.RpgAppController.loadFileEntries(rootDir, file)
      : await window.rpgWorkbench.loadFileEntries(rootDir, file);
    const entries = result?.entries || [];
    window.traceCall?.(t('trace.openProject'), tf('trace.mainProcessReturn', { entries: entries.length, warnings: result?.warnings?.length || 0 }), entries.length ? 'success' : 'warning');
    // 只替换当前文件的 entries，保留其他已加载文件
    const nextGroupedFiles = (current.groupedFiles || []).map((group) => {
      if (group.file !== file) return group;
      return window.RpgEntries?.buildGroupedFilesForFile?.(file, entries) || { file, items: entries.map((item, index) => ({ ...item, localIndex: index, sourceDraft: '', targetDraft: String(item.targetDraft ?? item.target ?? ''), translationStatus: item.translationStatus || item.draftStatus || (String(item.target || '').trim() ? 'translated' : 'pending'), draftStatus: item.draftStatus || item.translationStatus || (String(item.target || '').trim() ? 'translated' : 'pending') })) };
    });
    // 若当前文件还没在 groupedFiles 中，追加
    const hasFile = nextGroupedFiles.some((g) => g.file === file);
    if (!hasFile) {
      const built = window.RpgEntries?.buildGroupedFilesForFile?.(file, entries);
      if (built) nextGroupedFiles.push(built);
    }
    // 标记文件已加载
    const nextFileList = (current.fileList || []).map((f) => (f.file === file ? { ...f, loaded: true } : f));
    window.RpgAppStore?.setState?.({ groupedFiles: nextGroupedFiles, fileList: nextFileList, currentFile: file, currentEntryIndex: 0 });
    window.RpgApp?.renderFileSelect?.();
    window.RpgApp?.renderEntryList?.();
    window.RpgApp?.renderCurrentEntry?.();
  }

  async function applyProjectResult(result, { isDraft = false, draftPath = '' } = {}) {
    const useLazyLoad = Boolean(result?.useLazyLoad || result?.project?.useLazyLoad);
    if (useLazyLoad) {
      const fileList = Array.isArray(result?.files) ? result.files : (Array.isArray(result?.project?.files) ? result.project.files : []);
      const firstFile = fileList[0]?.file || '';
      window.RpgAppStore?.setState?.({
        entries: [],
        groupedFiles: [],
        fileList,
        currentFile: '',
        currentEntryIndex: 0,
      });
      const synced = syncStatusFromProject(result);
      window.RpgAppStore?.setState?.({
        loading: false,
        status: synced.recognized ? (isDraft ? 'draft-loaded' : 'project-loaded') : 'project-empty',
        ...(draftPath ? { draftPath } : {}),
      });
      syncProjectStatusFromState();
      window.RpgApp?.renderFileSelect?.();
      window.RpgApp?.renderEntryList?.();
      window.RpgApp?.renderCurrentEntry?.();
      window.showProjectStatus?.(`${t('workspace.load')}：${fileList.length} ${t('stats.files')}`, synced.recognized ? 'success' : 'warning');
      if (firstFile) {
        await loadFile(firstFile);
      }
      return;
    }

    const entries = result?.entries || result?.project?.entries || [];
    const groupedFiles = window.RpgEntries?.buildGroupedFiles?.(entries) || [];
    const currentFile = groupedFiles[0]?.file || '';
    window.traceCall?.(t('trace.openProject'), `groupedFiles=${groupedFiles.length}, currentFile=${currentFile}`, groupedFiles.length ? 'success' : 'warning');
    window.RpgAppStore?.setState?.({ entries, groupedFiles, currentFile, currentEntryIndex: 0, fileList: [] });
    const synced = syncStatusFromProject(result);
    const finalCurrentFile = (window.RpgAppStore?.getState?.().groupedFiles || [])[0]?.file || currentFile || '';
    window.RpgAppStore?.setState?.({
      currentFile: finalCurrentFile,
      loading: false,
      status: synced.recognized ? (isDraft ? 'draft-loaded' : 'project-loaded') : 'project-empty',
      ...(draftPath ? { draftPath } : {}),
    });
    syncProjectStatusFromState();
    window.RpgApp?.renderFileSelect?.();
    window.RpgApp?.renderEntryList?.();
    window.RpgApp?.renderCurrentEntry?.();
    requestAnimationFrame(() => {
      const current = window.RpgAppStore?.getState?.() || {};
      if ((current.groupedFiles || []).length) {
        window.RpgApp?.renderFileSelect?.();
        window.RpgApp?.renderEntryList?.();
        window.RpgApp?.renderCurrentEntry?.();
      }
    });
    window.showProjectStatus?.(`${t('workspace.load')}：${entries.length} ${t('stats.groups')}`, synced.recognized ? 'success' : 'warning');
  }

  async function loadProject(rootDir) {
    window.traceCall?.(t('trace.openProject'), tf('trace.prepareRead', { path: rootDir }), 'pending');
    window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || t('common.processing'), 'pending');
    window.RpgAppStore?.setState?.({ loading: true, status: 'loading-project' });
    syncProjectStatusFromState();
    const result = window.RpgAppController?.loadProjectTexts ? await window.RpgAppController.loadProjectTexts(rootDir) : await window.rpgWorkbench.loadProjectTexts(rootDir);
    window.traceCall?.(t('trace.openProject'), tf('trace.mainProcessReturn', { entries: result?.entries?.length || 0, warnings: result?.warnings?.length || 0 }), result?.entries?.length ? 'success' : (result?.useLazyLoad ? 'success' : 'error'));
    await applyProjectResult(result);
    return result;
  }

  function bindProjectActions() {
    const pickFolderBtn = get('pickFolderBtn');
    const saveDraftBtn = get('saveDraftBtn');
    const resetProjectBtn = get('resetProjectBtn');

    pickFolderBtn?.addEventListener('click', async () => {
      try {
        const prev = window.RpgAppStore?.getState?.() || {};
        window.traceCall?.(t('trace.openProject'), t('trace.callSystemDirPicker'), 'pending');
        window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || t('common.processing'), 'pending');
        const info = window.RpgAppController?.pickProjectFolder ? await window.RpgAppController.pickProjectFolder() : await window.rpgWorkbench.pickProjectFolder();
        if (!info) {
          window.traceCall?.(t('trace.openProject'), t('trace.userCancel'), 'warning');
          syncProjectStatusFromState();
          return;
        }
        window.traceCall?.(t('trace.openProject'), tf('trace.pickResult', { rootDir: info.rootDir || 'N/A', engine: info.engine || 'unknown' }), 'success');
        if (info.rootDir) await loadProject(info.rootDir);
      } catch (error) {
        window.traceCall?.(t('trace.openProject'), error.message || t('common.unknownError'), 'error');
        window.showProjectStatus?.(error.message || (window.RpgView?.t?.('common.aiTestFail') || t('common.operationFailed')), 'error');
      }
    });

    saveDraftBtn?.addEventListener('click', async () => {
      try {
        window.traceCall?.(t('trace.loadDraftBtn'), t('trace.startPickDraftFile'), 'pending');
        const file = window.RpgAppController?.pickDraftFile ? await window.RpgAppController.pickDraftFile() : await window.rpgWorkbench.pickDraftFile();
        if (!file?.filePath) {
          window.traceCall?.(t('trace.loadDraftBtn'), t('trace.userCancel'), 'error');
          return;
        }
        const result = window.RpgAppController?.loadDraftFile ? await window.RpgAppController.loadDraftFile(file.filePath) : await window.rpgWorkbench.loadDraftFile(file.filePath);
        if (!result?.ok) {
          const message = result?.message || t('draft.loadFailed');
          window.traceCall?.(t('trace.loadDraftBtn'), message, 'error');
          window.showProjectStatus?.(message, 'error');
          return;
        }
        await applyProjectResult(result, { isDraft: true, draftPath: result.draftPath || file.filePath });
        window.showProjectStatus?.(tf('draft.loaded', { path: file.filePath }), 'success');
        window.traceCall?.(t('trace.loadDraftBtn'), tf('trace.draftOpened', { path: file.filePath }), 'success');
      } catch (error) {
        window.traceCall?.(t('trace.loadDraftBtn'), error.message || t('common.unknownError'), 'error');
        window.showProjectStatus?.(error.message || (window.RpgView?.t?.('common.aiTestFail') || t('common.operationFailed')), 'error');
      }
    });
  }

  window.RpgProject = { syncStatusFromProject, syncProjectStatusFromState, refreshProjectStatusUi, loadProject, loadFile, bindProjectActions };
})();
