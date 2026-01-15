



# 🌌 Gemini SSH 助手 (Project Gemini)

**集成 AI 的赛博朋克风格现代化 Web SSH 客户端**

Project Gemini 是一款专为运维人员打造的现代化 Web SSH 客户端。它集成了 Google Gemini AI 能力，提供智能命令风险评估、运维辅助聊天以及极具科技感的“神经连接终端” (Neural Link Terminal) 风格界面，旨在提升服务器管理的效率与安全性。

## 🌟 核心功能

-   **智能 SSH 终端**：基于 `xterm.js`，支持 WebGL 加速、Fit 适配及 WebLinks，提供流畅的终端体验。
-   **AI 命令风险评估**：实时分析用户输入的 Linux 命令，提供中文功能说明、风险等级评估及高危操作预警。
-   **AI 运维助手**：侧边栏集成 AI 聊天面板，支持专家级 Linux 运维咨询、命令推荐及批量结果对比。
-   **多会话管理**：支持多标签页切换，同时管理多个服务器连接，状态实时同步。
-   **可视化服务器管理**：侧边栏树形结构管理服务器，支持快速连接与配置。
-   **中转网关**：后端 NestJS 充当 SSH 中转网关，实现协议转换与安全审计。

## 🛠 技术栈

### 前端 (Frontend)
-   **核心框架**：React 19 (并发渲染)
-   **构建工具**：Vite 6
-   **状态管理**：Zustand
-   **UI 体系**：Tailwind CSS + DaisyUI (自定义赛博朋克主题)
-   **终端模拟**：xterm.js + 插件 (Canvas, Webgl, Fit, WebLinks)
-   **AI SDK**：OpenAI SDK (对接 Gemini 兼容接口)

### 后端 (Backend)
-   **核心框架**：NestJS 11
-   **SSH 协议**：ssh2
-   **实时通信**：Socket.io
-   **开发语言**：TypeScript 5.x

## 📂 项目结构

```text
.
├── back/                # NestJS 后端代码
│   └── src/ssh/         # SSH 核心模块 (Gateway, Service)
├── components/AISSH/    # 前端核心业务逻辑
│   ├── common/          # 基础 UI 组件 (CyberPanel, Button)
│   ├── components/      # 业务组件 (Terminal, AIChat, ServerTree)
│   ├── services/        # 核心服务 (AI 工厂, 命令策略, SSH 服务)
│   └── store/           # Zustand 状态管理
├── electron/           # Electron 桌面端核心代码 (Main, Preload)
├── docker/              # 部署相关配置 (Dockerfile, docker-compose)
└── package.json         # 前端及桌面端配置
```

## 🚀 快速开始

### 1. 环境要求
-   Node.js (建议 v18+)
-   pnpm (推荐使用 pnpm 管理依赖)

### 2. 安装依赖
在项目根目录下执行：
```bash
pnpm install
```
进入后端目录安装依赖：
```bash
cd back
pnpm install
```

### 3. 配置环境变量
在项目根目录创建 `.env` 文件，并配置 AI 接口信息：
```env
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=your_api_base_url
OPENAI_MODEL=gemini-1.5-pro
```

### 4. 启动项目

#### Web 端开发
1. 启动后端：在 `back/` 目录下执行 `pnpm run start:dev`
2. 启动前端：在根目录下执行 `pnpm run dev`

#### 桌面端开发
在根目录下执行：
```bash
pnpm run electron:dev
```
*注：该命令会自动编译后端代码并启动 Electron 壳子。*

### 5. 桌面端打包
在根目录下执行以下命令进行打包：

- **打包全平台**: `pnpm run electron:build`
- **打包 Mac 版**: `pnpm run electron:build:mac`
- **打包 Windows 版**: `pnpm run electron:build:win`
- **打包 Linux 版**: `pnpm run electron:build:linux`

打包后的文件将生成在 `release/` 目录下。

## 🎨 UI 设计规范
本项目采用 **Neural Link Terminal** 风格，详细设计规范请参考 [STYLE_GUIDE.md](STYLE_GUIDE.md)：
-   **主色**：`Neon Cyan` (#00f3ff) - 边框、主要按钮。
-   **辅色**：`Electric Violet` (#bc13fe) - AI 交互。
-   **警告**：`Alert Red` (#ff2a00) - 高危操作。
-   **容器**：优先使用 `CyberPanel` 组件，保持全息半透明感（`backdrop-blur`）。

## 📜 开发规范
-   遵循 **Clean Code** 原则，变量命名语义化。
-   单个文件原则上不超过 **700 行**，超过则进行逻辑拆分。
-   使用**策略模式**处理不同命令的 AI 评估逻辑，**工厂模式**管理 AI 实例。
-   详细技术架构与 Electron 整合计划请参考 [TECHNICAL_DOC.md](TECHNICAL_DOC.md)。

## 📄 开源协议
[MIT License](LICENSE)


方块智联AI 团队开发 
[https://www.binterai.com/](https://www.binterai.com/)