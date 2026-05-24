# PDF Smart Reader

<p align="center">
  <img src="build/icon.ico" width="128" height="128" alt="PDF Smart Reader">
</p>

<p align="center">
  <strong>带 AI 助手的桌面 PDF 阅读器</strong>
</p>

<p align="center">
  <a href="https://github.com/gsiliconk/AI-PDF-Reading/releases">
    <img src="https://img.shields.io/github/v/release/gsiliconk/AI-PDF-Reading?style=flat-square" alt="Release">
  </a>
  <a href="https://github.com/gsiliconk/AI-PDF-Reading/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/gsiliconk/AI-PDF-Reading?style=flat-square" alt="License">
  </a>
</p>

---

**PDF Smart Reader** 是一款轻量级桌面 PDF 阅读器，内置 AI 对话面板，可以对打开的 PDF 文档进行智能问答、内容总结和关键信息提取。支持 OpenAI 兼容 API，可对接各种大模型服务。

本应用**所有数据保存在本地**，API 配置和历史记录不上传任何第三方服务器。

<!-- 截图占位：将截图放到 img/ 目录后取消注释 -->
<!-- ## 截图
<table>
  <tr>
    <td><img src="./img/1.png" width="400" alt="主界面"></td>
    <td><img src="./img/2.png" width="400" alt="AI 对话"></td>
  </tr>
</table>
-->

## 快速开始

### 下载安装（推荐）

前往 [Releases](https://github.com/gsiliconk/AI-PDF-Reading/releases) 下载安装包：

| 平台 | 安装包 |
|------|--------|
| Windows | `PDF Smart Reader Setup.exe` |

下载后双击运行即可，无需额外配置运行环境。

### 从源码构建

```bash
git clone https://github.com/gsiliconk/AI-PDF-Reading.git
cd AI-PDF-Reading
npm install

# 开发模式
npm run dev

# 构建 Windows 安装包
npm run build:win
```

产物位于 `release/` 目录。

## 功能特性

### PDF 阅读

- **多标签页**：同时打开多个 PDF 文件，Ctrl+Tab 切换
- **文件拖拽**：直接拖拽文件到窗口打开
- **历史记录**：自动记录最近打开的文件，一键重新打开
- **大纲导航**：侧边栏显示文档目录，点击跳转到对应章节
- **全文搜索**：Ctrl+F 搜索关键词，支持上一个/下一个导航
- **键盘快捷键**：Ctrl+O 打开文件、Ctrl+W 关闭标签页、Ctrl+Tab 切换标签

### AI 智能助手

- **文档问答**：基于当前打开的 PDF 内容回答问题
- **Function Calling**：AI 可自动调用工具读取文档内容：

| 工具 | 功能 |
|------|------|
| `get_page_text` | 获取指定页面文本 |
| `extract_pages` | 批量提取多页内容（最多 30 页） |
| `search_text` | 全文关键词搜索，返回匹配上下文 |
| `get_outline` | 获取文档目录/大纲结构 |
| `find_relevant_sections` | 根据问题智能匹配最相关段落 |

- **快捷指令**：一键总结全文、提取要点、查看目录、翻译当前页
- **Markdown 渲染**：AI 回复支持完整的 Markdown 格式
- **对话管理**：清空对话、复制消息、可调节面板宽度

### AI 服务配置

点击工具栏 **AI** 按钮 → 设置图标，配置 API 信息：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API 地址 | OpenAI 兼容的 API 端点 | `https://api.openai.com/v1` |
| API Key | 你的 API 密钥 | - |
| 模型名称 | 使用的模型 | `gpt-4o` |

支持任何 OpenAI 兼容的 API 服务，包括 OpenAI、Azure OpenAI、Deepseek、通义千问等。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Electron](https://www.electronjs.org/) 35 |
| 前端框架 | [React](https://react.dev/) 18 + TypeScript |
| 构建工具 | [electron-vite](https://electron-vite.org/) + Vite 5 |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) 3 |
| PDF 渲染 | [pdfjs-dist](https://mozilla.github.io/pdf.js/) 4.4 |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) |
| UI 组件库 | [animal-island-ui](https://www.npmjs.com/package/animal-island-ui) |
| 打包发布 | [electron-builder](https://www.electron.build/) (NSIS) |

## 架构

```
   ┌─────────────────────────────────────────────────┐
   │                  Electron 主进程                  │
   │  窗口管理 · IPC 通信 · 文件系统访问 · AI API 调用  │
   └──────────────────────┬──────────────────────────┘
                          │ IPC
   ┌──────────────────────┴──────────────────────────┐
   │                 React 渲染进程                    │
   │                                                  │
   │  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
   │  │ PDFViewer│  │  AIPanel │  │   其他组件     │  │
   │  │ (pdfjs)  │  │(Function │  │ TabBar/Sidebar│  │
   │  │          │  │ Calling) │  │ SearchBar/... │  │
   │  └──────────┘  └────┬─────┘  └───────────────┘  │
   │                     │                            │
   │              ┌──────┴──────┐                     │
   │              │ pdfSkills   │                     │
   │              │ (PDF 工具集) │                     │
   │              └─────────────┘                     │
   └──────────────────────────────────────────────────┘
                          │
                    OpenAI 兼容 API
                          │
              ┌───────────┴───────────┐
              │  OpenAI / Deepseek /  │
              │  通义千问 / Azure ...  │
              └───────────────────────┘
```

## 项目结构

```
src/
├── main/                          # Electron 主进程
│   └── index.ts                   # 窗口管理、IPC 处理、AI API 调用
├── preload/
│   └── index.ts                   # 暴露 electronAPI 到渲染进程
└── renderer/                      # React 应用
    └── src/
        ├── App.tsx                # 应用主组件（标签页、布局、状态管理）
        ├── components/
        │   ├── AIPanel.tsx        # AI 对话面板（Function Calling 循环）
        │   ├── AnnotationLayer.tsx# PDF 标注层
        │   ├── DropZone.tsx       # 拖拽打开 + 历史记录
        │   ├── PDFViewer.tsx      # PDF 渲染（pdfjs-dist）
        │   ├── SearchBar.tsx      # 全文搜索栏
        │   ├── Sidebar.tsx        # 大纲/目录侧边栏
        │   ├── StatusBar.tsx      # 底部状态栏
        │   ├── TabBar.tsx         # 多标签栏
        │   └── TitleBar.tsx       # 自定义无边框标题栏
        ├── hooks/
        │   └── useResizable.tsx   # 可调节宽度 Hook
        └── services/
            └── pdfSkills.ts       # PDF 工具函数（AI Function Calling 定义与执行）
```

## 开发

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- npm

### 本地开发

```bash
git clone https://github.com/gsiliconk/AI-PDF-Reading.git
cd AI-PDF-Reading
npm install
npm run dev
```

### 构建

```bash
npm run build:win    # Windows 安装包 (NSIS)
npm run build        # 仅构建，不打包
```

## 路线图

- [x] PDF 多标签页阅读
- [x] 文件拖拽打开
- [x] 大纲导航 + 全文搜索
- [x] AI 对话面板（Function Calling）
- [x] 快捷指令（总结、翻译、提取要点）
- [x] 自定义无边框标题栏
- [x] OpenAI 兼容 API 支持
- [ ] 暗色主题
- [ ] PDF 标注/批注
- [ ] 跨平台支持（macOS / Linux）
- [ ] 应用内自动更新
- [ ] 更多 AI 工具（对比多文档、生成思维导图）

## 许可证

[MIT](LICENSE)
