/**
 * @file src/main/services/project/ProjectStore.js
 * @description 项目级双轨数据存储器。
 *
 * 为了解决“文本在 JSON 文件中存放离散、导致翻译时时序错乱”的问题，
 * 我们在内存中维护两层视图：
 *   - physicalEntries：按原始 JSON 物理扫描顺序排列的数组（用于原样回填和默认展示）。
 *   - timelineEntries：按剧情拓扑排序后的虚拟剧本时间线（用于线性剧本翻译）。
 *
 * 核心约定：两个数组内部的同一个文本对象，其 JavaScript 对象引用（指针）完全一致。
 * 因此无论前端在哪种视图下修改 target，物理池中的对应对象都会同步改变，
 * 导出 / 写回时直接取 physicalEntries 即可，零二次转换开销。
 */

const fs = require('fs');
const path = require('path');
const { buildMapTimeline, sortNonMapEntries, buildChapterIndex, buildChapterGroupsSummary, createCustomGroup, rebuildChapterIndexWithOverrides } = require('./TimelineBuilder');
const { loadProjectSettings, saveProjectSettings } = require('../storage/ProjectSettingsService');

class ProjectStore {
  constructor() {
    this.physicalEntries = [];
    this.timelineEntries = [];
    this.chapterIndex = null;
    this.chapterGroups = [];
    this.viewMode = 'physical'; // 'physical' | 'timeline'
    this.projectRoot = '';
    this.engineName = '';
    this.timelineMeta = { sceneCount: 0, eventCount: 0 };
    // 用户手动章节管理覆盖层
    this.chapterOverrides = new Map();
    this.customGroups = new Map();
    this.chapterGroupNames = new Map();
    this.chapterSubGroupNames = new Map();
  }

  /**
   * 清空当前项目缓存。
   */
  clear() {
    this.physicalEntries = [];
    this.timelineEntries = [];
    this.chapterIndex = null;
    this.chapterGroups = [];
    this.viewMode = 'physical';
    this.projectRoot = '';
    this.engineName = '';
    this.timelineMeta = { sceneCount: 0, eventCount: 0 };
    this.chapterOverrides = new Map();
    this.customGroups = new Map();
    this.chapterGroupNames = new Map();
    this.chapterSubGroupNames = new Map();
  }

  /**
   * 设置物理条目并重建时间线。
   * @param {string} projectRoot
   * @param {Object[]} entries
   * @param {string} engineName
   */
  setPhysicalEntries(projectRoot, entries, engineName = '') {
    this.projectRoot = projectRoot || '';
    this.engineName = engineName || '';
    this.physicalEntries = Array.isArray(entries) ? entries : [];
    this.timelineEntries = this.buildTimelineEntries();
    this._loadChapterSettingsSync();
    this._rebuildChapterGroups();
    return {
      physicalCount: this.physicalEntries.length,
      timelineCount: this.timelineEntries.length,
      chapterGroups: this.chapterGroups,
      meta: this.timelineMeta,
    };
  }

  /**
   * 切换当前视图模式。
   * @param {'physical'|'timeline'} mode
   */
  setViewMode(mode) {
    if (mode !== 'timeline' && mode !== 'physical') return false;
    this.viewMode = mode;
    return true;
  }

  /**
   * 获取当前激活的条目数组（按当前视图模式）。
   * @returns {Object[]}
   */
  getActiveEntries() {
    return this.viewMode === 'timeline' ? this.timelineEntries : this.physicalEntries;
  }

  /**
   * 按页码切片返回当前激活数组的条目。
   * @param {number} page 从 1 开始
   * @param {number} pageSize
   * @returns {{total:number, entries:Object[]}}
   */
  getEntriesByPage(page = 1, pageSize = 200) {
    const targetArray = this.getActiveEntries();
    const start = Math.max(0, (page - 1) * pageSize);
    return { total: targetArray.length, entries: targetArray.slice(start, start + pageSize) };
  }

  /**
   * 根据 id 在物理池中查找条目（用于修改时确保改的是同一指针）。
   * @param {string} entryId
   * @returns {Object|undefined}
   */
  findPhysicalEntryById(entryId) {
    return this.physicalEntries.find((entry) => entry.id === entryId);
  }

