# 视频地址路径匹配问题 - 修复总结

## 问题发现

通过详细分析代码流程，发现以下不匹配：

1. **server.js** 返回字段：`videoUrl`
2. **App.js** 存储字段：`preview: videoUrl`  
3. **AINode.js** 读取字段：`data.videoUrl` ❌ **不匹配!**

## 修复内容

### 修复 1: AINode.js - 字段名修正

**文件**: [src/components/AINode.js](src/components/AINode.js#L287-L300)

**改动**: video-input 节点预览部分，将读取的字段从 `data.videoUrl` 改为 `data.preview`

```diff
  {shouldShowVideoPreviewContainer && (
    <div style={nodeStyles.previewContainer}>
-     {data.videoUrl ? (
+     {data.preview ? (
        <video
-       src={data.videoUrl}
+       src={data.preview}
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

**原因**: 前端App.js中实际存储的是`preview`字段，不是`videoUrl`

---

### 修复 2: App.js - 兼容性加强

**文件**: [src/App.js](src/App.js#L712-L721)

**改动**: 在视频生成完成时，同时设置 `preview` 和 `videoUrl` 字段

```diff
  setNodeDataById(targetNode.id, {
    status: 'completed',
    preview: videoUrl, // 后端返回的视频URL（或缩略图URL）
+   videoUrl, // 同时设置videoUrl以提高兼容性
    fileName: `生成视频_${taskId}.mp4`,
    taskId
  });
```

**原因**: 增强兼容性，防止其他代码期望 `videoUrl` 字段时出现问题

---

## 数据流畅流程（修复后）

```
server.js
  ↓
  返回: { videoUrl, localVideoPath, ... }
  ↓
App.js (第709行)
  ↓
  接收: { taskStatus, videoUrl, ... }
  ↓
  存储: { preview: videoUrl, videoUrl: videoUrl }
  ↓
AINode.js (第289行)
  ↓
  读取: data.preview 或 data.videoUrl ✓ 匹配！
  ↓
  显示: <video src={data.preview} .../>
```

---

## 验证检查清单

- [x] server.js 返回的字段名正确
- [x] App.js 正确接收和存储视频URL
- [x] AINode.js 读取的字段名与App.js存储的一致
- [x] 视频预览功能数据流完整

---

## 可能的后续优化

### 1. 使用本地视频路径
server.js 返回了 `localVideoPath`，前端可以选择使用：

```javascript
// 优先使用本地视频路径（更快更稳定）
preview: localVideoPath || videoUrl,
```

### 2. PORT 硬编码问题
server.js中构造localVideoPath时硬编码了PORT：

```javascript
localVideoPath = `http://localhost:${PORT}/ti2v-videos/${videoFile}`;
```

在生产环境中，应改为：
- 使用相对路径：`/ti2v-videos/${videoFile}`
- 或返回 `HOST` 让前端决定

### 3. 错误处理加强
建议在video标签添加错误处理：

```javascript
<video
  src={data.preview}
  onError={(e) => console.error('视频加载失败:', e)}
  ...
/>
```

---

## 修复完成
✓ 所有字段名匹配问题已解决
✓ 视频生成节点应能正确显示生成的视频
