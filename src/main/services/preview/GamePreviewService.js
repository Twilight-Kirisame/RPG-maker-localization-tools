/**
 * @file src/main/services/preview/GamePreviewService.js
 * @description 游戏内快速预览服务。临时把当前编辑的文本写回游戏 JSON，
 *   基于文本依赖项分析把同一事件/上下文组的相关译文一并带入，
 *   修改出生点，启动 Game.exe --test，退出后自动恢复原文件。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const { ensureDir } = require('../../utils/fsUtils');
const { getMainWindow, getMainWindowHandle } = require('../../appWindow');

const PREVIEW_BACKUP_DIR = 'localization_preview_backup';
const PREVIEW_LOCK_FILE = 'localization_preview.lock';
const PREVIEW_LOG_FILE = 'localization_preview.log';
const PREVIEW_LOCK_TTL_MS = 5 * 60 * 1000; // 5 分钟认为锁过期（防止崩溃残留）

function getBackupDir(rootDir) {
  return path.join(rootDir, PREVIEW_BACKUP_DIR);
}

function getLockFile(rootDir) {
  return path.join(rootDir, PREVIEW_LOCK_FILE);
}

function getLogFile(rootDir) {
  return path.join(rootDir, PREVIEW_LOG_FILE);
}

function hashFile(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return '';
  }
}

function log(rootDir, message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try { fs.appendFileSync(getLogFile(rootDir), line, 'utf8'); } catch { /* ignore */ }
}

/**
 * 解析 RPG Maker 事件路径，返回最后一层之前的对象和最后一层 key。
 * 路径形如：events[3].pages[0].list[12].parameters[0]
 */
function resolvePath(obj, pathStr) {
  if (!pathStr) return { parent: obj, key: '', isArrayIndex: false };
  const tokens = [];
  const regex = /(?:^|\.)([a-zA-Z_]\w*)|\[(\d+)\]/g;
  let match;
  while ((match = regex.exec(pathStr)) !== null) {
    tokens.push(match[1] !== undefined ? { type: 'key', value: match[1] } : { type: 'index', value: parseInt(match[2], 10) });
  }
  let current = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    current = current[token.value];
    if (current == null) return null;
  }
  if (!tokens.length) return null;
  const last = tokens[tokens.length - 1];
  return { parent: current, key: last.value, isArrayIndex: last.type === 'index' };
}

/**
 * 从 entry.path 中提取事件 ID（用于获取事件坐标）。
 * 例如 events[3].pages[0].list[12].parameters[0] -> 3
 */
