/**
 * @file src/main/services/export/RpgMakerWriteback.js
 * @description 将翻译条目写回 RPG Maker MV/MZ 的原始 JSON 结构（Map / CommonEvents /
 * System / Database），输出到 <rootDir>/localization_patch/data/ —— 绝不就地覆盖。
 *
 * 关键点：
 *  - 路径解析：events[2].pages[0].list[12].parameters[0]、1.name、terms.messages.alwaysDash
 *  - code:401 多行译文 → 同 indent 插入多条 401，保证后续命令位置不被破坏（反向遍历）
 *  - 路径越界 / 路径不存在 / 译文为空 → 计入错误报告但不中断整个 apply
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { ensureDir } = require('../../utils/fsUtils');

/**
 * 解析 RPG Maker entry.path（同 ProjectTextService 中 createEntry 的 path 约定）。
 * 例：
 *   "events[2].pages[0].list[12].parameters[0]"   → ['events',2,'pages',0,'list',12,'parameters',0]
 *   "events[2].pages[0].list[12].parameters[0][3]"→ ['events',2,'pages',0,'list',12,'parameters',0,3]
 *   "1.name"                                       → [1,'name']
 *   "terms.messages.alwaysDash"                    → ['terms','messages','alwaysDash']
 *   "commonEvents[5].list[2].parameters[1]"        → ['commonEvents',5,'list',2,'parameters',1]
 * @param {string} pathStr
 * @returns {Array<string|number>}
 */
function parsePath(pathStr) {
  if (!pathStr) return [];
  const out = [];
  for (const segment of String(pathStr).split('.')) {
    if (!segment) continue;
    const m = segment.match(/^([^[]*)((?:\[[^\]]*\])*)$/);
    if (!m) continue;
    const [, name, brackets] = m;
    if (name) out.push(/^\d+$/.test(name) ? Number(name) : name);
    if (brackets) {
      const bre = /\[([^\]]*)\]/g;
      let bm;
      while ((bm = bre.exec(brackets)) !== null) out.push(/^\d+$/.test(bm[1]) ? Number(bm[1]) : bm[1]);
    }
  }
  return out;
}

/**
 * 部分文件（如 CommonEvents.json）的 JSON 根本身是数组，但 ProjectTextService 给条目的
 * path 用了 `commonEvents[N]` 这样的虚拟前缀作为人类可读 ID。这里在文件级别按需剥掉前缀。
 * @param {Array} parts
 * @param {string} fileRel
 * @returns {Array}
 */
function stripVirtualRoot(parts, fileRel) {
  if (!parts.length) return parts;
  const base = String(fileRel || '').toLowerCase();
  if (base.endsWith('commonevents.json') && parts[0] === 'commonEvents') return parts.slice(1);
  return parts;
}

/**
 * 按 parts 在 root 上读取节点。中途 null/undefined 抛错（让上层捕获、记错误报告）。
 * @param {*} root
 * @param {Array<string|number>} parts
 * @returns {{parent: *, key: string|number, value: *}}
 */
function navigate(root, parts) {
  if (!parts.length) throw new Error('空路径');
  let parent = null;
  let key = null;
  let node = root;
  for (let i = 0; i < parts.length; i++) {
    parent = i === 0 ? null : node;
    key = parts[i];
    if (i === parts.length - 1) {
      const finalParent = i === 0 ? root : node;
      return { parent: finalParent, key, value: finalParent != null ? finalParent[key] : undefined };
    }
    if (node == null) throw new Error(`路径中断 @ ${parts.slice(0, i + 1).join('.')}`);
    node = node[key];
  }
  return { parent, key, value: node };
}

function setByPath(root, parts, value) {
  const { parent, key } = navigate(root, parts);
  if (parent == null) throw new Error('无效目标父节点');
  parent[key] = value;
}

/**
 * 对 events 内的 list 命令路径，抽取出 list 数组路径 + 命令在 list 中的 index。
 * 适用于 code:101/401/102/402（路径形如 ...list[N].parameters[...]）。
 * 若不属于该模式（system / database / generic），返回 null。
 * @param {Array<string|number>} parts
 * @returns {{listParts: Array, commandIndex: number, paramTail: Array} | null}
 */
function extractListContext(parts) {
  const listIdx = parts.indexOf('list');
  if (listIdx < 0) return null;
  if (typeof parts[listIdx + 1] !== 'number') return null;
  return {
    listParts: parts.slice(0, listIdx + 1),
    commandIndex: parts[listIdx + 1],
    paramTail: parts.slice(listIdx + 2),
  };
}

/**
 * 把一条 401 译文（可能含 \n）拆成多行并写回到 list 中：
 *  - list[i].parameters[0] = lines[0]
 *  - 在 list[i+1] 起插入 N-1 条同 indent 的 401 命令
 * 上游必须按 commandIndex DESC 调用本函数以避免 index 漂移。
 */
function expandMultilineDialogue(list, commandIndex, lines) {
  const orig = list[commandIndex];
  if (!orig || Number(orig.code) !== 401) throw new Error(`期望 code:401，实际 ${orig?.code}`);
  orig.parameters = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    list.splice(commandIndex + i, 0, { code: 401, indent: orig.indent ?? 0, parameters: [lines[i]] });
  }
}

/**
 * 单条 entry → 待写回任务。返回 null 表示跳过（空译文 / 等同原文）。
 */
