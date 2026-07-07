/**
 * @file src/main/services/preview/GamePreviewService.js
 * @description 游戏内快速预览服务。临时把当前编辑的文本写回游戏 JSON，
 *   基于文本依赖项分析把同一事件/上下文组的相关译文一并带入，
 *   修改出生点，启动 Game.exe --test，退出后自动恢复原文件。
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const { ensureDir } = require('../../utils/fsUtils');
const { getMainWindowHandle } = require('../../appWindow');

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
 */
async function backupFile(rootDir, relPath) {
  const src = path.join(rootDir, relPath.replace(/\//g, path.sep));
  const dest = path.join(getBackupDir(rootDir), relPath.replace(/\//g, path.sep));
  if (!fs.existsSync(src)) throw new Error(`源文件不存在：${relPath}`);
  ensureDir(path.dirname(dest));
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
 * 检查是否已有预览进行中。支持过期锁检测。
 */
function isPreviewLocked(rootDir) {
  const lock = readLock(rootDir);
  if (!lock) return false;
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
 * 启动时检查并恢复残留备份（防崩溃后遗留）。
 */
async function cleanupOnStartup(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return { restored: false, files: [] };
  const backupDir = getBackupDir(rootDir);
  if (!fs.existsSync(backupDir)) {
    await releaseLock(rootDir);
    return { restored: false, files: [] };
  }

  const restored = [];
  const files = await listBackupFiles(backupDir);
  for (const relPath of files) {
    try {
      await restoreFile(rootDir, relPath);
      restored.push(relPath);
      await removeBackupFile(rootDir, relPath);
    } catch (error) {
      log(rootDir, `恢复残留备份失败：${relPath} (${error.message})`);
    }
  }

  await removeEmptyBackupDirs(rootDir);
  await releaseLock(rootDir);

  return { restored: restored.length > 0, files: restored };
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
      writePatchToJson(json, patch.path, patch.targetText);
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
 */
function embedGameWindow(rootDir, pid, embedRect) {
  if (process.platform !== 'win32') {
    log(rootDir, '嵌入模式仅在 Windows 上可用');
    return;
  }
  const parentHwnd = getMainWindowHandle();
  if (!parentHwnd) {
    log(rootDir, '无法获取主窗口句柄，放弃嵌入');
    return;
  }
  if (!embedRect || typeof embedRect.x !== 'number') {
    log(rootDir, '缺少嵌入区域坐标，放弃嵌入');
    return;
  }
  const { x, y, width, height } = embedRect;
  const ps = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32Embed {
  [DllImport(\"user32.dll\")] public static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
  [DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
  [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport(\"user32.dll\", SetLastError=true)] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$gameHwnd = 0
for ($i=0; $i -lt 50; $i++) {
  try {
    $proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
    if ($proc -and $proc.MainWindowHandle -ne 0) { $gameHwnd = $proc.MainWindowHandle; break }
  } catch {}
  Start-Sleep -Milliseconds 200
}
if ($gameHwnd -ne 0) {
  $parent = [IntPtr]::new([Convert]::ToInt64('${parentHwnd}', 16))
  [void][Win32Embed]::SetParent($gameHwnd, $parent)
  [void][Win32Embed]::MoveWindow($gameHwnd, ${x}, ${y}, ${width}, ${height}, $true)
  [void][Win32Embed]::ShowWindow($gameHwnd, 1)
  [void][Win32Embed]::SetForegroundWindow($parent)
  Write-Host \"embedded $gameHwnd into ${parentHwnd} at ${x},${y} ${width}x${height}\"
} else {
  Write-Host \"game window not found\"
}
`;
  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, { windowsHide: true }, (error, stdout) => {
    if (error) log(rootDir, `嵌入游戏窗口失败：${error.message}`);
    else log(rootDir, `嵌入游戏窗口：${stdout.trim()}`);
  });
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

  try {
    await acquireLock(rootDir);

    // 1. 先恢复任何残留备份，保证干净状态
    await cleanupOnStartup(rootDir);

    // 2. 备份并写入预览补丁
    for (const relPath of affectedFiles) {
      await backupFile(rootDir, relPath);
    }
    await writePreviewPatches(rootDir, uniquePatches);

    // 3. 备份并魔改出生点（仅 Map 预览）
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

    // 4. 启动游戏
    const gameExePath = options.gameExePath || findGameExecutable(rootDir);
    const gameArgs = Array.isArray(options.gameArgs) ? options.gameArgs : ['--test'];
    gameProcess = launchGame(rootDir, gameExePath, gameArgs);
    if (!gameProcess.pid) {
      throw new Error('游戏进程未能启动');
    }

    // 4.1 嵌入模式：把 Game.exe 窗口挂到 Electron 主窗口指定区域
    if (options.previewWindowMode === 'embedded' && gameProcess.pid) {
      embedGameWindow(rootDir, gameProcess.pid, options.embedRect);
    }

    // 5. 注册进程异常与退出后的恢复逻辑
    const restoreOnce = async (reason) => {
      log(rootDir, `${reason}，开始恢复备份`);
      try {
        for (const relPath of backupFiles) {
          await restoreFile(rootDir, relPath);
          await removeBackupFile(rootDir, relPath);
        }
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
      message: '游戏已启动，退出后将自动恢复备份',
    };
  } catch (error) {
    // 出错时立即尝试恢复
    try {
      for (const relPath of backupFiles) {
        await restoreFile(rootDir, relPath);
        await removeBackupFile(rootDir, relPath);
      }
      await cleanupOnStartup(rootDir);
      await releaseLock(rootDir);
    } catch { /* ignore */ }
    throw error;
  }
}

/**
 * 手动停止预览并恢复所有备份。
 */
async function stopPreview(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return { restored: false, files: [] };
  const backupDir = getBackupDir(rootDir);
  const restored = [];
  if (fs.existsSync(backupDir)) {
    const files = await listBackupFiles(backupDir);
    for (const relPath of files) {
      try {
        await restoreFile(rootDir, relPath);
        restored.push(relPath);
        await removeBackupFile(rootDir, relPath);
      } catch (error) {
        log(rootDir, `手动恢复失败：${relPath} (${error.message})`);
      }
    }
  }
  await removeEmptyBackupDirs(rootDir);
  await releaseLock(rootDir);
  return { restored: restored.length > 0, files: restored };
}

/**
 * 手动恢复所有预览备份并清理（兼容旧命名）。
 */
async function restorePreviewBackups(rootDir) {
  return stopPreview(rootDir);
}

module.exports = {
  previewInGame,
  stopPreview,
  restorePreviewBackups,
  cleanupOnStartup,
  findGameExecutable,
};