  /**
   * 构建剧情时间线。
   * 目前仅对 RPG Maker MV/MZ 的 Map*.json 按事件流拓扑重排；
   * 重排以文件为单位进行，保证文件分组与前端文件选择器兼容。
   * 其它文件（System / Database / CommonEvents / 通用 JSON）的条目按文本优先级排序后追加。
   */
  buildTimelineEntries() {
    if (this.engineName !== 'rpg-maker' && !/RPG Maker/i.test(this.engineName)) {
      return this.physicalEntries.slice();
    }
    const timeline = [];
    const sceneSet = new Set();
    let eventCount = 0;

    // 按文件顺序逐个处理：Map 文件内部按剧情流启发式重排，其它文件按文本优先级排序
    const byFile = new Map();
    this.physicalEntries.forEach((entry) => {
      const file = entry.file;
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(entry);
    });

    for (const [file, entries] of byFile.entries()) {
      const fileName = path.basename(file || '');
      const isMap = /^Map\d+\.json$/i.test(fileName);

      if (!isMap) {
        sortNonMapEntries(entries).forEach((entry) => {
          this._clearTimelineContext(entry);
          timeline.push(entry);
        });
        continue;
      }

      const filePath = path.join(this.projectRoot, file);
      let mapJson = null;
      if (fs.existsSync(filePath)) {
        try {
          mapJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch {
          mapJson = null;
        }
      }

      if (!mapJson) {
        sortNonMapEntries(entries).forEach((entry) => {
          this._clearTimelineContext(entry);
          timeline.push(entry);
        });
        continue;
      }

      const sceneName = mapJson.displayName || fileName;
      sceneSet.add(sceneName);

      const { timeline: mapTimeline, unmatched, eventCount: fileEventCount } = buildMapTimeline(entries, mapJson, fileName);
      eventCount += fileEventCount;

      mapTimeline.forEach((entry) => timeline.push(entry));
      unmatched.forEach((entry) => {
        this._clearTimelineContext(entry);
        timeline.push(entry);
      });
    }

    this.timelineMeta = { sceneCount: sceneSet.size, eventCount };
    return timeline;
  }

  _findEntryByCommandPath(indexByPath, commandPath) {
    const direct = indexByPath.get(commandPath);
    if (direct) return direct;
    // 兼容旧版 key 中可能带 .parameters[0] 的写法
    for (const entry of indexByPath.values()) {
      if (entry.key === commandPath) return entry;
    }
    return null;
  }

  _attachTimelineContext(entry, context) {
    if (!entry) return;
    entry.timelineContext = {
      ...(entry.timelineContext || {}),
      ...context,
    };
    // 同步写回 context 对象，保证前端读取路径一致
    entry.context = {
      ...(entry.context || {}),
      sceneHint: context.scene,
      speaker: context.speaker,
      eventName: context.trigger,
      ...context,
    };
  }

  _clearTimelineContext(entry) {
    if (!entry) return;
    delete entry.timelineContext;
    if (entry.context) {
      delete entry.context.sceneHint;
      delete entry.context.eventName;
    }
  }

  // ========== 手动章节管理覆盖层 ==========

  /**
   * 从 project-settings.json 同步加载章节覆盖层。
   */
  _loadChapterSettingsSync() {
    if (!this.projectRoot) return;
    const { projectStoragePath } = require('../storage/StorageService');
    const filePath = projectStoragePath({ rootDir: this.projectRoot }, 'project-settings.json');
    let settings = {};
    if (fs.existsSync(filePath)) {
      try {
        settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        settings = {};
      }
    }
    this.chapterOverrides = new Map(Object.entries(settings?.chapterOverrides || {}));
    this.chapterGroupNames = new Map(Object.entries(settings?.chapterGroupNames || {}));
    this.chapterSubGroupNames = new Map(Object.entries(settings?.chapterSubGroupNames || {}));
    // customGroups 可能是数组或对象
    const rawCustomGroups = settings?.customGroups || [];
    this.customGroups = new Map();
    if (Array.isArray(rawCustomGroups)) {
      rawCustomGroups.forEach((g) => { if (g?.id) this.customGroups.set(g.id, g); });
    } else {
      Object.entries(rawCustomGroups).forEach(([id, g]) => { this.customGroups.set(id, { id, ...g }); });
    }
  }

  /**
   * 把章节覆盖层写回 project-settings.json。
   */
  async _saveChapterSettings() {
    if (!this.projectRoot) return;
    const project = { rootDir: this.projectRoot };
    const subGroupNamesObj = {};
    this.chapterSubGroupNames.forEach((value, key) => {
      subGroupNamesObj[key] = value instanceof Map ? Object.fromEntries(value) : value;
    });
    const settings = {
      chapterOverrides: Object.fromEntries(this.chapterOverrides),
      chapterGroupNames: Object.fromEntries(this.chapterGroupNames),
      chapterSubGroupNames: subGroupNamesObj,
      customGroups: Array.from(this.customGroups.values()),
    };
    await saveProjectSettings(project, settings);
  }

  /**
   * 使用当前覆盖层重建 chapterIndex 和 chapterGroups。
   */
  _rebuildChapterGroups() {
    const subGroupNames = new Map();
    this.chapterSubGroupNames.forEach((value, key) => {
      subGroupNames.set(key, value instanceof Map ? value : new Map(Object.entries(value || {})));
    });
    this.chapterIndex = rebuildChapterIndexWithOverrides(
      this.timelineEntries,
      this.chapterOverrides,
      this.customGroups,
      this.chapterGroupNames,
      subGroupNames
    );
    this.chapterGroups = buildChapterGroupsSummary(this.chapterIndex);
  }

  /**
   * 获取指定章节/子分组内的所有条目。
   * @param {string} groupId
   * @param {string} subGroupId
   * @returns {Object[]}
   */
  getEntriesByChapter(groupId, subGroupId = '') {
    if (!this.chapterIndex?.groups) return [];
    const group = this.chapterIndex.groups.get(groupId);
    if (!group) return [];
    if (subGroupId && group.subGroups) {
      const sub = group.subGroups.get(subGroupId);
      return sub ? sub.entries : [];
    }
    if (group.subGroups) {
      const all = [];
      group.subGroups.forEach((sub) => all.push(...sub.entries));
      return all;
    }
    return group.entries || [];
  }

  /**
   * 获取章节树摘要（供前端渲染）。
   * @returns {Object[]}
   */
  getChapterGroups() {
    return this.chapterGroups || [];
  }

  /**
   * 人工修正：把条目移动到目标章节组。
   * @param {string} entryId
   * @param {string} targetGroupId
   * @param {string} targetSubGroupId
   * @returns {Promise<boolean>}
   */
  async moveEntryToChapter(entryId, targetGroupId, targetSubGroupId = '') {
    const entry = this.findPhysicalEntryById(entryId);
    if (!entry || !this.chapterIndex?.groups) return false;

    const fromGroup = entry.chapterGroup;
    const fromSubGroup = entry.chapterSubGroup;
    if (fromGroup === targetGroupId && fromSubGroup === targetSubGroupId) return true;

    // 记录覆盖并重建（保持与自动分类、其它覆盖的一致性）
    this.chapterOverrides.set(entryId, { groupId: targetGroupId, subGroupId: targetSubGroupId || '' });
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return true;
  }

  /**
   * 创建自定义章节组。
   * @param {string} name
   * @param {number} [order]
   * @returns {Promise<Object|null>}
   */
  async createChapterGroup(name, order = 0) {
    if (!this.chapterIndex?.groups || !String(name || '').trim()) return null;
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const group = {
      id,
      name: String(name).trim(),
      order: Number(order) || 0,
      subGroups: [],
    };
    this.customGroups.set(id, group);
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return group;
  }

  /**
   * 重命名章节组。
   * @param {string} groupId
   * @param {string} newName
   * @returns {Promise<boolean>}
   */
  async renameChapterGroup(groupId, newName) {
    if (!this.chapterIndex?.groups || !String(newName || '').trim()) return false;
    const group = this.chapterIndex.groups.get(groupId);
    if (!group) return false;

    const name = String(newName).trim();
    if (group.type === 'custom') {
      const custom = this.customGroups.get(groupId);
      if (custom) custom.name = name;
    } else {
      this.chapterGroupNames.set(groupId, name);
    }
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return true;
  }

  /**
   * 删除章节组。
   * 仅允许删除自定义组；删除后组内条目按自动规则重新归类。
   * @param {string} groupId
   * @returns {Promise<boolean>}
   */
  async deleteChapterGroup(groupId) {
    if (!this.chapterIndex?.groups) return false;
    const group = this.chapterIndex.groups.get(groupId);
    if (!group || group.type !== 'custom') return false;

    // 移除所有指向该组的覆盖
    this.chapterOverrides.forEach((override, entryId) => {
      if (override.groupId === groupId) this.chapterOverrides.delete(entryId);
    });
    this.customGroups.delete(groupId);
    this.chapterGroupNames.delete(groupId);
    this.chapterSubGroupNames.delete(groupId);
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return true;
  }

  /**
   * 在指定章节组下创建子组。
   * @param {string} groupId
   * @param {string} subGroupName
   * @returns {Promise<Object|null>}
   */
  async createChapterSubGroup(groupId, subGroupName) {
    if (!this.chapterIndex?.groups || !String(subGroupName || '').trim()) return null;
    const group = this.chapterIndex.groups.get(groupId);
    if (!group) return null;

    const name = String(subGroupName).trim();
    const id = `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

    if (group.type === 'custom') {
      const custom = this.customGroups.get(groupId);
      if (custom) {
        if (!Array.isArray(custom.subGroups)) custom.subGroups = [];
        custom.subGroups.push({ id, name });
      }
    } else {
      let groupMap = this.chapterSubGroupNames.get(groupId);
      if (!(groupMap instanceof Map)) {
        groupMap = groupMap ? new Map(Object.entries(groupMap)) : new Map();
      }
      groupMap.set(id, name);
      this.chapterSubGroupNames.set(groupId, groupMap);
    }
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return { id, name };
  }

  /**
   * 重命名子组。
   * @param {string} groupId
   * @param {string} subGroupId
   * @param {string} newName
   * @returns {Promise<boolean>}
   */
  async renameChapterSubGroup(groupId, subGroupId, newName) {
    if (!this.chapterIndex?.groups || !String(newName || '').trim() || !subGroupId) return false;
    const group = this.chapterIndex.groups.get(groupId);
    if (!group || !group.subGroups?.has(subGroupId)) return false;

    const name = String(newName).trim();
    if (group.type === 'custom') {
      const custom = this.customGroups.get(groupId);
      if (custom && Array.isArray(custom.subGroups)) {
        const sub = custom.subGroups.find((s) => s.id === subGroupId);
        if (sub) sub.name = name;
      }
    } else {
      let groupMap = this.chapterSubGroupNames.get(groupId);
      if (!(groupMap instanceof Map)) {
        groupMap = groupMap ? new Map(Object.entries(groupMap)) : new Map();
      }
      groupMap.set(subGroupId, name);
      this.chapterSubGroupNames.set(groupId, groupMap);
    }
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return true;
  }

  /**
   * 删除子组。
   * 子组内条目会回到父组默认分类（移除指向该子组的覆盖）。
   * @param {string} groupId
   * @param {string} subGroupId
   * @returns {Promise<boolean>}
   */
  async deleteChapterSubGroup(groupId, subGroupId) {
    if (!this.chapterIndex?.groups || !subGroupId) return false;
    const group = this.chapterIndex.groups.get(groupId);
    if (!group || !group.subGroups?.has(subGroupId)) return false;

    // 移除指向该子组的覆盖
    this.chapterOverrides.forEach((override, entryId) => {
      if (override.groupId === groupId && override.subGroupId === subGroupId) {
        this.chapterOverrides.delete(entryId);
      }
    });

    if (group.type === 'custom') {
      const custom = this.customGroups.get(groupId);
      if (custom && Array.isArray(custom.subGroups)) {
        custom.subGroups = custom.subGroups.filter((s) => s.id !== subGroupId);
      }
    } else {
      const groupMap = this.chapterSubGroupNames.get(groupId);
      if (groupMap instanceof Map) groupMap.delete(subGroupId);
      else if (groupMap) delete groupMap[subGroupId];
    }
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return true;
  }

  /**
   * 一键恢复默认：清空所有手动覆盖、自定义组、重命名。
   * @returns {Promise<boolean>}
   */
  async resetChapterOverrides() {
    if (!this.chapterIndex?.groups) return false;
    this.chapterOverrides = new Map();
    this.customGroups = new Map();
    this.chapterGroupNames = new Map();
    this.chapterSubGroupNames = new Map();
    this._rebuildChapterGroups();
    await this._saveChapterSettings();
    return true;
  }
}

const globalStore = new ProjectStore();

module.exports = { ProjectStore, globalProjectStore: globalStore };
