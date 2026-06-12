# RPG 汉化工作台

> 面向 RPG Maker MV / MZ 项目的桌面端本地化辅助工具。  
> 支持项目识别、文本提取、双语编辑、术语库管理、AI/传统翻译辅助、草稿保存与补丁导出。

[![Electron](https://img.shields.io/badge/Electron-42.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-CommonJS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Windows](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-TBD-lightgrey)](#license)

---

## 项目简介

**RPG 汉化工作台**是一个为 RPG Maker 游戏汉化流程设计的 Electron 桌面应用。它的目标是把 RPG Maker 项目中的可翻译文本集中提取出来，以更接近翻译工作台的方式进行整理、编辑、术语维护和导出。

目前项目重点支持 **RPG Maker MV / MZ** 常见项目结构，能够识别 `data/` 或 `www/data/` 目录中的 JSON 数据文件，并从地图事件、公共事件、系统词条、数据库对象等内容中提取文本。

项目当前以 **Windows portable exe** 为主要发布形式，同时保留 Node.js / Electron 开发运行方式，便于后续维护和二次开发。

---

## 主要功能

### 已实现功能

- **RPG Maker 项目识别**
  - 自动检测 RPG Maker MV / MZ 项目目录。
  - 支持识别 `data/` 与 `www/data/` 数据目录。
  - 显示项目路径、引擎状态和文本统计信息。

- **文本提取与双语编辑**
  - 从 RPG Maker JSON 文件中提取可翻译文本。
  - 支持地图事件、公共事件、选项、系统词条、数据库字段等文本来源。
  - 提供原文 / 译文双栏编辑体验。
  - 支持按 JSON 文件分组查看。
  - 支持关键词搜索过滤。
  - 支持译文状态切换与翻译进度统计。

- **术语库管理**
  - 支持项目级术语库。
  - 支持新建、切换、删除术语库。
  - 支持添加、编辑、删除、搜索术语。
  - 支持术语库导入与导出。
  - 编辑文本时可查看术语命中并辅助插入译文。

- **草稿与补丁导出**
  - 支持将当前翻译进度导出为草稿文件。
  - 支持从草稿恢复翻译进度。
  - 支持导出可回写 RPG Maker 项目的补丁目录。

- **翻译辅助**
  - 支持 AI 翻译设置保存。
  - 支持 OpenAI 兼容接口 / DeepSeek 等大模型接口配置。
  - 支持 mock 模式，便于无 API Key 时测试流程。
  - 支持百度翻译接口配置。
  - 预留传统翻译与大模型翻译的统一设置入口。

- **界面与使用体验**
  - Electron 桌面端应用。
  - 支持中文、英文、日文界面字典。
  - 支持深色 / 浅色 / 跟随系统主题。
  - 支持多套主题色。
  - 支持自定义背景图。
  - 提供操作追踪信息，便于排查按钮和 IPC 调用状态。

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

### 生成 Windows portable exe

```bash
npm run dist
```

打包结果默认输出到：

```text
dist/
```

当前 `package.json` 中的打包配置为：

```json
{
  "build": {
    "asar": true,
    "files": [
      "main.js",
      "preload.js",
      "src/**/*",
      "renderer/**/*",
      "package.json"
    ],
    "directories": {
      "output": "dist"
    },
    "win": {
      "signAndEditExecutable": false,
      "target": ["portable"]
    }
  }
}
```

也就是说，新生成的 exe 只会包含以下运行必需内容：

- `main.js`
- `preload.js`
- `src/`
- `renderer/`
- `package.json`

不会被打进 exe 的内容包括：

- `node_modules/`
- `dist/`
- `.git/`
- 开发说明文件
- 打包脚本
- 临时文件

但这些文件仍可能对开发、安装依赖、重新打包或发布维护有用，不应简单等同于“无用文件”。

---

## 项目结构

```text
RPG localization/
├── main.js                         # Electron 主入口桥接文件
├── preload.js                      # Electron preload 桥接文件
├── package.json                    # 项目元信息、脚本、electron-builder 配置
├── package-lock.json               # npm 依赖锁定文件
├── README.md                       # 项目说明文档
├── src/
│   ├── main/
│   │   ├── main.js                 # Electron 主进程启动逻辑
│   │   ├── appWindow.js            # BrowserWindow 创建与窗口配置
│   │   ├── ipc/
│   │   │   ├── index.js            # IPC 注册入口
│   │   │   ├── project.ipc.js      # 项目选择、识别、文本加载 IPC
│   │   │   ├── glossary.ipc.js     # 术语库管理 IPC
│   │   │   ├── export.ipc.js       # 草稿与补丁导出 IPC
│   │   │   └── translation.ipc.js  # 翻译设置与翻译调用 IPC
│   │   ├── services/
│   │   │   ├── project/
│   │   │   │   └── ProjectTextService.js      # RPG Maker 项目识别与文本提取
│   │   │   ├── glossary/
│   │   │   │   └── GlossaryService.js         # 术语库读写与导入导出
│   │   │   ├── export/
│   │   │   │   └── ExportService.js           # 草稿保存、加载与补丁导出
│   │   │   ├── storage/
│   │   │   │   └── StorageService.js          # 项目级本地存储路径
│   │   │   └── translation/
│   │   │       └── TranslationService.js      # AI / 传统翻译设置与调用
│   │   └── utils/
│   │       └── fsUtils.js          # 文件系统工具函数
│   └── preload/
│       └── preload.js              # 暴露安全的 renderer API
├── renderer/
│   ├── index.html                  # 应用主页面
│   ├── styles.css                  # 全局样式
│   ├── renderer.js                 # 渲染层总协调逻辑
│   ├── export-module.js            # 导出相关渲染逻辑
│   └── app/
│       ├── bootstrap.js            # i18n、全局 UI 辅助初始化
│       ├── store.js                # 前端状态管理
│       ├── view.js                 # 主题、语言、基础视图逻辑
│       ├── controller.js           # 应用控制器与主流程协调
│       ├── entries.js              # 文本条目列表、编辑器、翻译辅助
│       ├── project.js              # 项目打开与加载流程
│       └── glossary.js             # 术语库管理界面逻辑
└── dist/                           # 打包输出目录，通常不提交到 Git
```

---

## 使用流程

1. 启动应用。
2. 点击 **打开游戏项目**。
3. 选择 RPG Maker MV / MZ 项目根目录。
4. 程序自动识别 `data/` 或 `www/data/` 下的 JSON 文件。
5. 在工作区中查看并编辑原文 / 译文。
6. 可选：打开 **术语库管理**，维护项目术语。
7. 可选：在 **设置** 中配置翻译接口。
8. 翻译过程中可随时导出草稿。
9. 完成后点击 **导出补丁**，生成可回写的补丁目录。

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

- Mock 翻译模式
- OpenAI 兼容大模型接口
- DeepSeek 等兼容 OpenAI API 风格的模型服务
- 百度翻译 API
- 传统翻译服务配置入口

API Key、模型、Base URL、提示词等配置会按项目保存在本地，不会写入源码仓库。

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
```

如果仓库中需要保留 VS Code / Cursor 的共享配置，可按需移除 `.vscode/` 忽略项。

---

## 开发脚本

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm start` | 启动 Electron 应用 |
| `npm run dev` | 开发模式启动，当前等同于 `npm start` |
| `npm run pack` | 打包为 Windows unpacked 目录 |
| `npm run dist` | 打包为 Windows portable exe |
| `npm run lint` | 当前为占位命令 |

---

## 当前限制

- 当前主要面向 Windows 桌面环境。
- 当前打包目标为 Windows portable exe。
- 文本提取规则仍以 RPG Maker MV / MZ 常见 JSON 结构为主。
- 插件自定义数据、复杂脚本内字符串、特殊加密/封包项目暂未完整覆盖。
- 目前没有引入自动化测试框架。
- 当前界面使用原生 JavaScript，随着功能增长，后续可能需要更系统的模块化或框架化重构。

---

## 远期开发目标

### 文本提取能力

- 扩展更多 RPG Maker 事件指令的识别。
- 支持插件参数中的可翻译文本提取。
- 支持更精细的上下文信息，例如地图名、事件名、事件页、角色名等。
- 支持重复文本合并与复用翻译。
- 支持文本差异检测，便于游戏版本更新后的增量汉化。

### 翻译工作流

- 增加批量翻译队列。
- 支持多模型翻译结果对比。
- 支持术语强制约束与 prompt 自动注入。
- 支持人工校对状态、锁定状态、审核状态。
- 支持翻译记忆库 TM。
- 支持导入/导出 CSV、XLSX、TMX 等格式。

### 工程与发布

- 增加自动化测试。
- 增加 GitHub Actions 自动构建 Windows release。
- 增加版本号自动更新与 changelog。
- 增加安装包目标，例如 NSIS installer。
- 探索 macOS / Linux 支持。

### 用户体验

- 优化长列表性能。
- 增加撤销/重做。
- 增加快捷键。
- 增加过滤器：未翻译、已翻译、术语命中、包含控制符等。
- 增加导出前校验报告。
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