function buildTask(entry) {
  if (!entry || !entry.file) return null;
  const target = String(entry.target ?? '').trim();
  if (!target) return null;
  if (entry.source && target === String(entry.source).trim()) return null;
  const rawParts = parsePath(entry.path || entry.key || '');
  const parts = stripVirtualRoot(rawParts, entry.file);
  if (!parts.length) return null;
  const ctx = extractListContext(parts);
  const isMultilineDialogue = Number(entry.code) === 401 && /\r?\n/.test(target);
  return { entry, parts, ctx, target, isMultilineDialogue };
}

/**
 * 把一个文件内的所有写回任务按 (是否 list / 同 list / index DESC) 排好序，
 * 保证多行 401 插入不影响后续 entry。
 */
function orderTasks(tasks) {
  const listGroups = new Map();
  const nonList = [];
  for (const task of tasks) {
    if (!task.ctx) { nonList.push(task); continue; }
    const k = task.ctx.listParts.join('.');
    if (!listGroups.has(k)) listGroups.set(k, []);
    listGroups.get(k).push(task);
  }
  // 同一 list 内：按 commandIndex DESC 排序（同 index 时多行 401 排在普通后面，先做插入）
  for (const arr of listGroups.values()) {
    arr.sort((a, b) => {
      if (b.ctx.commandIndex !== a.ctx.commandIndex) return b.ctx.commandIndex - a.ctx.commandIndex;
      return (b.isMultilineDialogue ? 1 : 0) - (a.isMultilineDialogue ? 1 : 0);
    });
  }
  return { listGroups, nonList };
}

/**
 * 应用一个文件的全部写回任务。
 */
function applyFileTasks(json, tasks, errors, fileRel) {
  const { listGroups, nonList } = orderTasks(tasks);
  // 非 list 类（system / database / generic）：顺序无关，直接写
  for (const task of nonList) {
    try { setByPath(json, task.parts, task.target); }
    catch (err) { errors.push({ file: fileRel, key: task.entry.key, reason: err.message }); }
  }
  // list 类：按组 DESC 顺序
  for (const [listKey, tasksInList] of listGroups.entries()) {
    let list = null;
    try { list = navigate(json, parsePath(listKey)).value; }
    catch (err) { tasksInList.forEach((t) => errors.push({ file: fileRel, key: t.entry.key, reason: `定位 list 失败：${err.message}` })); continue; }
    if (!Array.isArray(list)) { tasksInList.forEach((t) => errors.push({ file: fileRel, key: t.entry.key, reason: 'list 不是数组' })); continue; }
    for (const task of tasksInList) {
      try {
        if (task.isMultilineDialogue) {
          const lines = task.target.split(/\r?\n/);
          expandMultilineDialogue(list, task.ctx.commandIndex, lines);
        } else {
          // 在 list[commandIndex] 之上继续走 paramTail，得到完整路径
          setByPath(json, task.parts, task.target);
        }
      } catch (err) {
        errors.push({ file: fileRel, key: task.entry.key, reason: err.message });
      }
    }
  }
}

/**
 * 主入口：把全部翻译条目写回原始 JSON、输出到 patch 目录。
 * @param {{project: Object, entries: Object[], outDir?: string}} payload
 * @returns {Promise<{ok:boolean, outputDir:string, files: string[], errors: Object[], skipped: number}>}
 */
async function applyToFiles(payload) {
  const { project, entries } = payload || {};
  if (!project?.rootDir) throw new Error('缺少项目根目录');
  const rootDir = path.resolve(project.rootDir);
  const baseOutDir = path.resolve(payload?.outDir || path.join(rootDir, 'localization_patch'));
  if (!baseOutDir.startsWith(rootDir)) throw new Error('输出目录越界，必须位于项目根目录之下');
  const dataOutDir = path.join(baseOutDir, 'data');
  ensureDir(dataOutDir);

  // 按 file 分组
  const byFile = new Map();
  let skipped = 0;
  for (const entry of (entries || [])) {
    const task = buildTask(entry);
    if (!task) { skipped++; continue; }
    if (!byFile.has(task.entry.file)) byFile.set(task.entry.file, []);
    byFile.get(task.entry.file).push(task);
  }

  const errors = [];
  const outFiles = [];

  for (const [fileRel, tasks] of byFile.entries()) {
    const srcPath = path.resolve(rootDir, fileRel);
    if (!srcPath.startsWith(rootDir)) { errors.push({ file: fileRel, reason: '源文件路径越界' }); continue; }
    if (!fs.existsSync(srcPath)) { errors.push({ file: fileRel, reason: '源文件不存在' }); continue; }
    let original;
    try { original = JSON.parse(await fsp.readFile(srcPath, 'utf8')); }
    catch (err) { errors.push({ file: fileRel, reason: `解析失败：${err.message}` }); continue; }

    const clone = JSON.parse(JSON.stringify(original));
    applyFileTasks(clone, tasks, errors, fileRel);

    const outPath = path.join(dataOutDir, path.basename(fileRel));
    if (!path.resolve(outPath).startsWith(baseOutDir)) { errors.push({ file: fileRel, reason: '输出路径越界' }); continue; }
    await fsp.writeFile(outPath, JSON.stringify(clone, null, 0), 'utf8');
    outFiles.push(outPath);
  }

  return { ok: true, outputDir: baseOutDir, files: outFiles, errors, skipped };
}

module.exports = { applyToFiles, parsePath, setByPath, expandMultilineDialogue, extractListContext };
