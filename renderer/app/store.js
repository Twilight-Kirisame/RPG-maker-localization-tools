(() => {
  const state = {
    project: null,
    glossary: { projectName: '', glossaryName: 'default', terms: [] },
    aiSettings: { provider: 'deepseek', apiKey: '', baseUrl: '', model: '', prompt: '', lastEntryAiMode: 'baidu', traditional: {} },
    entries: [],
    groupedFiles: [],
    currentFile: '',
    currentEntryIndex: 0,
    loading: false,
    status: 'idle',
    draftPath: '',
  };

  const listeners = new Set();

  function getState() {
    return { ...state };
  }

  function setState(patch = {}) {
    Object.assign(state, patch);
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
