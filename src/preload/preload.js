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
  exportPatch: (payload) => invoke('export-patch', payload),
  saveDraft: (payload) => invoke('save-draft', payload),
  openFolder: (folderPath) => invoke('open-folder', folderPath),
  getAiSettings: (payload) => invoke('get-ai-settings', payload),
  saveAiSettings: (payload) => invoke('save-ai-settings', payload),
  saveTranslatorSettings: (payload) => invoke('save-translator-settings', payload),
  testTranslatorSettings: (payload) => invoke('test-translator-settings', payload),
  aiTranslate: (payload) => invoke('ai-translate', payload),
  getUiSettings: () => invoke('get-ui-settings'),
  saveUiSettings: (payload) => invoke('save-ui-settings', payload),
});
