(() => {
  const state = {
    project: null,
    glossary: { projectName: '', glossaryName: 'default', terms: [] },
    aiSettings: {
      provider: 'deepseek',
      // 按供应商隔离：每家独立存 apiKey / baseUrl / model / prompt，切换 provider 时前一家不被覆盖。
      providers: {
        mock:     { apiKey: '', baseUrl: '',                          model: '',                   prompt: '' },
        deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com',  model: 'deepseek-v4-flash',  prompt: '' },
        kimi:     { apiKey: '', baseUrl: 'https://api.moonshot.ai/v1', model: 'moonshot-v1-8k',    prompt: '' },
        openai:   { apiKey: '', baseUrl: '',                          model: '',                   prompt: '' },
        gemini:   { apiKey: '', baseUrl: '',                          model: '',                   prompt: '' },
        claude:   { apiKey: '', baseUrl: '',                          model: '',                   prompt: '' },
        custom:   { apiKey: '', baseUrl: '',                          model: '',                   prompt: '' },
      },
      // 兼容旧代码路径的顶层影像（同步自当前活动 provider 桶），只在渲染层持续维护，不作为真实源。
      apiKey: '', baseUrl: '', model: '', prompt: '',
      lastEntryAiMode: 'baidu',
      traditional: {},
    },
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

  const listeners = new Set();

  function getState() {
    return { ...state };
  }

  function setState(patch = {}) {
    const next = { ...patch };
    const currentProjectRoot = state.project?.rootDir || '';
    const patchProjectRoot = next.project?.rootDir || next.rootDir || '';
    const sameProject = Boolean(currentProjectRoot && patchProjectRoot && currentProjectRoot === patchProjectRoot);
    const patchProjectSignature = next.activeProjectSignature || next.projectSignature || '';
    const currentProjectSignature = state.activeProjectSignature || state.projectSignature || '';
    const hasProjectIdentity = Boolean(next.project || patchProjectSignature || next.project?.rootDir || next.project?.engine || next.project?.displayName);
    const before = {
      projectRoot: currentProjectRoot,
      status: state.status,
      projectSignature: currentProjectSignature,
      activeProjectSignature: state.activeProjectSignature || '',
    };
    if (sameProject && currentProjectSignature && patchProjectSignature && currentProjectSignature === patchProjectSignature) {
      next.project = { ...(state.project || {}), ...(next.project || {}) };
      next.projectSignature = currentProjectSignature;
      next.activeProjectSignature = currentProjectSignature;
      if (!next.status || next.status === 'idle' || next.status === 'project-empty') next.status = state.status || 'project-loaded';
      if (!next.aiSettings) next.aiSettings = state.aiSettings;
      if (!next.glossary) next.glossary = state.glossary;
    } else if (sameProject && !hasProjectIdentity) {
      next.project = state.project;
      next.projectSignature = state.projectSignature;
      next.activeProjectSignature = state.activeProjectSignature;
      next.status = next.status || state.status;
      if (!next.aiSettings) next.aiSettings = state.aiSettings;
      if (!next.glossary) next.glossary = state.glossary;
    }
    Object.assign(state, next);
    const after = {
      projectRoot: state.project?.rootDir || '',
      status: state.status,
      projectSignature: state.projectSignature || '',
      activeProjectSignature: state.activeProjectSignature || '',
    };
    if ((before.projectRoot && !after.projectRoot) || (before.status && after.status === 'idle') || (before.status === 'project-loaded' && after.status === 'project-empty')) {
      const stack = new Error().stack || '';
      console.warn('[RpgAppStore] project/status regression', { before, after, patchKeys: Object.keys(patch || {}), patch, stack });
      window.__RpgStateRegressionLog = window.__RpgStateRegressionLog || [];
      window.__RpgStateRegressionLog.push({ time: new Date().toISOString(), before, after, patchKeys: Object.keys(patch || {}), patch: { ...patch }, stack });
      if (window.traceCall) {
        const title = '状态回退';
        const detail = `${before.projectRoot || '∅'} / ${before.status || '∅'} -> ${after.projectRoot || '∅'} / ${after.status || '∅'}`;
        window.traceCall(title, `${detail} | ${stack.split('\n')[2] || stack.split('\n')[1] || 'unknown'}`, 'error');
      }
    }
    listeners.forEach((listener) => {
      try { listener(getState()); } catch (_) { /* ignore */ }
    });
    return getState();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.RpgAppStore = { getState, setState, subscribe };
})();
