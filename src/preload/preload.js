/**
 * @file src/preload/preload.js
 * @description 安全桥接层，只暴露受控 IPC API。
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * 统一 IPC 调用封装。
 * @param {string} channel
 * @param {...any} args
 * @returns {Promise<any>}
 */
function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('rpgWorkbench', {
  pickProjectFolder: () => invoke('pick-project-folder'),
  pickDraftFile: () => invoke('pick-draft-file'),
  loadDraftFile: (filePath) => invoke('load-draft-file', filePath),
  pickGlossaryFile: () => invoke('pick-glossary-file'),
  pickThemeImageFile: () => invoke('pick-theme-image-file'),
  loadProjectTexts: (rootDir) => invoke('load-project-texts', rootDir),
  scanProjectDataRoots: (rootDir) => invoke('scan-project-data-roots', rootDir),
  loadProjectFileList: (rootDir) => invoke('load-project-file-list', rootDir),
  loadFileEntries: (rootDir, filePath) => invoke('load-file-entries', rootDir, filePath),
  previewInGame: (payload) => invoke('preview-in-game', payload),
  repreviewInGame: (payload) => invoke('repreview-in-game', payload),
  returnToTitle: (payload) => invoke('return-to-title', payload),
  prevPreviewEntry: (payload) => invoke('prev-entry', payload),
  nextPreviewEntry: (payload) => invoke('next-entry', payload),
  stopPreview: (rootDir) => invoke('stop-preview', rootDir),
  restorePreviewBackups: (rootDir) => invoke('restore-preview-backups', rootDir),
  cleanupPreviewOnStartup: (rootDir) => invoke('cleanup-preview-on-startup', rootDir),
  resizeEmbeddedPreview: (payload) => invoke('resize-embedded-preview', payload),
  onPreviewProcessExited: (callback) => ipcRenderer.on('preview-process-exited', (_event, details) => callback(details)),
  saveProjectLastPosition: (payload) => invoke('save-project-last-position', payload),
  loadProjectProgressState: (project) => invoke('load-project-progress-state', project),
  loadGlossary: (payload) => invoke('load-glossary', payload),
  listGlossaries: (payload) => invoke('list-glossaries', payload),
  saveGlossary: (payload) => invoke('save-glossary', payload),
  saveGlossaryAs: (payload) => invoke('save-glossary-as', payload),
  exportGlossaryAs: (payload) => invoke('export-glossary-as', payload),
  importGlossary: (payload) => invoke('import-glossary', payload),
  deleteGlossary: (payload) => invoke('delete-glossary', payload),
  renameGlossary: (payload) => invoke('rename-glossary', payload),
  listProjectGlossaryMeta: (payload) => invoke('list-project-glossary-meta', payload),
  loadAggregatedGlossary: (payload) => invoke('load-aggregated-glossary', payload),
  updateGlossaryCategory: (payload) => invoke('update-glossary-category', payload),
  exportPatch: (payload) => invoke('export-patch', payload),
  applyWriteback: (payload) => invoke('apply-writeback', payload),
  saveDraft: (payload) => invoke('save-draft', payload),
  openFolder: (folderPath) => invoke('open-folder', folderPath),
  getProjectSettings: (project) => invoke('get-project-settings', project),
  saveProjectSettings: (payload) => invoke('save-project-settings', payload),
  pickDraftDir: (defaultPath) => invoke('pick-draft-dir', defaultPath),
  getAiSettings: (payload) => invoke('get-ai-settings', payload),
  saveAiSettings: (payload) => invoke('save-ai-settings', payload),
  saveTranslatorSettings: (payload) => invoke('save-translator-settings', payload),
  testTranslatorSettings: (payload) => invoke('test-translator-settings', payload),
  aiTranslate: (payload) => invoke('ai-translate', payload),
  validateEntry: (payload) => invoke('validate-entry', payload),
  getUiSettings: () => invoke('get-ui-settings'),
  saveUiSettings: (payload) => invoke('save-ui-settings', payload),
  pickImportFontFile: () => invoke('pick-import-font-file'),
  importFont: (payload) => invoke('import-font', payload),
  listImportedFonts: () => invoke('list-imported-fonts'),
  deleteImportedFont: (key) => invoke('delete-imported-font', key),
  setViewMode: (mode) => invoke('set-view-mode', mode),
  getViewMode: () => invoke('get-view-mode'),
  getViewModeEntries: (opts) => invoke('get-view-mode-entries', opts),
  updateEntryTranslation: (payload) => invoke('update-entry-translation', payload),
  getChapterTree: () => invoke('get-chapter-tree'),
  getChapterEntries: (opts) => invoke('get-chapter-entries', opts),
  moveEntryChapter: (payload) => invoke('move-entry-chapter', payload),
  createChapterGroup: (payload) => invoke('create-chapter-group', payload),
  renameChapterGroup: (payload) => invoke('rename-chapter-group', payload),
  deleteChapterGroup: (payload) => invoke('delete-chapter-group', payload),
  createChapterSubGroup: (payload) => invoke('create-chapter-sub-group', payload),
  renameChapterSubGroup: (payload) => invoke('rename-chapter-sub-group', payload),
  deleteChapterSubGroup: (payload) => invoke('delete-chapter-sub-group', payload),
  resetChapterOverrides: () => invoke('reset-chapter-overrides'),
  autoSaveDraft: (payload) => invoke('auto-save-draft', payload),
  autoSaveGlossary: (payload) => invoke('auto-save-glossary', payload),
  autoSaveAll: (payload) => invoke('auto-save-all', payload),
  pickAutoSaveDir: () => invoke('pick-auto-save-dir'),
  openExternalLink: (url) => invoke('open-external-link', url),
});
