/**
 * 游戏内快速预览服务冒烟测试
 * 使用仓库自带的 assets/test-projects/mv-mini 项目，验证：
 *   - 依赖分析与补丁写回/恢复
 *   - data/ / www/data/ / Game/data/ 三种项目结构
 *   - 预览提示插件（RpgWorkbenchPreviewNotifier）的注入与清理
 *   - 无缝重开（repreviewInGame）与退回标题（returnToTitle）
 */
const fs = require('fs');
const path = require('path');
const { previewInGame, repreviewInGame, returnToTitle, stopPreview, cleanupOnStartup } = require('../src/main/services/preview/GamePreviewService');

const FIXTURE = path.resolve(__dirname, '..', 'assets', 'test-projects', 'mv-mini');

async function runScenario(name, tmpDir, dataPrefix) {
  console.log(`\n=== Scenario: ${name} ===`);
  console.log('tmp project:', tmpDir);
  const mapRel = `${dataPrefix}Map001.json`;
  const systemRel = `${dataPrefix}System.json`;
  const jsPrefix = dataPrefix.replace(/data\/$/, 'js/');
  const pluginsJsPath = path.join(tmpDir, jsPrefix, 'plugins.js');
  const pluginFilePath = path.join(tmpDir, jsPrefix, 'plugins', 'RpgWorkbenchPreviewNotifier.js');
  console.log('original text:', JSON.parse(fs.readFileSync(path.join(tmpDir, mapRel), 'utf8')).events[1].pages[0].list[1].parameters[0]);

  // 构造一个最小 js/plugins.js 用于验证插件注入/恢复
  fs.mkdirSync(path.dirname(pluginsJsPath), { recursive: true });
  const originalPluginsJs = 'var $plugins = [{"name":"DummyPlugin","status":true,"description":"dummy","parameters":{}}];';
  fs.writeFileSync(pluginsJsPath, originalPluginsJs, 'utf8');

  await cleanupOnStartup(tmpDir);

  const entries = [
    { file: mapRel, path: 'events[1].pages[0].list[1].parameters[0]', targetDraft: '你好，世界。' },
    { file: mapRel, path: 'events[1].pages[0].list[2].parameters[0]', targetDraft: '这是同事件的第二句。' },
  ];
  const entry = entries[0];

  const result = await previewInGame(tmpDir, entry, '改后：你好，世界！', {
    jumpToStart: true,
    entries,
    showPreviewNotification: true,
    previewNotificationPosition: 'top-center',
    gameExePath: process.execPath,
    gameArgs: ['-e', 'setInterval(()=>{}, 10000)'],
  });

  console.log('preview result:', result);
  if (!result.ok) throw new Error(`preview failed: ${result.message}`);

  // 验证预览提示插件已注入
  if (!fs.existsSync(pluginFilePath)) throw new Error('预览提示插件文件未创建');
  const pluginsJsAfter = fs.readFileSync(pluginsJsPath, 'utf8');
  if (!pluginsJsAfter.includes('RpgWorkbenchPreviewNotifier')) throw new Error('预览提示插件未注册到 plugins.js');

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

  // 无缝重开测试：更新到另一个文本并发送 F12/Enter 指令
  const repreviewResult = await repreviewInGame(tmpDir, entry, '改后：无缝重开测试', {
    jumpToStart: true,
    entries,
    gamePid: result.pid,
  });
  console.log('repreview result:', repreviewResult);
  if (!repreviewResult.ok) throw new Error(`repreview failed: ${repreviewResult.message}`);
  await new Promise((r) => setTimeout(r, 400));
  const mapJsonAfterRepreview = JSON.parse(fs.readFileSync(path.join(tmpDir, mapRel), 'utf8'));
  if (mapJsonAfterRepreview.events[1].pages[0].list[1].parameters[0] !== '改后：无缝重开测试') {
    throw new Error('无缝重开未更新文本');
  }

  // returnToTitle 不应抛错
  returnToTitle(tmpDir, result.pid);

  const restored = await stopPreview(tmpDir);
  console.log('restored:', restored);
  if (!restored.restored) throw new Error('备份未恢复');

  // 验证预览提示插件已清理
  const pluginsJsRestored = fs.readFileSync(pluginsJsPath, 'utf8');
  if (pluginsJsRestored !== originalPluginsJs) throw new Error('plugins.js 未恢复到原始内容');
  if (fs.existsSync(pluginFilePath)) throw new Error('预览提示插件文件未清理');

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
