(() => {
  const log = (msg, kind = 'normal') => window.__rpgTrace?.(msg, kind);
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
    log(`草稿已导出：${result.path}`, 'success');
    return result;
  }

  async function exportPatch(payload) {
    assertProject(payload, '导出补丁');
    if (!window.rpgWorkbench?.exportPatch) throw new Error('补丁导出接口未注入');
    const result = await window.rpgWorkbench.exportPatch(payload);
    if (!result?.ok) throw new Error(result?.message || '导出补丁失败');
    if (result.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir);
    log(`补丁已导出：${result.outputDir}`, 'success');
    return result;
  }

  async function applyWriteback(payload) {
    assertProject(payload, '写回 JSON');
    if (!window.rpgWorkbench?.applyWriteback) throw new Error('写回接口未注入');
    const result = await window.rpgWorkbench.applyWriteback({ project: payload.project, entries: payload.entries });
    if (!result?.ok) throw new Error(result?.message || '写回失败');
    const errCount = Array.isArray(result.errors) ? result.errors.length : 0;
    const fileCount = Array.isArray(result.files) ? result.files.length : 0;
    const summary = `已写回 ${fileCount} 个 JSON 文件${errCount ? `（含 ${errCount} 条错误）` : ''}`;
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
      try { log('点击导出草稿', 'pending'); await exportDraft(window.__rpgExportContext()); }
      catch (error) { log(error.message, 'error'); }
    });
    if (patchBtn) patchBtn.addEventListener('click', async () => {
      try { log('点击导出补丁', 'pending'); const result = await exportPatch(window.__rpgExportContext()); if (result?.outputDir && window.rpgWorkbench?.openFolder) await window.rpgWorkbench.openFolder(result.outputDir); }
      catch (error) { log(error.message, 'error'); }
    });
    if (writebackBtn) writebackBtn.addEventListener('click', async () => {
      try { log('点击写回游戏 JSON', 'pending'); await applyWriteback(window.__rpgExportContext()); }
      catch (error) { log(error.message, 'error'); }
    });
    if (openPatchBtn) openPatchBtn.addEventListener('click', async () => {
      try {
        log('点击打开补丁目录', 'pending');
        const ctx = window.__rpgExportContext();
        if (!ctx?.lastPatchDir) throw new Error('没有可打开的补丁目录');
        if (!window.rpgWorkbench?.openFolder) throw new Error('打开目录接口未注入');
        await window.rpgWorkbench.openFolder(ctx.lastPatchDir);
      } catch (error) { log(error.message, 'error'); }
    });
  }

  function init(getContext) {
    window.__rpgExportContext = getContext;
    bind();
  }

  window.RpgExportModule = { init, exportDraft, exportPatch, applyWriteback };
})();
