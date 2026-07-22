/**
 * @file src/main/services/project/TimelineBuilder.js
 * @description 剧情流线模式的时间线构建器。
 *
 * 由于无法真正执行游戏，这里使用一组可解释的启发式规则，把同一 Map 内的事件/页面/命令
 * 重排成更接近玩家实际体验的剧情流顺序。核心原则：
 *   - 自动执行/并行事件往往推动主线，排在行动键 NPC 之前
 *   - 无条件的默认页面排在带开关/变量条件的页面之前
 *   - 同一页面内保持原有命令执行顺序
 *   - 对话类文本优先于说明性/数据库类文本
 *
 * 注意：本模块只决定编辑器里的展示顺序，不会修改原始 JSON 的物理结构。
 */

const path = require('path');

// RPG Maker MV/MZ 触发类型
const TRIGGER_TYPE = {
  ACTION_BUTTON: 0,
  PLAYER_TOUCH: 1,
  EVENT_TOUCH: 2,
  AUTORUN: 3,
  PARALLEL: 4,
};

// 触发类型优先级：数值越大越倾向于出现在剧情流前面
const TRIGGER_PRIORITY = {
  [TRIGGER_TYPE.AUTORUN]: 1000,
  [TRIGGER_TYPE.PARALLEL]: 800,
  [TRIGGER_TYPE.ACTION_BUTTON]: 600,
  [TRIGGER_TYPE.PLAYER_TOUCH]: 400,
  [TRIGGER_TYPE.EVENT_TOUCH]: 200,
};

const TRIGGER_NAMES = {
  [TRIGGER_TYPE.ACTION_BUTTON]: '行动键',
  [TRIGGER_TYPE.PLAYER_TOUCH]: '玩家接触',
  [TRIGGER_TYPE.EVENT_TOUCH]: '事件接触',
  [TRIGGER_TYPE.AUTORUN]: '自动执行',
  [TRIGGER_TYPE.PARALLEL]: '并行处理',
};

// 会被纳入剧情时间线的命令码
const STORY_COMMAND_CODES = new Set([101, 401, 102, 402, 405]);

// 文本展示优先级：数值越小越靠前
const TEXT_PRIORITY_TIERS = {
  'story-dialogue': 0,
  'choice': 0,
  'choice-branch': 0,
  'scrolling-text': 1,
  'speaker': 2,
  'actor-name': 2,
  'name': 3,
  'nickname': 3,
  'profile': 3,
  'description': 3,
  'battle-message': 3,
  'item-description': 3,
  'event-message': 3,
  'system-message': 4,
  'system-command': 4,
  'title': 5,
  'currency': 5,
  'system-title': 5,
  'currency-unit': 5,
  'plugin-text': 6,
  'comment': 6,
  'generic-text': 7,
};

/**
 * 计算一个 event page 的剧情流分数。分数越高，越应该排在前面。
 * @param {Object} event
 * @param {Object} page
 * @param {number} pageIndex
 * @returns {number}
 */
function scoreEventPage(event, page, pageIndex) {
  if (!page || typeof page !== 'object') return -Infinity;

  const triggerScore = TRIGGER_PRIORITY[page.triggerType] ?? 500;

  const conditions = page.conditions || {};
  const hasConditions = Boolean(
    conditions.switch1Valid
    || conditions.switch2Valid
    || conditions.variableValid
    || conditions.selfSwitchValid
    || conditions.itemValid
    || conditions.actorValid
  );
  const conditionPenalty = hasConditions ? -300 : 0;

  // 坐标：从上到下、从左到右。仅在相同触发类型下作为次要排序依据
  const coordScore = -((event?.y ?? 0) * 10 + (event?.x ?? 0));

  // 页码惩罚：默认页（0）优先，高 index 页往往是后续剧情状态
  const pagePenalty = pageIndex * 100;

  const list = Array.isArray(page.list) ? page.list : [];
  const hasDialogue = list.some((cmd) => cmd && cmd.code === 401);
  const hasChoices = list.some((cmd) => cmd && cmd.code === 102);
  const contentBonus = hasDialogue ? 50 : hasChoices ? 25 : 0;

  return triggerScore + conditionPenalty + coordScore - pagePenalty + contentBonus;
}

