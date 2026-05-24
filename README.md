# PDF Smart Reader

> 带 AI 助手的桌面 PDF 阅读器——多标签页、全文搜索、大纲导航、智能问答，开箱即用。

PDF Smart Reader 是一款轻量级桌面 PDF 阅读器，内置 AI 对话面板，可以对打开的 PDF 文档进行智能问答、内容总结和关键信息提取。支持 OpenAI 兼容 API，可对接各种大模型服务。

<!-- 截图占位 -->
<!-- ![主界面](screenshots/main.png) -->

## 下载安装

前往 [Releases](https://github.com/gsiliconk/AI-PDF-Reading/releases/latest) 下载安装包：

| 平台 | 安装包 |
|------|--------|
| Windows | `PDF Smart Reader Setup.exe` |

下载后双击运行即可，无需额外配置运行环境。

## 功能特性

### PDF 阅读

- 多标签页同时打开多个 PDF，Ctrl+Tab 切换
- 文件拖拽打开
- 自动记录最近打开的文件，一键重新打开
- 大纲侧边栏，点击跳转到对应章节
- 全文搜索（Ctrl+F），支持上一个/下一个导航
- 键盘快捷键：Ctrl+O 打开、Ctrl+W 关闭标签、Ctrl+Tab 切换标签

### AI 智能助手

- 基于当前 PDF 内容进行问答
- AI 可自动调用工具读取文档（获取页面文本、批量提取、全文搜索、读取目录、智能匹配相关段落）
- 快捷指令：一键总结全文、提取要点、查看目录、翻译当前页
- AI 回复支持 Markdown 格式渲染
- 支持自定义 API 地址、Key 和模型名称，兼容 OpenAI / Deepseek / 通义千问等服务

### 其他

- 无边框自定义标题栏
- API 配置和历史记录保存在本地，不上传任何数据

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Electron 35 |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | electron-vite + Vite 5 |
| 样式 | Tailwind CSS 3 |
| PDF 渲染 | pdfjs-dist 4.4 |
| 打包发布 | electron-builder (NSIS) |

## 从源码构建

```bash
git clone https://github.com/gsiliconk/AI-PDF-Reading.git
cd AI-PDF-Reading
npm install
npm run dev          # 开发模式
npm run build:win    # 构建 Windows 安装包
```

## 许可证

[MIT](LICENSE)
