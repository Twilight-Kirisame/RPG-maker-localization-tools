// 验证主进程所有模块在 stub electron 下都能 require 起来，避免运行时缺 import 之类问题
const Module = require('module');
const stub = {
  app: { getPath: () => require('os').tmpdir() },
  ipcMain: { handle: () => {} },
  dialog: {},
  shell: {},
  BrowserWindow: function () {},
  Tray: function () {},
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: { createFromPath: () => ({}) },
  nativeTheme: { themeSource: 'system' },
  contextBridge: { exposeInMainWorld: () => {} },
  ipcRenderer: { invoke: () => {} },
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return stub;
  return origLoad.apply(this, arguments);
};

const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const r = (rel) => path.resolve(ROOT, rel);

const modules = [
  'src/main/services/storage/StorageService',
  'src/main/services/glossary/GlossaryService',
  'src/main/services/project/ProjectTextService',
  'src/main/services/translation/GlossaryInjector',
  'src/main/services/translation/TranslationCache',
  'src/main/services/translation/AutoSplit',
  'src/main/services/translation/TranslationService',
  'src/main/services/validation/EngineConstraints',
  'src/main/services/validation/EntryValidator',
  'src/main/services/export/ExportService',
  'src/main/services/export/RpgMakerWriteback',
  'src/main/services/engine/EngineAdapter',
  'src/main/services/engine/RpgMakerAdapter',
  'src/main/services/engine/UnityAdapter',
  'src/main/services/engine/registry',
  'src/main/services/localization/ProgressService',
  'src/main/services/localization/ProjectProgressStateService',
  'src/main/services/localization/LocalizationEntry',
  'src/main/services/localization/TextClassificationService',
  'src/main/ipc/project.ipc',
  'src/main/ipc/translation.ipc',
  'src/main/ipc/glossary.ipc',
  'src/main/ipc/export.ipc',
  'src/main/ipc/ui.ipc',
  'src/main/ipc/preview.ipc',
  'src/main/ipc/index',
  'src/main/services/preview/GamePreviewService',
];

let failed = 0;
for (const m of modules) {
  try {
    require(r(m));
    console.log('  ok  ' + m);
  } catch (e) {
    failed++;
    console.log('  ERR ' + m + ' :: ' + e.message);
  }
}
console.log(failed === 0 ? '\nALL OK' : `\n${failed} module(s) failed`);
process.exit(failed === 0 ? 0 : 1);
