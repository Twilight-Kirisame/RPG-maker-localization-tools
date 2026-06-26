(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;

  function refreshProjectStatusUi({ project = {}, recognized = false, displayName = 'unknown', hasDataRoots = false, warnings = [], status = '' } = {}) {
    const projectPath = get('projectPath');
    const engineBadge = get('engineBadge');
    const engineHint = get('engineHint');
    if (projectPath) projectPath.textContent = project.rootDir || t('workspace.noProject');
    if (engineBadge) {
      engineBadge.textContent = recognized ? (displayName === 'unknown' ? '已识别' : displayName) : t('project.unrecognized');
      engineBadge.className = `badge ${recognized ? 'success' : 'warn'}`;
      engineBadge.dataset.projectSignature = project.rootDir ? [project.rootDir || '', project.engine || '', displayName || '', (project.dataRoots || []).join('|')].join('::') : '';
    }
    if (engineHint) {
      const dataRootText = hasDataRoots ? `文本目录：${(project.dataRoots || []).map((dir) => String(dir).replace(project.rootDir || '', '').replace(/^[/\\]/, '') || '.').join('；')}` : '';
      const scanStatus = hasDataRoots ? `已扫描到 ${(project.dataRoots || []).length} 个文本目录` : '未扫描到文本目录';
      const stateText = status === 'project-loaded' ? '项目已加载' : status === 'draft-loaded' ? '草稿已加载' : '';
      engineHint.textContent = dataRootText || `${stateText ? `${stateText}；` : ''}${scanStatus}；${warnings.length ? warnings.join('；') : (recognized ? '已识别到项目结构，可继续导入与翻译。' : t('project.hint'))}`;
      engineHint.dataset.projectSignature = engineBadge?.dataset.projectSignature || '';
    }
  }

  function syncProjectStatusFromState() {
    const current = state();
    const project = current.project || {};
    const hasDataRoots = Array.isArray(project.dataRoots) && project.dataRoots.length > 0;
    const hasEntries = (current.entries || []).length > 0;
    const hasSignature = Boolean(current.activeProjectSignature || current.projectSignature);
    const recognized = Boolean(project.rootDir || hasSignature) && (hasDataRoots || hasEntries || project.engine !== 'unknown' || project.displayName !== 'unknown' || current.status === 'project-loaded' || current.status === 'draft-loaded');
    const displayName = project.displayName || project.engine || (recognized ? '已识别' : 'unknown');
    const status = current.loading ? 'loading-project' : (current.status || (recognized ? 'project-loaded' : 'project-empty'));
    refreshProjectStatusUi({ project, recognized, displayName, hasDataRoots, warnings: current.loading ? ['正在加载项目…'] : [], status });
  }

  function resetProjectState() {
    const defaults = {
      project: null,
      projectSignature: '',
      activeProjectSignature: '',
      glossary: { projectName: '', glossaryName: 'default', terms: [] },
      aiSettings: { provider: 'deepseek', apiKey: '', baseUrl: '', model: '', prompt: '', lastEntryAiMode: 'baidu', traditional: {} },
      entries: [],
      groupedFiles: [],
      currentFile: '',
      currentEntryIndex: 0,
      contextGroups: [],
      entryViewMode: 'single',
      progressState: null,
      fileProgress: [],
      globalProgress: null,
      currentFileProgress: null,
      lastPosition: null,
      loading: false,
      status: 'idle',
      draftPath: '',
    };
    window.RpgAppStore?.setState?.(defaults);
    syncProjectStatusFromState();
    window.RpgApp?.renderFileSelect?.();
    window.RpgApp?.renderEntryList?.();
    window.RpgApp?.renderCurrentEntry?.();
    window.traceCall?.('重置项目', '已清空当前项目状态，回到未加载状态', 'success');
  }

  function syncStatusFromProject(info) {
    const current = state();
    const currentProject = current.project || {};
    const incomingProject = info.project || info || {};
    const project = {
      ...currentProject,
      ...incomingProject,
      rootDir: incomingProject.rootDir || incomingProject.projectRoot || currentProject.rootDir || '',
      dataRoots: Array.isArray(incomingProject.dataRoots) && incomingProject.dataRoots.length ? incomingProject.dataRoots : (Array.isArray(currentProject.dataRoots) ? currentProject.dataRoots : []),
      engine: incomingProject.engine || currentProject.engine || 'unknown',
      displayName: incomingProject.displayName || currentProject.displayName || incomingProject.engine || currentProject.engine || 'unknown',
    };
    const glossary = info.glossary || current.glossary;
    const aiSettings = info.aiSettings || current.aiSettings || {};
    if (!aiSettings.traditional) aiSettings.traditional = {};
    if (!Array.isArray(aiSettings.providers)) aiSettings.providers = aiSettings.providers || [];
    const progressState = info.progressState || current.progressState || null;
    const fileProgress = info.fileProgress || current.fileProgress || [];
    const globalProgress = info.globalProgress || current.globalProgress || null;
    const currentFileProgress = info.currentFileProgress || current.currentFileProgress || null;
    const hasProjectRoot = Boolean(project.rootDir);
    const hasDataRoots = Array.isArray(project.dataRoots) && project.dataRoots.length > 0;
    const engine = project.engine || info.engine || (hasDataRoots ? 'RPG Maker MV/MZ' : 'unknown');
    const displayName = project.displayName || info.displayName || engine;
    const hasLoadedEntries = Array.isArray(info.entries) ? info.entries.length > 0 : Array.isArray(current.entries) && current.entries.length > 0;
    const recognized = hasProjectRoot && (hasDataRoots || hasLoadedEntries || engine !== 'unknown' || displayName !== 'unknown');
    const projectSignature = [project.rootDir || '', project.engine || '', project.displayName || '', (project.dataRoots || []).join('|')].join('::');
    const nextState = {
      ...current,
      project,
      projectSignature,
      glossary,
      aiSettings,
      progressState,
      fileProgress,
      globalProgress,
      currentFileProgress,
      entries: Array.isArray(info.entries) ? info.entries : current.entries || [],
      lastPosition: progressState?.global || current.lastPosition || null,
      status: recognized ? 'project-loaded' : 'project-empty',
    };
    if (recognized) {
      nextState.currentFile = project.rootDir && progressState?.global?.lastTranslatedFile ? progressState.global.lastTranslatedFile : current.currentFile || '';
      nextState.currentEntryIndex = Math.max(0, Number(progressState?.global?.lastTranslatedIndex || current.currentEntryIndex || 0));
      nextState.activeProjectSignature = projectSignature;
    }
    window.RpgAppStore?.setState?.(nextState);
    refreshProjectStatusUi({ project, recognized, displayName, hasDataRoots, warnings: info.warnings || [] });
    window.RpgView?.syncUiSettingsFields?.({ preserveBackground: true });
    window.RpgApp?.syncGlobalAiModeSelect?.();
    window.RpgGlossaryModule?.updateContext?.(project, glossary);
    const debugSummary = `rootDir=${project.rootDir || ''} | engine=${project.engine || 'unknown'} | displayName=${project.displayName || 'unknown'} | dataRoots=${project.dataRoots?.length || 0} | recognized=${recognized} | status=${nextState.status}`;
    window.traceCall?.('项目状态打点', debugSummary, recognized ? 'success' : 'warning');
    window.showProjectStatus?.(recognized ? `已打开项目：${project.rootDir || ''}` : '尚未打开项目', recognized ? 'success' : 'warning');
    window.showToast?.(recognized ? `项目已识别：${displayName}` : '尚未识别引擎', recognized ? 'success' : 'warning');
    window.renderTraditionalStatus?.();
    window.setVersionLabel?.();
    return { recognized, project, glossary, aiSettings, progressState, fileProgress, globalProgress, currentFileProgress };
  }

  async function loadProject(rootDir) {
    return window.runUiAction?.('打开项目', async () => {
      window.traceCall?.('打开项目', `准备读取：${rootDir}`, 'pending');
      window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || '正在处理', 'pending');
      window.RpgAppStore?.setState?.({ ...window.RpgAppStore?.getState?.(), loading: true, status: 'loading-project' });
      syncProjectStatusFromState();
      const result = window.RpgAppController?.loadProjectTexts ? await window.RpgAppController.loadProjectTexts(rootDir) : await window.rpgWorkbench.loadProjectTexts(rootDir);
      window.traceCall?.('打开项目', `主进程返回 entries=${result?.entries?.length || 0}, warnings=${result?.warnings?.length || 0}`, result?.entries?.length ? 'success' : 'error');
      const synced = syncStatusFromProject(result);
      const entries = result.entries || [];
      window.RpgApp?.buildGroupedFiles?.(entries);
      const groupedFiles = window.RpgAppStore?.getState?.().groupedFiles || [];
      const progressState = result.progressState || window.RpgAppStore?.getState?.().progressState || null;
      const lastFile = progressState?.global?.lastTranslatedFile || groupedFiles[0]?.file || '';
      const lastIndex = Number.isInteger(progressState?.global?.lastTranslatedIndex) ? progressState.global.lastTranslatedIndex : 0;
      const current = window.RpgAppStore?.getState?.();
      window.RpgAppStore?.setState?.({
        ...current,
        project: synced.project,
        glossary: synced.glossary,
        aiSettings: synced.aiSettings,
        entries,
        groupedFiles,
        contextGroups: result.groups || [],
        fileProgress: result.fileProgress || [],
        globalProgress: result.globalProgress || null,
        currentFileProgress: result.currentFileProgress || null,
        currentFile: current.projectSignature === synced.projectSignature ? (current.currentFile || lastFile) : lastFile,
        currentEntryIndex: current.projectSignature === synced.projectSignature ? (current.currentEntryIndex || 0) : Math.max(0, lastIndex),
        progressState,
        loading: false,
        status: synced.recognized ? 'project-loaded' : 'project-empty',
        lastPosition: progressState?.global || null,
        activeProjectSignature: synced.projectSignature,
      });
      syncProjectStatusFromState();
      window.RpgApp?.renderFileSelect?.();
      window.RpgApp?.renderEntryList?.();
      window.RpgApp?.renderCurrentEntry?.();
      window.showProjectStatus?.(`${t('workspace.load')}：${entries.length} ${t('stats.groups')}`, synced.recognized ? 'success' : 'warning');
      return result;
    }, { pending: t('common.aiPending') || '正在处理', success: `${t('workspace.load')}：${t('stats.groups')}`, error: t('common.aiTestFail') || '操作失败', statusId: 'projectStatus', traceTitle: '打开项目' });
  }

  function bindProjectActions() {
    const pickFolderBtn = get('pickFolderBtn');
    const saveDraftBtn = get('saveDraftBtn');
    const resetProjectBtn = get('resetProjectBtn');

    pickFolderBtn?.addEventListener('click', async () => {
      try {
        const prev = window.RpgAppStore?.getState?.() || {};
        window.traceCall?.('打开项目', '开始调用系统目录选择器', 'pending');
        window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || '正在处理', 'pending');
        const info = window.RpgAppController?.pickProjectFolder ? await window.RpgAppController.pickProjectFolder() : await window.rpgWorkbench.pickProjectFolder();
        if (!info) {
          window.traceCall?.('打开项目', '用户取消选择', 'warning');
          window.RpgAppStore?.setState?.({ ...prev });
          syncProjectStatusFromState();
          return;
        }
        window.traceCall?.('打开项目', `选择结果 rootDir=${info.rootDir || 'N/A'}, engine=${info.engine || 'unknown'}`, 'success');
        if (info.rootDir) await loadProject(info.rootDir);
      } catch (error) {
        window.traceCall?.('打开项目', error.message || '未知错误', 'error');
        window.showProjectStatus?.(error.message || (window.RpgView?.t?.('common.aiTestFail') || '操作失败'), 'error');
      }
    });


    resetProjectBtn?.addEventListener('click', () => {
      const ok = window.confirm('此操作将清空当前项目、翻译内容、进度与术语关联，回到未加载项目状态。是否继续？');
      if (!ok) return;
      resetProjectState();
      window.showProjectStatus?.('已重置为未加载项目状态', 'warning');
      window.showToast?.('已重置项目状态', 'warning');
    });

    saveDraftBtn?.addEventListener('click', async () => {
      return window.runUiAction?.('加载草稿', async () => {
        window.traceCall?.('加载草稿', '开始选择草稿文件', 'pending');
        const file = window.RpgAppController?.pickDraftFile ? await window.RpgAppController.pickDraftFile() : await window.rpgWorkbench.pickDraftFile();
        if (!file?.filePath) {
          window.traceCall?.('加载草稿', '用户取消选择', 'error');
          throw new Error('已取消加载草稿');
        }
        const result = window.RpgAppController?.loadDraftFile ? await window.RpgAppController.loadDraftFile(file.filePath) : await window.rpgWorkbench.loadDraftFile(file.filePath);
        if (!result?.ok) throw new Error(result?.message || '草稿加载失败');
        const synced = syncStatusFromProject(result);
        const entries = result.entries || [];
        window.RpgApp?.buildGroupedFiles?.(entries);
        const groupedFiles = window.RpgAppStore?.getState?.().groupedFiles || [];
        const progressState = result.progressState || window.RpgAppStore?.getState?.().progressState || null;
        const lastFile = progressState?.global?.lastTranslatedFile || groupedFiles[0]?.file || '';
        const lastIndex = Number.isInteger(progressState?.global?.lastTranslatedIndex) ? progressState.global.lastTranslatedIndex : 0;
        window.RpgAppStore?.setState?.({
          ...window.RpgAppStore?.getState?.(),
          project: synced.project,
          glossary: synced.glossary,
          aiSettings: synced.aiSettings,
          entries,
          groupedFiles,
          contextGroups: result.groups || result.draft?.groups || [],
          fileProgress: result.fileProgress || [],
          globalProgress: result.globalProgress || null,
          currentFileProgress: result.currentFileProgress || null,
          currentFile: lastFile,
          currentEntryIndex: Math.max(0, lastIndex),
          progressState,
          loading: false,
          status: synced.recognized ? 'draft-loaded' : 'project-empty',
          draftPath: result.draftPath || file.filePath,
          lastPosition: progressState?.global || null,
        });
        syncProjectStatusFromState();
        window.RpgApp?.renderFileSelect?.();
        window.RpgApp?.renderEntryList?.();
        window.RpgApp?.renderCurrentEntry?.();
        window.showProjectStatus?.(`已载入草稿：${file.filePath}`, synced.recognized ? 'success' : 'warning');
        window.traceCall?.('加载草稿', `已打开 ${file.filePath}`, 'success');
        return result;
      }, { pending: '正在选择草稿文件…', success: '草稿加载完成', error: '草稿加载失败', statusId: 'projectStatus', traceTitle: '加载草稿' });
    });
  }

  window.RpgProject = { syncStatusFromProject, loadProject, bindProjectActions };
})();
