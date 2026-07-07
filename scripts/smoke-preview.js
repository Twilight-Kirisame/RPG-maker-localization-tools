/**
 * 游戏内快速预览服务冒烟测试
 * 使用仓库自带的 test/fixtures/mv-mini 项目，验证依赖分析与补丁写回/恢复。
 * 同时覆盖 data/ 与 www/data/ 两种常见项目结构。
 */
const fs = require('fs');
const path = require('path');
const { previewInGame, stopPreview, cleanupOnStartup } = require('../src/main/services/preview/GamePreviewService');

const FIXTURE = path.resolve(__dirname, '..', 'assets', 'test-projects', 'mv-mini');

async function runScenario(name, tmpDir, dataPrefix) {
  console.log(`\n=== Scenario: ${name} ===`);
  console.log('tmp project:', tmpDir);
  const mapRel = `${dataPrefix}Map001.json`;
  const systemRel = `${dataPrefix}System.json`;
  console.log('original text:', JSON.parse(fs.readFileSync(path.join(tmpDir, mapRel), 'utf8')).events[1].pages[0].list[1].parameters[0]);

  await cleanupOnStartup(tmpDir);

  const entries = [
    { file: mapRel, path: 'events[1].pages[0].list[1].parameters[0]', targetDraft: '你好，世界。' },
    { file: mapRel, path: 'events[1].pages[0].list[2].parameters[0]', targetDraft: '这是同事件的第二句。' },
  ];
  const entry = entries[0];

  const result = await previewInGame(tmpDir, entry, '改后：你好，世界！', {
    jumpToStart: true,
    entries,
    gameExePath: process.execPath,
    gameArgs: ['-e', 'setInterval(()=>{}, 10000)'],
  });

  console.log('preview result:', result);
  if (!result.ok) throw new Error(`preview failed: ${result.message}`);

  const mapJson = JSON.parse(fs.readFileSync(path.join(tmpDir, mapRel), 'utf8'));
  const patchedText = mapJson.events[1].pages[0].list[1].parameters[0];
  const depText = mapJson.events[1].pages[0].list[2].parameters[0];
  const untouchedText = mapJson.events[1].pages[0].list[3].parameters[0];

  console.log('patched text:', patchedText);
  console.log('dependency text:', depText);
  console.log('untouched text:', untouchedText);

  if (patchedText !== '改后：你好，世界！') throw new Error('当前条目未写入');
  if (depText !== '这是同事件的第二句。') throw new Error('依赖条目未写入');
  if (untouchedText === '这是同事件的第二句。') throw new Error('不应把依赖文本写到无关路径');

  const restored = await stopPreview(tmpDir);
  console.log('restored:', restored);
  if (!restored.restored) throw new Error('备份未恢复');

  const mapJson2 = JSON.parse(fs.readFileSync(path.join(tmpDir, mapRel), 'utf8'));
  if (mapJson2.events[1].pages[0].list[1].parameters[0] === '改后：你好，世界！') {
    throw new Error('备份未正确恢复');
  }
  console.log('restored original text:', mapJson2.events[1].pages[0].list[1].parameters[0]);

  try { process.kill(result.pid); } catch {}
}

async function main() {
  if (!fs.existsSync(FIXTURE)) {
    console.log('SKIP: fixture not found at', FIXTURE);
    return;
  }

  const tmpData = path.join(require('os').tmpdir(), `rpg-preview-smoke-data-${Date.now()}`);
  const tmpWww = path.join(require('os').tmpdir(), `rpg-preview-smoke-www-${Date.now()}`);

  const tmpNested = path.join(require('os').tmpdir(), `rpg-preview-smoke-nested-${Date.now()}`);

  try {
    // data/ 结构
    fs.cpSync(FIXTURE, tmpData, { recursive: true });
    await runScenario('data/', tmpData, 'data/');

    // www/data/ 结构
    fs.cpSync(FIXTURE, tmpWww, { recursive: true });
    fs.mkdirSync(path.join(tmpWww, 'www', 'data'), { recursive: true });
    for (const name of fs.readdirSync(path.join(tmpWww, 'data'))) {
      fs.renameSync(path.join(tmpWww, 'data', name), path.join(tmpWww, 'www', 'data', name));
    }
    fs.rmdirSync(path.join(tmpWww, 'data'));
    await runScenario('www/data/', tmpWww, 'www/data/');

    // Game/data/ 非标准嵌套结构（验证 dataRoots 与 entry.file 推导）
    fs.cpSync(FIXTURE, tmpNested, { recursive: true });
    fs.mkdirSync(path.join(tmpNested, 'Game', 'data'), { recursive: true });
    for (const name of fs.readdirSync(path.join(tmpNested, 'data'))) {
      fs.renameSync(path.join(tmpNested, 'data', name), path.join(tmpNested, 'Game', 'data', name));
    }
    fs.rmdirSync(path.join(tmpNested, 'data'));
    await runScenario('Game/data/', tmpNested, 'Game/data/');

    console.log('\nGamePreviewService smoke test PASSED');
  } finally {
    await new Promise((r) => setTimeout(r, 500));
    try { fs.rmSync(tmpData, { recursive: true, force: true }); } catch (e) { console.log('cleanup warning:', e.message); }
    try { fs.rmSync(tmpWww, { recursive: true, force: true }); } catch (e) { console.log('cleanup warning:', e.message); }
    try { fs.rmSync(tmpNested, { recursive: true, force: true }); } catch (e) { console.log('cleanup warning:', e.message); }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
