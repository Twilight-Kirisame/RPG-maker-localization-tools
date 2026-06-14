(() => {
  const get = (id) => document.getElementById(id);
  const state = () => window.RpgAppStore?.getState?.() || {};
  const t = (key) => window.RpgView?.t?.(key) || key;

  function syncStatusFromProject(info) {
    const current = state();
    const project = info.project || info;
    const glossary = info.glossary || current.glossary;
    const aiSettings = info.aiSettings || current.aiSettings || {};
    if (!aiSettings.traditional) aiSettings.traditional = {};
    if (!Array.isArray(aiSettings.providers)) aiSettings.providers = aiSettings.providers || [];
    window.RpgAppStore?.setState?.({ project, glossary, aiSettings, status: project.rootDir ? 'project-ready' : 'project-empty' });

    const projectPath = get('projectPath');
    const engineBadge = get('engineBadge');
    const engineHint = get('engineHint');
    if (projectPath) projectPath.textContent = project.rootDir || info.rootDir || t('workspace.noProject');
    const engine = project.engine || info.engine || 'unknown';
    if (engineBadge) {
      engineBadge.textContent = engine;
      engineBadge.className = `badge ${engine === 'unknown' ? 'warn' : 'success'}`;
    }
    if (engineHint) {
      const dataRootText = Array.isArray(project.dataRoots) && project.dataRoots.length ? `文本目录：${project.dataRoots.map((dir) => String(dir).replace(project.rootDir || '', '').replace(/^[/\\]/, '') || '.').join('；')}` : '';
      engineHint.textContent = dataRootText || (info.warnings?.length
        ? info.warnings.join('；')
        : engine === 'RPG Maker MV/MZ'
          ? '已识别为 MV/MZ，可导入 data/*.json 并生成回写补丁。'
          : engine === 'RPG Maker VX Ace / XP'
            ? '已识别为 VX Ace / XP，当前保留二进制扩展位。'
            : t('project.hint'));
    }
    window.RpgView?.syncUiSettingsFields?.({ preserveBackground: true });
    window.RpgApp?.syncGlobalAiModeSelect?.();
    window.RpgGlossaryModule?.updateContext?.(project, glossary);
    if (window.setCallTraceStatus) window.setCallTraceStatus(project.rootDir ? `项目已就绪：${project.rootDir}` : '未加载项目', 'success');
    window.renderTraditionalStatus?.();
    window.setVersionLabel?.();
  }

  async function loadProject(rootDir) {
    window.traceCall?.('导出草稿', `准备读取：${rootDir}`, 'pending');
    window.showProjectStatus?.(window.RpgView?.t?.('common.aiPending') || '正在处理', 'pending');
    window.RpgAppStore?.setState?.({ loading: true, status: 'loading-project' });
    const result = window.RpgAppController?.loadProjectTexts ? await window.RpgAppController.loadProjectTexts(rootDir) : await window.rpgWorkbench.loadProjectTexts(rootDir);
    window.traceCall?.('导出草稿', `主进程返回 entries=${result?.entries?.length || 0}, warnings=${result?.warnings?.length || 0}`, result?.entries?.length ? 'success' : 'error');
    syncStatusFromProject(result);
    const entries = result.entries || [];
    window.RpgApp?.buildGroupedFiles?.(entries);
    const groupedFiles = window.RpgAppStore?.getState?.().groupedFiles || [];
    const currentFile = groupedFiles[0]?.file || '';
    window.RpgAppStore?.setState?.({ entries, groupedFiles, currentFile, currentEntryIndex: 0, loading: false, status: 'project-loaded' });
    window.RpgApp?.renderFileSelect?.();
    window.RpgApp?.renderEntryList?.();
    window.RpgApp?.renderCurrentEntry?.();
    window.showProjectStatus?.(`${t('workspace.load')}：${entries.length} ${t('stats.groups')}`, 'success');
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
          window.traceCall?.('打开项目', '用户取消选择', 'error');
          window.showProjectStatus?.(window.RpgView?.t?.('common.aiTestFail') || '操作失败', 'error');
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
        syncStatusFromProject(result);
        const entries = result.entries || [];
        window.RpgApp?.buildGroupedFiles?.(entries);
        const groupedFiles = window.RpgAppStore?.getState?.().groupedFiles || [];
        const currentFile = groupedFiles[0]?.file || '';
        window.RpgAppStore?.setState?.({ entries, groupedFiles, currentFile, currentEntryIndex: 0, loading: false, status: 'draft-loaded', draftPath: result.draftPath || file.filePath });
        window.RpgApp?.renderFileSelect?.();
        window.RpgApp?.renderEntryList?.();
        window.RpgApp?.renderCurrentEntry?.();
        window.showProjectStatus?.(`已载入草稿：${file.filePath}`, 'success');
        window.traceCall?.('载入草稿按钮', `已打开 ${file.filePath}`, 'success');
      } catch (error) {
        window.traceCall?.('载入草稿按钮', error.message || '未知错误', 'error');
        window.showProjectStatus?.(error.message || (window.RpgView?.t?.('common.aiTestFail') || '操作失败'), 'error');
      }
    });
  }

  window.RpgProject = { syncStatusFromProject, loadProject, bindProjectActions };
})();
