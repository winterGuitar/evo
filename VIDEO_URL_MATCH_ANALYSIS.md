# 视频地址路径匹配问题分析

## 问题概述
后端返回的视频地址与前端读取的视频路径存在**字段名不匹配**的问题。

---

## 1. 后端服务器返回 (server.js)

### `/api/ti2v/query` 接口返回格式
**位置**: [server.js](server.js#L509-L514)

```javascript
res.status(200).json({
  code: 0,
  message: "查询任务成功",
  data: {
    taskId,
    taskStatus,
    videoUrl,                    // ← 返回的字段名
    localVideoPath,              // ← 本地视频访问路径（格式: http://localhost:PORT/ti2v-videos/{videoFile}）
    errorMsg: queryResult.data?.error_msg || "",
    rawResponse: queryResult
  }
});
```

### 关键信息
- **videoUrl**: 来自火山引擎API的原始视频URL
- **localVideoPath**: 本地下载后的视频访问URL
- **存储位置**: `downloadDir` = `./ti2v_videos`
- **访问路由**: `/ti2v-videos` → 静态文件服务

---

## 2. 前端处理 (App.js)

### 接收响应
**位置**: [App.js](App.js#L709)

```javascript
const { taskStatus, videoUrl, errorMsg } = queryData.data;
```

### 存储到节点
**位置**: [App.js](App.js#L717)

```javascript
setNodeDataById(targetNode.id, {
  status: 'completed',
  preview: videoUrl,              // ← 存储到 preview 字段
  fileName: `生成视频_${taskId}.mp4`,
  taskId
});
```

---

## 3. 前端显示 (AINode.js)

### video-input 节点预览
**位置**: [AINode.js](AINode.js#L326-L336)

```javascript
{shouldShowVideoPreviewContainer && (
  <div style={nodeStyles.previewContainer}>
    {data.videoUrl ? (                    // ← 读取 videoUrl 字段
      <video
        src={data.videoUrl}               // ← 使用 videoUrl
        style={nodeStyles.previewVideo}
        controls
        preload="metadata"
      />
    ) : (
      <div style={nodeStyles.previewPlaceholder}>No video yet</div>
    )}
  </div>
)}
```

---

## 问题汇总

| 组件 | 字段名 | 说明 |
|------|--------|------|
| **server.js 返回** | `videoUrl` | 原始URL或本地路径 |
| **App.js 存储** | `preview` | 将videoUrl存储为preview |
| **AINode.js 读取** | `videoUrl` | 期望从videoUrl读取（❌ 不匹配） |

---

## 🔴 核心问题

**App.js 设置的是 `preview` 字段，但 AINode.js 读取的是 `videoUrl` 字段，导致视频无法显示。**

---

## 修复方案

### 方案 A：修改 AINode.js（推荐 ✓）
改为读取 `data.preview` 而不是 `data.videoUrl`，这样与图片处理保持一致。

```javascript
{data.preview ? (
  <video src={data.preview} ... />
) : (
  <div>No video yet</div>
)}
```

### 方案 B：修改 App.js
同时设置 `preview` 和 `videoUrl`：

```javascript
setNodeDataById(targetNode.id, {
  status: 'completed',
  preview: videoUrl,
  videoUrl: videoUrl,  // ← 添加此行
  fileName: `生成视频_${taskId}.mp4`,
  taskId
});
```

### 方案 C：修改 server.js
修改返回字段名为 `preview` 或 `videoPreviewUrl`（影响面大，不推荐）

---

## 补充问题

### 端口问题
server.js 在构造本地视频路径时使用了 `PORT` 变量：
```javascript
localVideoPath = `http://localhost:${PORT}/ti2v-videos/${videoFile}`;
```

在生产环境中，如果前端不是在 `localhost:3001` 访问，此URL 可能无法访问。

---

## 建议

✓ **采用方案 A**：修改 AINode.js 读取 `data.preview` 字段，保持前端数据处理的一致性。