/**
 * 按剧情流启发式对地图内所有事件排序。
 * @param {Array} events Map.json 中的 events 数组
 * @returns {Array<{event:Object,eventIndex:number,score:number}>}
 */
function sortEventsByStoryFlow(events) {
  const scored = [];
  events.forEach((event, eventIndex) => {
    if (!event || !Array.isArray(event.pages) || !event.pages.length) return;
    const bestScore = Math.max(...event.pages.map((page, pageIndex) => scoreEventPage(event, page, pageIndex)));
    scored.push({ event, eventIndex, score: bestScore });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 构建触发说明标签。
 */
function buildTriggerLabel(event, eventIndex, page, pageIndex) {
  const eventName = event?.name ? ` · ${event.name}` : '';
  const triggerName = TRIGGER_NAMES[page.triggerType] || `触发${page.triggerType}`;
  const conditions = page.conditions || {};
  const condHints = [];
  if (conditions.switch1Valid) condHints.push(`SW${conditions.switch1Id}`);
  if (conditions.switch2Valid) condHints.push(`SW${conditions.switch2Id}`);
  if (conditions.variableValid) condHints.push(`VAR${conditions.variableId}>=${conditions.variableValue}`);
  if (conditions.selfSwitchValid) condHints.push(`SS${conditions.selfSwitchCh}`);
  if (conditions.itemValid) condHints.push(`ITEM${conditions.itemId}`);
  if (conditions.actorValid) condHints.push(`ACTOR${conditions.actorId}`);
  const condStr = condHints.length ? ` [${condHints.join(',')}]` : '';
  return `事件 ${eventIndex}${eventName} (页${pageIndex} · ${triggerName}${condStr})`;
}

/**
 * 根据 command path 在 entries 索引中查找对应条目。
 * 兼容 entry.path / entry.key / entry.id 三种键。
 */
function findEntryByCommandPath(indexByPath, commandPath) {
  const direct = indexByPath.get(commandPath);
  if (direct) return direct;
  for (const entry of indexByPath.values()) {
    if (entry.key === commandPath) return entry;
  }
  return null;
}

/**
 * 给 entry 附加剧情流上下文。
 */
function attachTimelineContext(entry, context) {
  if (!entry) return;
  entry.timelineContext = {
    ...(entry.timelineContext || {}),
    ...context,
  };
  entry.context = {
    ...(entry.context || {}),
    sceneHint: context.scene,
    speaker: context.speaker,
    eventName: context.trigger,
    ...context,
  };
}

/**
 * 清空时间线上下文。
 */
function clearTimelineContext(entry) {
  if (!entry) return;
  delete entry.timelineContext;
  if (entry.context) {
    delete entry.context.sceneHint;
    delete entry.context.eventName;
  }
}

/**
 * 计算条目的展示优先级。数值越小越靠前。
 * @param {Object} entry
 * @returns {number}
 */
function getTextPriority(entry) {
  const role = entry?.semanticRole || '';
  const type = entry?.textType || '';
  if (TEXT_PRIORITY_TIERS[role] !== undefined) return TEXT_PRIORITY_TIERS[role];
  if (TEXT_PRIORITY_TIERS[type] !== undefined) return TEXT_PRIORITY_TIERS[type];
  if (/-description$/.test(type)) return TEXT_PRIORITY_TIERS['item-description'];
  if (/^system-/.test(type)) return TEXT_PRIORITY_TIERS['system-message'];
  return 99;
}

/**
 * 为单个 Map 文件构建剧情时间线。
 * @param {Object[]} entries 该文件的所有 physical entries
 * @param {Object} mapJson 解析后的 Map JSON
 * @param {string} fileName Map 文件名（如 Map002.json）
 * @returns {{timeline:Object[],unmatched:Object[],eventCount:number}}
 */
function buildMapTimeline(entries, mapJson, fileName) {
  const timeline = [];
  const fileUsedIds = new Set();
  const indexByPath = new Map(entries.map((entry) => [entry.path || entry.key || entry.id, entry]));

  const events = Array.isArray(mapJson?.events) ? mapJson.events : [];
  let eventCount = 0;

  const sortedEvents = sortEventsByStoryFlow(events);

  for (const { event, eventIndex } of sortedEvents) {
    eventCount += 1;

    // 同一事件内按页面分数排序
    const scoredPages = event.pages.map((page, pageIndex) => ({
      page,
      pageIndex,
      score: scoreEventPage(event, page, pageIndex),
    }));
    scoredPages.sort((a, b) => b.score - a.score);

    for (const { page, pageIndex } of scoredPages) {
      let currentSpeaker = '';
      const list = Array.isArray(page?.list) ? page.list : [];

      list.forEach((command, cmdIndex) => {
        if (!command || typeof command !== 'object') return;
        const code = Number(command.code);
        const params = Array.isArray(command.parameters) ? command.parameters : [];
        const triggerLabel = buildTriggerLabel(event, eventIndex, page, pageIndex);
        const sceneName = mapJson?.displayName || fileName;

        if (code === 101) {
          currentSpeaker = String(params[4] || '').trim();
        }

        if (code === 401 || code === 405) {
          const entry = findEntryByCommandPath(
            indexByPath,
            `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[0]`
          );
          if (entry) {
            attachTimelineContext(entry, {
              scene: sceneName,
              trigger: triggerLabel,
              speaker: currentSpeaker || entry.context?.speaker || '',
            });
            timeline.push(entry);
            fileUsedIds.add(entry.id);
          }
        }

        if (code === 102) {
          const choices = Array.isArray(params[0]) ? params[0] : [];
          choices.forEach((_choice, choiceIndex) => {
            const entry = findEntryByCommandPath(
              indexByPath,
              `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[0][${choiceIndex}]`
            );
            if (entry) {
              attachTimelineContext(entry, {
                scene: sceneName,
                trigger: `${triggerLabel} · 分支选择`,
                speaker: currentSpeaker || entry.context?.speaker || '',
              });
              timeline.push(entry);
              fileUsedIds.add(entry.id);
            }
          });
        }

        if (code === 402) {
          const entry = findEntryByCommandPath(
            indexByPath,
            `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[1]`
          );
          if (entry) {
            attachTimelineContext(entry, {
              scene: sceneName,
              trigger: `${triggerLabel} · 分支`,
              speaker: currentSpeaker || entry.context?.speaker || '',
            });
            timeline.push(entry);
            fileUsedIds.add(entry.id);
          }
        }

        if (code === 101) {
          const entry = findEntryByCommandPath(
            indexByPath,
            `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[4]`
          );
          if (entry) {
            attachTimelineContext(entry, {
              scene: sceneName,
              trigger: `${triggerLabel} · 说话者`,
              speaker: currentSpeaker || entry.context?.speaker || '',
            });
            timeline.push(entry);
            fileUsedIds.add(entry.id);
          }
        }
      });
    }
  }

  // 同文件中未被事件流覆盖的条目，按文本优先级排序后追加
  const unmatched = entries
    .filter((entry) => !fileUsedIds.has(entry.id))
    .sort((a, b) => getTextPriority(a) - getTextPriority(b));

  unmatched.forEach((entry) => clearTimelineContext(entry));

  return { timeline, unmatched, eventCount };
}

/**
 * 对非 Map 文件的 entries 按文本优先级排序。
 * @param {Object[]} entries
 * @returns {Object[]}
 */
function sortNonMapEntries(entries) {
  return [...entries].sort((a, b) => getTextPriority(a) - getTextPriority(b));
}

// ========== 剧情章节分类（Virtual Timeline Decoupling Layer） ==========

const SYSTEM_GROUP_ID = 'system';
const STATIC_GROUP_ID = 'static';
const SYSTEM_GROUP_LABEL_KEY = 'chapter.system';
const STATIC_GROUP_LABEL_KEY = 'chapter.static';

const CHAPTER_WEIGHT_OFFSETS = {
  switch1: 0,
  switch2: 20000,
  variable: 10000,
  selfSwitch: 30000,
  item: 40000,
  actor: 50000,
};

/**
 * 判断文件是否属于系统/静态组（非 Map 文件）。
 * @param {string} fileName
 * @returns {boolean}
 */
function isSystemFile(fileName) {
  return !/^Map\d+\.json$/i.test(path.basename(fileName || ''));
}

/**
 * 计算事件页面的剧情章节权重。
 * @param {Object} conditions
 * @returns {number}
 */
function computeChapterWeight(conditions) {
  const c = conditions || {};
  if (c.switch1Valid && c.switch1Id) return CHAPTER_WEIGHT_OFFSETS.switch1 + c.switch1Id;
  if (c.variableValid && c.variableValue != null) return CHAPTER_WEIGHT_OFFSETS.variable + c.variableValue;
  if (c.switch2Valid && c.switch2Id) return CHAPTER_WEIGHT_OFFSETS.switch2 + c.switch2Id;
  if (c.selfSwitchValid && c.selfSwitchCh) return CHAPTER_WEIGHT_OFFSETS.selfSwitch + (c.selfSwitchCh.charCodeAt(0) || 0);
  if (c.itemValid && c.itemId) return CHAPTER_WEIGHT_OFFSETS.item + c.itemId;
  if (c.actorValid && c.actorId) return CHAPTER_WEIGHT_OFFSETS.actor + c.actorId;
  return 99999;
}

/**
 * 生成章节标签。
 * @param {Object} conditions
 * @param {number} weight
 * @returns {string}
 */
function computeChapterLabel(conditions, weight) {
  const c = conditions || {};
  if (c.switch1Valid && c.switch1Id) return { key: 'chapter.switch', params: { id: c.switch1Id } };
  if (c.variableValid && c.variableValue != null) return { key: 'chapter.variable', params: { value: c.variableValue } };
  if (c.switch2Valid && c.switch2Id) return { key: 'chapter.switch2', params: { id: c.switch2Id } };
  if (c.selfSwitchValid && c.selfSwitchCh) return { key: 'chapter.selfSwitch', params: { ch: c.selfSwitchCh } };
  if (c.itemValid && c.itemId) return { key: 'chapter.item', params: { id: c.itemId } };
  if (c.actorValid && c.actorId) return { key: 'chapter.actor', params: { id: c.actorId } };
  return { key: 'chapter.fallback', params: { weight } };
}

/**
 * 获取固定组（系统/静态）的 i18n 标签数据。
 */
function getSystemLabel() {
  return { key: SYSTEM_GROUP_LABEL_KEY, params: {} };
}

function getStaticLabel() {
  return { key: STATIC_GROUP_LABEL_KEY, params: {} };
}

/**
 * 判断事件页是否没有任何有效条件。
 * @param {Object} conditions
 * @returns {boolean}
 */
function hasNoConditions(conditions) {
  const c = conditions || {};
  return !c.switch1Valid && !c.switch2Valid && !c.variableValid && !c.selfSwitchValid && !c.itemValid && !c.actorValid;
}

/**
 * 对单条 entry 进行剧情章节分类。
 * @param {Object} entry
 * @returns {{chapterGroup:string, chapterSubGroup:string, chapterWeight:number, chapterLabel:string, chapterType:string}}
 */
function classifyEntryChapter(entry) {
  const fileName = path.basename(entry?.file || '');

  // 系统与道具组：所有非 Map 文件
  if (isSystemFile(fileName)) {
    return {
      chapterGroup: SYSTEM_GROUP_ID,
      chapterSubGroup: fileName,
      chapterWeight: 99999,
      labelKey: SYSTEM_GROUP_LABEL_KEY,
      labelParams: {},
      chapterType: 'system',
    };
  }

  const conditions = entry?.adapterMeta?.conditions || {};

  // 静态环境调查组：Map 事件页无条件
  if (hasNoConditions(conditions)) {
    const subGroup = entry?.adapterMeta?.mapDisplayName || fileName;
    return {
      chapterGroup: STATIC_GROUP_ID,
      chapterSubGroup: subGroup,
      chapterWeight: 99999,
      labelKey: STATIC_GROUP_LABEL_KEY,
      labelParams: {},
      chapterType: 'static',
    };
  }

  // 剧情流章节组
  const weight = computeChapterWeight(conditions);
  const label = computeChapterLabel(conditions, weight);
  return {
    chapterGroup: `chapter-${weight}`,
    chapterSubGroup: '',
    chapterWeight: weight,
    labelKey: label.key,
    labelParams: label.params,
    chapterType: 'chapter',
  };
}

/**
 * 构建章节索引。
 * @param {Object[]} entries 已按剧情流排序的条目数组（通常是 timelineEntries）
 * @returns {{groups:Map, manualOverrides:Map}}
 */
function buildChapterIndex(entries) {
  const groups = new Map();

  // 初始化顶层组
  groups.set(SYSTEM_GROUP_ID, {
    id: SYSTEM_GROUP_ID,
    labelKey: SYSTEM_GROUP_LABEL_KEY,
    labelParams: {},
    type: 'system',
    subGroups: new Map(),
    entries: [],
  });
  groups.set(STATIC_GROUP_ID, {
    id: STATIC_GROUP_ID,
    labelKey: STATIC_GROUP_LABEL_KEY,
    labelParams: {},
    type: 'static',
    subGroups: new Map(),
    entries: [],
  });

  entries.forEach((entry) => {
    const classification = classifyEntryChapter(entry);
    entry.chapterGroup = classification.chapterGroup;
    entry.chapterSubGroup = classification.chapterSubGroup;
    entry.chapterWeight = classification.chapterWeight;
    entry.labelKey = classification.labelKey;
    entry.labelParams = classification.labelParams;
    entry.chapterType = classification.chapterType;

    let group = groups.get(classification.chapterGroup);
    if (!group) {
      group = {
        id: classification.chapterGroup,
        labelKey: classification.labelKey,
        labelParams: classification.labelParams,
        type: 'chapter',
        subGroups: null,
        entries: [],
      };
      groups.set(classification.chapterGroup, group);
    }

    if (classification.chapterSubGroup) {
      if (!group.subGroups) group.subGroups = new Map();
      let subGroup = group.subGroups.get(classification.chapterSubGroup);
      if (!subGroup) {
        subGroup = {
          id: classification.chapterSubGroup,
          label: classification.chapterSubGroup,
          entries: [],
        };
        group.subGroups.set(classification.chapterSubGroup, subGroup);
      }
      subGroup.entries.push(entry);
    } else {
      group.entries.push(entry);
    }
  });

  // 对剧情章节组按权重排序内部条目：已经按 timeline 顺序进入，保持即可
  // 系统/静态子组内部按文本优先级再排一次，保证对话类优先
  const systemGroup = groups.get(SYSTEM_GROUP_ID);
  systemGroup.subGroups.forEach((subGroup) => {
    subGroup.entries.sort((a, b) => getTextPriority(a) - getTextPriority(b));
  });

  const staticGroup = groups.get(STATIC_GROUP_ID);
  staticGroup.subGroups.forEach((subGroup) => {
    subGroup.entries.sort((a, b) => getTextPriority(a) - getTextPriority(b));
  });

  return { groups, manualOverrides: new Map() };
}

/**
 * 把章节索引转为前端树形摘要数组。
 * @param {{groups:Map, manualOverrides:Map}} chapterIndex
 * @returns {Object[]}
 */
function buildChapterGroupsSummary(chapterIndex) {
  if (!chapterIndex?.groups) return [];
  const result = [];

  // 固定顺序：系统组、静态调查组、剧情章节组（按 weight 升序）
  const fixedOrder = [SYSTEM_GROUP_ID, STATIC_GROUP_ID];
  const chapterGroups = [];

  chapterIndex.groups.forEach((group) => {
    if (fixedOrder.includes(group.id)) {
      // 顶层固定组稍后处理
      return;
    }
    chapterGroups.push(group);
  });

  chapterGroups.sort((a, b) => {
    // 自定义组按 order 排序，并排在自动剧情组之后
    const aCustom = a.type === 'custom';
    const bCustom = b.type === 'custom';
    if (aCustom && bCustom) return (a.order || 0) - (b.order || 0);
    if (aCustom) return 1;
    if (bCustom) return -1;
    const aw = parseInt(a.id.replace('chapter-', ''), 10) || 0;
    const bw = parseInt(b.id.replace('chapter-', ''), 10) || 0;
    return aw - bw;
  });

  const sortedGroups = [
    chapterIndex.groups.get(SYSTEM_GROUP_ID),
    chapterIndex.groups.get(STATIC_GROUP_ID),
    ...chapterGroups,
  ].filter(Boolean);

  const countTranslated = (items) => items.filter((e) => String(e.target || '').trim()).length;

  sortedGroups.forEach((group) => {
    const summary = {
      id: group.id,
      labelKey: group.labelKey,
      labelParams: group.labelParams,
      type: group.type,
      entryCount: 0,
      translatedCount: 0,
      subGroups: null,
    };

    if (group.subGroups) {
      summary.subGroups = [];
      group.subGroups.forEach((subGroup) => {
        summary.subGroups.push({
          id: subGroup.id,
          label: subGroup.label,
          entryCount: subGroup.entries.length,
          translatedCount: countTranslated(subGroup.entries),
        });
        summary.entryCount += subGroup.entries.length;
        summary.translatedCount += countTranslated(subGroup.entries);
      });
      summary.subGroups.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }
    // 同时统计直接挂在父组下的条目
    if (group.entries?.length) {
      summary.entryCount += group.entries.length;
      summary.translatedCount += countTranslated(group.entries);
    }

    result.push(summary);
  });

  return result;
}

// ========== 手动章节管理覆盖层 ==========

const CUSTOM_GROUP_LABEL_KEY = 'chapter.custom';

/**
 * 创建自定义章节组对象。
 * @param {string} groupId
 * @param {string} name
 * @param {number} order
 * @returns {Object}
 */
function createCustomGroup(groupId, name, order = 0) {
  return {
    id: groupId,
    labelKey: CUSTOM_GROUP_LABEL_KEY,
    labelParams: { name },
    type: 'custom',
    customName: name,
    order: Number(order) || 0,
    subGroups: new Map(),
    entries: [],
  };
}

/**
 * 把任意 Map / 数组 / 对象转成标准 Map。
 * @param {Map|Array|Object} input
 * @returns {Map}
 */
function normalizeMap(input) {
  if (input instanceof Map) return input;
  if (Array.isArray(input)) {
    const map = new Map();
    input.forEach((item) => {
      if (item && item.id !== undefined) map.set(item.id, item);
    });
    return map;
  }
  return new Map(Object.entries(input || {}));
}

/**
 * 应用章节组显示名重命名。
 * @param {Object} group
 * @param {Map|Object} groupNames
 */
function applyGroupRename(group, groupNames) {
  if (!group || !groupNames) return;
  const map = groupNames instanceof Map ? groupNames : new Map(Object.entries(groupNames || {}));
  const name = map.get(group.id);
  if (!name || group.type === 'custom') return;
  group.labelKey = CUSTOM_GROUP_LABEL_KEY;
  group.labelParams = { name };
  group.customName = name;
}

/**
 * 应用子组显示名重命名。
 * @param {Object} subGroup
 * @param {Map|Object} subGroupNames
 * @param {string} groupId
 */
function applySubGroupRename(subGroup, subGroupNames, groupId) {
  if (!subGroup || !subGroupNames) return;
  const map = subGroupNames instanceof Map ? subGroupNames : new Map(Object.entries(subGroupNames || {}));
  const groupMap = map.get(groupId);
  if (!groupMap) return;
  const name = groupMap instanceof Map ? groupMap.get(subGroup.id) : groupMap[subGroup.id];
  if (name) subGroup.label = name;
}

/**
 * 根据自动分类 + 用户覆盖层重建章节索引。
 * @param {Object[]} entries 已按剧情流排序的条目数组
 * @param {Map|Object} overrides entryId -> { groupId, subGroupId }
 * @param {Map|Array|Object} customGroups 自定义组集合
 * @param {Map|Object} groupNames 自动组显示名重命名
 * @param {Map|Object} subGroupNames 自动子组显示名重命名
 * @returns {{groups:Map, manualOverrides:Map}}
 */
function rebuildChapterIndexWithOverrides(entries, overrides = {}, customGroups = {}, groupNames = {}, subGroupNames = {}) {
  const chapterIndex = buildChapterIndex(entries);

  // 1. 先创建自定义组
  const customGroupMap = normalizeMap(customGroups);
  customGroupMap.forEach((group) => {
    if (!group || !group.id) return;
    if (!chapterIndex.groups.has(group.id)) {
      chapterIndex.groups.set(group.id, createCustomGroup(group.id, group.name || group.id, group.order));
    }
  });

  // 2. 应用条目移动覆盖
  const overrideMap = normalizeMap(overrides);
  overrideMap.forEach((override, entryId) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || !override) return;

    const targetGroupId = override.groupId;
    const targetSubGroupId = override.subGroupId || '';
    const targetGroup = chapterIndex.groups.get(targetGroupId);
    if (!targetGroup) return;

    // 2.1 从原组移除
    const fromGroup = chapterIndex.groups.get(entry.chapterGroup);
    if (fromGroup) {
      if (entry.chapterSubGroup && fromGroup.subGroups) {
        const sourceSub = fromGroup.subGroups.get(entry.chapterSubGroup);
        if (sourceSub) {
          sourceSub.entries = sourceSub.entries.filter((e) => e.id !== entryId);
          if (!sourceSub.entries.length) fromGroup.subGroups.delete(entry.chapterSubGroup);
        }
      } else {
        fromGroup.entries = fromGroup.entries.filter((e) => e.id !== entryId);
      }
      // 若顶层剧情组已空则删除
      if (fromGroup.type === 'chapter' && !fromGroup.entries.length && (!fromGroup.subGroups || !fromGroup.subGroups.size)) {
        chapterIndex.groups.delete(entry.chapterGroup);
      }
    }

    // 2.2 加入目标组
    entry.chapterGroup = targetGroupId;
    entry.chapterSubGroup = targetSubGroupId;
    entry.chapterIsManual = true;
    entry.labelKey = targetGroup.labelKey;
    entry.labelParams = targetGroup.labelParams;
    entry.chapterType = targetGroup.type;
    if (targetSubGroupId) {
      entry.labelParams = { ...targetGroup.labelParams, sub: targetSubGroupId };
    }

    if (targetSubGroupId) {
      if (!targetGroup.subGroups) targetGroup.subGroups = new Map();
      let targetSub = targetGroup.subGroups.get(targetSubGroupId);
      if (!targetSub) {
        targetSub = { id: targetSubGroupId, label: targetSubGroupId, entries: [] };
        targetGroup.subGroups.set(targetSubGroupId, targetSub);
      }
      targetSub.entries.push(entry);
    } else {
      targetGroup.entries.push(entry);
    }
  });

  // 3. 应用重命名
  chapterIndex.groups.forEach((group) => {
    applyGroupRename(group, groupNames);
    if (group.subGroups) {
      group.subGroups.forEach((subGroup) => {
        applySubGroupRename(subGroup, subGroupNames, group.id);
      });
    }
  });

  // 4. 清理空自定义组
  chapterIndex.groups.forEach((group, groupId) => {
    if (group.type === 'custom' && !group.entries.length && (!group.subGroups || !group.subGroups.size)) {
      chapterIndex.groups.delete(groupId);
    }
  });

  return chapterIndex;
}

module.exports = {
  TRIGGER_TYPE,
  TRIGGER_PRIORITY,
  TRIGGER_NAMES,
  STORY_COMMAND_CODES,
  TEXT_PRIORITY_TIERS,
  SYSTEM_GROUP_ID,
  STATIC_GROUP_ID,
  SYSTEM_GROUP_LABEL_KEY,
  STATIC_GROUP_LABEL_KEY,
  CUSTOM_GROUP_LABEL_KEY,
  scoreEventPage,
  sortEventsByStoryFlow,
  buildMapTimeline,
  getTextPriority,
  sortNonMapEntries,
  attachTimelineContext,
  clearTimelineContext,
  isSystemFile,
  computeChapterWeight,
  computeChapterLabel,
  hasNoConditions,
  classifyEntryChapter,
  buildChapterIndex,
  buildChapterGroupsSummary,
  createCustomGroup,
  rebuildChapterIndexWithOverrides,
};