function extractEventId(pathStr) {
  const match = /events\[(\d+)\]/.exec(pathStr || '');
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 从 Map 文件名解析 mapId。例如 data/Map002.json -> 2
 */
function extractMapId(fileName) {
  const match = /Map(\d+)\.json$/i.exec(fileName || '');
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 判断路径是否指向 CommonEvents.json 中的事件。
 */
function isCommonEventPath(pathStr) {
  return /^commonEvents\[\d+\]/i.test(pathStr || '');
}

/**
 * 备份单个文件。
 * 关键约定：已存在的备份代表上一次干净的原文件，绝不能用当前（可能已被预览修改过）的文件覆盖它。
 * 若检测到当前文件与备份不一致，优先从旧备份恢复，避免原文件被永久污染。
 */
async function backupFile(rootDir, relPath) {
  const src = path.join(rootDir, relPath.replace(/\//g, path.sep));
  const dest = path.join(getBackupDir(rootDir), relPath.replace(/\//g, path.sep));
  if (!fs.existsSync(src)) throw new Error(`源文件不存在：${relPath}`);
  ensureDir(path.dirname(dest));

  if (fs.existsSync(dest)) {
    const srcHash = hashFile(src);
    const destHash = hashFile(dest);
    if (srcHash && destHash && srcHash !== destHash) {
      log(rootDir, `检测到 ${relPath} 已被修改，优先从旧备份恢复原始文件`);
      try {
        await fsp.copyFile(dest, src);
      } catch (error) {
        log(rootDir, `从旧备份恢复失败：${relPath} (${error.message})`);
        throw new Error(`无法恢复 ${relPath} 的原始备份，预览已中止以防止覆盖原文件`);
      }
    }
    log(rootDir, `备份已存在，跳过：${relPath}`);
    return;
  }

  await fsp.copyFile(src, dest);
  log(rootDir, `备份：${relPath}`);
}

/**
 * 恢复单个文件。
 */
async function restoreFile(rootDir, relPath) {
  const src = path.join(getBackupDir(rootDir), relPath.replace(/\//g, path.sep));
  const dest = path.join(rootDir, relPath.replace(/\//g, path.sep));
  if (!fs.existsSync(src)) return false;
  await fsp.copyFile(src, dest);
  log(rootDir, `恢复：${relPath}`);
  return true;
}

/**
 * 删除单个备份文件。
 */
async function removeBackupFile(rootDir, relPath) {
  const backupPath = path.join(getBackupDir(rootDir), relPath.replace(/\//g, path.sep));
  if (fs.existsSync(backupPath)) {
    await fsp.unlink(backupPath);
  }
}

/**
 * 清理空备份目录。
 */
async function removeEmptyBackupDirs(rootDir) {
  const backupDir = getBackupDir(rootDir);
  if (!fs.existsSync(backupDir)) return;
  try {
    await removeEmptyDirs(backupDir);
  } catch { /* ignore */ }
}

async function removeEmptyDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await removeEmptyDirs(fullPath);
    }
  }
  const remaining = await fsp.readdir(dirPath);
  if (!remaining.length) {
    await fsp.rmdir(dirPath);
  }
}

/**
 * 读取锁文件内容，返回 { pid, timestamp } 或 null。
 */
function readLock(rootDir) {
  const lockFile = getLockFile(rootDir);
  if (!fs.existsSync(lockFile)) return null;
  try {
    const raw = fs.readFileSync(lockFile, 'utf8').trim();
    const [pidPart, timePart] = raw.split(':');
    return { pid: Number(pidPart) || 0, timestamp: Number(timePart) || 0 };
  } catch {
    return { pid: 0, timestamp: 0 };
  }
}

/**
 * 检查是否已有预览进行中。支持过期锁检测；同进程可再次预览（用于无缝重定位）。
 */
function isPreviewLocked(rootDir) {
  const lock = readLock(rootDir);
  if (!lock) return false;
  if (lock.pid === process.pid) return false; // 当前进程自身可重入
  if (lock.timestamp && Date.now() - lock.timestamp > PREVIEW_LOCK_TTL_MS) {
    return false;
  }
  return true;
}

async function acquireLock(rootDir) {
  const lockFile = getLockFile(rootDir);
  await fsp.writeFile(lockFile, `${process.pid}:${Date.now()}`, 'utf8');
}

async function releaseLock(rootDir) {
  const lockFile = getLockFile(rootDir);
  if (fs.existsSync(lockFile)) {
    try { await fsp.unlink(lockFile); } catch { /* ignore */ }
  }
}

/**
 * 递归列出备份目录下所有文件的相对路径。
 */
async function listBackupFiles(backupDir) {
  if (!fs.existsSync(backupDir)) return [];
  const results = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        results.push(path.relative(backupDir, fullPath).replace(/\\/g, '/'));
      }
    }
  }
  await walk(backupDir);
  return results;
}

/**
 * 递归查找项目下的 js 目录（用于清理残留的预览提示插件）。
 */
function discoverJsRoots(rootDir, maxDepth = 3) {
  const roots = new Set();
  const skipped = new Set(['node_modules', 'localization_preview_backup', 'localization_exports', 'localization_drafts', 'localization_glossaries']);
  function walk(dir, depth) {
    if (!dir || depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'js') {
        roots.add(fullPath);
        continue;
      }
      if (skipped.has(entry.name)) continue;
      walk(fullPath, depth + 1);
    }
  }
  walk(rootDir, 0);
  return [...roots];
}

/**
 * 启动时检查并恢复残留备份（防崩溃后遗留）。
 * 会尽可能恢复所有备份文件，失败时保留备份并记录日志，不会擅自删除可能未恢复成功的备份。
 */
async function cleanupOnStartup(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return { restored: false, files: [], errors: [] };
  const backupDir = getBackupDir(rootDir);
  const errors = [];
  const restored = [];

  if (fs.existsSync(backupDir)) {
    const files = await listBackupFiles(backupDir);
    for (const relPath of files) {
      try {
        await restoreFile(rootDir, relPath);
        restored.push(relPath);
        await removeBackupFile(rootDir, relPath);
      } catch (error) {
        errors.push({ file: relPath, message: error.message });
        log(rootDir, `恢复残留备份失败：${relPath} (${error.message})`);
      }
    }
  }

  await removeEmptyBackupDirs(rootDir);
  await releaseLock(rootDir);

  // 清理崩溃可能残留的预览提示插件
  for (const jsRoot of discoverJsRoots(rootDir)) {
    await removePreviewNotifier(rootDir, jsRoot);
  }
  cleanupCommandFile(rootDir);

  return { restored: restored.length > 0, files: restored, errors };
}

/**
 * 写入单个预览补丁到指定 JSON 文件。
 */
function writePatchToJson(json, entryPath, targetText) {
  const resolved = resolvePath(json, entryPath);
  if (!resolved) throw new Error(`无法解析路径：${entryPath}`);
  resolved.parent[resolved.key] = targetText;
}

/**
 * 分析当前条目的依赖项，返回需要一起写回的 patch 列表。
 *
 * 策略：
 * 1. 当前条目本身一定写入。
 * 2. 对于 Map 事件（events[*].pages[*].list[*]）：
 *    - 同一 event 内的所有已翻译对话行（401）
 *    - 同一 event 内的说话者（101 parameters[4]）
 *    - 同一 event 内的选项（102）与分支名（402）
 *    - 同一 event 内的长文本（405）
 * 3. 对于 CommonEvents：同一 commonEvent 索引内的相关条目。
 * 4. 对于数据库/System：只写自身。
 *
 * @param {Object} entry 当前选中的条目
 * @param {Object[]} entries 可选的项目条目集合（至少包含当前文件）
 * @returns {Object[]} [{ file, path, targetText }]
 */
function analyzeDependencies(entry, entries = []) {
  const patches = [];
  if (!entry?.file || !entry?.path) return patches;

  // 自身
  patches.push({ file: entry.file, path: entry.path, targetText: entry.target ?? entry.targetDraft ?? '' });

  const currentPath = entry.path;
  const currentFile = entry.file;

  // Map 事件：按 eventId 聚合
  const currentEventId = extractEventId(currentPath);
  if (currentEventId != null && /(^|\/)data\/Map\d+\.json$/i.test(currentFile)) {
    const eventPrefix = `events[${currentEventId}]`;
    entries.forEach((other) => {
      if (!other || other.file !== currentFile) return;
      if (other.path === currentPath) return;
      if (!other.path?.startsWith(eventPrefix)) return;
      const text = String(other.targetDraft ?? other.target ?? '').trim();
      if (!text) return;
      patches.push({ file: other.file, path: other.path, targetText: text });
    });
    return patches;
  }

  // CommonEvents：按 commonEvents[index] 聚合
  const commonMatch = /^(commonEvents\[\d+\])/.exec(currentPath);
  if (commonMatch) {
    const eventPrefix = commonMatch[1];
    entries.forEach((other) => {
      if (!other || other.file !== currentFile) return;
      if (other.path === currentPath) return;
      if (!other.path?.startsWith(eventPrefix)) return;
      const text = String(other.targetDraft ?? other.target ?? '').trim();
      if (!text) return;
      patches.push({ file: other.file, path: other.path, targetText: text });
    });
    return patches;
  }

  return patches;
}

/**
 * 按文件分组 patch 并写回。
 */
async function writePreviewPatches(rootDir, patches) {
  const byFile = new Map();
  patches.forEach((patch) => {
    if (!byFile.has(patch.file)) byFile.set(patch.file, []);
    byFile.get(patch.file).push(patch);
  });

  for (const [relPath, filePatches] of byFile) {
    const filePath = path.join(rootDir, relPath.replace(/\//g, path.sep));
    const raw = await fsp.readFile(filePath, 'utf8');
    const json = JSON.parse(raw);
    filePatches.forEach((patch) => {
      try {
        writePatchToJson(json, patch.path, patch.targetText);
      } catch (error) {
        log(rootDir, `跳过无效预览路径：${relPath} → ${patch.path}（${error.message}）`);
      }
    });
    await fsp.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8');
    log(rootDir, `写入预览补丁：${relPath} (${filePatches.length} 处)`);
  }
}

/**
 * 查找 System.json 的相对路径。
 * 优先顺序：
 * 1. 当前 entry.file 所在目录（兼容 Game/data/Map002.json 等非标准布局）
 * 2. 项目扫描得到的 dataRoots
 * 3. 兼容旧硬编码：data/System.json、www/data/System.json
 */
function findSystemJsonRelPath(rootDir, options = {}) {
  const candidates = [];

  const entryFile = String(options.entryFile || '').replace(/\\/g, '/');
  if (entryFile) {
    candidates.push(path.posix.join(path.posix.dirname(entryFile), 'System.json'));
  }

  if (Array.isArray(options.dataRoots)) {
    options.dataRoots.forEach((dataRoot) => {
      const relRoot = path.relative(rootDir, dataRoot).replace(/\\/g, '/');
      candidates.push(path.posix.join(relRoot, 'System.json'));
    });
  }

  candidates.push('data/System.json', 'www/data/System.json');

  for (const rel of candidates) {
    const normalizedRel = String(rel || '').replace(/^\.\//, '').replace(/\\/g, '/');
    if (!normalizedRel) continue;
    if (fs.existsSync(path.join(rootDir, normalizedRel.replace(/\//g, path.sep)))) return normalizedRel;
  }

  return entryFile
    ? path.posix.join(path.posix.dirname(entryFile), 'System.json')
    : 'data/System.json';
}

/**
 * 修改 System.json 的出生点到指定地图坐标。
 */
async function setStartPosition(rootDir, systemRelPath, mapId, x, y) {
  const systemPath = path.join(rootDir, systemRelPath.replace(/\//g, path.sep));
  if (!fs.existsSync(systemPath)) throw new Error('找不到 System.json');
  const raw = await fsp.readFile(systemPath, 'utf8');
  const system = JSON.parse(raw);
  system.startMapId = mapId;
  system.startX = x;
  system.startY = y;
  await fsp.writeFile(systemPath, JSON.stringify(system, null, 2), 'utf8');
  log(rootDir, `出生点魔改：mapId=${mapId}, x=${x}, y=${y}`);
  return system;
}

/**
 * 从 Map.json 读取指定事件坐标，并尝试找一个不与事件重叠的相邻格子。
 */
async function getEventPosition(rootDir, mapRelPath, eventId) {
  const mapPath = path.join(rootDir, mapRelPath.replace(/\//g, path.sep));
  const raw = await fsp.readFile(mapPath, 'utf8');
  const mapJson = JSON.parse(raw);
  const event = mapJson.events?.[eventId];
  if (!event) return null;
  let x = event.x ?? 0;
  let y = event.y ?? 0;

  // 尝试把玩家放在事件右侧一格；若越界则依次尝试左/下/上
  const width = mapJson.width || 256;
  const height = mapJson.height || 256;
  const candidates = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  for (const c of candidates) {
    if (c.x >= 0 && c.x < width && c.y >= 0 && c.y < height) {
      return { x: c.x, y: c.y, originalX: x, originalY: y };
    }
  }
  return { x, y, originalX: x, originalY: y };
}

/**
 * 查找 Game.exe 路径。
 */
function findGameExecutable(rootDir) {
  const candidates = ['Game.exe', 'game.exe', 'nw.exe'];
  const dirs = ['', 'www'];
  for (const dir of dirs) {
    for (const name of candidates) {
      const fullPath = path.join(rootDir, dir, name);
      if (fs.existsSync(fullPath)) return fullPath;
    }
  }
  return null;
}

const PREVIEW_NOTIFIER_PLUGIN_NAME = 'RpgWorkbenchPreviewNotifier';

/**
 * 根据 dataRoots 或 entry.file 推导游戏的 js 目录。
 */
function findJsRoot(rootDir, options = {}) {
  if (Array.isArray(options.dataRoots) && options.dataRoots.length) {
    for (const dataRoot of options.dataRoots) {
      const jsRoot = path.join(dataRoot, '..', 'js');
      if (fs.existsSync(jsRoot)) return jsRoot;
    }
  }
  if (options.entryFile) {
    const entryDir = path.dirname(options.entryFile.replace(/\\/g, '/'));
    const jsRoot = path.join(rootDir, entryDir, '..', 'js');
    if (fs.existsSync(jsRoot)) return jsRoot;
  }
  const candidates = ['js', 'www/js'];
  for (const rel of candidates) {
    const fullPath = path.join(rootDir, rel);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

/**
 * 生成 RPG Maker MV/MZ 插件代码：在游戏中显示一个半透控制浮层（提示 + 上一句/下一句/返回标题）。
 * 使用 DOM 覆盖层实现按钮，比 RPG Maker 原生 Sprite 按钮更简单可靠。
 */
function buildNotifierPluginCode(text, position, duration, labels = {}, commandFile = '', enableOverlay = true) {
  const safeText = String(text || '').replace(/'/g, "\\'").replace(/\\/g, '\\\\');
  const safePosition = String(position || 'top-center').replace(/'/g, "\\'");
  const safeDuration = String(Number(duration) || 0);
  const safeCommandFile = String(commandFile || path.join(process.cwd(), 'localization_preview_command.json')).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const safePrev = String(labels.prev || '上一句').replace(/'/g, "\\'");
  const safeNext = String(labels.next || '下一句').replace(/'/g, "\\'");
  const safeTitle = String(labels.title || '返回标题').replace(/'/g, "\\'");
  const safeEnableOverlay = enableOverlay !== false ? 'true' : 'false';
  return `// 由 RPG 汉化工作台自动注入，预览结束后会自动移除
(function() {
  'use strict';
  const params = PluginManager.parameters('${PREVIEW_NOTIFIER_PLUGIN_NAME}');
  const enabled = String(params['Enabled'] || 'true').toLowerCase() === 'true';
  const text = String(params['Text'] || '${safeText}');
  const position = String(params['Position'] || '${safePosition}');
  const duration = Number(params['Duration'] || '${safeDuration}');
  const commandFile = String(params['CommandFile'] || '${safeCommandFile}');
  const labelPrev = String(params['ButtonPrev'] || '${safePrev}');
  const labelNext = String(params['ButtonNext'] || '${safeNext}');
  const labelTitle = String(params['ButtonTitle'] || '${safeTitle}');
  const enableOverlay = ${safeEnableOverlay};

  if (!enabled) return;

  // 状态显示元素，用于给用户即时反馈
  let statusEl = null;
  function updateStatus(message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.opacity = '1';
    setTimeout(() => { if (statusEl) statusEl.style.opacity = '0.6'; }, 1500);
  }

  // 直接驱动 RPG Maker 的 Input 对象，比纯 DOM 事件更可靠
  function pressRpgMakerButton(buttonName, key, code, keyCode) {
    try {
      if (typeof Input !== 'undefined') {
        if (typeof Input._onKeyDown === 'function') Input._onKeyDown({ keyCode, code, key, preventDefault: function(){} });
        if (Input._currentState && typeof Input._currentState === 'object') Input._currentState[buttonName] = true;
      }
    } catch (e) { console.error('[RpgWorkbenchPreviewNotifier] pressRpgMakerButton failed', e); }
  }
  function releaseRpgMakerButton(buttonName, key, code, keyCode) {
    try {
      if (typeof Input !== 'undefined') {
        if (typeof Input._onKeyUp === 'function') Input._onKeyUp({ keyCode, code, key, preventDefault: function(){} });
        if (Input._currentState && typeof Input._currentState === 'object') Input._currentState[buttonName] = false;
      }
    } catch (e) { console.error('[RpgWorkbenchPreviewNotifier] releaseRpgMakerButton failed', e); }
  }

  function simulateKey(key, code, keyCode) {
    try {
      const targets = [window, document, document.body, document.documentElement].filter(Boolean);
      const down = new KeyboardEvent('keydown', { key, code, keyCode, bubbles: true, cancelable: true, view: window });
      const up = new KeyboardEvent('keyup', { key, code, keyCode, bubbles: true, cancelable: true, view: window });
      targets.forEach(function(t) { try { t.dispatchEvent(down); } catch (e) {} });
      setTimeout(function() { targets.forEach(function(t) { try { t.dispatchEvent(up); } catch (e) {} }); }, 80);
    } catch (e) {
      console.error('[RpgWorkbenchPreviewNotifier] simulateKey failed', e);
    }
  }

  function nextSentence() {
    // 下一句：模拟决定键（Enter/Space/Z），推进游戏内文本
    pressRpgMakerButton('ok', 'Enter', 'Enter', 13);
    simulateKey('Enter', 'Enter', 13);
    setTimeout(function() { releaseRpgMakerButton('ok', 'Enter', 'Enter', 13); }, 120);
    updateStatus('下一句');
  }

  function previousSentence() {
    // 上一句：模拟取消键（Escape/Insert/X/0），用于回退或关闭当前消息
    pressRpgMakerButton('cancel', 'Escape', 'Escape', 27);
    simulateKey('Escape', 'Escape', 27);
    setTimeout(function() { releaseRpgMakerButton('cancel', 'Escape', 'Escape', 27); }, 120);
    updateStatus('上一句');
  }

  function returnToTitle() {
    removeOverlay();
    try {
      if (typeof SceneManager !== 'undefined' && typeof Scene_Title !== 'undefined') {
        SceneManager.goto(Scene_Title);
      }
    } catch (e) {
      console.error('[RpgWorkbenchPreviewNotifier] returnToTitle failed', e);
      updateStatus('返回标题失败');
    }
  }

  function removeOverlay() {
    const overlay = document.getElementById('rpg-workbench-preview-overlay');
    if (overlay) overlay.remove();
  }

  function isSceneMap() {
    try {
      return SceneManager._scene && SceneManager._scene.constructor === Scene_Map;
    } catch (e) { return false; }
  }

  function createButton(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'padding:6px 12px;border:1px solid rgba(255,255,255,0.35);border-radius:6px;background:rgba(124,140,255,0.22);color:#fff;cursor:pointer;font-size:13px;font-weight:600;line-height:1.4;white-space:nowrap;transition:background 0.15s ease,border-color 0.15s ease,text-shadow 0.15s ease;text-shadow:0 1px 2px rgba(0,0,0,0.7);-webkit-tap-highlight-color:transparent;user-select:none;';
    function setHover() { btn.style.background = 'rgba(124,140,255,0.55)'; btn.style.borderColor = 'rgba(255,255,255,0.75)'; btn.style.textShadow = '0 0 6px rgba(255,255,255,0.6)'; }
    function clearHover() { btn.style.background = 'rgba(124,140,255,0.22)'; btn.style.borderColor = 'rgba(255,255,255,0.35)'; btn.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)'; }
    function activate() { btn.style.background = 'rgba(124,140,255,0.85)'; setTimeout(clearHover, 120); }
    btn.addEventListener('mouseenter', setHover);
    btn.addEventListener('mouseleave', clearHover);
    let fired = false;
    function handlePress(event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      if (fired) return;
      fired = true;
      activate();
      onClick();
      setTimeout(function() { fired = false; }, 250);
    }
    if (window.PointerEvent) {
      btn.addEventListener('pointerdown', handlePress);
    } else {
      btn.addEventListener('mousedown', handlePress);
      btn.addEventListener('touchstart', handlePress, { passive: false });
    }
    return btn;
  }

  function createOverlay() {
    if (document.getElementById('rpg-workbench-preview-overlay')) return;

    // 确保 body 可接受点击事件（部分 RPG Maker MV/MZ 发行版会重置 body 样式）
    document.body.style.pointerEvents = document.body.style.pointerEvents || 'auto';
    if (document.documentElement) document.documentElement.style.pointerEvents = 'auto';

    const overlay = document.createElement('div');
    overlay.id = 'rpg-workbench-preview-overlay';
    // 使用最大 z-index，强制浮在游戏 canvas 之上；pointer-events 仅作用在浮层自身
    overlay.style.cssText = 'position:fixed;z-index:2147483647;display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(0,0,0,0.78);border:1px solid rgba(124,140,255,0.55);border-radius:10px;color:#fff;font-family:sans-serif;font-size:14px;user-select:none;pointer-events:auto;box-shadow:0 6px 20px rgba(0,0,0,0.55);backdrop-filter:blur(4px);';

    switch (position) {
      case 'top-left': overlay.style.top = '12px'; overlay.style.left = '12px'; break;
      case 'top-center': overlay.style.top = '12px'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)'; break;
      case 'top-right': overlay.style.top = '12px'; overlay.style.right = '12px'; break;
      case 'bottom-left': overlay.style.bottom = '12px'; overlay.style.left = '12px'; break;
      case 'bottom-center': overlay.style.bottom = '12px'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)'; break;
      case 'bottom-right': overlay.style.bottom = '12px'; overlay.style.right = '12px'; break;
      default: overlay.style.top = '12px'; overlay.style.left = '50%'; overlay.style.transform = 'translateX(-50%)';
    }

    const label = document.createElement('span');
    label.textContent = text;
    label.style.cssText = 'margin-right:6px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.8);';
    overlay.appendChild(label);
    overlay.appendChild(createButton(labelPrev, previousSentence));
    overlay.appendChild(createButton(labelNext, nextSentence));
    overlay.appendChild(createButton(labelTitle, returnToTitle));

    statusEl = document.createElement('span');
    statusEl.style.cssText = 'margin-left:6px;font-size:11px;color:rgba(200,208,255,0.9);font-weight:500;min-width:80px;text-align:right;opacity:0.6;transition:opacity 0.2s ease;text-shadow:0 1px 2px rgba(0,0,0,0.8);';
    statusEl.textContent = 'ready';
    overlay.appendChild(statusEl);

    // 挂到 documentElement 而非 body，避免某些 nw.js 发行版在切场景时清空 body 导致浮层丢失
    const rootEl = document.documentElement || document.body;
    rootEl.appendChild(overlay);
    console.log('[RpgWorkbenchPreviewNotifier] overlay created', position);

    // 监听 DOM 变化：若浮层被游戏或 nw.js 意外移除，则重新创建（最多重试 10 次）
    let recreateCount = 0;
    const observerRoot = document.body || document.documentElement;
    const observer = new MutationObserver(function() {
      if (!document.getElementById('rpg-workbench-preview-overlay') && recreateCount < 10) {
        recreateCount += 1;
        createOverlay();
      }
      if (recreateCount >= 10) {
        try { observer.disconnect(); } catch (e) {}
      }
    });
    try { observer.observe(observerRoot, { childList: true, subtree: true }); } catch (e) {}

    if (duration > 0) {
      setTimeout(function() {
        overlay.remove();
      }, duration * 1000);
    }
  }

  // 可靠地挂载到 Scene_Map / Scene_Base：createDisplayObjects/start/terminate 多重保险
  function patchScenes() {
    let ready = false;
    if (typeof Scene_Map !== 'undefined') {
      if (!Scene_Map.prototype.__rpgWorkbenchPatched) {
        Scene_Map.prototype.__rpgWorkbenchPatched = true;

        const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
        Scene_Map.prototype.createDisplayObjects = function() {
          _Scene_Map_createDisplayObjects.call(this);
          createOverlay();
        };

        const _Scene_Map_start = Scene_Map.prototype.start;
        Scene_Map.prototype.start = function() {
          if (_Scene_Map_start) _Scene_Map_start.call(this);
          createOverlay();
        };

        const _Scene_Map_terminate = Scene_Map.prototype.terminate;
        Scene_Map.prototype.terminate = function() {
          removeOverlay();
          if (_Scene_Map_terminate) _Scene_Map_terminate.call(this);
        };
      }
      ready = true;
    }

    if (typeof Scene_Base !== 'undefined' && Scene_Base.prototype && !Scene_Base.prototype.__rpgWorkbenchPatched) {
      Scene_Base.prototype.__rpgWorkbenchPatched = true;
      const _Scene_Base_start = Scene_Base.prototype.start;
      Scene_Base.prototype.start = function() {
        if (_Scene_Base_start) _Scene_Base_start.call(this);
        createOverlay();
      };
      ready = true;
    }

    if (!ready) {
      setTimeout(patchScenes, 100);
      return;
    }

    // 若当前已经在任意场景，立即创建
    if (typeof SceneManager !== 'undefined' && SceneManager._scene) {
      createOverlay();
    }
  }

  if (enableOverlay) {
    patchScenes();

    // 插件加载后尽早尝试创建一次（标题画面等也能看到）
    setTimeout(function() {
      if (!document.getElementById('rpg-workbench-preview-overlay')) {
        createOverlay();
      }
    }, 1500);

    // 兜底：每隔 1 秒检查一次浮层是否存在，不存在就重建，最多 60 秒
    let guardCount = 0;
    const guardInterval = setInterval(function() {
      if (guardCount >= 60) { clearInterval(guardInterval); return; }
      guardCount += 1;
      if (!document.getElementById('rpg-workbench-preview-overlay')) {
        createOverlay();
      }
    }, 1000);
  }

  // 监听命令文件：工作台侧的「退回标题」等指令通过文件下发给插件执行
  (function watchCommandFile() {
    try {
      const node = (typeof window !== 'undefined' && window.__rpgWorkbenchPreview && window.__rpgWorkbenchPreview.node) || null;
      const fs = (node && node.fs) || (typeof require === 'function' ? require('fs') : null);
      const path = (node && node.path) || (typeof require === 'function' ? require('path') : null);
      if (!fs || !path) {
        console.error('[RpgWorkbenchPreviewNotifier] fs/path not available, command watcher disabled');
        return;
      }
      const file = path.resolve(commandFile);
      let lastTimestamp = 0;
      function handle() {
        if (!fs.existsSync(file)) return;
        let raw = '';
        try { raw = fs.readFileSync(file, 'utf8'); } catch { return; }
        if (!raw.trim()) return;
        let payload;
        try { payload = JSON.parse(raw); } catch { return; }
        if (!payload || typeof payload !== 'object' || !payload.command) return;
        const timestamp = Number(payload.timestamp) || 0;
        if (timestamp && timestamp <= lastTimestamp) return;
        lastTimestamp = timestamp || Date.now();
        if (payload.command === 'return-to-title') {
          returnToTitle();
        } else if (payload.command === 'prev-entry') {
          previousSentence();
        } else if (payload.command === 'next-entry') {
          nextSentence();
        }
      }
      setInterval(handle, 150);
    } catch (e) {
      console.error('[RpgWorkbenchPreviewNotifier] watchCommandFile failed', e);
    }
  })();
})();
`;
}

/**
 * 向游戏临时注入预览提示插件，并注册到 plugins.js。
 */
async function injectPreviewNotifier(rootDir, jsRoot, options = {}) {
  if (!jsRoot || !fs.existsSync(jsRoot)) return { ok: false, message: '找不到 js 目录' };
  const pluginsJsPath = path.join(jsRoot, 'plugins.js');
  const pluginFilePath = path.join(jsRoot, 'plugins', `${PREVIEW_NOTIFIER_PLUGIN_NAME}.js`);
  const relPluginsJs = path.relative(rootDir, pluginsJsPath).replace(/\\/g, '/');
  const relPluginFile = path.relative(rootDir, pluginFilePath).replace(/\\/g, '/');

  if (fs.existsSync(pluginsJsPath)) await backupFile(rootDir, relPluginsJs);
  if (fs.existsSync(pluginFilePath)) await backupFile(rootDir, relPluginFile);

  ensureDir(path.dirname(pluginFilePath));
  const text = options.previewNotificationText || '文本内容预览模式';
  const position = options.previewNotificationPosition || 'top-center';
  const duration = Number(options.previewNotificationDuration) || 0;
  const labels = {
    prev: options.previewNotificationPrevLabel || '上一句',
    next: options.previewNotificationNextLabel || '下一句',
    title: options.previewNotificationTitleLabel || '返回标题',
  };
  const commandFile = path.join(rootDir, 'localization_preview_command.json');
  const enableOverlay = options.enableOverlay !== false;
  const code = buildNotifierPluginCode(text, position, duration, labels, commandFile, enableOverlay);
  await fsp.writeFile(pluginFilePath, code, 'utf8');
  log(rootDir, `写入预览提示插件：${relPluginFile}`);

  const pluginEntry = {
    name: PREVIEW_NOTIFIER_PLUGIN_NAME,
    status: true,
    description: 'RPG Workbench preview mode notifier',
    parameters: {
      Enabled: 'true',
      Text: text,
      Position: position,
      Duration: String(duration),
      CommandFile: commandFile,
      ButtonPrev: labels.prev,
      ButtonNext: labels.next,
      ButtonTitle: labels.title,
    },
  };

  if (!fs.existsSync(pluginsJsPath)) {
    await fsp.writeFile(pluginsJsPath, `var $plugins =\n${JSON.stringify([pluginEntry], null, 2)};`, 'utf8');
  } else {
    const raw = await fsp.readFile(pluginsJsPath, 'utf8');
    const match = /var\s+\$plugins\s*=\s*(\[[\s\S]*?\]);/.exec(raw);
    if (!match) throw new Error('无法解析 plugins.js');
    let plugins = JSON.parse(match[1]);
    plugins = plugins.filter((p) => p.name !== PREVIEW_NOTIFIER_PLUGIN_NAME);
    plugins.push(pluginEntry);
    await fsp.writeFile(pluginsJsPath, `var $plugins =\n${JSON.stringify(plugins, null, 2)};`, 'utf8');
  }
  log(rootDir, `注册预览提示插件到：${relPluginsJs}`);

  return { ok: true, relPluginsJs, relPluginFile };
}

/**
 * 恢复 plugins.js 并删除临时注入的预览提示插件文件。
 */
async function removePreviewNotifier(rootDir, jsRoot) {
  if (!jsRoot || !fs.existsSync(jsRoot)) return;
  const pluginsJsPath = path.join(jsRoot, 'plugins.js');
  const pluginFilePath = path.join(jsRoot, 'plugins', `${PREVIEW_NOTIFIER_PLUGIN_NAME}.js`);
  const relPluginsJs = path.relative(rootDir, pluginsJsPath).replace(/\\/g, '/');
  const relPluginFile = path.relative(rootDir, pluginFilePath).replace(/\\/g, '/');

  await restoreFile(rootDir, relPluginsJs);
  await removeBackupFile(rootDir, relPluginsJs);
  const restoredPlugin = await restoreFile(rootDir, relPluginFile);
  await removeBackupFile(rootDir, relPluginFile);
  if (!restoredPlugin && fs.existsSync(pluginFilePath)) {
    try { await fsp.unlink(pluginFilePath); } catch { /* ignore */ }
  }
  log(rootDir, '清理预览提示插件');
}

const activeCommandWatchers = new Map(); // rootDir -> { watcher, lastTimestamp }

function getCommandFilePath(rootDir) {
  return path.join(rootDir, 'localization_preview_command.json');
}

function stopCommandWatcher(rootDir) {
  const active = activeCommandWatchers.get(rootDir);
  if (!active) return;
  try { active.watcher.close(); } catch { /* ignore */ }
  activeCommandWatchers.delete(rootDir);
  log(rootDir, '停止命令文件监听');
}

function cleanupCommandFile(rootDir) {
  const commandFile = getCommandFilePath(rootDir);
  try {
    stopCommandWatcher(rootDir);
    if (fs.existsSync(commandFile)) fs.unlinkSync(commandFile);
  } catch { /* ignore */ }
}

/**
 * 监听命令文件（主要用于工作台侧「退回标题」指令的下发）。
 * 上一句/下一句/返回标题现在由游戏内插件直接处理，主进程仅做日志记录。
 */
function startCommandWatcher(rootDir, gameProcess) {
  stopCommandWatcher(rootDir);
  const commandFile = getCommandFilePath(rootDir);
  const state = { lastTimestamp: 0 };

  async function handleCommandFile() {
    if (!fs.existsSync(commandFile)) return;
    let raw = '';
    try { raw = await fsp.readFile(commandFile, 'utf8'); } catch { return; }
    if (!raw.trim()) return;
    let payload;
    try { payload = JSON.parse(raw); } catch { return; }
    if (!payload || typeof payload !== 'object' || !payload.command) return;
    const timestamp = Number(payload.timestamp) || 0;
    if (timestamp && timestamp <= state.lastTimestamp) return;
    state.lastTimestamp = timestamp || Date.now();

    log(rootDir, `收到游戏内命令：${payload.command}（已由插件直接处理）`);
  }

  // 首次启动时清理旧命令文件并确保文件存在，否则 fs.watch 可能报错
  try {
    if (fs.existsSync(commandFile)) fs.unlinkSync(commandFile);
    fs.writeFileSync(commandFile, '', 'utf8');
  } catch { /* ignore */ }

  // fs.watch 在 Windows 部分 nw.js 发行版下对 JSON 文件覆盖写入不敏感，
  // 因此以 watchFile 为主，fs.watch 为辅。
  let watcher = null;
  try {
    watcher = fs.watch(commandFile, async (eventType) => {
      if (eventType === 'change' || eventType === 'rename') {
        try { await handleCommandFile(); } catch (error) {
          log(rootDir, `处理命令文件失败：${error.message}`);
        }
      }
    });
  } catch (watchError) {
    log(rootDir, `fs.watch 启动失败，完全依赖轮询：${watchError.message}`);
  }

  // watchFile 兜底：高频率轮询，确保按钮响应及时
  fs.watchFile(commandFile, { interval: 80 }, async () => {
    try { await handleCommandFile(); } catch (error) {
      log(rootDir, `处理命令文件失败：${error.message}`);
    }
  });

  // 额外主动轮询兜底：防止某些环境下 watch 完全不触发
  const pollInterval = setInterval(async () => {
    try { await handleCommandFile(); } catch (error) {
      log(rootDir, `主动轮询命令文件失败：${error.message}`);
    }
  }, 250);

  activeCommandWatchers.set(rootDir, {
    watcher: { close: () => { try { clearInterval(pollInterval); } catch {} try { watcher?.close(); } catch {} fs.unwatchFile(commandFile); } },
    lastTimestamp: 0,
  });
  log(rootDir, `开始监听命令文件：${commandFile}`);
}

/**
 * 向游戏窗口发送单个虚拟按键（Windows 专用）。
 * keyCode 为 Win32 虚拟键码，如 0x7B(F12)、0x0D(Enter)。
 */
function sendKeyToGameWindow(rootDir, pid, keyCode) {
  if (process.platform !== 'win32') {
    log(rootDir, '向游戏窗口发送按键仅在 Windows 上可用');
    return;
  }
  const parentHwnd = getMainWindowHandle();
  if (!parentHwnd) {
    log(rootDir, '无法获取主窗口句柄，跳过发送按键');
    return;
  }
  const ps = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Win32Key {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport(\"user32.dll\", SetLastError = true, CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport(\"kernel32.dll\")] public static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);
  [DllImport(\"kernel32.dll\")] public static extern bool Process32First(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);
  [DllImport(\"kernel32.dll\")] public static extern bool Process32Next(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);
  [DllImport(\"kernel32.dll\")] public static extern bool CloseHandle(IntPtr hObject);

  public const uint TH32CS_SNAPPROCESS = 0x00000002;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct PROCESSENTRY32 {
    public uint dwSize;
    public uint cntUsage;
    public uint th32ProcessID;
    public IntPtr th32DefaultHeapID;
    public uint th32ModuleID;
    public uint cntThreads;
    public uint th32ParentProcessID;
    public int pcPriClassBase;
    public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }

  public static List<int> GetChildPids(int rootPid) {
    var result = new List<int> { rootPid };
    try {
      var snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
      if (snapshot == IntPtr.Zero) return result;
      bool changed = true;
      while (changed) {
        changed = false;
        var entry = new PROCESSENTRY32();
        entry.dwSize = (uint)Marshal.SizeOf(entry);
        if (Process32First(snapshot, ref entry)) {
          do {
            if (result.Contains((int)entry.th32ParentProcessID) && !result.Contains((int)entry.th32ProcessID)) {
              result.Add((int)entry.th32ProcessID);
              changed = true;
            }
          } while (Process32Next(snapshot, ref entry));
        }
      }
      CloseHandle(snapshot);
    } catch {}
    return result;
  }
}
"@
$targetPids = [Win32Key]::GetChildPids(${pid})
try { Write-Output (\"target pids = \" + ([string]::Join(', ', $targetPids))) } catch {}
$gameHwnd = 0
for ($i=0; $i -lt 50; $i++) {
  foreach ($p in $targetPids) {
    try {
      $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
      if ($proc -and $proc.MainWindowHandle -ne 0) { $gameHwnd = $proc.MainWindowHandle; break }
    } catch {}
  }
  if ($gameHwnd -ne 0) { break }
  Start-Sleep -Milliseconds 200
}

# PID 匹配失败时，按 Chrome 窗口类回退查找（兼容 MTool 等注入启动）
if ($gameHwnd -eq 0) {
  $parent = [IntPtr]::new([Convert]::ToInt64('${parentHwnd}', 16))
  $candidates = New-Object System.Collections.Generic.List[Object]
  $cb = [Win32Key+EnumWindowsProc] {
    param([IntPtr]$hWnd, [IntPtr]$lParam)
    if ($hWnd -eq $parent) { return $true }
    if (![Win32Key]::IsWindowVisible($hWnd)) { return $true }
    $rc = New-Object Win32Key+RECT
    [void][Win32Key]::GetWindowRect($hWnd, [ref]$rc)
    $area = ($rc.Right - $rc.Left) * ($rc.Bottom - $rc.Top)
    if ($area -le 10000) { return $true }
    $sb = New-Object System.Text.StringBuilder 256
    [void][Win32Key]::GetClassName($hWnd, $sb, 256)
    $class = $sb.ToString()
    $candidates.Add(@{ Hwnd = $hWnd; Area = $area; Class = $class })
    return $true
  }
  [void][Win32Key]::EnumWindows($cb, [IntPtr]::Zero)
  $best = $candidates | Sort-Object -Property Area -Descending | Where-Object { $_.Class -eq 'Chrome_WidgetWin_1' -or $_.Class -eq 'Chrome_WidgetWin_0' } | Select-Object -First 1
  if ($best) {
    $gameHwnd = $best.Hwnd
    Write-Output \"fallback hwnd=$gameHwnd class=$($best.Class) area=$($best.Area)\"
  }
}

if ($gameHwnd -ne 0) {
  [void][Win32Key]::SetForegroundWindow($gameHwnd)
  Start-Sleep -Milliseconds 100
  [void][Win32Key]::PostMessage($gameHwnd, 0x100, [IntPtr]::new(${keyCode}), [IntPtr]::new(0))
  Start-Sleep -Milliseconds 80
  [void][Win32Key]::PostMessage($gameHwnd, 0x101, [IntPtr]::new(${keyCode}), [IntPtr]::new(0))
  Write-Output \"sent key ${keyCode} to hwnd $gameHwnd\"
} else {
  Write-Output \"game window not found (candidates=$($candidates.Count))\"
}
`;
  // 脚本较长，写入临时 .ps1 文件再执行，避免命令行长度过长（spawn ENAMETOOLONG）
  const tmpFile = path.join(os.tmpdir(), `rpg-preview-key-${pid}-${Date.now()}.ps1`);
  let child = null;
  try {
    fs.writeFileSync(tmpFile, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(ps, 'utf8')]));
    child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], { windowsHide: true });
  } catch (error) {
    log(rootDir, `发送按键脚本失败：${error.message}`);
    try { fs.unlinkSync(tmpFile); } catch {}
    return;
  }
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });
  child.on('error', (error) => {
    log(rootDir, `发送按键失败：${error.message}`);
  });
  child.on('close', (code) => {
    try { fs.unlinkSync(tmpFile); } catch {}
    if (stderr.trim()) log(rootDir, `发送按键 stderr：${stderr.trim()}`);
    if (code !== 0) log(rootDir, `发送按键退出码 ${code}`);
    log(rootDir, `发送按键 ${keyCode}：${stdout.trim() || (stderr.trim() || '无输出')}`);
  });
}

/**
 * 将正在运行的预览游戏退回标题画面。
 * 通过写入命令文件让游戏内插件执行 SceneManager.goto(Scene_Title)，
 * 比直接向窗口发送 F12 更可靠，且不受窗口句柄/焦点影响。
 */
function returnToTitle(rootDir, _gamePid) {
  if (!rootDir) throw new Error('缺少项目目录');
  log(rootDir, '写入退回标题命令');
  writePreviewCommand(rootDir, 'return-to-title');
}

/**
 * 向命令文件写入通用预览控制指令。
 * 游戏内提示插件会轮询该文件并执行对应动作。
 * @param {string} rootDir
 * @param {string} command
 */
function writePreviewCommand(rootDir, command) {
  if (!rootDir) throw new Error('缺少项目目录');
  const commandFile = getCommandFilePath(rootDir);
  const payload = JSON.stringify({ command, timestamp: Date.now() });
  try {
    if (fs.existsSync(commandFile)) fs.unlinkSync(commandFile);
    fs.writeFileSync(commandFile, payload, 'utf8');
  } catch (error) {
    throw new Error(`写入预览命令失败：${error.message}`);
  }
}

function prevPreviewEntry(rootDir) {
  log(rootDir, '写入上一句命令');
  writePreviewCommand(rootDir, 'prev-entry');
}

function nextPreviewEntry(rootDir) {
  log(rootDir, '写入下一句命令');
  writePreviewCommand(rootDir, 'next-entry');
}

/**
 * 在已有预览游戏运行的前提下，更新补丁并重开到新点位。
 * 流程：写回新 patches / System.json → 命令文件通知插件退回标题 → Enter 开始新游戏。
 */
async function repreviewInGame(rootDir, entry, targetText, options = {}) {
  if (!rootDir || !fs.existsSync(rootDir)) throw new Error('项目目录不存在');
  if (!entry?.file || !entry?.path) throw new Error('条目缺少 file 或 path');
  const gamePid = options.gamePid;
  const isEmbedded = options.previewWindowMode === 'embedded';
  if (!isEmbedded && !gamePid) throw new Error('缺少游戏进程 PID，无法无缝重开');

  const mapId = extractMapId(entry.file);
  if (!mapId && !isCommonEventPath(entry.path)) {
    throw new Error('当前条目不在 Map*.json 或 CommonEvents.json 中，暂不支持预览');
  }

  const entries = Array.isArray(options.entries) ? options.entries : [];
  const current = { ...entry, target: targetText, targetDraft: targetText };
  const patches = analyzeDependencies(current, entries);
  const patchMap = new Map();
  patches.forEach((patch) => patchMap.set(`${patch.file}::${patch.path}`, patch));
  const uniquePatches = Array.from(patchMap.values());
  const affectedFiles = new Set(uniquePatches.map((p) => p.file));
  const systemRelPath = findSystemJsonRelPath(rootDir, { entryFile: entry.file, dataRoots: options.dataRoots });

  try {
    // 1. 重新写入预览补丁（仅在首次预览时备份；重开时保留原始备份）
    for (const relPath of affectedFiles) {
      const existingBackup = path.join(getBackupDir(rootDir), relPath.replace(/\//g, path.sep));
      if (!fs.existsSync(existingBackup)) await backupFile(rootDir, relPath);
    }
    await writePreviewPatches(rootDir, uniquePatches);

    // 2. 重新魔改出生点
    const existingSystemBackup = path.join(getBackupDir(rootDir), systemRelPath.replace(/\//g, path.sep));
    if (!fs.existsSync(existingSystemBackup)) await backupFile(rootDir, systemRelPath);
    let x = 0;
    let y = 0;
    if (mapId) {
      const eventId = extractEventId(entry.path);
      if (eventId != null) {
        const pos = await getEventPosition(rootDir, entry.file, eventId);
        if (pos) { x = pos.x; y = pos.y; }
      }
      await setStartPosition(rootDir, systemRelPath, mapId, x, y);
    }

    // 3. 分支：嵌入模式只需让渲染器重载 webview；弹出模式退回标题并发送 Enter 重开
    if (isEmbedded) {
      log(rootDir, '更新 webview 嵌入式预览补丁');
      return {
        ok: true,
        mode: 'webview',
        mapId,
        x,
        y,
        patchedFiles: Array.from(affectedFiles),
        patchCount: uniquePatches.length,
        message: '已更新预览点位，webview 将重新加载',
      };
    }

    // 3. 弹出模式：退回标题并重开（测试模式 F12 会重载数据）
    returnToTitle(rootDir, gamePid);
    setTimeout(() => {
      sendKeyToGameWindow(rootDir, gamePid, 0x0D); // VK_RETURN
    }, 1600);

    return {
      ok: true,
      pid: gamePid,
      mapId,
      x,
      y,
      patchedFiles: Array.from(affectedFiles),
      patchCount: uniquePatches.length,
      mode: 'popup',
      message: '已更新预览点位并退回标题重开',
    };
  } catch (error) {
    // 出错时立即尝试恢复
    try {
      for (const relPath of [...affectedFiles, systemRelPath]) {
        await restoreFile(rootDir, relPath);
        await removeBackupFile(rootDir, relPath);
      }
      await cleanupOnStartup(rootDir);
    } catch { /* ignore */ }
    throw error;
  }
}

/**
 * 启动游戏测试进程。
 */
function launchGame(rootDir, gameExePath, gameArgs = ['--test']) {
  const exe = gameExePath || findGameExecutable(rootDir);
  if (!exe) throw new Error('找不到 Game.exe');
  if (!fs.existsSync(exe)) throw new Error(`游戏可执行文件不存在：${exe}`);
  log(rootDir, `启动游戏：${exe} ${gameArgs.join(' ')}`);
  return spawn(exe, gameArgs, {
    cwd: rootDir,
    detached: false,
    windowsHide: false,
  });
}

/**
 * 将游戏窗口嵌入 Electron 主窗口的指定区域（仅 Windows）。
 * 使用 PowerShell 调用 Win32 SetParent / MoveWindow，无需额外 native 依赖。
 *
 * embedRect 约定：以 Electron 主窗口内容区左上角为原点、物理像素为单位的矩形。
 */
function embedGameWindow(rootDir, pid, embedRect) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      log(rootDir, '嵌入模式仅在 Windows 上可用');
      resolve({ ok: false, mode: 'failed', message: '嵌入模式仅在 Windows 上可用' });
      return;
    }
    const mainWindow = getMainWindow();
    const parentHwnd = getMainWindowHandle();
    if (!mainWindow || !parentHwnd) {
      log(rootDir, '无法获取主窗口句柄，放弃嵌入');
      resolve({ ok: false, mode: 'failed', message: '无法获取主窗口句柄' });
      return;
    }
    if (!embedRect || typeof embedRect.x !== 'number') {
      log(rootDir, '缺少嵌入区域坐标，放弃嵌入');
      resolve({ ok: false, mode: 'failed', message: '缺少嵌入区域坐标' });
      return;
    }

    const { x, y, width, height } = embedRect;
    const contentBounds = mainWindow.getContentBounds();
    // 按显示器缩放比例计算，确保覆盖模式使用正确的屏幕物理坐标
    let scaleFactor = 1;
    try {
      const { screen } = require('electron');
      scaleFactor = screen.getDisplayMatching(contentBounds).scaleFactor || 1;
    } catch {
      scaleFactor = 1;
    }
    const overlayX = Math.round(contentBounds.x * scaleFactor + x);
    const overlayY = Math.round(contentBounds.y * scaleFactor + y);
    const overlayW = width;
    const overlayH = height;

    const ps = `
try {
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'

Add-Type -TypeDefinition @\"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32Embed {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport(\"user32.dll\", SetLastError = true)] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport(\"user32.dll\", SetLastError = true, CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport(\"user32.dll\", SetLastError = true, CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  [DllImport(\"user32.dll\")] public static extern IntPtr GetParent(IntPtr hWnd);
  [DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
  [DllImport(\"user32.dll\", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport(\"kernel32.dll\")] public static extern uint GetLastError();

  public const int GWL_STYLE = -16;
  public const int GWL_EXSTYLE = -20;
  public const int WS_CHILD = 0x40000000;
  public const int WS_POPUP = unchecked((int)0x80000000);
  public const int WS_CAPTION = 0x00C00000;
  public const int WS_THICKFRAME = 0x00040000;
  public const int WS_BORDER = 0x00800000;
  public const int WS_DLGFRAME = 0x00400000;
  public const int WS_MINIMIZEBOX = 0x00020000;
  public const int WS_MAXIMIZEBOX = 0x00010000;
  public const int WS_SYSMENU = 0x00080000;
  public const uint WS_EX_DLGMODALFRAME = 0x00000001;
  public const uint WS_EX_WINDOWEDGE = 0x00000100;
  public const uint WS_EX_CLIENTEDGE = 0x00000200;
  public const uint WS_EX_STATICEDGE = 0x00020000;
  public const uint WS_EX_TOOLWINDOW = 0x00000080;
  public const uint WS_EX_APPWINDOW = 0x00040000;
  public const uint SWP_FRAMECHANGED = 0x0020;
  public const uint SWP_NOMOVE = 0x0002;
  public const uint SWP_NOSIZE = 0x0001;
  public const uint SWP_NOZORDER = 0x0004;
  public const uint SWP_NOACTIVATE = 0x0010;
  public const uint SWP_SHOWWINDOW = 0x0040;
  public const uint SWP_HIDEWINDOW = 0x0080;
  public static readonly IntPtr HWND_TOP = IntPtr.Zero;
  public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

  [DllImport("kernel32.dll")] public static extern IntPtr CreateToolhelp32Snapshot(uint dwFlags, uint th32ProcessID);
  [DllImport("kernel32.dll")] public static extern bool Process32First(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);
  [DllImport("kernel32.dll")] public static extern bool Process32Next(IntPtr hSnapshot, ref PROCESSENTRY32 lppe);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr hObject);

  public const uint TH32CS_SNAPPROCESS = 0x00000002;

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public struct PROCESSENTRY32 {
    public uint dwSize;
    public uint cntUsage;
    public uint th32ProcessID;
    public IntPtr th32DefaultHeapID;
    public uint th32ModuleID;
    public uint cntThreads;
    public uint th32ParentProcessID;
    public int pcPriClassBase;
    public uint dwFlags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }

  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
\"@

$targetPid = ${pid}
$parent = [IntPtr]::new([Convert]::ToInt64('${parentHwnd}', 16))
$embedX = ${x}
$embedY = ${y}
$embedW = ${width}
$embedH = ${height}
$overlayX = ${overlayX}
$overlayY = ${overlayY}

function Emit($obj) {
  Write-Output ($obj | ConvertTo-Json -Compress)
}

# 收集目标进程及其子进程的 PID（nw.js/Chrome 有时窗口属于子进程）
function GetChildPids($rootPid) {
  $result = New-Object System.Collections.Generic.List[System.Int32]
  $result.Add($rootPid)
  try {
    $snapshot = [Win32Embed]::CreateToolhelp32Snapshot([Win32Embed]::TH32CS_SNAPPROCESS, 0)
    if ($snapshot -eq [IntPtr]::Zero) { return $result }
    $changed = $true
    while ($changed) {
      $changed = $false
      $entry = New-Object Win32Embed+PROCESSENTRY32
      $entry.dwSize = [System.Runtime.InteropServices.Marshal]::SizeOf($entry)
      if ([Win32Embed]::Process32First($snapshot, [ref]$entry)) {
        do {
          if ($result.Contains($entry.th32ParentProcessID) -and !$result.Contains($entry.th32ProcessID)) {
            $result.Add($entry.th32ProcessID)
            $changed = $true
          }
        } while ([Win32Embed]::Process32Next($snapshot, [ref]$entry))
      }
    }
    [Win32Embed]::CloseHandle($snapshot)
  } catch {}
  return $result
}
$targetPids = GetChildPids ${pid}

try { Write-Output (\"target pids = \" + ([string]::Join(', ', $targetPids))) } catch {}

Write-Output \"find pid=$targetPid parent=${parentHwnd} embed=$embedX,$embedY ${width}x${height} overlay=$overlayX,$overlayY\"

$global:EmbedHwnd = [IntPtr]::Zero
$global:EmbedMaxArea = 0

$candidates = New-Object System.Collections.Generic.List[Object]

$callback = [Win32Embed+EnumWindowsProc] {
  param([IntPtr]$hWnd, [IntPtr]$lParam)
  if (![Win32Embed]::IsWindow($hWnd)) { return $true }
  if ($hWnd -eq $parent) { return $true }
  if (![Win32Embed]::IsWindowVisible($hWnd)) { return $true }
  $winPid = 0
  [void][Win32Embed]::GetWindowThreadProcessId($hWnd, [ref]$winPid)
  $rc = New-Object Win32Embed+RECT
  [void][Win32Embed]::GetWindowRect($hWnd, [ref]$rc)
  $area = ($rc.Right - $rc.Left) * ($rc.Bottom - $rc.Top)
  if ($area -le 10000) { return $true }
  $classSb = New-Object System.Text.StringBuilder 256
  [void][Win32Embed]::GetClassName($hWnd, $classSb, 256)
  $class = $classSb.ToString()
  $candidates.Add(@{ Hwnd = $hWnd; Area = $area; Pid = $winPid; Class = $class })
  if ($targetPids.Contains($winPid)) {
    if ($area -gt $global:EmbedMaxArea) {
      $global:EmbedMaxArea = $area
      $global:EmbedHwnd = $hWnd
    }
  }
  return $true
}

for ($i = 0; $i -lt 500; $i++) {
  $global:EmbedHwnd = [IntPtr]::Zero
  $global:EmbedMaxArea = 0
  $candidates.Clear()
  [void][Win32Embed]::EnumWindows($callback, [IntPtr]::Zero)
  if ($global:EmbedHwnd -ne [IntPtr]::Zero) { break }
  # 如果已经发现 Chrome 窗口候选，提前结束等待
  if ($candidates.Count -gt 0) {
    $chrome = $candidates | Where-Object { $_.Class -eq 'Chrome_WidgetWin_1' -or $_.Class -eq 'Chrome_WidgetWin_0' } | Sort-Object -Property Area -Descending | Select-Object -First 1
    if ($chrome) { break }
  }
  Start-Sleep -Milliseconds 50
}

$gameHwnd = $global:EmbedHwnd

# PID 直接匹配失败时，按窗口类 / 进程名 / 面积回退查找（兼容 MTool 等注入启动方式）
if ($gameHwnd -eq [IntPtr]::Zero -and $candidates.Count -gt 0) {
  $sorted = $candidates | Sort-Object -Property Area -Descending
  Write-Output \"pid match failed, candidates=$($candidates.Count), top classes=$($sorted | Select-Object -First 5 | ForEach-Object { $_.Class } -join ',')\"
  foreach ($c in $sorted) {
    if ($c.Class -eq 'Chrome_WidgetWin_1' -or $c.Class -eq 'Chrome_WidgetWin_0') {
      $gameHwnd = $c.Hwnd
      Write-Output \"fallback by chrome class: hwnd=$gameHwnd class=$($c.Class) pid=$($c.Pid) area=$($c.Area)\"
      break
    }
  }
  if ($gameHwnd -eq [IntPtr]::Zero) {
    foreach ($c in $sorted) {
      try {
        $proc = Get-Process -Id $c.Pid -ErrorAction SilentlyContinue
        if ($proc -and ($proc.ProcessName -eq 'Game' -or $proc.ProcessName -eq 'nw' -or $proc.ProcessName -eq 'nwjs')) {
          $gameHwnd = $c.Hwnd
          Write-Output \"fallback by process name: hwnd=$gameHwnd name=$($proc.ProcessName) pid=$($c.Pid)\"
          break
        }
      } catch {}
    }
  }
  if ($gameHwnd -eq [IntPtr]::Zero) {
    $best = $sorted | Select-Object -First 1
    $gameHwnd = $best.Hwnd
    Write-Output \"fallback by largest area: hwnd=$gameHwnd class=$($best.Class) pid=$($best.Pid) area=$($best.Area)\"
  }
}

if ($gameHwnd -eq [IntPtr]::Zero -or ![Win32Embed]::IsWindow($gameHwnd)) {
  Emit @{ ok = $false; mode = 'failed'; message = \"未找到游戏窗口 (pid=$targetPid, candidates=$($candidates.Count))\" }
  return
}

$styleBefore = [Win32Embed]::GetWindowLong($gameHwnd, [Win32Embed]::GWL_STYLE)
$exStyleBefore = [Win32Embed]::GetWindowLong($gameHwnd, [Win32Embed]::GWL_EXSTYLE)
Write-Output \"found hwnd=$gameHwnd style=0x$($styleBefore.ToString('X8')) exStyle=0x$($exStyleBefore.ToString('X8'))\"

# 如果已经是 Electron 的子窗口，只需调整位置
$currentParent = [Win32Embed]::GetParent($gameHwnd)
if ($currentParent -eq $parent) {
  [void][Win32Embed]::MoveWindow($gameHwnd, $embedX, $embedY, $embedW, $embedH, $true)
  [void][Win32Embed]::SetWindowPos($gameHwnd, [Win32Embed]::HWND_TOP, $embedX, $embedY, $embedW, $embedH,
    [Win32Embed]::SWP_SHOWWINDOW -bor [Win32Embed]::SWP_FRAMECHANGED)
  $styleAfter = [Win32Embed]::GetWindowLong($gameHwnd, [Win32Embed]::GWL_STYLE)
  Emit @{ ok = $true; mode = 'embedded'; hwnd = \"$gameHwnd\"; message = \"已嵌入，仅调整位置\"; styleAfter = \"0x$($styleAfter.ToString('X8'))\" }
  return
}

# 先隐藏，减少独立窗口闪烁
[void][Win32Embed]::ShowWindow($gameHwnd, 0)

# 在 SetParent 前先把目标窗口改成 WS_CHILD 并去掉顶层/边框样式，
# 这是 SetParent 成功嵌入外部 Chrome/nw.js 窗口的关键。
$childStyle = $styleBefore -band -bnot ([Win32Embed]::WS_POPUP -bor [Win32Embed]::WS_CAPTION -bor [Win32Embed]::WS_THICKFRAME -bor [Win32Embed]::WS_BORDER -bor [Win32Embed]::WS_DLGFRAME -bor [Win32Embed]::WS_MINIMIZEBOX -bor [Win32Embed]::WS_MAXIMIZEBOX -bor [Win32Embed]::WS_SYSMENU)
$childStyle = $childStyle -bor [Win32Embed]::WS_CHILD
$childExStyle = $exStyleBefore -band -bnot ([Win32Embed]::WS_EX_DLGMODALFRAME -bor [Win32Embed]::WS_EX_WINDOWEDGE -bor [Win32Embed]::WS_EX_CLIENTEDGE -bor [Win32Embed]::WS_EX_STATICEDGE -bor [Win32Embed]::WS_EX_TOOLWINDOW -bor [Win32Embed]::WS_EX_APPWINDOW)

[void][Win32Embed]::SetWindowLong($gameHwnd, [Win32Embed]::GWL_STYLE, $childStyle)
[void][Win32Embed]::SetWindowLong($gameHwnd, [Win32Embed]::GWL_EXSTYLE, $childExStyle)
[void][Win32Embed]::SetWindowPos($gameHwnd, [Win32Embed]::HWND_TOP, 0, 0, 0, 0,
  [Win32Embed]::SWP_FRAMECHANGED -bor [Win32Embed]::SWP_NOMOVE -bor [Win32Embed]::SWP_NOSIZE -bor [Win32Embed]::SWP_NOZORDER -bor [Win32Embed]::SWP_NOACTIVATE -bor [Win32Embed]::SWP_HIDEWINDOW)

# 尝试 SetParent 嵌入
$oldParent = [Win32Embed]::SetParent($gameHwnd, $parent)
$setParentErr = [Win32Embed]::GetLastError()
$actualParent = [Win32Embed]::GetParent($gameHwnd)
$embedded = ($actualParent -eq $parent)

if ($embedded) {
  try {
    [void][Win32Embed]::MoveWindow($gameHwnd, $embedX, $embedY, $embedW, $embedH, $true)
    [void][Win32Embed]::SetWindowPos($gameHwnd, [Win32Embed]::HWND_TOP, $embedX, $embedY, $embedW, $embedH,
      [Win32Embed]::SWP_SHOWWINDOW -bor [Win32Embed]::SWP_FRAMECHANGED)
    [void][Win32Embed]::ShowWindow($gameHwnd, 1)
    [void][Win32Embed]::SetForegroundWindow($parent)
    $styleAfter = [Win32Embed]::GetWindowLong($gameHwnd, [Win32Embed]::GWL_STYLE)
    Emit @{ ok = $true; mode = 'embedded'; hwnd = \"$gameHwnd\"; message = \"已嵌入主窗口\"; styleAfter = \"0x$($styleAfter.ToString('X8'))\" }
    return
  } catch {
    Write-Output \"embedded-move-failed: $($_.Exception.Message)\"
    # 失败后解除父子关系，准备回退到覆盖模式
    [void][Win32Embed]::SetParent($gameHwnd, [IntPtr]::Zero)
  }
}

# 嵌入失败：恢复原始样式并回退到顶层覆盖模式
Write-Output \"SetParent failed, oldParent=$oldParent actualParent=$actualParent err=$setParentErr -> fallback overlay\"
[void][Win32Embed]::SetParent($gameHwnd, [IntPtr]::Zero)
[void][Win32Embed]::SetWindowLong($gameHwnd, [Win32Embed]::GWL_STYLE, $styleBefore)
[void][Win32Embed]::SetWindowLong($gameHwnd, [Win32Embed]::GWL_EXSTYLE, $exStyleBefore)

try {
  $popupStyle = ($styleBefore -band -bnot ([Win32Embed]::WS_CHILD -bor [Win32Embed]::WS_CAPTION -bor [Win32Embed]::WS_THICKFRAME -bor [Win32Embed]::WS_BORDER -bor [Win32Embed]::WS_DLGFRAME -bor [Win32Embed]::WS_MINIMIZEBOX -bor [Win32Embed]::WS_MAXIMIZEBOX -bor [Win32Embed]::WS_SYSMENU)) -bor [Win32Embed]::WS_POPUP
  $popupExStyle = $exStyleBefore -band -bnot ([Win32Embed]::WS_EX_DLGMODALFRAME -bor [Win32Embed]::WS_EX_WINDOWEDGE -bor [Win32Embed]::WS_EX_CLIENTEDGE -bor [Win32Embed]::WS_EX_STATICEDGE -bor [Win32Embed]::WS_EX_TOOLWINDOW -bor [Win32Embed]::WS_EX_APPWINDOW)
  [void][Win32Embed]::SetWindowLong($gameHwnd, [Win32Embed]::GWL_STYLE, $popupStyle)
  [void][Win32Embed]::SetWindowLong($gameHwnd, [Win32Embed]::GWL_EXSTYLE, $popupExStyle)
  [void][Win32Embed]::SetWindowPos($gameHwnd, [Win32Embed]::HWND_TOPMOST, $overlayX, $overlayY, $overlayW, $overlayH,
    [Win32Embed]::SWP_FRAMECHANGED -bor [Win32Embed]::SWP_SHOWWINDOW)
  [void][Win32Embed]::ShowWindow($gameHwnd, 1)
  [void][Win32Embed]::SetForegroundWindow($gameHwnd)
  Emit @{ ok = $true; mode = 'overlay'; hwnd = \"$gameHwnd\"; message = \"SetParent 失败（错误码 $setParentErr），已使用顶层覆盖模式\"; err = $setParentErr }
} catch {
  Emit @{ ok = $false; mode = 'failed'; message = \"$($_.Exception.Message)\" }
}
} catch {
  Emit @{ ok = $false; mode = 'failed'; message = \"$($_.Exception.Message)\"; stack = \"$($_.ScriptStackTrace)\" }
}
`;
    // 脚本较长，写入临时 .ps1 文件再执行，避免命令行长度过长（spawn ENAMETOOLONG）
    const tmpFile = path.join(os.tmpdir(), `rpg-preview-embed-${pid}-${Date.now()}.ps1`);
    let child = null;
    try {
      fs.writeFileSync(tmpFile, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(ps, 'utf8')]));
      child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile], { windowsHide: true });
    } catch (error) {
      log(rootDir, `嵌入脚本写入/启动失败：${error.message}`);
      try { fs.unlinkSync(tmpFile); } catch {}
      resolve({ ok: false, mode: 'failed', message: error.message });
      return;
    }
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const psTimeout = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch { /* ignore */ }
    }, 30000);
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => {
      clearTimeout(psTimeout);
      try { fs.unlinkSync(tmpFile); } catch {}
      log(rootDir, `嵌入脚本启动失败：${error.message}`);
      resolve({ ok: false, mode: 'failed', message: error.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(psTimeout);
      try { fs.unlinkSync(tmpFile); } catch {}
      if (timedOut || signal) {
        resolve({ ok: false, mode: 'failed', message: '嵌入脚本执行超时' });
        return;
      }
      const lines = stdout.split(/\r?\n/).filter((l) => l.trim());
      let result = null;
      for (const line of lines) {
        if (line.startsWith('{')) {
          try { result = JSON.parse(line); } catch { /* ignore */ }
          if (result) break;
        }
      }
      if (!result) {
        result = { ok: false, mode: 'failed', message: stderr.trim() || `嵌入脚本退出码 ${code}` };
      }
      if (stderr) {
        log(rootDir, `嵌入脚本 stderr：${stderr.trim()}`);
      }
      log(rootDir, `嵌入结果：${result.mode || 'unknown'} - ${result.message || ''}`);
      resolve(result);
    });
  });
}

/**
 * 带超时保护的窗口嵌入调用。
 */
function embedGameWindowWithTimeout(rootDir, pid, embedRect, timeoutMs = 30000) {
  return Promise.race([
    embedGameWindow(rootDir, pid, embedRect),
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, mode: 'failed', message: '嵌入操作超时' }), timeoutMs)),
  ]);
}

/**
 * 执行完整预览流程。
 * @param {string} rootDir
 * @param {Object} entry
 * @param {string} targetText
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function previewInGame(rootDir, entry, targetText, options = {}) {
  if (!rootDir || !fs.existsSync(rootDir)) throw new Error('项目目录不存在');
  if (!entry?.file || !entry?.path) throw new Error('条目缺少 file 或 path');

  if (isPreviewLocked(rootDir)) {
    throw new Error('已有预览进行中，请等待当前预览结束或手动恢复备份');
  }

  const mapId = extractMapId(entry.file);
  if (!mapId && !isCommonEventPath(entry.path)) {
    throw new Error('当前条目不在 Map*.json 或 CommonEvents.json 中，暂不支持预览');
  }

  const entries = Array.isArray(options.entries) ? options.entries : [];
  const current = { ...entry, target: targetText, targetDraft: targetText };
  const patches = analyzeDependencies(current, entries);

  // 去重：同一 file+path 只保留最后一个（targetText 以当前编辑为准）
  const patchMap = new Map();
  patches.forEach((patch) => patchMap.set(`${patch.file}::${patch.path}`, patch));
  const uniquePatches = Array.from(patchMap.values());

  const affectedFiles = new Set(uniquePatches.map((p) => p.file));
  const systemRelPath = findSystemJsonRelPath(rootDir, { entryFile: entry.file, dataRoots: options.dataRoots });
  const backupFiles = [...new Set([systemRelPath, ...Array.from(affectedFiles)])];
  let gameProcess = null;
  let startPositionChanged = false;
  let jsRoot = null;

  try {
    await acquireLock(rootDir);

    // 1. 先恢复任何残留备份，保证干净状态
    await cleanupOnStartup(rootDir);

    // 2. 若开启提示（或为嵌入模式以保证命令通道可用），注入 RPG Maker 预览提示插件
    const isEmbedded = options.previewWindowMode === 'embedded';
    if (options.showPreviewNotification !== false || isEmbedded) {
      jsRoot = findJsRoot(rootDir, { dataRoots: options.dataRoots, entryFile: entry.file });
      if (jsRoot) {
        await injectPreviewNotifier(rootDir, jsRoot, {
          previewNotificationText: options.previewNotificationText || '文本内容预览模式',
          previewNotificationPosition: options.previewNotificationPosition || 'top-center',
          previewNotificationDuration: options.previewNotificationDuration || 0,
          previewNotificationPrevLabel: options.previewNotificationPrevLabel || '上一句',
          previewNotificationNextLabel: options.previewNotificationNextLabel || '下一句',
          previewNotificationTitleLabel: options.previewNotificationTitleLabel || '返回标题',
          enableOverlay: !isEmbedded && options.showPreviewNotification !== false,
        });
      } else {
        log(rootDir, '未找到 js 目录，跳过预览提示插件注入');
      }
    }

    // 3. 备份并写入预览补丁
    for (const relPath of affectedFiles) {
      await backupFile(rootDir, relPath);
    }
    await writePreviewPatches(rootDir, uniquePatches);

    // 4. 备份并魔改出生点（仅 Map 预览）
    await backupFile(rootDir, systemRelPath);
    let x = 0;
    let y = 0;
    if (mapId && options.jumpToStart !== false) {
      const eventId = extractEventId(entry.path);
      if (eventId != null) {
        const pos = await getEventPosition(rootDir, entry.file, eventId);
        if (pos) { x = pos.x; y = pos.y; }
      }
      await setStartPosition(rootDir, systemRelPath, mapId, x, y);
      startPositionChanged = true;
    }

    // 5. 分支：嵌入模式通过 webview 加载，弹出模式启动独立 Game.exe
    if (options.previewWindowMode === 'embedded') {
      log(rootDir, '启动 webview 嵌入式预览');
      const gameUrl = pathToFileURL(path.join(rootDir, 'www', 'index.html')).href;
      const preloadPath = pathToFileURL(path.join(__dirname, '..', '..', 'preload', 'game-preview-preload.js')).href;
      return {
        ok: true,
        mode: 'webview',
        gameUrl,
        preloadPath,
        mapId,
        x,
        y,
        startPositionChanged,
        patchedFiles: Array.from(affectedFiles),
        patchCount: uniquePatches.length,
        message: '游戏将以 webview 形式嵌入主窗口，停止预览后将自动恢复备份',
      };
    }

    // 5. 弹出模式：启动独立游戏窗口
    const gameExePath = options.gameExePath || findGameExecutable(rootDir);
    const gameArgs = Array.isArray(options.gameArgs) ? options.gameArgs : ['--test'];
    gameProcess = launchGame(rootDir, gameExePath, gameArgs);
    if (!gameProcess.pid) {
      throw new Error('游戏进程未能启动');
    }
    const previewStartTime = Date.now();

    // 5.1 监听游戏内浮层按钮写入的命令文件
    startCommandWatcher(rootDir, gameProcess);

    // 6. 注册进程异常与退出后的恢复逻辑
    const restoreOnce = async (reason) => {
      // MTool 等注入工具：Game.exe 是启动器 wrapper，启动真正 nw.exe 后会立即退出。
      // 如果游戏进程在 10 秒内退出，暂不恢复备份/通知前端，避免误清理仍在运行的实际游戏。
      if (reason === '游戏进程退出' && Date.now() - previewStartTime < 10000) {
        log(rootDir, `${reason}（${Date.now() - previewStartTime}ms），疑似启动器 wrapper，暂不恢复备份，等待手动停止预览`);
        return;
      }
      log(rootDir, `${reason}，开始恢复备份`);
      stopCommandWatcher(rootDir);
      try {
        // 通知渲染端游戏已退出，重置预览状态
        try {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('preview-process-exited', { rootDir, reason });
          }
        } catch (notifyError) {
          log(rootDir, `通知渲染端游戏退出失败：${notifyError.message}`);
        }

        for (const relPath of backupFiles) {
          await restoreFile(rootDir, relPath);
          await removeBackupFile(rootDir, relPath);
        }
        await removePreviewNotifier(rootDir, jsRoot);
        await removeEmptyBackupDirs(rootDir);
        await releaseLock(rootDir);
        log(rootDir, '备份已恢复');
      } catch (restoreError) {
        log(rootDir, `恢复备份失败：${restoreError.message}`);
      }
    };

    gameProcess.on('error', (error) => restoreOnce(`游戏进程异常：${error.message}`));
    gameProcess.on('exit', () => restoreOnce('游戏进程退出'));

    return {
      ok: true,
      pid: gameProcess.pid,
      mapId,
      x,
      y,
      startPositionChanged,
      patchedFiles: Array.from(affectedFiles),
      patchCount: uniquePatches.length,
      mode: 'popup',
      message: '游戏已作为独立窗口启动，退出后将自动恢复备份',
    };
  } catch (error) {
    // 出错时立即尝试恢复
    stopCommandWatcher(rootDir);
    try {
      for (const relPath of backupFiles) {
        await restoreFile(rootDir, relPath);
        await removeBackupFile(rootDir, relPath);
      }
      await removePreviewNotifier(rootDir, jsRoot);
      await cleanupOnStartup(rootDir);
      await releaseLock(rootDir);
    } catch { /* ignore */ }
    throw error;
  }
}

/**
 * 手动停止预览并恢复所有备份。
 * 失败时保留备份并记录日志，便于用户再次尝试恢复。
 */
async function stopPreview(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return { restored: false, files: [], errors: [] };
  const backupDir = getBackupDir(rootDir);
  const restored = [];
  const errors = [];
  if (fs.existsSync(backupDir)) {
    const files = await listBackupFiles(backupDir);
    for (const relPath of files) {
      try {
        await restoreFile(rootDir, relPath);
        restored.push(relPath);
        await removeBackupFile(rootDir, relPath);
      } catch (error) {
        errors.push({ file: relPath, message: error.message });
        log(rootDir, `手动恢复失败：${relPath} (${error.message})`);
      }
    }
  }
  await removeEmptyBackupDirs(rootDir);
  await releaseLock(rootDir);

  // 手动停止时也清理预览提示插件（扫描所有发现的 js 目录）
  for (const jsRoot of discoverJsRoots(rootDir)) {
    await removePreviewNotifier(rootDir, jsRoot);
  }
  cleanupCommandFile(rootDir);

  return { restored: restored.length > 0, files: restored, errors };
}

/**
 * 手动恢复所有预览备份并清理（兼容旧命名）。
 */
async function restorePreviewBackups(rootDir) {
  return stopPreview(rootDir);
}

module.exports = {
  previewInGame,
  repreviewInGame,
  returnToTitle,
  prevPreviewEntry,
  nextPreviewEntry,
  stopPreview,
  restorePreviewBackups,
  cleanupOnStartup,
  findGameExecutable,
  embedGameWindow,
};
