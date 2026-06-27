(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;

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
      engineBadge.textContent = recognized ? (displayName === 'unknown' ? '已识别' : displayName) : t('project.unrecognized');
      engineBadge.className = `badge ${recognized ? 'success' : 'warn'}`;
      engineBadge.dataset.projectSignature = project.rootDir
        ? [project.rootDir || '', project.engine || '', displayName || '', (project.dataRoots || []).join('|')].join('::')
        : '';
    }
    if (engineHint) {
      const dataRootText = hasDataRoots
        ? `文本目录：${(project.dataRoots || []).map((dir) => String(dir).replace(project.rootDir || '', '').replace(/^[/\\]/, '') || '.').join('；')}`
        : '';
      const scanStatus = hasDataRoots ? `已扫描到 ${(project.dataRoots || []).length} 个文本目录` : '未扫描到文本目录';
      const stateText = status === 'project-loaded' ? '项目已加载' : status === 'draft-loaded' ? '草稿已加载' : status === 'loading-project' ? '正在加载项目…' : '';
      engineHint.textContent = dataRootText
        || `${stateText ? `${stateText}；` : ''}${scanStatus}；${warnings.length ? warnings.join('；') : (recognized ? '已识别到项目结构，可继续导入与翻译。' : t('project.hint'))}`;
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
    const recognized = Boolean(project.rootDir) && (hasDataRoots || hasEntries || (project.engine && project.engine !== 'unknown') || (project.displayName && project.displayName !== 'unknown') || current.status === 'project-loaded' || current.status === 'draft-loaded');
    const displayName = project.displayName || project.engine || (recognized ? '已识别' : 'unknown');
    const status = current.loading ? 'loading-project' : (current.status || (recognized ? 'project-loaded' : 'project-empty'));
    refreshProjectStatusUi({ project, recognized, displayName, hasDataRoots, warnings: current.loading ? ['正在加载项目…'] : [], status });
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
    const aiSettings = info?.aiSettings || current.aiSettings || {};
    if (!aiSettings.traditional) aiSettings.traditional = {};
    const hasProjectRoot = Boolean(project.rootDir);
    const hasDataRoots = Array.isArray(project.dataRoots) && project.dataRoots.length > 0;
    const hasLoadedEntries = Array.isArray(info?.entries) ? info.entries.length > 0 : Array.isArray(current.entries) && current.entries.length > 0;
    const engine = project.engine || (hasDataRoots ? 'RPG Maker MV/MZ' : 'unknown');
    const displayName = project.displayName || engine;
    const recognized = hasProjectRoot && (hasDataRoots || hasLoadedEntries || engine !== 'unknown' || displayName !== 'unknown');
    const projectSignature = [project.rootDir || '', project.engine || '', project.displayName || '', (project.dataRoots || []).join('|')].join('::');
    const prevSignature = current.activeProjectSignature || '';
    const switchedProject = recognized && prevSignature && prevSignature !== projectSignature;

    window.RpgAppStore?.setState?.({
      project,
      projectSignature,
      glossary,
      aiSettings,
      entries: Array.isArray(info?.entries) ? info.entries : current.entries || [],
      status: recognized ? (info?.draft ? 'draft-loaded' : 'project-loaded') : 'project-empty',
      activeProjectSignature: recognized ? projectSignature : prevSignature,
      // 切换到不同项目时清空与上一个项目绑定的工作区状态
      ...(switchedProject ? { currentFile: '', currentEntryIndex: 0, contextGroupSelection: [], entryViewMode: 'single' } : {}),
    });

    refreshProjectStatusUi({ project, recognized, displayName, hasDataRoots, warnings: info?.warnings || [] });
    window.RpgView?.syncUiSettingsFields?.({ preserveBackground: true });
    window.RpgApp?.syncGlobalAiModeSelect?.();
    window.RpgGlossaryModule?.updateContext?.(project, glossary);
    if (window.setCallTraceStatus) window.setCallTraceStatus(project.rootDir ? `项目已就绪：${project.rootDir}` : '未加载项目', recognized ? 'success' : 'warning');
    window.renderTraditionalStatus?.();
    window.setVersionLabel?.();
    window.traceCall?.('项目状态打点', `rootDir=${project.rootDir || ''} | engine=${engine} | displayName=${displayName} | dataRoots=${project.dataRoots?.length || 0} | recognized=${recognized}`, recognized ? 'success' : 'warning');
    return { recognized, project, glossary, aiSettings, projectSignature };
  }

  async function loadProject(rootDir) {
    window.traceCall?.('打开项目', `准备读取：${rootDir}`, 'pending');
    window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || '正在处理', 'pending');
    window.RpgAppStore?.setState?.({ loading: true, status: 'loading-project' });
    syncProjectStatusFromState();
    const result = window.RpgAppController?.loadProjectTexts ? await window.RpgAppController.loadProjectTexts(rootDir) : await window.rpgWorkbench.loadProjectTexts(rootDir);
    window.traceCall?.('打开项目', `主进程返回 entries=${result?.entries?.length || 0}, warnings=${result?.warnings?.length || 0}`, result?.entries?.length ? 'success' : 'error');
    const synced = syncStatusFromProject(result);
    const entries = result.entries || [];
    window.RpgApp?.buildGroupedFiles?.(entries);
    const groupedFiles = window.RpgAppStore?.getState?.().groupedFiles || [];
    const currentFile = groupedFiles[0]?.file || '';
    window.RpgAppStore?.setState?.({
      entries,
      groupedFiles,
      currentFile,
      currentEntryIndex: 0,
      loading: false,
      status: synced.recognized ? 'project-loaded' : 'project-empty',
    });
    syncProjectStatusFromState();
    window.RpgApp?.renderFileSelect?.();
    window.RpgApp?.renderEntryList?.();
    window.RpgApp?.renderCurrentEntry?.();
    window.showProjectStatus?.(`${t('workspace.load')}：${entries.length} ${t('stats.groups')}`, synced.recognized ? 'success' : 'warning');
    return result;
  }

  function bindProjectActions() {
    const pickFolderBtn = get('pickFolderBtn');
    const saveDraftBtn = get('saveDraftBtn');

    pickFolderBtn?.addEventListener('click', async () => {
      try {
        window.traceCall?.('打开项目', '开始调用系统目录选择器', 'pending');
        window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || '正在处理', 'pending');
        const info = window.RpgAppController?.pickProjectFolder ? await window.RpgAppController.pickProjectFolder() : await window.rpgWorkbench.pickProjectFolder();
        if (!info) {
          window.traceCall?.('打开项目', '用户取消选择', 'warning');
          syncProjectStatusFromState();
          return;
        }
        window.traceCall?.('打开项目', `选择结果 rootDir=${info.rootDir || 'N/A'}, engine=${info.engine || 'unknown'}`, 'success');
        syncStatusFromProject(info);
        if (info.rootDir) await loadProject(info.rootDir);
      } catch (error) {
        window.traceCall?.('打开项目', error.message || '未知错误', 'error');
        window.showProjectStatus?.(error.message || (window.RpgView?.t?.('common.aiTestFail') || '操作失败'), 'error');
      }
    });

    saveDraftBtn?.addEventListener('click', async () => {
      try {
        window.traceCall?.('载入草稿按钮', '开始选择草稿文件', 'pending');
        const file = window.RpgAppController?.pickDraftFile ? await window.RpgAppController.pickDraftFile() : await window.rpgWorkbench.pickDraftFile();
        if (!file?.filePath) {
          window.traceCall?.('载入草稿按钮', '用户取消选择', 'error');
          return;
        }
        const result = window.RpgAppController?.loadDraftFile ? await window.RpgAppController.loadDraftFile(file.filePath) : await window.rpgWorkbench.loadDraftFile(file.filePath);
        if (!result?.ok) {
          const message = result?.message || '草稿加载失败';
          window.traceCall?.('载入草稿按钮', message, 'error');
          window.showProjectStatus?.(message, 'error');
          return;
        }
        const synced = syncStatusFromProject(result);
        const entries = result.entries || [];
        window.RpgApp?.buildGroupedFiles?.(entries);
        const groupedFiles = window.RpgAppStore?.getState?.().groupedFiles || [];
        const currentFile = groupedFiles[0]?.file || '';
        window.RpgAppStore?.setState?.({
          entries,
          groupedFiles,
          currentFile,
          currentEntryIndex: 0,
          loading: false,
          status: synced.recognized ? 'draft-loaded' : 'project-empty',
          draftPath: result.draftPath || file.filePath,
        });
        syncProjectStatusFromState();
        window.RpgApp?.renderFileSelect?.();
        window.RpgApp?.renderEntryList?.();
        window.RpgApp?.renderCurrentEntry?.();
        window.showProjectStatus?.(`已载入草稿：${file.filePath}`, synced.recognized ? 'success' : 'warning');
        window.traceCall?.('载入草稿按钮', `已打开 ${file.filePath}`, 'success');
      } catch (error) {
        window.traceCall?.('载入草稿按钮', error.message || '未知错误', 'error');
        window.showProjectStatus?.(error.message || (window.RpgView?.t?.('common.aiTestFail') || '操作失败'), 'error');
      }
    });
  }

  window.RpgProject = { syncStatusFromProject, syncProjectStatusFromState, refreshProjectStatusUi, loadProject, bindProjectActions };
})();
