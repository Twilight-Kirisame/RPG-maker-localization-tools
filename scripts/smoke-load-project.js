// 直接调用 load-project-texts IPC 内部使用的核心服务链，复刻用户「打开项目」的执行流程，
// 不启 Electron 但触发与运行时同等的 require + 业务逻辑。
const Module = require('module');
const path = require('path');

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
};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return stub;
  return origLoad.apply(this, arguments);
};

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'assets', 'test-projects', 'mv-mini');

(async () => {
  const { pickAdapter } = require(path.join(ROOT, 'src/main/services/engine/registry'));
  const { detectGlossaryHits, ensureProjectGlossary } = require(path.join(ROOT, 'src/main/services/glossary/GlossaryService'));
  const { loadAiSettings } = require(path.join(ROOT, 'src/main/services/translation/TranslationService'));
  const { loadDraft, applyDraftToEntries } = require(path.join(ROOT, 'src/main/services/export/ExportService'));

  console.log('==> 模拟 load-project-texts IPC 流程');
  const { adapter, probe, fallback } = pickAdapter(FIXTURE);
  console.log('  adapter:', adapter?.displayName || adapter?.id, '| confidence:', probe?.confidence, '| fallback:', fallback);

  const project = adapter.extract(FIXTURE);
  project.engine = project.engine || adapter.displayName;
  project.adapterId = adapter.id;
  console.log('  engine:', project.engine, '| entries:', (project.entries || []).length);

  const glossary = await ensureProjectGlossary(project);
  console.log('  glossary:', glossary.glossaryName, '| terms:', (glossary.terms || []).length);

  const aiSettings = await loadAiSettings(project);
  console.log('  aiSettings.provider:', aiSettings.provider);

  let entries = detectGlossaryHits(project.entries || [], glossary);
  console.log('  entries w/ hits:', entries.length);

  const draft = await loadDraft(FIXTURE);
  console.log('  draft loaded:', !!draft);
  if (draft?.entries?.length) entries = applyDraftToEntries(entries, draft.entries);

  // 进度统计
  try {
    const { calculateGlobalProgress, calculateFileProgress } = require(path.join(ROOT, 'src/main/services/localization/ProgressService'));
    const gp = calculateGlobalProgress(entries);
    const fp = calculateFileProgress(entries);
    console.log('  global progress:', gp);
    console.log('  per-file progress (head 3):', (fp || []).slice(0, 3));
  } catch (e) {
    console.log('  ProgressService probe failed:', e.message);
  }

  console.log('\n==> load-project-texts full chain executed without error');
})().catch((e) => {
  console.error('==> FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
