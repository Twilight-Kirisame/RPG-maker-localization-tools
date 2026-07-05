# Changelog

本文档记录 RPG 汉化工作台每个版本的显著变更。  
v1.1 及更早版本的变更日志请参见 [README.md#更新日志](./README.md#更新日志)。

---

## v1.2 — 上下文组重构、AI 对齐引擎与大型项目懒加载

**发布日期**：2026-07-05

### 核心改进

#### 1. AI 编组翻译 · 双协议自适应对齐引擎

- **JSON 结构化协议**（OpenAI / DeepSeek / Claude / Gemini / custom）：
  - 请求体使用编号键值对 `{"1":"...", "2":"...", "N":"..."}`，渲染端可传 `responseFormat: 'json_object'`，主进程在 OpenAI 兼容路径中透传 `response_format` 强制返回 JSON。
  - 解析器按 expected keys 严格校验，缺一段即判定失败。
- **逐条并发协议**（Baidu / Google / traditional-baidu）：
  - 将编组按 `\N` 拆分为 segments，对每段独立 mask 控制码后单独调用 `aiTranslate`，`Promise.all` 并发完成，再按原 index 装回有序数组。
  - 解决传统翻译 API 无法识别 `\N`、把整段当普通字符串翻译的问题。
- **程序级 Prompt 包装器**：`buildGroupSystemPromptJson` / `buildGroupUserMessageJson` 临时拼接协议规则与 few-shot 示例，用户全局 prompt 不被污染。
- **控制码占位符保护**：发送前把 `\N[1]`、`\V[3]`、`\C[10]`、`\FS[12]` 替换为 `{{RPG_CODE_n}}`；JSON 模式先 parse 再逐 value restore，避免还原后的 `\N[1]` 破坏 JSON。bare `\N` 与 `\N[1]` 通过 `(?!\[)` 负向预查区分。
- **诊断式重试**：段数不匹配时最多重试 2 次；重试 prompt 携带上次实际返回段数与错误输出前 400 字符；HTTP / 鉴权失败立即终止；用尽重试后不把结果写回条目槽，仅在 textarea 展示由用户决策。
- **多级响应解析 fallback**：JSON → `\N` → `|||` → `---SPLIT---` → 双换行。

#### 2. 上下文组模式 · UI / 交互重构

- 原文框从只读 `<div>` 改为可编辑 `<textarea class="context-group-source-editable">`，初始以 `\N` 分隔，支持手动拆合分句。
- 阻止 click / mousedown / keydown 冒泡，避免触发外层行选中。
- AI 翻译成功后自动按对齐 segments 逐条回填 `entry.target / targetDraft`；旧手动"应用到所选"路径仍保留。
- 备选列表新增局部搜索框（按 key + source 过滤），勾选 checkbox 时保存/还原 `scrollTop` 与搜索框焦点，新增独立"回到顶部"按钮。

#### 3. 大型项目懒加载

针对 500+ Map、10 万+ entry 的超大型 RPG Maker MV/MZ 工程（实测项目 `ソウルハンターノノ`）：

- 新增阈值：
  - `LAZY_LOAD_FILE_SIZE_BYTES = 512KB`
  - `LAZY_LOAD_TOTAL_SIZE_BYTES = 50MB`
  - `LAZY_LOAD_TOTAL_ENTRIES = 50000`
- 满足任一阈值时，`load-project-texts` 返回 `useLazyLoad=true` + `files[]` 文件索引，不再一次性返回全部 entries。
- 新增 IPC：`load-project-file-list`、`load-file-entries(rootDir, filePath)`。
- 渲染端首次只加载文件列表并默认打开第一个文件；切换文件时按需拉取；已加载文件做缓存。
- 懒加载模式下禁用跨全部文件搜索（仅搜索当前文件），导出/写回给出明确提示"请先加载全部文件"。
- 新增回归脚本 `scripts/test-lazy-load.js`。
- 实测：`listFiles` 20–70ms，单文件提取 15–220ms，首次内存从 129k 条条目降至单文件最多约 2k 条。

### 其他改进

#### 进度面板与跳转按钮

- 为 `.progress-dashboard / .progress-card / .progress-actions` 新增响应式网格布局：宽屏 4 列单行，窄屏（<1280px）2×2 网格 + 按钮独占底行右对齐。
- 补绑 `gotoLastPositionBtn` / `nextPendingBtn` 的 click handler，引入通用 `jumpTo(file, idx)` 工具：
  - 自动从组模式切回单条模式；
  - 同步设置 `currentFile / currentEntryIndex / entryViewMode`；
  - 同步顶部文件下拉选择器；
  - `scrollIntoView({ behavior: 'smooth', block: 'center' })` 滚动定位；
  - "下一个未翻译"支持跨文件回环查找。

#### UI 紧凑化

- Sidebar padding、`brand` 间距、`brand-mark` 尺寸与标题字号收紧。
- `.translation-panel`、上下文组面板、预览条、分隔条等 padding / gap / min-height 全面下调。
- `.context-group-entry-list` max-height 从 `540px` 降至 `420px`，避免核心按钮被挤出视口。

#### 国际化补全

- 新增约 40 个 i18n key 到 `bootstrap.js` 三语词典（zh-CN / en / ja）：上下文组、备选列表、AI 协议反馈、传统翻译分流反馈、跳转提示等。
- 新增 `tf(key, params)` 插值助手，user-facing 字符串统一走 `t()` / `tf()`。

### 变更文件

```
modified:   renderer/app/entries.js          (核心：~600 行新增/重写；懒加载支持)
modified:   renderer/app/bootstrap.js        (i18n 三语词典补全 ~40 key + stats.files)
modified:   renderer/app/controller.js       (新增 loadFileEntries)
modified:   renderer/app/project.js          (懒加载项目加载/文件切换)
modified:   renderer/export-module.js        (懒加载模式下导出/写回保护)
modified:   renderer/styles.css              (UI 紧凑化 + 进度网格新增 ~80 行)
modified:   src/main/services/engine/RpgMakerAdapter.js           (listFiles/extractFile 接口)
modified:   src/main/services/engines/adapters/RpgMakerAdapter.js (listFiles/extractFile 实现)
modified:   src/main/services/engines/EngineRegistry.js           (懒加载阈值与路由)
modified:   src/main/services/project/ProjectTextService.js       (collectProjectFiles/collectFileTexts)
modified:   src/main/ipc/project.ipc.js      (load-project-texts 懒加载分支 + 新 IPC)
modified:   src/preload/preload.js           (暴露新 IPC)
new file:   CHANGELOG_pending.md             (详细 pending 变更说明)
new file:   CHANGELOG.md                     (本文档)
new file:   scripts/test-lazy-load.js        (懒加载回归脚本)
```

### 验证脚本

```bash
node scripts/smoke-mainproc-require.js    # 25 个主进程模块 require 检查
node scripts/smoke-load-project.js        # load-project-texts IPC 完整链路
node scripts/smoke-writeback.js           # 提取→注入→断行→写回→断言
node scripts/test-lazy-load.js "/path/to/large-rpg-project"   # 懒加载回归
```

### 已知问题与后续方向

- **非 RPG Maker 引擎**：`Tectonia_ver1.10` 等 Vahren / 自制引擎项目仍缺适配器，打开后显示未识别或 entries 为空。v1.3 方向是新增 VahrenAdapter 等。
- **懒加载导出/写回**：完整流式导出尚未实现，当前仅给出明确提示。
- **单文件条目过多**：如 `CommonEvents.json` 1,877 条时渲染仍可能轻微卡顿。
- **单条模式 AI 翻译 fallback message** 与 `validateLocal` 警告 tag 仍少量硬编码中文，不影响功能。

---

## v1.1.1 — 合并修复与回归保护

**发布日期**：见 README.md 更新日志。

- 修复 git 合并后 8 个文件残留的 conflict markers。
- entry 形状升级到 LocalizationEntry，新增 `adapterMeta`、`textClass`、`textType`、`semanticRole`、`groupId`、`context`、`constraints`、`progress`、`status`、`hash` 等字段；Writeback / Validator / TranslationService / smoke 全部兼容新旧形状。
- 新增 `scripts/smoke-mainproc-require.js` 与 `scripts/smoke-load-project.js` 两个不依赖 Electron 的冒烟脚本。

## v1.1 — 本地化全链路升级

**发布日期**：见 README.md 更新日志。

- 术语库 AI 注入（replace / prompt）。
- AI 译文哈希缓存（LRU 10k、每项目独立 JSON、debounce 写盘）。
- AI 译文自动断行（CJK / ASCII 标点 → 空格 → 硬切）。
- `EngineConstraints` + `EntryValidator` 校验行宽 / 行数 / 控制码。
- `apply-writeback` IPC 真实写回原始 JSON 深克隆到 `localization_patch/data/`，不覆盖原文件。
- `EngineAdapter` 接口 + `RpgMakerAdapter` + `UnityAdapter` 占位；`registry.pickAdapter()` 自动选择。
- 双语编辑器：文件下拉百分比、单条/上下文组显示模式、warning tag、设置面板开关。
- 恢复 stable / test 双轨打包与 `打包发布版.bat`。
- 新增 `scripts/smoke-writeback.js` 与 `assets/test-projects/mv-mini/`。
