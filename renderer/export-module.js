(() => {
  const el = (id) => document.getElementById(id);

  function assertProject(payload, action) {
    if (!payload?.project?.rootDir) throw new Error(`${action}前请先打开并载入项目`);
  }

  async function exportDraft(payload) {
    assertProject(payload, '导出草稿');
    if (!window.rpgWorkbench?.saveDraft) throw new Error('草稿导出接口未注入');
    const result = await window.rpgWorkbench.saveDraft(payload);
    if (!result?.ok) throw new Error(result?.message || '导出草稿失败');
    if (result.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir);
    return result;
  }

  async function exportPatch(payload) {
    assertProject(payload, '导出补丁');
    if (!window.rpgWorkbench?.exportPatch) throw new Error('补丁导出接口未注入');
    const result = await window.rpgWorkbench.exportPatch(payload);
    if (!result?.ok) throw new Error(result?.message || '导出补丁失败');
    if (result.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir);
    return result;
  }

  function bind() {
    const draftBtn = el('loadProjectBtn');
    const patchBtn = el('exportPatchBtn');
    const openPatchBtn = el('openPatchFolderBtn');
    if (draftBtn) draftBtn.addEventListener('click', async () => {
      return window.runUiAction?.('导出草稿', async () => exportDraft(window.__rpgExportContext()), { pending: '正在导出草稿…', success: '草稿导出完成', error: '草稿导出失败', statusId: 'projectStatus', traceTitle: '导出草稿' });
    });
    if (patchBtn) patchBtn.addEventListener('click', async () => {
      return window.runUiAction?.('导出补丁', async () => exportPatch(window.__rpgExportContext()), { pending: '正在导出补丁…', success: '补丁导出完成', error: '补丁导出失败', statusId: 'projectStatus', traceTitle: '导出补丁' });
    });
    if (openPatchBtn) openPatchBtn.addEventListener('click', async () => {
      return window.runUiAction?.('打开补丁目录', async () => {
        const ctx = window.__rpgExportContext();
        if (!ctx?.lastPatchDir) throw new Error('没有可打开的补丁目录');
        if (!window.rpgWorkbench?.openFolder) throw new Error('打开目录接口未注入');
        return window.rpgWorkbench.openFolder(ctx.lastPatchDir);
      }, { pending: '正在打开补丁目录…', success: '补丁目录已打开', error: '打开补丁目录失败', statusId: 'projectStatus', traceTitle: '打开补丁目录' });
    });
  }

  function init(getContext) {
    window.__rpgExportContext = getContext;
    bind();
  }

  window.RpgExportModule = { init, exportDraft, exportPatch };
})();
