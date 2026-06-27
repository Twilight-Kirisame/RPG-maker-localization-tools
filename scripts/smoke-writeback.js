/**
 * @file scripts/smoke-writeback.js
 * @description 端到端冒烟测试：
 *  1. 用 ProjectTextService 提取 assets/test-projects/mv-mini 的全部条目
 *  2. 用 GlossaryInjector 把术语注入 / 替换在虚拟 AI 上演练
 *  3. 用 AutoSplit 对 1 条超长 401 拆行
 *  4. 用 RpgMakerWriteback.applyToFiles 把结果写回 localization_patch/data/
 *  5. 断言：输出 JSON 形状对、字数对、原始文件未变化
 *
 * 不依赖 electron / sqlite / 任何 native module，可在 CI 中 `node scripts/smoke-writeback.js` 跑通。
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { collectProjectTexts } = require('../src/main/services/project/ProjectTextService');
const { applyToFiles } = require('../src/main/services/export/RpgMakerWriteback');
const { split: autoSplit } = require('../src/main/services/translation/AutoSplit');
const { applyInjection } = require('../src/main/services/translation/GlossaryInjector');
const { validateEntry } = require('../src/main/services/validation/EntryValidator');

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'assets', 'test-projects', 'mv-mini');
const PATCH_DIR = path.join(FIXTURE_ROOT, 'localization_patch');

function pass(msg) { console.log(`  PASS  ${msg}`); }
function fail(msg, err) { console.error(`  FAIL  ${msg}\n        ${err?.message || err}`); process.exitCode = 1; }

function cleanupPatch() {
  if (fs.existsSync(PATCH_DIR)) fs.rmSync(PATCH_DIR, { recursive: true, force: true });
}

function snapshotFixture() {
  const out = {};
  for (const file of ['System.json', 'CommonEvents.json', 'Map001.json', 'Items.json']) {
    out[file] = fs.readFileSync(path.join(FIXTURE_ROOT, 'data', file), 'utf8');
  }
  return out;
}

function fakeTranslate(text) {
  // 简易 mock 翻译：在原文前加 [zh] 前缀；多语境下可被 cache/inject 覆盖。
  return `[zh]${text}`;
}

async function main() {
  console.log('## smoke-writeback');
  cleanupPatch();
  const originalSnapshot = snapshotFixture();

  // 1) 提取
  const project = collectProjectTexts(FIXTURE_ROOT);
  assert.ok(project.entries.length > 0, '应当提取到条目');
  pass(`提取 ${project.entries.length} 条文本`);

  // 兼容旧形状（顶层 code/kind）与新形状（adapterMeta.code/kind）
  const codeOf = (e) => Number(e?.code ?? e?.adapterMeta?.code);
  const kindOf = (e) => e?.kind ?? e?.adapterMeta?.kind ?? e?.textType ?? '';

  const longDialogue = project.entries.find((e) => codeOf(e) === 401 && e.source.includes('長い'));
  assert.ok(longDialogue, '应当能找到长对话条目');
  pass(`定位长对话条目：${longDialogue.path}`);

  // 2) 术语注入演练
  const glossary = { terms: [{ source: 'アルレッキーノ', target: '阿尔莱奇诺', enabled: true }] };
  const speakerEntry = project.entries.find((e) => e.source === 'アルレッキーノ');
  const inj = applyInjection({ sourceText: speakerEntry.source, systemPrompt: '基础提示', glossary, mode: 'replace' });
  assert.strictEqual(inj.effectiveSource, '阿尔莱奇诺', '强制替换后原文应当变为目标译名');
  pass('GlossaryInjector replace 模式按术语替换原文');

  // 3) AutoSplit 拆行
  const { lines } = autoSplit(fakeTranslate(longDialogue.source), { maxCharsPerLine: 28, maxLines: 4 });
  assert.ok(lines.length > 1, '超长译文应当被拆为多行');
  pass(`AutoSplit 拆为 ${lines.length} 行`);

  // 4) 校验：故意造一个超长 + 缺控制码的译文
  const validation = validateEntry({ source: longDialogue.source, target: 'これは非常に長い行であり、制限を超える', kind: kindOf(longDialogue), code: codeOf(longDialogue) }, 'RPG Maker MV/MZ');
  pass(`validateEntry 命中 ${validation.warnings.length} 条 warning（demo）`);

  // 5) 用 fakeTranslate 给所有条目造译文，长对话用 AutoSplit 结果
  const translatedEntries = project.entries.map((e) => {
    if (e === longDialogue) return { ...e, target: lines.join('\n') };
    if (e === speakerEntry) return { ...e, target: '阿尔莱奇诺' };
    return { ...e, target: fakeTranslate(e.source) };
  });

  // 6) 写回
  const result = await applyToFiles({ project: { rootDir: FIXTURE_ROOT, engine: 'RPG Maker MV/MZ' }, entries: translatedEntries });
  assert.ok(result.ok, '写回应当成功');
  assert.ok(result.files.length > 0, '应当产出 >0 个写回文件');
  pass(`写回 ${result.files.length} 个文件，错误 ${result.errors.length} 条，跳过 ${result.skipped}`);

  // 7) 原始文件应当字节级未变
  const afterSnapshot = snapshotFixture();
  for (const [file, content] of Object.entries(originalSnapshot)) {
    assert.strictEqual(afterSnapshot[file], content, `${file} 原始文件被改动`);
  }
  pass('原始 fixture 文件未被改动');

  // 8) 输出 JSON 结构断言
  const outMap = JSON.parse(fs.readFileSync(path.join(PATCH_DIR, 'data', 'Map001.json'), 'utf8'));
  const list = outMap.events[1].pages[0].list;
  const firstDialogue = list.find((cmd) => cmd.code === 401 && cmd.parameters[0]?.startsWith('[zh]ようこそ'));
  assert.ok(firstDialogue, '第一条 401 应写入翻译');
  pass('第一条 401 译文写入到位');

  const longSplits = list.filter((cmd, idx) => cmd.code === 401 && idx >= 3);
  assert.ok(longSplits.length >= 2, `长对话应当被拆为多条 401，实际：${longSplits.length}`);
  for (const cmd of longSplits) assert.strictEqual(cmd.indent, longSplits[0].indent, '拆出的 401 indent 必须一致');
  pass(`长对话拆为 ${longSplits.length} 条连续 401（indent=${longSplits[0].indent}）`);

  const endMarker = list.find((cmd) => cmd.code === 0);
  assert.ok(endMarker, 'code:0 结束标记应仍存在');
  pass('code:0 结束标记位置保留');

  const outItems = JSON.parse(fs.readFileSync(path.join(PATCH_DIR, 'data', 'Items.json'), 'utf8'));
  assert.strictEqual(outItems[1].name, '[zh]ポーション', 'Items 译名写入');
  pass('Items 译名按 path 写入');

  const outSystem = JSON.parse(fs.readFileSync(path.join(PATCH_DIR, 'data', 'System.json'), 'utf8'));
  assert.strictEqual(outSystem.gameTitle, '[zh]テスト', 'System gameTitle 写入');
  assert.strictEqual(outSystem.terms.commands[0], '[zh]攻撃', 'System terms.commands[0] 写入');
  pass('System 字段按 path 写入');

  cleanupPatch();
  console.log('\n## smoke-writeback OK\n');
}

main().catch((err) => fail('main', err));
