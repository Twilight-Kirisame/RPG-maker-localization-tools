# RPG 汉化工作台

> 面向 RPG Maker MV / MZ 项目的桌面端本地化辅助工具。  
> 支持项目识别、文本提取、双语编辑、术语库管理、AI/传统翻译辅助、草稿保存与补丁导出。

[![Electron](https://img.shields.io/badge/Electron-42.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-CommonJS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Windows](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](#license)

---

## 更新日志

### v1.1.1 — 合并修复与回归保护

- 修复 git 合并后 8 个文件残留的 conflict markers（`<<<<<<<` / `=======` / `>>>>>>>`）导致 `.bat` 闪退、Electron 主进程因 `appStoragePath is not defined` 抛出 ReferenceError、`project.js` 因括号失配 `node --check` 失败等问题。
- entry 形状升级到 LocalizationEntry（顶层 `code` / `kind` 改入 `adapterMeta.code` / `adapterMeta.kind`、新增 `textClass` / `textType` / `semanticRole` / `groupId` / `context` / `constraints` / `progress` / `status` / `hash` 等字段）。Writeback / Validator / TranslationService / smoke 全部加 `codeOf / kindOf / pathOf` helper，新旧形状双兼容读取。
- 新增两个不依赖 Electron 即可跑的冒烟脚本：
  - `node scripts/smoke-mainproc-require.js` — stub Electron 后 require 全部 25 个主进程模块，杜绝再出"运行时缺导入"
  - `node scripts/smoke-load-project.js` — 复刻 `load-project-texts` IPC 流程，验证适配器派发 → 提取 → 术语库 → AI 设置 → 草稿套回 → 进度统计的完整链路

### v1.1 — 本地化全链路升级

工具从「文本替换助手」升级为「本地化资源生命周期工具」，核心改动如下。

**翻译链路（src/main/services/translation/）**
- **术语库 AI 注入**：在调用 AI 翻译前主动介入，命中术语后按用户选择走「强制替换原文」或「注入 System Prompt（要求 AI 遵守对照表）」。设置面板新增三态单选，默认 `off`，空术语库时所有模式 no-op。
- **AI 译文哈希缓存**：以 `sha1(provider|model|systemPrompt|source)` 为键、每项目独立 JSON 文件持久化（LRU 10k 条，debounce 800ms 写盘）。同源文重复翻译命中缓存、零 token 消耗；切 provider / model / prompt 自动失效。文件路径：`userData/projects/<slug>.translation-cache.json`。`mock` 模式不进缓存。
- **AI 译文自动断行**：拿到 AI 译文后，对话框（`code:401`）若超过引擎约束（默认 28 字 / 行、4 行），按 CJK 标点 → ASCII 标点 → 空格 → 硬切优先级自动拆分，并在写回时拆为多条同 indent 的 `code:401`，避免游戏内文本被截断。

**校验（src/main/services/validation/）**
- `EngineConstraints.js`：按引擎 + 文本类型（对话 / 选项 / 系统等）维护行宽、行数、是否保留控制码的约束。
- `EntryValidator.js`：翻译/编辑时校验译文行宽、行数、控制码缺失，把 warning 字段挂到 entry。前端实时按键校验、超长行边框转红 + warning tag。

**写回（src/main/services/export/RpgMakerWriteback.js）**
- 新增 `apply-writeback` IPC，把当前所有翻译按 `entry.path`（如 `events[2].pages[0].list[12].parameters[0]`）回填到原始 JSON 的深克隆，输出到 `<rootDir>/localization_patch/data/`，**绝不就地覆盖原文件**。
- 自动处理 `code:101/401/102/402` 与 system/database 字段的不同写入方式。
- 多行 `code:401` 反向遍历 list 数组插入，保留原 indent 与后续命令位置。
- 路径越界/不存在路径会落到错误报告，不打断整体 apply。
- 工作区新增「写回游戏 JSON」按钮。

**适配器层（src/main/services/engine/）**
- 新增 `EngineAdapter` 接口契约 + `assertAdapter()` 运行时校验。
- `RpgMakerAdapter` 封装现有 `ProjectTextService` 与 `RpgMakerWriteback`。
- `UnityAdapter` 占位：识别 `*_Data/` + `UnityPlayer.dll` / `Assembly-CSharp.dll`，提取返回空 + 提示尚未实现。
- `registry.pickAdapter(rootDir)` 按 detect 置信度自动选择，未识别时回退 RpgMaker（向后兼容）。
- `load-project-texts` 与 `apply-writeback` 全部走 registry。

**双语编辑器 UI**
- 项目状态 / 工作区智能同步：开新项目时合并旧状态、避免覆盖式刷新；切换不同项目时清空遗留 `currentFile/currentEntryIndex` 等。
- JSON 文件下拉显示**每文件翻译百分比**（`Map001.json (12/30 · 40%)`），新增右侧百分比徽标（done/partial/pending 三态着色）；输入译文时实时刷新。
- 文本行 layout 从 Grid 切到 Flex，彻底解决嵌套 grid + `minmax(0,1fr)` + textarea 造成的单字竖排。
- 单条/上下文组**显示模式**完整恢复。上下文组勾选行重构成 2 行栅格（第 1 行：checkbox + 源文，第 2 行：meta 右对齐 + 省略号），杜绝元数据与源文抢宽度。
- 上下文组分隔符 `---SPLIT---` → `\N`（短，避免冗长）；在译文框直接输入 `\N` 即时触发预览分行；预览条点击插入 / 移除 `\N`；正则负向预查 `\\N(?!\[)` 兼容 RPG Maker `\N[1]` 角色名引用、不会误切；旧草稿 `---SPLIT---` 仍向后兼容。
- 行内 warning tag：`line-too-long` / `too-many-lines` / `control-char-missing`；行带 `has-warnings` class 时整行高亮。
- 设置 / LLM 面板新增「术语库自动注入模式」「译文自动断行」开关，写入 `ai-settings.json`。

**构建 / 工具链**
- 恢复 stable / test 双线打包：
  - `npm run dist` / `npm run pack`：稳定版 → `dist/`
  - `npm run dist:test` / `npm run pack:test`：测试版（自动改 `productName` 为「RPG汉化工作台-测试版」）→ `dist-test/`
  - `打包发布版.bat` 启动后给出菜单选择 stable / test。
- 新增端到端冒烟脚本 `scripts/smoke-writeback.js`，不依赖 Electron 即可 `node scripts/smoke-writeback.js` 跑通：提取 → 术语注入 → 自动断行 → 写回 → 断言原 fixture 字节级未变 + 输出 JSON 结构正确。
- 新增测试 fixture `assets/test-projects/mv-mini/`（最小 RPG Maker MV 工程），仅供冒烟使用，不参与运行时。

---

## 项目简介

**RPG 汉化工作台**是一个为 RPG Maker 游戏汉化流程设计的 Electron 桌面应用。它的目标是把 RPG Maker 项目中的可翻译文本集中提取出来，以更接近翻译工作台的方式进行整理、编辑、术语维护和导出。

目前项目重点支持 **RPG Maker MV / MZ** 常见项目结构。除了识别标准的 `data/` 与 `www/data/` 目录，也支持主动扫描项目目录，自动发现包含 `System.json`、`CommonEvents.json`、`Map*.json` 等 RPG Maker 数据特征的实际文本数据目录，并从地图事件、公共事件、系统词条、数据库对象等内容中提取文本。

项目当前以 **Windows portable exe** 为主要发布形式，同时保留 Node.js / Electron 开发运行方式，便于后续维护和二次开发。

---

## 主要功能

### 已实现功能

- **RPG Maker 项目识别**
  - 自动检测 RPG Maker MV / MZ 项目目录。
  - 支持识别 `data/` 与 `www/data/` 数据目录。
  - 支持主动扫描文本位置，递归发现非标准目录中的 RPG Maker 数据文件。
  - 可显示实际发现的数据目录，方便确认文本来源位置。
  - 显示项目路径、引擎状态和文本统计信息。

- **文本提取与双语编辑**
  - 从 RPG Maker JSON 文件中提取可翻译文本。
  - 支持地图事件、公共事件、选项、系统词条、数据库字段等文本来源。
  - 提供原文 / 译文双栏编辑体验（Flex 布局，CJK 自适应）。
  - 支持按 JSON 文件分组查看，下拉显示每文件 `translated/total · percent%` 实时进度。
  - 支持关键词搜索过滤。
  - 支持译文状态切换与翻译进度统计（输入即时刷新）。
  - 支持**单条模式**与**上下文行模式**双形态。

- **上下文行模式（多行合并翻译）**
  - 可勾选多条相邻文本组成一个上下文组，整段送 AI 翻译。
  - 译文回写时按 `\N`（短分隔符）→ 换行 → 百分比顺序自动拆分回原条目。
  - 在译文框直接输入 `\N` 即可触发预览分行；行间分隔条点击插入 / 移除 `\N`。
  - 正则负向预查 `\\N(?!\[)` 保证 `\N[1]` 等 RPG Maker 角色名引用不会被误切。
  - 旧草稿里的 `---SPLIT---` 标记仍向后兼容。

- **术语库管理 + AI 注入闭环**
  - 支持项目级术语库的新建、切换、重命名、删除、增删改查。
  - 支持术语库导入与导出。
  - 编辑文本时可查看术语命中并辅助插入译文。
  - **AI 翻译前自动介入**：命中术语后按用户选择走「强制替换原文」或「注入 System Prompt」，杜绝大模型译名漂移并显著降低 token 消耗。
  - 设置面板三态单选：不使用 / 强制替换 / Prompt 注入；空术语库时所有模式 no-op。

- **AI 译文哈希缓存（断点续传 / 零成本重译）**
  - 以 `sha1(provider|model|systemPrompt|source)` 为键、每项目独立 JSON 文件持久化。
  - 同原文重复翻译命中缓存、零 token 消耗。
  - 切换 provider / model / prompt 自动 cache miss，避免污染。
  - LRU 10k 条上限、debounce 写盘，断网/重启后无缝续传。

- **译文超长警示 + 自动断行**
  - 按引擎 + 文本类型（对话框 / 选项 / 系统等）维护行宽 / 行数约束。
  - 编辑时实时校验译文，超长 / 缺控制码自动出现 warning tag、整行红色边框高亮。
  - 大模型译文若超出对话框约束，自动按 CJK 标点 → ASCII 标点 → 空格 → 硬切顺序拆分为多行。
  - 写回阶段把拆分后的对话拆成多条同 indent 的 `code:401`，防止游戏内文本截断 / 死机。

- **草稿与补丁导出 + 真实写回**
  - 支持将当前翻译进度导出为草稿文件。
  - 支持从草稿恢复翻译进度。
  - 支持导出可回写的补丁清单。
  - **新增写回游戏 JSON**：按 `entry.path` 把译文逐字段写回原始 JSON 的深克隆，输出到 `<rootDir>/localization_patch/data/`，**绝不就地覆盖原文件**；自动处理 `code:101/401/102/402` 与 system / database 不同字段；多行 401 反向遍历插入、保留 indent 与后续命令位置；路径越界 / 不存在路径落到错误报告，不打断整体 apply。

- **翻译辅助 / 多提供方**
  - 支持 mock 模式，便于无 API Key 时测试流程。
  - 支持 OpenAI 兼容接口 / DeepSeek 等大模型接口配置。
  - 支持百度翻译 API。
  - 预留传统翻译与大模型翻译的统一设置入口。
  - 翻译设置按项目保存在本地、不写入仓库。

- **引擎适配器抽象**
  - 主进程引入 `EngineAdapter` 接口契约。
  - `RpgMakerAdapter` 封装现有提取与写回链路。
  - `UnityAdapter` 占位：能识别 Unity 项目目录（`*_Data/` + `UnityPlayer.dll` / `Assembly-CSharp.dll`），提取阶段返回空 + 提示尚未实现，为后续 Unity 文本支持铺路。
  - `registry.pickAdapter()` 按 detect 置信度自动选择适配器、未识别时回退 RpgMaker（向后兼容）。

- **界面与使用体验**
  - Electron 桌面端应用。
  - 支持中文、英文、日文界面字典。
  - 支持深色 / 浅色 / 跟随系统主题。
  - 支持多套主题色。
  - 支持自定义背景图。
  - 提供操作追踪信息，便于排查按钮和 IPC 调用状态。
  - 项目状态 / 工作区状态智能同步：切换不同项目时清空遗留 `currentFile/currentEntryIndex` 等。

---

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 桌面框架 | Electron |
| 运行环境 | Node.js |
| 模块系统 | CommonJS |
| 前端界面 | 原生 HTML / CSS / JavaScript |
| 主进程服务 | Node.js 文件系统与 Electron IPC |
| 打包工具 | electron-builder |
| 目标平台 | Windows portable exe |

本项目目前没有使用 React、Vue、Vite、Webpack 等前端框架或构建链。渲染层以原生浏览器 API 编写，主进程以 CommonJS 模块组织。

---

## 快速开始

### 环境要求

- Windows 10 / 11
- Node.js 18 或更高版本
- npm

建议使用较新的 Node.js LTS 版本。

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
npm start
```

或：

```bash
npm run dev
```

这两个命令都会以 Electron 开发方式启动应用。

---

## 打包发布

### 一键交互式打包（推荐）

双击运行项目根目录的 `打包发布版.bat`，菜单选择：

```
1. Build stable release  (dist/)
2. Build test release    (dist-test/)
```

脚本会自动安装依赖（如缺失）、清理旧构建残留、调用对应 npm 脚本、产出可分发的 portable exe。

### 命令行打包

| 命令 | 输出位置 | 用途 |
| --- | --- | --- |
| `npm run dist`      | `dist/`      | **稳定版**：`RPG汉化工作台` |
| `npm run dist:test` | `dist-test/` | **测试版**：`RPG汉化工作台-测试版`（与稳定版安装目录、注册键、用户数据完全独立，方便同机并存对比） |
| `npm run pack`      | `dist/`      | 稳定版未打包目录（调试用） |
| `npm run pack:test` | `dist-test/` | 测试版未打包目录（调试用） |

测试版与稳定版的隔离依靠 electron-builder 的 `--config.extraMetadata.name=rpg-localization-workbench-test` 与 `--config.productName` 覆写实现，互不污染各自的 userData 目录与缓存。

### 打包配置

```json
{
  “build”: {
    “asar”: true,
    “files”: [
      “main.js”,
      “preload.js”,
      “src/**/*”,
      “renderer/**/*”,
      “assets/**/*”,
      “package.json”
    ],
    “directories”: {
      “output”: “dist”
    },
    “win”: {
      “signAndEditExecutable”: false,
      “target”: [“portable”]
    },
    “extraMetadata”: {
      “name”: “rpg-localization-workbench”
    }
  }
}
```

`assets/test-projects/mv-mini/` 与 `scripts/smoke-writeback.js` 不在 `files` 白名单里，**不会**被打进 exe，仅供开发期冒烟。

---

## 项目结构

```text
RPG localization/
├── main.js                         # Electron 主入口桥接文件
├── preload.js                      # Electron preload 桥接文件
├── package.json                    # 项目元信息、脚本、electron-builder 配置
├── package-lock.json               # npm 依赖锁定文件
├── README.md                       # 项目说明文档
├── 打包发布版.bat                  # 交互式打包脚本（菜单选择 stable / test）
├── scripts/
│   └── smoke-writeback.js          # 端到端冒烟（不依赖 Electron）：提取→注入→断行→写回→断言
├── assets/
│   └── test-projects/
│       └── mv-mini/                # 最小 RPG Maker MV 测试 fixture（仅供冒烟）
│           └── data/{System,CommonEvents,Map001,Items}.json
├── src/
│   ├── main/
│   │   ├── main.js                 # Electron 主进程启动逻辑
│   │   ├── appWindow.js            # BrowserWindow 创建与窗口配置
│   │   ├── ipc/
│   │   │   ├── index.js            # IPC 注册入口
│   │   │   ├── project.ipc.js      # 项目选择 / 识别 / 文本加载 IPC（走 adapter registry）
│   │   │   ├── glossary.ipc.js     # 术语库管理 IPC
│   │   │   ├── export.ipc.js       # 草稿、补丁导出与 apply-writeback IPC
│   │   │   ├── translation.ipc.js  # 翻译设置 / 调用 / 校验 IPC
│   │   │   └── ui.ipc.js           # UI 设置 IPC
│   │   ├── services/
│   │   │   ├── engine/                              # 引擎适配器层（v1.1 新增）
│   │   │   │   ├── EngineAdapter.js                 # 接口契约 + assertAdapter 运行时校验
│   │   │   │   ├── RpgMakerAdapter.js               # RPG Maker MV/MZ 适配器
│   │   │   │   ├── UnityAdapter.js                  # Unity 占位适配器
│   │   │   │   └── registry.js                      # 按 detect 置信度自动选择
│   │   │   ├── project/
│   │   │   │   └── ProjectTextService.js            # RPG Maker 文本提取实现
│   │   │   ├── glossary/
│   │   │   │   └── GlossaryService.js               # 术语库 CRUD / 导入导出 / 命中检测
│   │   │   ├── translation/
│   │   │   │   ├── TranslationService.js            # AI / 传统翻译统一入口
│   │   │   │   ├── GlossaryInjector.js              # 术语 AI 注入（replace / prompt）— v1.1
│   │   │   │   ├── TranslationCache.js              # SHA1 LRU JSON 缓存 — v1.1
│   │   │   │   └── AutoSplit.js                     # 译文自动断行（标点优先） — v1.1
│   │   │   ├── validation/                          # 译文校验层 — v1.1
│   │   │   │   ├── EngineConstraints.js             # 行宽 / 行数 / 控制码保留约束
│   │   │   │   └── EntryValidator.js                # 单条 entry 校验、产出 warning 数组
│   │   │   ├── export/
│   │   │   │   ├── ExportService.js                 # 草稿保存 / 加载 / 补丁清单
│   │   │   │   └── RpgMakerWriteback.js             # 真实写回原始 JSON — v1.1
│   │   │   └── storage/
│   │   │       └── StorageService.js                # 项目级本地存储路径
│   │   └── utils/
│   │       └── fsUtils.js          # 文件系统工具函数
│   └── preload/
│       └── preload.js              # 暴露安全的 renderer API（含 applyWriteback / validateEntry）
├── renderer/
│   ├── index.html                  # 应用主页面
│   ├── styles.css                  # 全局样式
│   ├── renderer.js                 # 渲染层总协调逻辑
│   ├── export-module.js            # 导出 / 写回交互逻辑
│   └── app/
│       ├── bootstrap.js            # i18n、全局 UI 辅助初始化
│       ├── store.js                # 前端状态管理
│       ├── view.js                 # 主题、语言、基础视图逻辑
│       ├── controller.js           # 应用控制器与主流程协调
│       ├── entries.js              # 文本条目列表、编辑器、上下文行模式、本地校验
│       ├── project.js              # 项目打开 / 状态智能同步
│       └── glossary.js             # 术语库管理界面逻辑
├── dist/                           # stable 打包输出目录
└── dist-test/                      # test 打包输出目录
```

---

## 使用流程

1. 启动应用。
2. 点击 **打开游戏项目**。
3. 选择 RPG Maker MV / MZ 项目根目录。
4. 程序会自动识别 `data/`、`www/data/` 或其他包含 RPG Maker 数据特征的目录。
5. 如果项目文本没有出现在标准目录中，可点击 **扫描文本位置** 主动搜索实际数据目录。
6. 在工作区中查看并编辑原文 / 译文。
7. 可选：打开 **术语库管理**，维护项目术语；可新建、切换、重命名、删除、导入、导出术语库。
8. 可选：在 **设置** 中配置翻译接口。
9. 翻译过程中可随时导出草稿。
10. 完成后点击 **导出补丁**，生成可回写的补丁目录。

---

## 支持的文本来源

当前文本提取逻辑重点覆盖以下 RPG Maker 数据：

- `System.json`
  - 游戏标题
  - 货币单位
  - 系统指令词
  - 基础术语
  - 系统消息

- 数据库 JSON
  - 角色、职业、技能、物品、武器、防具、敌人、状态等常见对象字段
  - `name`
  - `description`
  - `profile`
  - `message1` / `message2` / `message3`

- 地图与公共事件
  - 显示文本指令
  - 选项文本
  - 事件页中的文本内容

后续会继续扩展对更多事件指令、插件数据和特殊字段的识别。

---

## 翻译接口说明

项目目前包含以下翻译辅助方向：

- Mock 翻译模式（不进缓存，便于调试）
- OpenAI 兼容大模型接口
- DeepSeek 等兼容 OpenAI API 风格的模型服务
- 百度翻译 API
- 传统翻译服务配置入口

### 调用前介入

每次 AI 调用前，工作台会主动跑下面这条流水：

```
原文 → [术语注入]（off / replace / prompt 任一）
     → [哈希缓存查询]（命中即返回，零 token）
     → [provider 实际请求]
     → [自动断行]（仅 code:401，若启用）
     → [校验]（行宽 / 行数 / 控制码）
     → 译文返回 renderer
```

- **术语注入**：命中术语后按用户配置在原文里直接替换，或把对照表追加到 System Prompt。
- **哈希缓存**：以 `sha1(provider | model | systemPrompt | source)` 为键，按项目持久化（LRU 10k 条）。同源文重复翻译命中缓存、网络中断后重启可断点续传。
- **自动断行**：对话框译文超出引擎约束时按 CJK 标点 → ASCII 标点 → 空格 → 硬切顺序自动拆分；写回阶段拆为多条同 indent 的 `code:401`。
- **校验**：超长 / 缺控制码会进 entry.warnings，前端实时高亮。

API Key、模型、Base URL、提示词、术语注入模式、自动断行开关等配置都按项目保存在本地（`userData/projects/<slug>.ai-settings.json`），不会写入源码仓库。翻译缓存独立文件（`userData/projects/<slug>.translation-cache.json`）。

上传 GitHub 时请注意不要提交任何真实密钥、账号配置或私人项目数据。

---

## GitHub 上传建议

建议提交：

```text
main.js
preload.js
package.json
package-lock.json
README.md
src/
renderer/
```

建议忽略：

```text
node_modules/
dist/
*.log
.env
*.local
.DS_Store
Thumbs.db
```

推荐 `.gitignore`：

```gitignore
node_modules/
dist/
*.log
.env
.env.*
*.local
.DS_Store
Thumbs.db
.vscode/
.idea/
*.zip
*.7z
*.rar
*.exe
*.msi
```

如果仓库中需要保留 VS Code / Cursor 的共享配置，可按需移除 `.vscode/` 忽略项。

---

## 开发脚本

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm start` | 启动 Electron 应用 |
| `npm run dev` | 开发模式启动，当前等同于 `npm start` |
| `npm run pack` | 打包为 Windows unpacked 目录（稳定版） |
| `npm run pack:test` | 打包为 Windows unpacked 目录（测试版，输出到 `dist-test/`） |
| `npm run dist` | 打包为 Windows portable exe（稳定版） |
| `npm run dist:test` | 打包为 Windows portable exe（测试版） |
| `npm run lint` | 当前为占位命令 |
| `node scripts/smoke-writeback.js` | 端到端冒烟：提取 → 术语注入 → 自动断行 → 写回 fixture → 12 项断言；不依赖 Electron 运行时，可入 CI |
| `node scripts/smoke-mainproc-require.js` | stub Electron 后 require 全部主进程模块，确保启动期没有缺失 import / 循环依赖 |
| `node scripts/smoke-load-project.js` | 直接模拟 `load-project-texts` IPC 完整流程（含适配器派发 / 术语库 / AI 设置 / 进度统计） |

---

## 当前限制

- 当前主要面向 Windows 桌面环境。
- 当前打包目标为 Windows portable exe。
- **引擎支持**：当前仅 RPG Maker MV / MZ 适配器是完整可用的。Unity 适配器是占位（仅识别、不提取）。**RPG Maker XP / VX Ace（`.rgss2a` / `.rgss3a` 封包）、Wolf RPG Editor、Vahren / ヴァーレントゥーガ、KiriKiri、自制引擎**等暂未支持，打开后会显示「未识别」或回退到 RPG Maker 适配器后扫不到 `data/*.json`。
- **大型 MV/MZ 项目可能造成主进程堆内存峰值过高**：例如 500+ Map JSON、文本提取超过 ~10 万条条目时，IPC 返回 payload 可能 200MB+，在 Electron BrowserWindow 默认 V8 堆下偶发崩溃。后续会引入分页 / 流式 / 索引化加载缓解。
- 文本提取规则仍以 RPG Maker MV / MZ 常见 JSON 结构为主。
- 插件自定义数据、复杂脚本内字符串、特殊加密/封包项目暂未完整覆盖。
- 当前界面使用原生 JavaScript，随着功能增长，后续可能需要更系统的模块化或框架化重构。

---

## 远期开发目标

### 文本提取能力

- 扩展更多 RPG Maker 事件指令的识别。
- 支持插件参数中的可翻译文本提取。
- 支持更精细的上下文信息，例如地图名、事件名、事件页、角色名等。
- 支持重复文本合并与复用翻译（v1.1 通过哈希缓存部分覆盖）。
- 支持文本差异检测，便于游戏版本更新后的增量汉化。
- **跨引擎拓展**：v1.1 已铺设 EngineAdapter 抽象 + Unity 占位，后续可加 RPG Maker VX Ace / XP、Unity I18N.csv / TextMeshPro、Ren'Py 等真实适配器。

### 翻译工作流

- 增加批量翻译队列。
- 支持多模型翻译结果对比。
- ~~支持术语强制约束与 prompt 自动注入。~~ ✅ v1.1 已完成（GlossaryInjector）
- ~~AI 译文超长保护与自动断行。~~ ✅ v1.1 已完成（AutoSplit）
- ~~AI 译文哈希缓存与断点续传。~~ ✅ v1.1 已完成（TranslationCache）
- ~~写回原始 JSON。~~ ✅ v1.1 已完成（RpgMakerWriteback）
- 支持人工校对状态、锁定状态、审核状态（v1.1 已有 `translated/pending` 与 `warnings` 通道，可扩展）。
- 支持翻译记忆库 TM（v1.1 翻译缓存可视作前身）。
- 支持导入/导出 CSV、XLSX、TMX 等格式。

### 工程与发布

- ~~冒烟脚本入门。~~ ✅ v1.1 已完成（`scripts/smoke-writeback.js`）
- ~~test / stable 双轨打包。~~ ✅ v1.1 已恢复
- 增加完整自动化测试。
- 增加 GitHub Actions 自动构建 Windows release。
- 增加版本号自动更新与 changelog 自动生成。
- 增加安装包目标，例如 NSIS installer。
- 探索 macOS / Linux 支持。

### 用户体验

- 优化长列表性能。
- 增加撤销/重做。
- 增加快捷键。
- 增加过滤器：未翻译、已翻译、术语命中、包含控制符等。
- ~~增加导出前校验报告。~~ ✅ v1.1 已完成（EntryValidator + has-warnings 实时显示）
- ~~JSON 文件维度的翻译百分比统计。~~ ✅ v1.1 已恢复（文件下拉与右侧百分比徽标）
- 增加项目最近打开列表。

---

## 贡献方式

欢迎以 issue 或 pull request 的形式参与改进。

建议贡献方向：

- 新增 RPG Maker 文本提取规则。
- 修复特定游戏项目的兼容性问题。
- 改进术语库和翻译记忆功能。
- 改进 AI 翻译 prompt 与批量翻译流程。
- 补充文档、截图和示例项目。
- 增加测试与自动构建流程。

提交问题时建议附带：

- RPG Maker 版本或项目结构说明。
- 出现问题的 JSON 文件类型。
- 复现步骤。
- 控制台或操作追踪中的错误信息。

请不要上传含版权争议的完整商业游戏资源。

---

## License

- MIT License

在许可证确定前，请默认视为“保留所有权利”。

---

## 致谢

本项目面向 RPG Maker 汉化工作流中的重复劳动与术语一致性问题，希望能为个人汉化、同人翻译和小型本地化团队提供一个更轻量、可控、可扩展的桌面工具。
