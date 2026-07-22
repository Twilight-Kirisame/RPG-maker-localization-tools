// 剧情流线模式冒烟测试：验证 Map 内事件按剧情流启发式重排
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

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
  console.log(`  ✓ ${message}`);
}

function getEventIdsInOrder(entries) {
  // 从 entry.path 中提取 event index
  return entries.map((entry) => {
    const match = /events\[(\d+)\]/.exec(entry.path || '');
    return match ? parseInt(match[1], 10) : null;
  }).filter((id) => id !== null);
}

function getSpeakersInOrder(entries) {
  return entries.map((entry) => entry.context?.speaker || entry.timelineContext?.speaker || '').filter(Boolean);
}

function getTriggersInOrder(entries) {
  return entries.map((entry) => entry.timelineContext?.trigger || entry.context?.eventName || '').filter(Boolean);
}

(async () => {
  const { pickAdapter } = require(path.join(ROOT, 'src/main/services/engine/registry'));
  const { globalProjectStore } = require(path.join(ROOT, 'src/main/services/project/ProjectStore'));

  console.log('==> 剧情流线模式冒烟测试');

  const { adapter } = pickAdapter(FIXTURE);
  console.log('  adapter:', adapter.displayName);

  globalProjectStore.clear();
  const project = adapter.extract(FIXTURE);
  console.log('  physical entries:', project.entries.length);
  console.log('  timeline entries:', globalProjectStore.timelineEntries.length);
  console.log('  timeline meta:', globalProjectStore.timelineMeta);

  const timeline = globalProjectStore.timelineEntries;
  const map2Entries = timeline.filter((entry) => entry.file?.endsWith('Map002.json'));
  const map2EventIds = getEventIdsInOrder(map2Entries);
  const map2Speakers = getSpeakersInOrder(map2Entries);
  const map2Triggers = getTriggersInOrder(map2Entries);

  console.log('\n  Map002 时间线事件顺序:', map2EventIds.join(' -> '));
  console.log('  Map002 时间线说话者:', map2Speakers.join(' -> '));

  // 断言 1：自动执行事件（event 2）应排在行动键事件（event 1）之前
  const firstDialogueEvent = map2EventIds[0];
  assert(firstDialogueEvent === 2, `自动执行事件应排在最前，实际首个事件为 ${firstDialogueEvent}`);

  // 断言 2：405 滚动文本应出现在时间线中
  const hasScrollingText = map2Entries.some((entry) => entry.adapterMeta?.code === 405 || entry.adapterMeta?.kind === 'long-description');
  assert(hasScrollingText, '405 滚动文本应出现在时间线中');

  // 断言 3：条件页对话出现在默认页对话之后（event 3 page 1 在 page 0 之后）
  const conditionalLine = map2Entries.find((entry) => entry.source?.includes('スイッチ5がON'));
  assert(conditionalLine, '条件页对话应出现在时间线中');
  const defaultLine = map2Entries.find((entry) => entry.source?.includes('今日はいい天気'));
  assert(defaultLine, '默认页对话应出现在时间线中');
  const conditionalIdx = map2Entries.indexOf(conditionalLine);
  const defaultIdx = map2Entries.indexOf(defaultLine);
  assert(defaultIdx < conditionalIdx, '默认页对话应排在条件页对话之前');

  // 断言 4：选项与分支保留在对应事件页内
  const choiceEntry = map2Entries.find((entry) => entry.adapterMeta?.kind === 'choice' && entry.source === '調べる');
  assert(choiceEntry, '选项文本应出现在时间线中');
  const branchEntry = map2Entries.find((entry) => entry.adapterMeta?.kind === 'choice-branch' && entry.source === '調べる選択肢');
  assert(branchEntry, '分支文本应出现在时间线中');

  // 断言 5：说话者上下文正确传递
  const scrollingEntry = map2Entries.find((entry) => entry.adapterMeta?.kind === 'long-description');
  assert(scrollingEntry?.context?.speaker === '謎の声' || scrollingEntry?.timelineContext?.speaker === '謎の声', '405 滚动文本应继承 101 说话者');

  // 断言 6：物理顺序保持不变（globalProjectStore.physicalEntries 未被重排）
  const physicalMap2Ids = getEventIdsInOrder(globalProjectStore.physicalEntries.filter((entry) => entry.file?.endsWith('Map002.json')));
  const physicalOrderPreserved = physicalMap2Ids.every((id, i) => i === 0 || id >= physicalMap2Ids[i - 1]);
  assert(physicalOrderPreserved, `物理顺序应保持原始 eventIndex 递增，实际为 ${physicalMap2Ids.join(',')}`);

  // 断言 7：章节分类索引已生成
  const chapterGroups = globalProjectStore.getChapterGroups();
  assert(chapterGroups.length >= 3, `至少应有系统、静态、剧情三个顶层组，实际 ${chapterGroups.length} 个`);

  // 断言 8：系统与道具组包含 System/Items/CommonEvents
  const systemGroup = chapterGroups.find((g) => g.id === 'system');
  assert(systemGroup, '应存在系统与道具组');
  const systemGroupEntries = globalProjectStore.getEntriesByChapter('system');
  assert(systemGroupEntries.length > 0, '系统与道具组应包含条目');
  assert(systemGroupEntries.some((e) => e.file?.includes('System.json')), '系统组应包含 System.json 条目');
  assert(systemGroupEntries.some((e) => e.file?.includes('Items.json')), '系统组应包含 Items.json 条目');

  // 断言 9：静态环境调查组包含无条件的 Map 条目
  const staticGroup = chapterGroups.find((g) => g.id === 'static');
  assert(staticGroup, '应存在静态环境调查组');
  const staticGroupEntries = globalProjectStore.getEntriesByChapter('static');
  assert(staticGroupEntries.some((e) => e.file?.includes('Map002.json')), '静态调查组应包含 Map002 的无条件条目');

  // 断言 10：剧情流章节组包含有条件的 Map 条目
  const chapterGroup = chapterGroups.find((g) => g.type === 'chapter');
  assert(chapterGroup, '应存在剧情流章节组');
  const chapterGroupEntries = globalProjectStore.getEntriesByChapter(chapterGroup.id);
  assert(chapterGroupEntries.some((e) => e.source?.includes('スイッチ5がON')), '剧情章节组应包含条件页对话');

  // 断言 11：人工移动条目后，章节索引正确更新
  const targetEntry = staticGroupEntries.find((e) => e.file?.includes('Map002.json'));
  assert(targetEntry, '静态调查组应存在可移动的 Map002 条目');
  const moveOk = globalProjectStore.moveEntryToChapter(targetEntry.id, chapterGroup.id);
  assert(moveOk, '移动条目到剧情章节组应成功');
  const chapterGroupEntriesAfterMove = globalProjectStore.getEntriesByChapter(chapterGroup.id);
  assert(chapterGroupEntriesAfterMove.some((e) => e.id === targetEntry.id), '移动后条目应出现在剧情章节组');
  assert(targetEntry.chapterIsManual, '被移动条目应标记为人工修正');

  console.log('\n==> 剧情流线模式冒烟测试通过');
})().catch((e) => {
  console.error('==> FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
