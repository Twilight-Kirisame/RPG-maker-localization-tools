(() => {
  const el = (id) => document.getElementById(id);
  const t = (key) => window.RpgView?.t?.(key) || key;
  const tf = (key, params = {}) => {
    let text = t(key);
    Object.keys(params || {}).forEach((k) => {
      text = text.split(`{${k}}`).join(String(params[k] ?? ''));
    });
    return text;
  };

  function assertProject(payload, action) {
    if (!payload?.project?.rootDir) throw new Error(tf('error.projectRequired', { action }));
  }

  function assertNotLazyLoad(payload, action) {
    if (payload?.project?.useLazyLoad) {
      throw new Error(`[懒加载模式] ${action} 需要完整项目数据。请先加载所有文件，或等待后续支持流式导出。`);
    }
  }

  async function exportDraft(payload) {
    assertProject(payload, t('action.exportDraft'));
    assertNotLazyLoad(payload, t('action.exportDraft'));
    if (!window.rpgWorkbench?.saveDraft) throw new Error(t('error.saveDraftApiMissing'));
    const result = await window.rpgWorkbench.saveDraft(payload);
    if (!result?.ok) throw new Error(result?.message || t('error.exportDraftFailed'));
    if (result.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir);
    return result;
  }

  async function exportPatch(payload) {
    assertProject(payload, t('action.exportPatch'));
    assertNotLazyLoad(payload, t('action.exportPatch'));
    if (!window.rpgWorkbench?.exportPatch) throw new Error(t('error.exportPatchApiMissing'));
    const result = await window.rpgWorkbench.exportPatch(payload);
    if (!result?.ok) throw new Error(result?.message || t('error.exportPatchFailed'));
    if (result.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir);
    return result;
  }

  async function applyWriteback(payload) {
    assertProject(payload, t('action.writebackJson'));
    assertNotLazyLoad(payload, t('action.writebackJson'));
    if (!window.rpgWorkbench?.applyWriteback) throw new Error(t('error.writebackApiMissing'));
    const result = await window.rpgWorkbench.applyWriteback({ project: payload.project, entries: payload.entries });
    if (!result?.ok) throw new Error(result?.message || t('error.writebackFailed'));
    const errCount = Array.isArray(result.errors) ? result.errors.length : 0;
    const fileCount = Array.isArray(result.files) ? result.files.length : 0;
    const summary = tf('writeback.summary', { count: fileCount, errors: errCount });
    if (errCount) log(`${summary}：${result.errors.slice(0, 3).map((e) => `${e.file || ''}/${e.key || ''}：${e.reason}`).join('；')}`, errCount > 0 ? 'pending' : 'success');
    log(summary, errCount ? 'pending' : 'success');
    if (result.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir);
    return result;
  }

  function bind() {
    const draftBtn = el('loadProjectBtn');
    const patchBtn = el('exportPatchBtn');
    const writebackBtn = el('applyWritebackBtn');
    const openPatchBtn = el('openPatchFolderBtn');
    if (draftBtn) draftBtn.addEventListener('click', async () => {
      return window.runUiAction?.(t('action.exportDraft'), async () => exportDraft(window.__rpgExportContext()), { pending: t('export.draftPending'), success: t('export.draftSuccess'), error: t('export.draftError'), statusId: 'projectStatus', traceTitle: t('action.exportDraft') });
    });
    if (patchBtn) patchBtn.addEventListener('click', async () => {
      return window.runUiAction?.(t('action.exportPatch'), async () => exportPatch(window.__rpgExportContext()), { pending: t('export.patchPending'), success: t('export.patchSuccess'), error: t('export.patchError'), statusId: 'projectStatus', traceTitle: t('action.exportPatch') });
    });
    if (writebackBtn) writebackBtn.addEventListener('click', async () => {
      try { log(t('trace.writebackClicked'), 'pending'); await applyWriteback(window.__rpgExportContext()); }
      catch (error) { log(error.message, 'error'); }
    });
    if (openPatchBtn) openPatchBtn.addEventListener('click', async () => {
      return window.runUiAction?.(t('action.openPatchDir'), async () => {
        const ctx = window.__rpgExportContext();
        if (!ctx?.lastPatchDir) throw new Error(t('error.noPatchDir'));
        if (!window.rpgWorkbench?.openFolder) throw new Error(t('error.openDirApiMissing'));
        return window.rpgWorkbench.openFolder(ctx.lastPatchDir);
      }, { pending: t('action.openingPatchDir'), success: t('action.patchDirOpened'), error: t('action.openPatchDirFailed'), statusId: 'projectStatus', traceTitle: t('action.openPatchDir') });
    });
  }

  function init(getContext) {
    window.__rpgExportContext = getContext;
    bind();
  }

  window.RpgExportModule = { init, exportDraft, exportPatch, applyWriteback };
})();
