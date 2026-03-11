# AI Workflow Editor

一个可视化的 AI 工作流编辑器，支持视频生成、图片生成、时间轴拖拽排序、视频合成等功能。

## 功能特性

- 🎨 可视化节点编辑器（基于 React Flow）
- 🎬 视频生成（支持即梦、万相模型）
- 🖼️ 图片生成
- 📹 视频时间轴拖拽排序
- 🔗 节点连线与数据传递
- 🎥 前端 FFmpeg 视频合成
- 💬 豆包 AI 助手集成

## 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **操作系统**: Windows / macOS / Linux

## 快速开始

### 1. 安装 Node.js

如果未安装 Node.js，请从 [官网](https://nodejs.org/) 下载并安装 LTS 版本。

### 2. 克隆项目

```bash
git clone <你的仓库地址>
cd evo
```

### 3. 安装依赖

有两种方式：

**方式一：使用启动脚本（推荐）**

```bash
# Windows
start-all.bat
```

脚本会自动：
- 检查并安装前端依赖 (`ai-workflow-editor/node_modules`)
- 检查并安装后端依赖 (`serversrc/node_modules`)
- 启动后端服务 (端口 3001)
- 启动前端服务 (端口 3000)

**方式二：手动安装**

```bash
# 安装前端依赖
cd ai-workflow-editor
npm install
cd ..

# 安装后端依赖
cd serversrc
npm install
cd ..
```

### 4. 启动服务

**方式一：一键启动**

```bash
start-all.bat
```

**方式二：分别启动**

```bash
# 终端1：启动后端
cd serversrc
node server.js

# 终端2：启动前端
cd ai-workflow-editor
npm start
```

### 5. 访问应用

打开浏览器访问：http://localhost:3000

## 项目结构

```
evo/
├── ai-workflow-editor/     # 前端 React 应用
│   ├── public/
│   │   └── ffmpeg/         # FFmpeg WASM 文件（视频合成用）
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   └── styles.js      # 样式
│   └── package.json
├── serversrc/              # 后端 Express 服务
│   ├── package.json
│   └── server.js
├── images/                 # 静态资源
└── start-all.bat          # 一键启动脚本
```

## 依赖说明

### 前端依赖

- `react` / `react-dom`: UI 框架
- `reactflow`: 流程图编辑器
- `@ffmpeg/ffmpeg`: 浏览器端视频处理
- `@ffmpeg/util`: FFmpeg 工具函数
- `@craco/craco`: React 配置扩展

### 后端依赖

- `express`: Web 框架
- `cors`: 跨域支持
- `multer`: 文件上传
- `dotenv`: 环境变量
- `node-fetch`: HTTP 请求

## 常见问题

### 1. FFmpeg 加载失败

如果视频合成时提示 FFmpeg 加载失败：
- 检查网络连接（需要访问 CDN 或使用本地文件）
- 本地 FFmpeg 文件位于 `ai-workflow-editor/public/ffmpeg/`

### 2. 端口被占用

- 前端默认端口：3000
- 后端默认端口：3001

如需修改，请编辑对应配置文件。

### 3. COOP/COEP 错误

开发环境已配置 COOP/COEP  headers 以支持 SharedArrayBuffer。如果遇到相关错误，检查 `craco.config.js` 配置。

## 技术栈

- **前端**: React 19, React Flow, FFmpeg.wasm
- **后端**: Node.js, Express
- **AI 模型**: 即梦 (jimeng), 万相 (wanxiang)

## 许可证

ISC
