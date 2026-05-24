# PDF Smart Reader

> 一款带 AI 助手的桌面 PDF 阅读器，支持多标签页、全文搜索、大纲导航和智能问答。

PDF Smart Reader 是一款基于 Electron 的桌面 PDF 阅读器，内置 AI 对话面板，可以对打开的 PDF 文档进行智能问答、内容总结和关键信息提取。支持 OpenAI 兼容 API，可对接各种大模型服务。

<!-- 截图占位：请将截图放到 screenshots/ 目录，然后取消注释 -->
<!-- ![主界面](screenshots/main.png) -->
<!-- ![AI 对话](screenshots/ai-panel.png) -->

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
- **Function Calling**：AI 可调用工具读取文档内容，包括：
  - `get_page_text` - 获取指定页面文本
  - `extract_pages` - 批量提取多页内容
  - `search_text` - 全文关键词搜索
  - `get_outline` - 获取文档目录结构
  - `find_relevant_sections` - 智能匹配最相关段落
- **快捷指令**：一键总结全文、提取要点、查看目录、翻译当前页
- **Markdown 渲染**：AI 回复支持完整的 Markdown 格式
- **对话管理**：清空对话、复制消息、可调节面板宽度

### 其他

- **自定义标题栏**：无边框窗口，原生体验
- **API 可配置**：支持自定义 API 地址、Key 和模型名称
- **本地存储**：API 配置和历史记录保存在本地，不上传任何数据

## 快速开始

### 前提条件

- [Node.js](https://nodejs.org/) 18+
- npm 或 pnpm

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/gsiliconk/AI-PDF-Reading.git
cd AI-PDF-Reading

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 构建安装包

```bash
# 构建 Windows 安装包
npm run build:win
```

构建产物位于 `release/` 目录。

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Electron 35 |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | electron-vite + Vite 5 |
| 样式 | Tailwind CSS 3 |
| PDF 渲染 | pdfjs-dist 4.4 |
| Markdown | react-markdown |
| 配置持久化 | electron-store |
| UI 组件库 | animal-island-ui |
| 打包发布 | electron-builder (NSIS) |

## 项目结构

```
src/
├── main/                 # Electron 主进程
│   └── index.ts          # 主入口，窗口管理、IPC 通信
├── preload/              # 预加载脚本
│   └── index.ts          # 暴露 electronAPI 到渲染进程
└── renderer/             # 渲染进程 (React 应用)
    └── src/
        ├── App.tsx       # 应用主组件
        ├── components/
        │   ├── AIPanel.tsx         # AI 对话面板
        │   ├── AnnotationLayer.tsx # 标注层
        │   ├── DropZone.tsx        # 拖拽打开区域
        │   ├── PDFViewer.tsx       # PDF 渲染器
        │   ├── SearchBar.tsx       # 搜索栏
        │   ├── Sidebar.tsx         # 大纲侧边栏
        │   ├── StatusBar.tsx       # 底部状态栏
        │   ├── TabBar.tsx          # 标签栏
        │   └── TitleBar.tsx        # 自定义标题栏
        ├── hooks/
        │   └── useResizable.tsx    # 可调节宽度 Hook
        └── services/
            └── pdfSkills.ts        # PDF 工具函数 (AI Function Calling)
```

## 配置 AI 服务

点击工具栏的 **AI** 按钮打开对话面板，点击设置图标配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API 地址 | OpenAI 兼容的 API 端点 | `https://api.openai.com/v1` |
| API Key | 你的 API 密钥 | - |
| 模型名称 | 使用的模型 | `gpt-4o` |

支持任何 OpenAI 兼容的 API 服务，包括但不限于 OpenAI、Azure OpenAI、Deepseek、通义千问等。

## 许可证

[MIT](LICENSE)
