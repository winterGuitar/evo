# Custom Hooks

本目录包含可复用的 React Hooks，用于简化 App.js 的代码组织和提高可维护性。

## Hooks 列表

### 1. useFileStorage

**文件**: `useFileStorage.js`

**功能**:
- 处理工作流文件的保存和加载
- 处理节点数据，保存服务器相对路径
- 支持文件格式验证

**导出的函数**:
```javascript
const {
  processNodesForSave,  // 处理节点数据，保存服务器相对路径
  saveDataToFile,       // 保存数据到文件
  loadDataFromFile      // 从文件加载数据
} = useFileStorage();
```

**使用示例**:
```javascript
const App = () => {
  const { saveDataToFile, loadDataFromFile } = useFileStorage();

  const handleSave = async () => {
    await saveDataToFile(nodes, edges, 'workflow.json', timelineData);
  };

  const handleLoad = async (event) => {
    const data = await loadDataFromFile(event);
    if (data) {
      setNodes(data.nodes);
      setEdges(data.edges);
    }
  };

  // ...
};
```

---

### 2. useTimeline

**文件**: `useTimeline.js`

**功能**:
- 管理时间轴状态（选中项、折叠状态）
- 处理视频合成（使用 MediaRecorder API）
- 上传合成视频到服务器

**参数**: `timelineItems` - 时间轴项目数组

**导出的状态和函数**:
```javascript
const {
  selectedTimelineItems,          // 选中的时间轴项目 ID 数组
  setSelectedTimelineItems,        // 设置选中的时间轴项目
  isTimelineCollapsed,             // 时间轴是否折叠
  setIsTimelineCollapsed,          // 设置时间轴折叠状态
  composedVideoUrl,                // 合成视频的完整 URL
  setComposedVideoUrl,             // 设置合成视频 URL
  composedVideoServerPath,         // 合成视频的服务器相对路径
  setComposedVideoServerPath,      // 设置服务器路径
  composeProgress,                 // 合成进度对象
  handleTimelineItemClick,         // 点击时间轴项目
  handleSelectAllTimeline,         // 选择所有时间轴项目
  handleClearTimelineSelection,    // 清除时间轴选择
  handleComposeVideo               // 合成视频
} = useTimeline(timelineItems);
```

**使用示例**:
```javascript
const App = () => {
  const timelineItems = useMemo(() => {
    return nodes
      .filter(node => ['video-input', 'video-gen'].includes(node.type))
      .map(node => ({
        id: node.id,
        type: node.type,
        sequenceNumber: node.data.sequenceNumber,
        preview: node.data.preview,
        fileName: node.data.fileName
      }));
  }, [nodes]);

  const {
    handleTimelineItemClick,
    handleComposeVideo,
    selectedTimelineItems
  } = useTimeline(timelineItems);

  // ...
};
```

---

### 3. useNodeOperations

**文件**: `useNodeOperations.js`

**功能**:
- 处理节点的创建、删除、修改
- 处理图片/视频文件选择和上传
- 处理节点序号变更

**导出的函数**:
```javascript
const {
  handleNodeImageSelect,    // 处理节点图片选择
  handleNodeVideoSelect,   // 处理节点视频选择
  handleDeleteNode,        // 删除节点
  handleNodeModelChange,   // 修改节点模型
  handleNodeTextChange,    // 修改节点文本
  handleSequenceChange,    // 修改节点序号
  handleSendNodeRequest    // 发送节点请求
} = useNodeOperations();
```

**使用示例**:
```javascript
const App = () => {
  const {
    handleNodeImageSelect,
    handleNodeVideoSelect,
    handleDeleteNode
  } = useNodeOperations();

  // 处理图片选择
  const onImageSelect = (nodeId, file) => {
    handleNodeImageSelect(nodeId, file, setNodes, setSelectedNode);
  };

  // 删除节点
  const deleteNode = (nodeId) => {
    handleDeleteNode(nodeId, setNodes, setEdges, setSelectedNode);
  };

  // ...
};
```

---

## 迁移指南

### 当前状态

App.js 中的相关函数已保留，以确保兼容性。函数位置已添加注释说明：
- `processNodesForSave`, `saveDataToFile`, `loadDataFromFile` → 第 47-148 行
- `handleTimelineItemClick`, `handleComposeVideo` 等 → 第 1382 行开始
- `handleNodeImageSelect`, `handleNodeVideoSelect` 等 → 第 832 行开始

### 如何迁移到 Hooks

#### 步骤 1: 在组件中调用 Hook

```javascript
const App = () => {
  // 在组件顶部调用 hooks
  const { processNodesForSave, saveDataToFile, loadDataFromFile } = useFileStorage();
  const {
    handleTimelineItemClick,
    handleComposeVideo,
    // ...
  } = useTimeline(timelineItems);
  const {
    handleNodeImageSelect,
    handleNodeVideoSelect,
    // ...
  } = useNodeOperations();

  // ...
};
```

#### 步骤 2: 删除对应的旧函数

删除 App.js 中标记为已提取到 Hook 的函数定义。

#### 步骤 3: 调整函数调用

Hook 版本的函数可能需要传递额外的参数（如 `setNodes`, `setSelectedNode` 等）。

```javascript
// 原函数
handleNodeImageSelect(nodeId, file)

// Hook 版本（需要传递 setNodes 和 setSelectedNode）
handleNodeImageSelect(nodeId, file, setNodes, setSelectedNode)
```

---

## 注意事项

1. **向后兼容**: 当前 App.js 保留了所有原函数，可以正常工作
2. **渐进式迁移**: 可以一个一个地迁移到 Hooks，不影响现有功能
3. **参数差异**: 部分函数在 Hook 版本中需要传递额外的参数
4. **状态管理**: Hooks 使用内部状态管理，外部调用需要传入更新函数

---

## 未来计划

- [ ] 逐步迁移 App.js 中的函数调用到 Hooks
- [ ] 添加更多通用 Hooks（如 `useWorkflow`）
- [ ] 改进错误处理和日志记录
- [ ] 添加 TypeScript 类型定义
