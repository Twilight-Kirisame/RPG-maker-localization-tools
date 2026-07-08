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

class ProjectStore {
  constructor() {
    this.physicalEntries = [];
    this.timelineEntries = [];
    this.viewMode = 'physical'; // 'physical' | 'timeline'
    this.projectRoot = '';
    this.engineName = '';
    this.timelineMeta = { sceneCount: 0, eventCount: 0 };
  }

  /**
   * 清空当前项目缓存。
   */
  clear() {
    this.physicalEntries = [];
    this.timelineEntries = [];
    this.viewMode = 'physical';
    this.projectRoot = '';
    this.engineName = '';
    this.timelineMeta = { sceneCount: 0, eventCount: 0 };
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
    return {
      physicalCount: this.physicalEntries.length,
      timelineCount: this.timelineEntries.length,
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
   * 其它文件（System / Database / CommonEvents / 通用 JSON）的条目按原物理顺序追加。
   */
  buildTimelineEntries() {
    if (this.engineName !== 'rpg-maker' && !/RPG Maker/i.test(this.engineName)) {
      return this.physicalEntries.slice();
    }
    const timeline = [];
    const usedIds = new Set();
    const sceneSet = new Set();
    let eventCount = 0;

    // 按文件顺序逐个处理：Map 文件内部按事件流重排，其它文件保持原顺序
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
        entries.forEach((entry) => {
          this._clearTimelineContext(entry);
          timeline.push(entry);
        });
        continue;
      }

      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        entries.forEach((entry) => {
          this._clearTimelineContext(entry);
          timeline.push(entry);
        });
        continue;
      }
      let mapJson;
      try {
        mapJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        entries.forEach((entry) => {
          this._clearTimelineContext(entry);
          timeline.push(entry);
        });
        continue;
      }
      const sceneName = mapJson.displayName || fileName;
      sceneSet.add(sceneName);

      const indexByPath = new Map(entries.map((entry) => [entry.path || entry.key || entry.id, entry]));
      const events = Array.isArray(mapJson.events) ? mapJson.events : [];
      const fileUsedIds = new Set();

      events.forEach((event, eventIndex) => {
        if (!event || !Array.isArray(event.pages)) return;
        eventCount += 1;
        event.pages.forEach((page, pageIndex) => {
          let currentSpeaker = '';
          const list = Array.isArray(page?.list) ? page.list : [];
          list.forEach((command, cmdIndex) => {
            if (!command || typeof command !== 'object') return;
            const code = Number(command.code);
            const params = Array.isArray(command.parameters) ? command.parameters : [];

            if (code === 101) {
              currentSpeaker = String(params[4] || '').trim();
            }

            if (code === 401) {
              const entry = this._findEntryByCommandPath(indexByPath, `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[0]`);
              if (entry) {
                this._attachTimelineContext(entry, {
                  scene: sceneName,
                  trigger: `事件 ${eventIndex}${event.name ? ` · ${event.name}` : ''} (页 ${pageIndex})`,
                  speaker: currentSpeaker || entry.context?.speaker || '',
                });
                timeline.push(entry);
                fileUsedIds.add(entry.id);
                usedIds.add(entry.id);
              }
            }

            if (code === 102) {
              const choices = Array.isArray(params[0]) ? params[0] : [];
              choices.forEach((_choice, choiceIndex) => {
                const entry = this._findEntryByCommandPath(indexByPath, `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[0][${choiceIndex}]`);
                if (entry) {
                  this._attachTimelineContext(entry, {
                    scene: sceneName,
                    trigger: `事件 ${eventIndex}${event.name ? ` · ${event.name}` : ''} (页 ${pageIndex}) · 分支选择`,
                    speaker: currentSpeaker || entry.context?.speaker || '',
                  });
                  timeline.push(entry);
                  fileUsedIds.add(entry.id);
                  usedIds.add(entry.id);
                }
              });
            }

            if (code === 402) {
              const entry = this._findEntryByCommandPath(indexByPath, `events[${eventIndex}].pages[${pageIndex}].list[${cmdIndex}].parameters[1]`);
              if (entry) {
                this._attachTimelineContext(entry, {
                  scene: sceneName,
                  trigger: `事件 ${eventIndex}${event.name ? ` · ${event.name}` : ''} (页 ${pageIndex}) · 分支`,
                  speaker: currentSpeaker || entry.context?.speaker || '',
                });
                timeline.push(entry);
                fileUsedIds.add(entry.id);
                usedIds.add(entry.id);
              }
            }
          });
        });
      });

      // 同文件中未被事件流覆盖的条目（如 speaker 名字本身）按原物理顺序追加
      entries.forEach((entry) => {
        if (!fileUsedIds.has(entry.id)) {
          this._clearTimelineContext(entry);
          timeline.push(entry);
          usedIds.add(entry.id);
        }
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
}

const globalStore = new ProjectStore();

module.exports = { ProjectStore, globalProjectStore: globalStore };
