# 本地项目 → GitHub 仓库 同步说明

> Baseline：[Twilight-Kirisame/RPG-maker-localization-tools](https://github.com/Twilight-Kirisame/RPG-maker-localization-tools) `v1.1.1`
>
> 本文档汇总从 `v1.1.1` 到当前本地代码的所有变更：新增功能、修复、UI / 架构重构、以及尚未解决的已知问题。
> 本地 `README.md` 与远端**完全一致**（同字节同行数），所以下方所有 v1.2 内容均为「未写入 README 的、已落在代码里的工作」。

---

## v1.2 候选 — 上下文组深度重构 + AI 对齐引擎重写

### 1. AI 编组翻译 · 双协议自适应对齐引擎（核心重写）

**问题根源**
- v1.1.1 的 `applyContextGroupTranslation()` 依赖大模型在无约束状态下自行输出 `\N` 分隔符。
- 单跑 deepseek-v4-flash 等非思考型轻量模型时，模型会忽略多行输入，常出现 "段数不符（2/5）" "段数不符（3/5）" 等对齐错误，最终编组翻译失败。
- 同时百度 / 谷歌等传统翻译 API 无法识别 `\N`，整段发送被视为普通字符串翻译，破坏对齐。

**新协议矩阵**

| Provider | 协议 | 实现 |
|---|---|---|
| **deepseek / openai / claude / custom / gemini** | **JSON 结构化对齐** | 编号键值对 `{"1":"...","2":"...","N":"..."}` 双向传输；`response_format: { type: 'json_object' }` 在主进程透传到 OpenAI 兼容端点强制返回 JSON；解析器按 expectedKeys 严格校验 |
| **baidu / google / traditional-baidu** | **逐条并发 API 分流** | 按 `\N` 拆 segments，对每段独立 `protectControlCodes` mask 后单独调用 aiTranslate，`Promise.all` 并发完成 N 个 API 调用，再按原 index 装回有序数组 |
| mock / 空 | 文本协议（legacy） | 保留 v1.1.1 行为以便调试 |

**程序级 Prompt 包装器（与用户 system prompt 完全解耦）**
- `buildGroupSystemPromptJson(basePrompt, n)` —— 用户原 prompt + 协议规则 + 控制码占位规则 + JSON few-shot 示例（"输入 3 段→输出也必须 3 段"）
- `buildGroupUserMessageJson(payload, n, retryDiag)` —— 把"本输入包含 X 行、必须返回 X 行"的硬约束追加到 user message 末尾（OpenAI user role 注意力比 system 高，对轻量模型尤其有效）
- **用户的全局 prompt 永不被污染**：所有协议指令仅在本次调用临时拼接，不写回 `aiSettings.prompt`

**控制码占位符保护**
- 发送前：`\N[1]`、`\V[3]`、`\C[10]`、`\FS[12]` 等 RPG Maker 控制码替换为 `{{RPG_CODE_n}}`（视觉特征强、模型不会篡改）
- 收回后：在每个 string value 内 restore 占位符（JSON 模式必须先 parse 再 restore，否则 `\N[1]` 还原后会注入 JSON 文本破坏 parse —— 这是 JSON 路径的关键 bug 修复点）
- 分句标记 bare `\N` 与控制码 `\N[1]` 通过 `(?!\[)` 负向预查精确区分

**诊断式重试**
- 段数不匹配时最多重试 2 次（共 3 次往返）
- 重试 prompt 不是盲目重发同一请求，而是携带：
  - 上次实际返回了 N 段（精确告知失败状态）
  - 上次错误输出的前 400 字符（让模型看到反例后纠错）
- 接口层 HTTP / 鉴权失败立即终止，不浪费重试次数
- 用尽重试后**不写回条目槽**，仅把"尽力结果"展示在 textarea 由用户决策，避免污染数据

**多级响应解析 fallback**
- JSON 模式：严格按 `"1".."N"` 键名取值 → 缺一即 fail
- 文本模式 fallback 顺序：`\N` → `|||`（中间方案）→ `---SPLIT---`（旧）→ 双换行（兜底）

### 2. 上下文组模式 · UI / 交互完整重构

**原文框可编辑**（之前是只读 `<div>`）
- 改为 `<textarea class="context-group-source-editable">`，初始内容以 `\N` 显式分隔标记拼接
- 阻止 click/mousedown/keydown 冒泡，避免触发外层 row 选中
- 用户可手动拆 / 合分句，编辑后内容直接作为 prompt 主体发送

**译文回写自动化**
- AI 翻译成功后自动按对齐后的 segments 数组逐条精准回填 `entry.target / targetDraft`
- 不再需要手动点"应用到所选"两步操作（旧路径仍保留供手动调整）

**备选列表交互优化**
- 新增**局部搜索框**：在备选条目列表上方独立过滤（按 key + source 模糊匹配），与全局 `entrySearch` 解耦，跨 re-render 状态保留
- 修复**勾选弹回顶部 bug**：勾选 checkbox 时抓取 `list.scrollTop` 与搜索框焦点 / 光标，`requestAnimationFrame` 后还原
- 新增独立"**回到顶部**"按钮：显式 `list.scrollTop = 0`，自动回顶逻辑被彻底剥离

### 3. 进度元信息 + 跳转按钮 · 横向网格布局（DOM 不变，纯 CSS 修复）

**问题根源**：`.progress-dashboard / .progress-card / .progress-actions` 在 v1.1.1 中**没有任何 CSS 规则**，全部走浏览器默认 block 流 → 纵向堆叠 → 左侧臃肿、右侧大面积空白。

**修复**：新增网格布局，宽屏 4 列单行（项目进度｜当前文件进度｜上次翻译位置｜按钮组），按钮组靠右填闲置空间；窄屏（<1280px）自动降级 2×2 网格 + 按钮独占底行右对齐。

### 4. 跳转按钮 handler 补绑（修复完全无响应 bug）

**问题根源**：`gotoLastPositionBtn` / `nextPendingBtn` 在 `index.html` 中渲染，但**整个项目从未为它们绑定 click handler** —— 不是状态错乱，是 handler 缺失。

**修复**：在 `bindEntryActions()` 末尾补绑两个 handler，引入通用 `jumpTo(file, idx)` 工具：
1. 自动从组模式切回单条模式（避免在组模式下点跳转无视觉反馈）
2. 设置 `currentFile / currentEntryIndex / entryViewMode` 一致
3. 同步顶部文件下拉选择器的值
4. `requestAnimationFrame` 后用 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 滚动到目标行
5. "下一个未翻译"支持跨文件回环查找（当前文件没有未翻译条目时自动向后续文件扫，再回到开头）

### 5. UI 紧凑化（全面优化信息密度）

**Logo 区域**
| 项目 | 修改前 | 修改后 |
|---|---|---|
| `.sidebar` padding | `24px` | `18px 20px` |
| `.brand` margin-bottom / gap | `24 / 14` | `14 / 10` |
| `.brand-mark` 尺寸 | `52×52 / radius 16 / font 24` | `40×40 / radius 12 / font 20` |
| `.brand-copy` gap | `8px` | `2px` |
| `.brand-title-row h1` font | 默认 | `18px` |

**编辑器底部 / 上下文组**
| 项目 | 修改前 | 修改后 |
|---|---|---|
| `.translation-panel` padding | `22px` | `18px` |
| `.translation-panel-header` margin-bottom / padding-bottom | `18 / 14` | `10 / 8` |
| `.context-group-panel` gap | `14px` | `10px` |
| `.context-group-source/target` min-height | `160px` | `120px` |
| `.context-group-preview-label` padding / font | `10×14 / 12` | `6×10 / 11` |
| `.preview-line-row` padding | `8×14` | `4×10` |
| `.preview-line-separator` height | `24px` | `18px` |
| `.context-group-entry-list` max-height | `540px` | `420px`（避免核心按钮被挤出视口） |
| `.context-group-list-toolbar` | `gap 8`, 可换行 | `flex-wrap: nowrap, gap 6` |

### 6. 国际化（i18n）覆盖补全

**新增 ~40 个 i18n key 到 `bootstrap.js` 三语词典**（zh-CN / en / ja）：

- 上下文组：`context.groupSummary` / `context.groupEmpty` / `context.sourcePlaceholder` / `context.targetPlaceholder` / `context.previewLabel` / `context.previewInsert` / `context.previewRemove` / `context.previewEmptyLine` / `context.splitHint` / `context.aiTranslateGroup` / `context.applyToSelected` / `context.clearSelection`
- 备选列表：`context.listFilterPlaceholder` / `context.backToTop` / `context.backToTopTitle`
- AI 协议反馈：`context.aiCalling` / `context.aiRetrying` / `context.aiSegmentCountWarn` / `context.aiSuccess` / `context.aiSuccessWithRetry` / `context.aiFailRetained` / `context.aiSegmentMismatch` / `context.aiRetryExhausted` / `context.aiTraceLabel` / `context.aiTracePending` / `context.aiTraceSuccess`
- 传统翻译分流反馈：`context.aiTradBatchProgress` / `context.aiTradBatchFailed`
- 跳转：`progress.jumpFail` / `progress.gotoLastDone`

**新增 `tf(key, params)` 助手**（entries.js 顶部）：支持 `{key}` 占位插值，所有 user-facing 字符串都通过 `t()` / `tf()` 调用

**保留为内置中文不动**的字符串及理由：
- `buildGroupSystemPromptJson / buildGroupUserMessageJson` 内的 prompt 内容（发给 AI 不是给用户看；AI 能正确理解中文指令）
- `validateLocal` 警告 tag（"第 1 行 30/28 字"）—— 技术警告，旧 v1.1.1 风格保留
- 单条模式 AI 翻译按钮的成功消息 —— 单条模式属于本轮 task 范围之外

### 7. 主进程小改动（最小侵入）

- `src/main/services/translation/TranslationService.js:309-312`：在 OpenAI 兼容路径中新增 `if (settings.responseFormat) payloadBody.response_format = { type: settings.responseFormat };` —— 仅当渲染端传 `responseFormat` 字段时启用，向后兼容、不传则行为完全不变

---

## 完整变更文件清单

```
modified:   renderer/app/entries.js          (核心：~600 行新增/重写；懒加载支持 + 条目列表增量加载)
modified:   renderer/app/bootstrap.js        (i18n 三语词典补全 ~40 key + stats.files)
modified:   renderer/app/controller.js       (新增 loadFileEntries)
modified:   renderer/app/project.js          (懒加载项目加载/文件切换)
modified:   renderer/app/store.js            (entryRenderLimit)
modified:   renderer/export-module.js        (移除懒加载导出禁用)
modified:   renderer/styles.css              (UI 紧凑化 + 进度网格 + load-more-sentinel)
modified:   src/main/services/engine/RpgMakerAdapter.js           (listFiles/extractFile 接口)
modified:   src/main/services/engines/adapters/RpgMakerAdapter.js (listFiles/extractFile 实现)
modified:   src/main/services/engines/EngineRegistry.js           (懒加载阈值与路由)
modified:   src/main/services/project/ProjectTextService.js       (collectProjectFiles/collectFileTexts)
modified:   src/main/services/export/ExportService.js             (collectFullEntries 流式合并)
modified:   src/main/ipc/project.ipc.js      (load-project-texts 懒加载分支 + 新 IPC)
modified:   src/main/ipc/export.ipc.js      (懒加载模式下 save/export/writeback 合并)
modified:   src/preload/preload.js           (暴露新 IPC)
new file:   CHANGELOG_pending.md             (本文档)
new file:   scripts/test-lazy-load.js        (懒加载回归脚本)
unchanged:  README.md                        (与远端 v1.1.1 完全一致)
```

---

## 尚存问题与不足（待下一轮迭代）

下列问题已经过专项诊断报告，本轮**只排查、不修复**，避免改动范围失控。修复方向已写明，可按优先级推进。

### A. 非 RPG Maker 引擎打开后"无法识别 / 无文本"

**典型案例**：`Tectonia_ver1.10`（テクトニア魔境）

**性质**：非 bug，**缺适配器**。

**诊断**：
- 项目实际是 **Vahren / ヴァーレントゥーガ** 引擎（日本同人 SRPG 自制引擎）
- 决定性证据：`Vahren.exe` 主可执行文件
- 完全不含 `System.json` / `CommonEvents.json` / `Map*.json`
- 没有 `data/` / `www/data/` 目录
- 文本资源存在 `.dat` 二进制脚本文件（12+ 个）+ `language*.txt`（Shift-JIS / CRLF）

**当前工具的判定流程**：
1. `pickAdapter()` 跑 RpgMakerAdapter.detect() → confidence = 0
2. UnityAdapter.detect() → confidence = 0
3. registry 全 0 时 fallback 到 RpgMaker（v1.1.1 向后兼容设计）
4. RpgMakerAdapter.extract() → discoverDataRoots 返回空 → entries 空
5. UI 显示 "engine: unknown / 未识别"

**修复方向**：
- 新增 `VahrenAdapter`：解析 `.dat` 自定义二进制脚本 + Shift-JIS `language*.txt` 文本格式
- 同样可扩展 KiriKiri / Wolf RPG Editor / 自制引擎适配器
- README 远期目标"跨引擎拓展"已铺设 `EngineAdapter` 抽象，新增 adapter 只需实现 `detect()` / `extract()` / `writeback()` 三件套

### B. 超大 RPG Maker MV/MZ 项目导入后整体闪退

**典型案例**：`ソウルハンターノノ`（SHN）

**性质**：**真 bug**，规模处理缺陷。

**实测数据**（用 `collectProjectTexts` 在 stub Electron 环境直接跑）：

| 维度 | 数值 |
|---|---|
| 引擎识别 | RPG Maker MV/MZ（正确）|
| 总 JSON 数 | 546 |
| Map*.json 数 | 531（普通工程通常 20-50）|
| 最大单文件 | Tilesets.json 3.0MB、CommonEvents.json 2.5MB、Map022.json 1.6MB |
| 数据目录总体积 | ~53MB |
| 提取后 entry 总数 | **129,128**（普通工程通常 2K–20K）|
| extract 总耗时 | **1.289s**（主线程同步阻塞） |
| 主进程峰值堆 | 239.7MB（仅提取阶段，未含 IPC 序列化）|

**闪退最可能链路**：
1. `load-project-texts` IPC 调 `adapter.extract()` 是**完全同步**的（`fs.readFileSync × 546` + `JSON.parse × 546`）
2. 提取得到 12.9 万个 entry 对象。每个 entry 在 v1.1.1 LocalizationEntry 形状下含 30+ 字段（SHA1 哈希、context、constraints、status 等），平均 1–2KB
3. IPC 把这 12.9 万对象数组用 V8 structured clone 序列化回 renderer。序列化峰值可能再翻倍，逼近 400–500MB
4. Electron BrowserWindow V8 默认堆上限 ~2GB，但主进程默认与 renderer 共享调度，加上 Windows 上日文路径增加 fs 调用开销，任何一环 V8 alloc 失败或 IPC 超时都会触发主/渲染进程崩溃 → 整体闪退
5. 即使没崩，UI 接 12.9 万 entry 后 `buildGroupedFiles + detectGlossaryHits + renderEntryList` 也会进一步堆叠卡死，可能被 Windows DWM 当 ANR 强杀

**关键放大因素**：
- `extractMapText` 对 531 个 Map 全部递归 walk，命中所有 `code:401/102/402/101` + `extractGenericJsonText` 兜底字段提取
- v1.1.1 LocalizationEntry 每条都算 SHA1（`hashText`），12.9 万次 SHA1 同步执行额外 ~200ms CPU
- 没有任何分页 / 流式 / 过滤逻辑 —— 一次性把整个项目载完

**修复方向**（v1.3 重点）：
1. **IPC 分页**：`load-project-texts` 只返回元数据（文件列表 + 进度），按文件 `load-file-entries(fileId)` 按需拉取 ✅ **已实现**
2. **entry 序列化瘦身**：传 renderer 时去掉 hash / context.groupSource 等大字段，需要时按 ID 索取
3. **异步化提取**：`fs.readFile`（promise 版）+ `p-limit` 并发 8–16，避免主线程同步阻塞
4. **maxEntriesWarning**：超过 5 万条时弹窗提示用户"项目超大，建议分文件加载"，给用户感知
5. **内存压力监控**（可选）：`process.memoryUsage().heapUsed > 1GB` 时主动 GC 并截断

**实际实现（本轮完成）**
- 新增阈值：`LAZY_LOAD_FILE_SIZE_BYTES=512KB`、`LAZY_LOAD_TOTAL_SIZE_BYTES=50MB`、`LAZY_LOAD_TOTAL_ENTRIES=50000`
- 当项目满足任一阈值时，`load-project-texts` 改为返回 `useLazyLoad=true` + `files[]`（文件索引），不返回全部 entries
- 新增 IPC：`load-project-file-list`、`load-file-entries(rootDir, filePath)`
- 渲染端首次只加载文件列表，默认加载第一个文件；用户切换文件时按需拉取；已加载文件做缓存
- 懒加载模式下禁用跨全部文件搜索（只能搜索当前文件）
- 新增回归脚本：`scripts/test-lazy-load.js`
- SHNwin 实测：`listFiles` 20–70ms，单文件提取 15–220ms，首次内存占用从 129k 条条目降至单个文件最多约 2k 条

### 8. 懒加载模式下的完整导出/写回（v1.3 扩展）

**问题根源**
- 懒加载后前端只保留已加载文件的 entries，直接导出会导致未加载文件数据丢失。

**实现**
- 新增 `ExportService.collectFullEntries(rootDir, modifiedEntries)`：主进程一次性重新提取全部 entries，再用前端修改覆盖对应条目
- `save-draft` / `export-patch` / `apply-writeback` 三个 IPC 在 `project.useLazyLoad` 时自动走合并流程
- 前端 `export-module.js` 移除懒加载禁用提示
- SHNwin 实测：导出补丁 1.7s（仅 changed entries），保存草稿/写回 4–5s（完整 129k 条）

### 9. 条目列表虚拟化（v1.3 扩展）

**问题根源**
- 单文件条目过多（如 CommonEvents.json 1,877 条）时，一次性创建所有 row DOM 仍会卡顿。

**实现**
- 引入 `entryRenderLimit`，初始渲染 100 条
- 底部 sentinel + `IntersectionObserver`，滚动接近底部时自动增量加载 100 条
- 切换文件、搜索、跳转时重置 limit；`jumpTo` 目标索引超出当前 limit 时自动扩容

**尚存限制**
- 导出草稿/补丁/写回在懒加载模式下仍会一次性把所有 entries 读入主进程内存（约 240MB），对极大规模项目可考虑后续改为逐文件流式写入。

### 10. 游戏内快速预览（Game Preview Injector）

**业务目标**
- 在双语编辑器中选中某行译文后，一键启动游戏并直接跳到该地图/事件附近，实时查看字体、换行、排版效果，无需手动跑图。

**实现**
- 新增主进程服务 `src/main/services/preview/GamePreviewService.js`：
  - 备份 `System.json` 与被修改的 `Map*.json`（或 `CommonEvents.json`）
  - **基于文本依赖项分析**：预览当前条目时，自动把同一事件（event）内已翻译的对话、说话者、选项、分支、长文本一并写回游戏 JSON，避免只改一句而上下文仍是原文
  - 魔改 `System.json` 的 `startMapId / startX / startY`，把玩家出生点放到目标事件旁边（优先右侧一格，避免与事件重叠）
  - 通过 `child_process.spawn` 启动 `Game.exe --test` 测试模式（自带穿墙/快进）
  - 游戏退出或启动失败后自动恢复备份；支持 5 分钟过期的锁文件，防止崩溃残留导致死锁
  - 支持任意层级的 `data/` 数据目录（如 `Game/data/System.json`），优先根据 `entry.file` 与 `project.dataRoots` 推导 `System.json` 位置，而不是只认 `data/` 或 `www/data/`
- 新增 IPC：`preview-in-game`、`stop-preview`、`restore-preview-backups`、`cleanup-preview-on-startup`
- 渲染端：
  - 单条模式列表行内显示「预览」按钮（Map / CommonEvents 文件，兼容任意层级的 `data/` 目录结构，如 `Game/data/Map*.json`）
  - 上下文组模式在操作栏增加「预览」按钮，以首句为入口带动整组依赖
  - 工作区右上角增加「停止游戏预览」按钮，可强制恢复备份
  - 项目加载时自动调用 `stop-preview` 清理上次崩溃可能残留的备份
  - 界面设置 → UI 标签页新增「启用游戏内快速预览」开关，默认开启；关闭后隐藏所有预览入口
- 新增约 13 个 i18n key 到 `bootstrap.js` 三语词典

**涉及文件**
- `src/main/services/preview/GamePreviewService.js`
- `src/main/ipc/preview.ipc.js`
- `src/preload/preload.js`
- `renderer/app/controller.js`
- `renderer/app/entries.js`
- `renderer/app/project.js`
- `renderer/app/view.js`
- `renderer/app/bootstrap.js`
- `renderer/index.html`
- `renderer/styles.css`
- `src/main/ipc/ui.ipc.js`

### C. 已知次要遗留

| 问题 | 影响范围 | 风险 |
|---|---|---|
| `validateLocal` 警告 tag 文本（"第 X 行 N/M 字"）仍硬编码中文 | 单条模式 warning tag | 低，技术 UI 用户基本可读 |
| 单条模式 AI 翻译按钮 fallback message 仍硬编码 | `entries.js:1234` 单条 AI 流程 | 低 |
| RPG Maker XP / VX Ace（`.rgss2a` / `.rgss3a`）未支持 | 旧版 RM 项目 | 已在 README 远期目标中 |
| Wolf RPG Editor / KiriKiri / Ren'Py 等未支持 | 跨引擎覆盖率 | 已在 README 远期目标中 |
| 百度个人版 QPS 1（新逐条并发可能限频） | 编组翻译 5+ 条同时打百度 | 低，失败时给明确"第 N 段失败"提示，用户可降低段数重试 |

---

## 升级到 v1.2 的建议合并顺序

如果要把本地这批改动合并回 GitHub，建议按以下顺序提 PR（每个 PR 内聚、易 review）：

1. **fix(progress): 补绑跳转按钮 handler** —— 风险最低、纯 bug fix，文件改动 1 处
2. **fix(ui): 进度元信息横向网格布局** —— 纯 CSS、DOM 不变，向后兼容
3. **feat(i18n): 补全上下文组三语词典 + tf() 助手** —— 增量、无破坏性
4. **refactor(ai): 上下文组双协议自适应引擎（JSON + 逐条并发）** —— 主进程 +4 行、渲染端大改 但收敛在 `renderGroupMode` 闭包内
5. **feat(ui): 上下文组紧凑化 + 备选列表交互优化** —— 与上一项可独立但建议同发
6. **docs: 同步 README v1.2 段落 + 把本文档内容合入 CHANGELOG**

---

## 验证脚本（已有的、可用于回归）

仓库自带的 3 个冒烟脚本仍然有效，本轮改动**未破坏**任何一项：

```bash
node scripts/smoke-mainproc-require.js    # 25 个主进程模块 require 检查
node scripts/smoke-load-project.js        # load-project-texts IPC 完整链路
node scripts/smoke-writeback.js           # 提取→注入→断行→写回→断言
```

新增懒加载验证脚本：

```bash
node scripts/test-lazy-load.js "F:/フリーゲーム/ソウルハンターノノ/SHNwin"
```

建议为 v1.3 新增：

```bash
# 待开发：上下文组 JSON 协议端到端冒烟
node scripts/smoke-context-group-json.js  # mock provider + fake JSON response 全链路对齐验证
# 待开发：流式导出/写回冒烟（懒加载模式下导出完整项目）
node scripts/smoke-lazy-export.js
```
