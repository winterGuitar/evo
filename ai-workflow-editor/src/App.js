import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

// 导入样式和常量
import {
  canvasStyles,
  edgeStyles,
  miniMapStyles,
  globalStyles,
  colors,
} from './styles';
import {
  NODE_PALETTE_CATEGORIES,
  getNodeColor,
} from './constants';
import AINode from './components/AINode';
import NodePalette from './components/NodePalette';
import ContextMenu from './components/ContextMenu';
import DisconnectableEdge from './components/DisconnectableEdge';
import {
  suppressResizeObserverWarning,
  createNewNode,
  createImageNode,
  createVideoNode,
  isValidImageFile,
  isValidVideoFile,
  updateNodesStatus,
} from './utils';

// 导入自定义 Hooks
import { useFileStorage } from './hooks/useFileStorage';
import { useTimeline } from './hooks/useTimeline';
import { useNodeOperations } from './hooks/useNodeOperations';

// ========== 抑制 ResizeObserver 警告 ==========
suppressResizeObserverWarning();

// ========== File Storage Helpers ==========
// 这些函数已迁移到 useFileStorage Hook 中 (src/hooks/useFileStorage.js)
// const { saveDataToFile, loadDataFromFile } = useFileStorage();

const areInputPreviewListsEqual = (prevList, nextList) => {
  if (prevList === nextList) return true;
  if (!Array.isArray(prevList) || !Array.isArray(nextList)) return false;
  if (prevList.length !== nextList.length) return false;

  for (let index = 0; index < prevList.length; index += 1) {
    const prevItem = prevList[index];
    const nextItem = nextList[index];
    if (
      (prevItem?.nodeId || '') !== (nextItem?.nodeId || '') ||
      (prevItem?.preview || '') !== (nextItem?.preview || '') ||
      (prevItem?.fileName || '') !== (nextItem?.fileName || '')
    ) {
      return false;
    }
  }

  return true;
};

const syncImageInputPreviewForGenerativeNodes = (allNodes, allEdges) => {
  if (!Array.isArray(allNodes) || allNodes.length === 0) return allNodes;

  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
  let hasChanged = false;

  const nextNodes = allNodes.map((node) => {
    if (!['image-gen', 'video-gen'].includes(node.type)) return node;

    const linkedImageInputNodeIds = [];
    const linkedNodeIdSet = new Set();

    allEdges.forEach((edge) => {
      if (edge.target !== node.id) return;
      const sourceNode = nodeMap.get(edge.source);
      // 支持所有输入源类型：图片输入、视频输入、视频生成、图片生成
      if (!['image-input', 'video-input', 'video-gen', 'image-gen'].includes(sourceNode?.type)) return;
      if (linkedNodeIdSet.has(sourceNode.id)) return;
      linkedNodeIdSet.add(sourceNode.id);
      linkedImageInputNodeIds.push(sourceNode.id);
    });

    const nextInputPreviews = linkedImageInputNodeIds
      .map((sourceNodeId) => nodeMap.get(sourceNodeId))
      .filter(Boolean)
      .map((sourceNode) => {
        let previewUrl = '';
        let fileName = '';
        let isLastFrame = false;

        // 图片输入节点：直接使用 preview
        if (sourceNode.type === 'image-input') {
          previewUrl = sourceNode.data?.preview || '';
          fileName = sourceNode.data?.fileName || '';
        }
        // 视频输入节点：使用最后一帧
        else if (sourceNode.type === 'video-input') {
          previewUrl = sourceNode.data?.lastFrame || '';
          fileName = sourceNode.data?.fileName ? `${sourceNode.data.fileName}_last_frame.jpg` : 'video_frame.jpg';
          isLastFrame = true;
        }
        // 视频生成节点：使用最后一帧（缩略图）
        else if (sourceNode.type === 'video-gen') {
          previewUrl = sourceNode.data?.lastFrame || '';
          fileName = sourceNode.data?.fileName ? `${sourceNode.data.fileName}_last_frame.jpg` : 'generated_video_frame.jpg';
          isLastFrame = true;
        }
        // 图片生成节点：直接使用 preview（生成的图片）
        else if (sourceNode.type === 'image-gen') {
          previewUrl = sourceNode.data?.preview || '';
          fileName = sourceNode.data?.fileName || 'generated_image.jpg';
        }

        return {
          nodeId: sourceNode.id,
          preview: previewUrl,
          fileName,
          isLastFrame
        };
      })
      .filter((item) => item.preview);

    const prevInputPreviews = Array.isArray(node.data?.inputPreviews)
      ? node.data.inputPreviews
      : [];

    if (areInputPreviewListsEqual(prevInputPreviews, nextInputPreviews)) {
      return node;
    }

    hasChanged = true;
    return {
      ...node,
      data: {
        ...node.data,
        inputPreviews: nextInputPreviews
      }
    };
  });

  return hasChanged ? nextNodes : allNodes;
};

// 从视频 URL 提取最后一帧作为图片
const extractVideoFrame = async (videoUrl) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = video.duration; // 跳转到最后一帧
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        video.remove();
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      video.remove();
      reject(new Error('Failed to load video'));
    };
  });
};

// ========== 主应用组件 ==========
const App = () => {
  const reactFlowWrapper = useRef(null);
  const edgesCountRef = useRef(0);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [isInitiated, setIsInitiated] = useState(false);

  // 连接线拖拽状态
  const [connectStartPos, setConnectStartPos] = useState(null);
  const [pendingConnection, setPendingConnection] = useState(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    position: null,
    targetNode: null // 菜单目标节点（可能是节点或画布）
  });

  // 保存文件输入框的 ref
  const fileInputRef = useRef(null);

  // 自动保存相关状态
  const [saveFilePath, setSaveFilePath] = useState(null);
  const [saveFileHandle, setSaveFileHandle] = useState(null); // 保存文件句柄，用于覆盖保存
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const autoSaveTimerRef = useRef(null);

  // 使用自定义 Hooks
  const { saveDataToFileWithCustomPath, saveToExistingFile, loadDataFromFile } = useFileStorage();

  // 计算视频时间轴项目（视频输入节点和视频生成节点，按序号排序）
  const timelineItems = useMemo(() => {
    const videoNodes = nodes.filter((node) =>
      ['video-input', 'video-gen'].includes(node.type) &&
      node.data?.sequenceNumber &&
      (node.data?.preview || node.data?.lastFrame)
    );

    return videoNodes
      .sort((a, b) => {
        const seqA = a.data.sequenceNumber || 999;
        const seqB = b.data.sequenceNumber || 999;
        return seqA - seqB;
      })
      .map((node) => ({
        id: node.id,
        type: node.type,
        sequenceNumber: node.data.sequenceNumber,
        label: node.data.label || node.data.fileName || '未命名',
        preview: node.data.preview || node.data.lastFrame,
        fileName: node.data.fileName
      }));
  }, [nodes]);

  const {
    selectedTimelineItems,
    setSelectedTimelineItems,
    isTimelineCollapsed,
    setIsTimelineCollapsed,
    composedVideoUrl,
    setComposedVideoUrl,
    composedVideoServerPath,
    setComposedVideoServerPath,
    composeProgress,
    handleTimelineItemClick,
    handleSelectAllTimeline,
    handleClearTimelineSelection,
    handleComposeVideo,
  } = useTimeline(timelineItems);

  const {
    handleNodeImageSelect,
    handleNodeVideoSelect,
    handleDeleteNode,
  } = useNodeOperations();

  const composedVideoUrlRef = useRef('');

  const imageInputPreviewVersion = useMemo(() => {
    return nodes
      .filter((node) => ['image-input', 'video-input', 'video-gen', 'image-gen'].includes(node.type))
      .map((node) => {
        let content = '';
        if (node.type === 'image-input') {
          content = node.data?.preview || '';
        } else if (node.type === 'video-input' || node.type === 'video-gen') {
          content = node.data?.lastFrame || '';
        } else if (node.type === 'image-gen') {
          content = node.data?.preview || '';
        }
        return `${node.id}:${content}:${node.data?.fileName || ''}`;
      })
      .join('|');
  }, [nodes]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    if (composedVideoUrlRef.current && composedVideoUrlRef.current !== composedVideoUrl) {
      URL.revokeObjectURL(composedVideoUrlRef.current);
    }
    composedVideoUrlRef.current = composedVideoUrl;
  }, [composedVideoUrl]);

  useEffect(() => () => {
    if (composedVideoUrlRef.current) {
      URL.revokeObjectURL(composedVideoUrlRef.current);
    }
  }, []);

  const setNodeDataById = useCallback((nodeId, dataPatch) => {
    if (!nodeId || !dataPatch) return;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          ...dataPatch
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          ...dataPatch
        }
      };
    });
  }, [setNodes]);

  // 初始化空画布
  useEffect(() => {
    if (!isInitiated) {
      setNodes([]);
      setEdges([]);
      setIsInitiated(true);
    }
  }, [isInitiated, setNodes, setEdges]);

  // 同步图像输入节点到图像/视频生成节点的输入预览
  useEffect(() => {
    setNodes((nds) => syncImageInputPreviewForGenerativeNodes(nds, edges));
  }, [edges, imageInputPreviewVersion, setNodes]);


  // 自动保存功能已禁用
  // 30秒自动保存
  // useEffect(() => {
  //   if (!saveFilePath) return;
  //
  //   // 清除之前的定时器
  //   if (autoSaveTimerRef.current) {
  //     clearInterval(autoSaveTimerRef.current);
  //   }
  //
  //   // 设置新的定时器，每30秒自动保存
  //   autoSaveTimerRef.current = setInterval(() => {
  //     if (nodesRef.current.length > 0 || edgesRef.current.length > 0) {
  //       saveDataToFile(nodesRef.current, edgesRef.current, saveFilePath).then((filePath) => {
  //         if (filePath) {
  //           setLastSaveTime(new Date());
  //           console.log(`自动保存成功: ${filePath}`);
  //         }
  //       });
  //     }
  //   }, 30000); // 30秒
  //
  //   return () => {
  //     if (autoSaveTimerRef.current) {
  //       clearInterval(autoSaveTimerRef.current);
  //     }
  //   };
  // }, [saveFilePath]);


  // 处理视频最后一帧捕获
  const handleLastFrameCaptured = useCallback((nodeId, frameData) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          lastFrame: frameData
        }
      };
    }));
  }, [setNodes]);

  // 键盘删除快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const tagName = target?.tagName?.toLowerCase?.();
      const isEditing = target?.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
      if (isEditing) return;

      if (e.key === 'Delete' && selectedNode) {
        e.preventDefault();
        if (window.confirm(`确定要删除节点 "${selectedNode.data.label || selectedNode.id}" 吗？`)) {
          handleDeleteNode(selectedNode.id, setNodes, setEdges, setSelectedNode, nodesRef.current);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, handleDeleteNode, setNodes, setEdges, setSelectedNode]);

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();

    if (!reactFlowWrapper.current || !reactFlowInstance) {
      console.warn('ReactFlow 实例未就绪');
      return;
    }

    try {
      const files = event.dataTransfer.files;
      
      if (files.length > 0) {
        const file = files[0];
        const bounds = reactFlowWrapper.current.getBoundingClientRect();
        const position = reactFlowInstance.project({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });

        if (isNaN(position.x) || isNaN(position.y)) {
          return;
        }

        if (isValidImageFile(file)) {
          const newNode = createImageNode(file, position);
          setNodes((nds) => nds.concat(newNode));
          return;
        }

        if (isValidVideoFile(file)) {
          const newNode = createVideoNode(file, position);
          setNodes((nds) => nds.concat(newNode));
          return;
        }
      }

      const dragData = event.dataTransfer.getData('application/reactflow');
      if (!dragData) return;

      const nodeType = JSON.parse(dragData);
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      if (!isNaN(position.x) && !isNaN(position.y)) {
        const newNode = createNewNode(nodeType, position, nodeType);
        setNodes((nds) => nds.concat(newNode));
      }
    } catch (error) {
      console.error('拖拽添加节点失败:', error);
    }
  }, [reactFlowInstance, setNodes]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    
    if (!reactFlowWrapper.current || !reactFlowInstance) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      position: position,
      targetNode: null
    });
    setPendingConnection(null);
  }, [reactFlowInstance]);

  // 节点右键菜单处理
  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();

    if (!reactFlowWrapper.current || !reactFlowInstance) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.project({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });

    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      position: position,
      targetNode: node
    });
  }, [reactFlowInstance]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, position: null, targetNode: null });
    setPendingConnection(null);
  }, []);

  // 复制节点
  const handleDuplicateNode = useCallback((node) => {
    if (!node) return;

    const newNode = {
      ...node,
      id: `${node.type}-${Date.now()}`, // 生成唯一ID
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50
      },
      data: {
        ...node.data,
        // 清理不需要复制的内部字段
        inputPreviews: node.data.inputPreviews ? [...node.data.inputPreviews] : []
      }
    };
    setNodes((nds) => [...nds, newNode]);
    handleCloseContextMenu();
  }, [setNodes, handleCloseContextMenu]);

  const handleCreateNodeFromContextMenu = useCallback((nodeType) => {
    if (contextMenu.position) {
      const nodeConfig = {
        id: nodeType,
        label: NODE_PALETTE_CATEGORIES
          .flatMap(cat => cat.items)
          .find(item => item.id === nodeType)?.label || nodeType,
        description: NODE_PALETTE_CATEGORIES
          .flatMap(cat => cat.items)
          .find(item => item.id === nodeType)?.description || `${nodeType}节点`,
        type: nodeType
      };
      
      const newNode = createNewNode(nodeConfig, contextMenu.position, nodeConfig);
      setNodes((nds) => nds.concat(newNode));

      if (pendingConnection?.nodeId && pendingConnection?.handleType) {
        const edgeParams = pendingConnection.handleType === 'source'
          ? {
              source: pendingConnection.nodeId,
              sourceHandle: pendingConnection.handleId,
              target: newNode.id,
              targetHandle: 'input'
            }
          : {
              source: newNode.id,
              sourceHandle: 'output',
              target: pendingConnection.nodeId,
              targetHandle: pendingConnection.handleId
            };

        setEdges((eds) => addEdge({
          ...edgeParams,
          type: 'disconnectable',
          animated: true,
          style: edgeStyles.edge,
          data: {
            onDisconnect: (edgeId) => {
              setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
            }
          }
        }, eds));
      }
    }
    handleCloseContextMenu();
  }, [contextMenu.position, pendingConnection, handleCloseContextMenu, setNodes, setEdges]);

  const handleDisconnectEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  const attachDisconnectHandlers = useCallback((rawEdges) => {
    if (!Array.isArray(rawEdges)) return [];
    return rawEdges.map((edge) => {
      if (edge?.data?.onDisconnect) return edge;
      return {
        ...edge,
        type: edge?.type || 'disconnectable',
        data: {
          ...(edge?.data || {}),
          onDisconnect: handleDisconnectEdge
        }
      };
    });
  }, [handleDisconnectEdge]);

  const handleDisconnectNodeEdges = useCallback((nodeId) => {
    if (!nodeId) return;
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setEdges]);

  const handleResizeNode = useCallback((nodeId, size) => {
    if (!nodeId || !size) return;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          width: size.width,
          height: size.height
        }
      };
    }));
  }, [setNodes]);

  const handleNodeModelChange = useCallback((nodeId, modelId) => {
    if (!nodeId || !modelId) return;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          model: modelId
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          model: modelId
        }
      };
    });
  }, [setNodes]);

  const handleNodeTextChange = useCallback((nodeId, text) => {
    if (!nodeId) return;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          inputText: text
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          inputText: text
        }
      };
    });
  }, [setNodes]);

  const handleNodeAspectRatioChange = useCallback((nodeId, aspectRatio, duration) => {
    if (!nodeId) return;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      const newData = {
        ...node.data,
        ...(aspectRatio !== undefined && { aspectRatio }),
        ...(duration !== undefined && { duration })
      };
      return {
        ...node,
        data: newData
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      const newData = {
        ...prev.data,
        ...(aspectRatio !== undefined && { aspectRatio }),
        ...(duration !== undefined && { duration })
      };
      return {
        ...prev,
        data: newData
      };
    });
  }, [setNodes]);


  const handleSequenceChange = useCallback((nodeId, sequenceNumber, checkDuplicate = false) => {
    if (!nodeId) return;

    // 如果清空序号，直接允许
    if (!sequenceNumber) {
      setNodes((nds) => nds.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          data: {
            ...node.data,
            sequenceNumber
          }
        };
      }));

      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            sequenceNumber
          }
        };
      });
      return;
    }

    // 只有在失焦时才检查序号是否与其他节点重复
    if (checkDuplicate) {
      const currentNodes = nodesRef.current;
      const duplicateNode = currentNodes.find(
        (node) => node.id !== nodeId && node.data?.sequenceNumber === sequenceNumber
      );

      if (duplicateNode) {
        const duplicateNodeLabel = duplicateNode.data?.label || duplicateNode.id?.slice(-6) || '未知节点';
        alert(`序号 ${sequenceNumber} 已被节点 "${duplicateNodeLabel}" 使用，请使用其他序号`);
        return;
      }
    }

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          sequenceNumber
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          sequenceNumber
        }
      };
    });
  }, [setNodes]);

  // 节点操作相关处理函数已迁移到 useNodeOperations Hook 中 (src/hooks/useNodeOperations.js)

  // App.js 中替换 handleSendNodeRequest 函数
  const handleSendNodeRequest = useCallback(async (nodeId) => {
    if (!nodeId) return;

    const currentNodes = nodesRef.current;
    const targetNode = currentNodes.find((node) => node.id === nodeId);
    if (!targetNode || !['image-gen', 'video-gen'].includes(targetNode.type)) {
      return;
    }

    // 1. 准备请求参数（从节点数据中获取）
    const { inputText: prompt, inputPreviews = [], aspectRatio = '16:9', duration = '5s' } = targetNode.data;

    // 获取选中的模型ID
    const selectedModel = targetNode.data.model || 'jimeng';
    console.log('选择的模型:', selectedModel);

    // 根据时长计算对应的frame数
    const durationToFramesMap = {
      '5s': 121,
      '10s': 241
    };
    const frames = durationToFramesMap[duration] || 121;

    // 万相模型需要至少一张输入图，最好有两张（首帧和尾帧）
    if (inputPreviews.length === 0 || !inputPreviews[0]?.preview) {
      alert("请先关联图片或视频输入节点！");
      return;
    }

    // 2. 处理输入源（图片或视频）
    let firstFrameBase64 = '';
    let lastFrameBase64 = '';

    try {
      // 处理第一张输入图（首帧）
      const firstInput = inputPreviews[0];
      if (firstInput.isVideoSource) {
        // 如果是视频源，提取最后一帧
        console.log('从视频源提取首帧...');
        const videoFrameDataUrl = await extractVideoFrame(firstInput.preview);
        firstFrameBase64 = videoFrameDataUrl.split(',')[1];
        console.log('首帧提取成功');
      } else {
        // 如果是图片源，直接使用
        if (firstInput.preview.startsWith('data:image/')) {
          firstFrameBase64 = firstInput.preview.split(',')[1];
        } else if (firstInput.preview.startsWith('blob:')) {
          const response = await fetch(firstInput.preview);
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = resolve;
            reader.readAsDataURL(blob);
          });
          firstFrameBase64 = reader.result.split(',')[1];
        }
      }

      // 处理第二张输入图（尾帧）- 仅万相模型需要
      if (selectedModel === 'wanxiang' && inputPreviews[1]?.preview) {
        const secondInput = inputPreviews[1];
        if (secondInput.isVideoSource) {
          console.log('从视频源提取尾帧...');
          const videoFrameDataUrl = await extractVideoFrame(secondInput.preview);
          lastFrameBase64 = videoFrameDataUrl.split(',')[1];
          console.log('尾帧提取成功');
        } else {
          if (secondInput.preview.startsWith('data:image/')) {
            lastFrameBase64 = secondInput.preview.split(',')[1];
          } else if (secondInput.preview.startsWith('blob:')) {
            const response = await fetch(secondInput.preview);
            const blob = await response.blob();
            const reader = new FileReader();
            await new Promise((resolve) => {
              reader.onload = resolve;
              reader.readAsDataURL(blob);
            });
            lastFrameBase64 = reader.result.split(',')[1];
          }
        }
        console.log('尾帧图片已准备');
      }

      if (!firstFrameBase64) {
        throw new Error('无法获取首帧图片数据');
      }
    } catch (error) {
      alert(`处理输入源失败：${error.message}`);
      console.error('处理输入源失败:', error);
      return;
    }

    // 3. 更新节点状态为"运行中"
    setNodeDataById(targetNode.id, {
      status: 'running',
      lastRequestError: '',
      preview: '', // 清空旧预览
      fileName: ''
    });

    try {
      if (targetNode.type === 'video-gen') {
        // ========== 视频生成逻辑 ==========
        console.log('提交视频生成任务...');
        console.log('模型:', selectedModel);
        
        // 4. 根据模型准备不同的请求参数
        const requestBody = {
          model: selectedModel,
          prompt
        };

        if (selectedModel === 'wanxiang') {
          // 万相模型使用首帧和尾帧
          requestBody.firstFrameBase64 = firstFrameBase64;
          requestBody.lastFrameBase64 = lastFrameBase64;
          console.log('使用万相参数: firstFrameBase64, lastFrameBase64');
        } else {
          // 即梦模型使用 imageBase64, seed, frames, aspect_ratio
          requestBody.imageBase64 = firstFrameBase64;
          requestBody.seed = 12345;
          requestBody.frames = frames;
          requestBody.aspect_ratio = aspectRatio;
          console.log('使用即梦参数: imageBase64, seed, frames, aspect_ratio');
        }

        // 5. 调用后端"提交任务"接口
        const submitRes = await fetch('http://localhost:3001/api/ti2v/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        const submitData = await submitRes.json();

        if (submitData.code !== 0) {
          throw new Error(submitData.message || '任务提交失败');
        }
        const { taskId } = submitData.data;
        console.log("任务提交成功，taskId：", taskId);

        // 5. 循环查询任务状态（模拟原queryTaskLoop逻辑）
        let isCancelled = false;
        const queryTask = async () => {
          // 检查是否已被取消（节点被删除或组件卸载）
          if (isCancelled) return;

          const queryRes = await fetch('http://localhost:3001/api/ti2v/query', {
              method: 'POST', // 必须和服务端app.post匹配
              headers: { 'Content-Type': 'application/json' }, // 必须传Content-Type
              body: JSON.stringify({ 
                taskId,
                model: selectedModel // 传递模型ID
              }) // taskId放在请求体里
            });
            const queryData = await queryRes.json();

            if (queryData.code !== 0) {
              throw new Error(queryData.message || '任务查询失败');
            }

            const { taskStatus, videoUrl, localVideoPath, errorMsg } = queryData.data;
            console.log("任务状态：", taskStatus);

            switch (taskStatus) {
              case "done":
                // 任务完成：优先使用后端返回的本地访问地址 localVideoPath，否则使用远程 videoUrl
                {
                  const displayUrl = localVideoPath || videoUrl || '';
                  const fileNameFromUrl = displayUrl ? displayUrl.split('/').pop() : `生成视频_${taskId}.mp4`;
                  setNodeDataById(targetNode.id, {
                    status: 'completed',
                    preview: displayUrl, // 用于节点展示（本地访问地址或远程URL）
                    videoUrl: displayUrl, // 兼容性字段，保持 videoUrl 存储实际可访问地址
                    fileName: fileNameFromUrl,
                    taskId
                  });
                }
                alert("视频生成成功！");
                break;
              case "failed":
                throw new Error(errorMsg || '任务执行失败');
              case "timeout":
                throw new Error('任务执行超时');
              case "in_queue":
              case "running":
                // 继续查询
                if (!isCancelled) {
                  setTimeout(queryTask, 5000);
                }
                break;
              default:
                if (!isCancelled) {
                  setTimeout(queryTask, 5000);
                }
            }
          };

        // 将清理函数存储到节点上
        if (!targetNode._cancelQueryTask) {
          targetNode._cancelQueryTask = [];
        }
        const cancelFn = () => { isCancelled = true; };
        targetNode._cancelQueryTask.push(cancelFn);

        queryTask();
      } else if (targetNode.type === 'image-gen') {
        // ========== 图片生成逻辑 ==========
        console.log('提交图片生成任务...');
        // TODO: 这里应该调用图片生成API
        // 目前只是模拟生成成功

        // 模拟API调用延迟 - 使用 ref 存储 timeout 以便清理
        const timeoutId = setTimeout(() => {
          // 创建一个模拟的图片（使用输入的图片本身作为示例）
          const resultImageBase64 = firstFrameBase64;

          setNodeDataById(targetNode.id, {
            status: 'completed',
            preview: `data:image/jpeg;base64,${resultImageBase64}`,
            fileName: '生成图片.jpg'
          });

          alert('图片生成成功！（模拟）');
          console.log('图片生成任务完成');
        }, 2000);

        // 存储到 ref 以便清理（实际使用中需要在组件添加对应的清理逻辑）
        if (!targetNode._timeoutIds) {
          targetNode._timeoutIds = [];
        }
        targetNode._timeoutIds.push(timeoutId);
      }
    } catch (error) {
      // 6. 处理错误
      setNodeDataById(targetNode.id, {
        status: 'error',
        lastRequestError: error.message
      });
      alert(`${targetNode.type === 'video-gen' ? '视频' : '图片'}生成失败：${error.message}`);
    }
  }, [setNodeDataById]);

  const onConnect = useCallback((params) => {
    edgesCountRef.current = 1;
    setEdges((eds) => addEdge({
      ...params,
      type: 'disconnectable',
      animated: true,
      style: edgeStyles.edge,
      data: { onDisconnect: handleDisconnectEdge }
    }, eds));
  }, [setEdges, handleDisconnectEdge]);

  // 连接线开始拖拽
  const onConnectStart = useCallback((_event, params) => {
    const { nodeId, handleId, handleType } = params || {};
    if (!nodeId || !handleType) return;
    setConnectStartPos({ nodeId, handleId, handleType });
  }, []);

  // 连接线拖拽结束 - 如果没有连接到有效节点，打开创建窗口
  const onConnectEnd = useCallback((event) => {
    if (!connectStartPos || !reactFlowWrapper.current || !reactFlowInstance) {
      setConnectStartPos(null);
      return;
    }

    // 延迟检查，确保 onConnect 已经执行过
    setTimeout(() => {
      // 检查是否成功添加了新的连接（边的数量是否增加）
      const connectionWasSuccessful = edgesCountRef.current > 0;
      
      if (connectionWasSuccessful) {
        // 连接成功，重置计数器并返回
        edgesCountRef.current = 0;
        setConnectStartPos(null);
        return;
      }

      // 获取鼠标释放位置
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const clientX = event.clientX;
      const clientY = event.clientY;

      // 检查鼠标释放位置是否在节点上
      const releasePosition = reactFlowInstance.project({
        x: clientX - bounds.left,
        y: clientY - bounds.top,
      });

      // 检查是否在任何节点上（考虑节点的实际大小）
      const isOverNode = nodes.some(node => {
        const nodeWidth = 200;
        const nodeHeight = 180;
        
        const dx = Math.abs(releasePosition.x - (node.position.x + nodeWidth / 2));
        const dy = Math.abs(releasePosition.y - (node.position.y + nodeHeight / 2));
        
        return dx < nodeWidth && dy < nodeHeight;
      });

      if (!isOverNode && !isNaN(releasePosition.x) && !isNaN(releasePosition.y)) {
        // 打开创建菜单在鼠标释放位置，并缓存这次起始连线信息
        setPendingConnection(connectStartPos);
        setContextMenu({
          visible: true,
          x: clientX,
          y: clientY,
          position: releasePosition
        });
      }

      setConnectStartPos(null);
      edgesCountRef.current = 0;
    }, 10);
  }, [connectStartPos, reactFlowInstance, nodes, reactFlowWrapper]);

  const onNodeClick = useCallback((_event, node) => {
    setSelectedNode(node);
  }, []);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    setSelectedNode(selectedNodes?.[0] || null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0 && isInitiated) {
      const timer = setTimeout(() => {
        try {
          reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
        } catch (e) {
          // 忽略错误
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [reactFlowInstance, nodes.length, isInitiated]);

  // 节点类型定义 - 使用 useMemo 优化性能
  const nodeTypes = useMemo(() => ({
    'image-gen': (props) => <AINode {...props}
      onDelete={(nodeId) => handleDeleteNode(nodeId, setNodes, setEdges, setSelectedNode)}
      onDisconnectAllEdges={handleDisconnectNodeEdges}
      onResize={handleResizeNode}
      onModelChange={handleNodeModelChange}
      onTextChange={handleNodeTextChange}
      onImageSelect={(nodeId, file) => handleNodeImageSelect(nodeId, file, setNodes, setSelectedNode)}
      onVideoSelect={(nodeId, file) => handleNodeVideoSelect(nodeId, file, setNodes, setSelectedNode)}
      onSendRequest={handleSendNodeRequest}
      onLastFrameCaptured={handleLastFrameCaptured}
      onSequenceChange={handleSequenceChange}
    />,
    'video-gen': (props) => <AINode {...props}
      onDelete={(nodeId) => handleDeleteNode(nodeId, setNodes, setEdges, setSelectedNode)}
      onDisconnectAllEdges={handleDisconnectNodeEdges}
      onResize={handleResizeNode}
      onModelChange={handleNodeModelChange}
      onTextChange={handleNodeTextChange}
      onImageSelect={(nodeId, file) => handleNodeImageSelect(nodeId, file, setNodes, setSelectedNode)}
      onVideoSelect={(nodeId, file) => handleNodeVideoSelect(nodeId, file, setNodes, setSelectedNode)}
      onSendRequest={handleSendNodeRequest}
      onLastFrameCaptured={handleLastFrameCaptured}
      onSequenceChange={handleSequenceChange}
      onAspectRatioChange={handleNodeAspectRatioChange}
    />,
    'image-input': (props) => <AINode {...props}
      onDelete={(nodeId) => handleDeleteNode(nodeId, setNodes, setEdges, setSelectedNode)}
      onDisconnectAllEdges={handleDisconnectNodeEdges}
      onResize={handleResizeNode}
      onModelChange={handleNodeModelChange}
      onTextChange={handleNodeTextChange}
      onImageSelect={(nodeId, file) => handleNodeImageSelect(nodeId, file, setNodes, setSelectedNode)}
      onVideoSelect={(nodeId, file) => handleNodeVideoSelect(nodeId, file, setNodes, setSelectedNode)}
      onSendRequest={handleSendNodeRequest}
      onLastFrameCaptured={handleLastFrameCaptured}
      onSequenceChange={handleSequenceChange}
    />,
    'video-input': (props) => <AINode {...props}
      onDelete={(nodeId) => handleDeleteNode(nodeId, setNodes, setEdges, setSelectedNode)}
      onDisconnectAllEdges={handleDisconnectNodeEdges}
      onResize={handleResizeNode}
      onModelChange={handleNodeModelChange}
      onTextChange={handleNodeTextChange}
      onImageSelect={(nodeId, file) => handleNodeImageSelect(nodeId, file, setNodes, setSelectedNode)}
      onVideoSelect={(nodeId, file) => handleNodeVideoSelect(nodeId, file, setNodes, setSelectedNode)}
      onSendRequest={handleSendNodeRequest}
      onLastFrameCaptured={handleLastFrameCaptured}
      onSequenceChange={handleSequenceChange}
    />,
  }), [handleDeleteNode, handleDisconnectNodeEdges, handleResizeNode, handleNodeModelChange, handleNodeTextChange, handleNodeImageSelect, handleNodeVideoSelect, handleSendNodeRequest, handleLastFrameCaptured, handleSequenceChange, handleNodeAspectRatioChange, setNodes, setEdges, setSelectedNode]);

  const edgeTypes = useMemo(() => ({
    disconnectable: DisconnectableEdge
  }), []);

  const handleRunWorkflow = useCallback(() => {
    setNodes((nds) => updateNodesStatus(nds, 'running'));

    setTimeout(() => {
      setNodes((nds) => updateNodesStatus(nds, 'completed'));
      alert('✅ 工作流执行完成！\n实际项目中这里会调用AI接口执行节点逻辑');
    }, 2000);
  }, [setNodes]);

  const handleClearCanvas = useCallback(() => {
    if (window.confirm('确定要清空画布吗？\n注意：这将清除所有节点和连接线。')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      setSaveFilePath(null);
      setSaveFileHandle(null);
      handleCloseContextMenu();
    }
  }, [setNodes, setEdges, handleCloseContextMenu, attachDisconnectHandlers]);

  const handleSaveToFile = useCallback(async () => {
    console.log('点击保存按钮');
    if (nodes.length === 0 && edges.length === 0) {
      alert('画布为空，无需保存');
      return;
    }

    // 准备时间轴数据
    const timelineData = {
      items: timelineItems.map(item => ({
        id: item.id,
        type: item.type,
        sequenceNumber: item.sequenceNumber,
        label: item.label,
        preview: item.preview, // 保存引用路径
        fileName: item.fileName
      })),
      selectedItems: selectedTimelineItems,
      // 保存合成视频相对路径
      composedVideoUrl: composedVideoServerPath || ''
    };
    console.log('保存时间轴数据:', timelineData);

    try {
      let savedPath;

      if (saveFileHandle) {
        // 有文件句柄，直接覆盖保存
        console.log('覆盖保存到现有文件:', saveFilePath);
        const result = await saveToExistingFile(nodes, edges, saveFileHandle, timelineData);
        if (result) {
          savedPath = result.fileName;
        }
      } else {
        // 没有文件句柄，使用文件选择器
        console.log('使用文件选择器保存');
        const result = await saveDataToFileWithCustomPath(nodes, edges, timelineData);
        if (result) {
          savedPath = result.fileName;
          setSaveFileHandle(result.fileHandle);
        }
      }

      console.log('保存完成，返回路径:', savedPath);
      if (savedPath) {
        setSaveFilePath(savedPath);
        setLastSaveTime(new Date());
      }
    } catch (error) {
      console.error('保存过程出错:', error);
      alert(`保存失败: ${error.message}`);
    }
  }, [nodes, edges, saveFilePath, saveFileHandle, timelineItems, selectedTimelineItems, composedVideoServerPath, saveToExistingFile, saveDataToFileWithCustomPath]);

  // 使用文件选择器指定位置和名称保存
  const handleSaveToCustomPath = useCallback(async () => {
    console.log('点击另存为按钮');
    if (nodes.length === 0 && edges.length === 0) {
      alert('画布为空，无需保存');
      return;
    }

    console.log('准备使用文件选择器保存');

    // 准备时间轴数据
    const timelineData = {
      items: timelineItems.map(item => ({
        id: item.id,
        type: item.type,
        sequenceNumber: item.sequenceNumber,
        label: item.label,
        preview: item.preview, // 保存引用路径
        fileName: item.fileName
      })),
      selectedItems: selectedTimelineItems,
      // 保存合成视频相对路径
      composedVideoUrl: composedVideoServerPath || ''
    };
    console.log('保存时间轴数据:', timelineData);

    try {
      const result = await saveDataToFileWithCustomPath(nodes, edges, timelineData);
      if (result) {
        setSaveFilePath(result.fileName);
        setSaveFileHandle(result.fileHandle);
        setLastSaveTime(new Date());
        console.log('保存完成，返回路径:', result.fileName);
      }
    } catch (error) {
      console.error('保存过程出错:', error);
      alert(`保存失败: ${error.message}`);
    }
  }, [nodes, edges, timelineItems, selectedTimelineItems, composedVideoServerPath, saveDataToFileWithCustomPath]);

  const handleLoadFromFile = useCallback(async (event) => {
    const data = await loadDataFromFile(event);
    if (data) {
      if (data.nodes && data.nodes.length > 0) {
        // 处理节点数据，将相对路径转换为完整 URL
        const processedNodes = data.nodes.map((node) => {
          const processedNode = { ...node };

          // 将相对路径转换为完整 URL
          if (processedNode.data?.preview?.startsWith('/ti2v_videos/')) {
            processedNode.data.preview = `http://localhost:3001${processedNode.data.preview}`;
            processedNode.data.serverPath = processedNode.data.preview.replace('http://localhost:3001', '');
          }
          if (processedNode.data?.videoUrl?.startsWith('/ti2v_videos/')) {
            processedNode.data.videoUrl = `http://localhost:3001${processedNode.data.videoUrl}`;
          }

          // 确保 position 存在
          if (!processedNode.position) {
            processedNode.position = { x: 0, y: 0 };
          }

          return processedNode;
        });

        setNodes(processedNodes);
      }
      if (data.edges && data.edges.length > 0) {
        setEdges(attachDisconnectHandlers(data.edges));
      }

      // 恢复时间轴数据
      if (data.timeline) {
        console.log('加载时间轴数据:', data.timeline);
        if (data.timeline.selectedItems) {
          setSelectedTimelineItems(data.timeline.selectedItems);
        }
        if (data.timeline.composedVideoUrl) {
          console.log('恢复合成视频URL:', data.timeline.composedVideoUrl);
          // 将相对路径转换为完整 URL
          const composedUrl = data.timeline.composedVideoUrl.startsWith('/ti2v_videos/')
            ? `http://localhost:3001${data.timeline.composedVideoUrl}`
            : data.timeline.composedVideoUrl;
          console.log('转换后的完整URL:', composedUrl);
          setComposedVideoUrl(composedUrl);
          setComposedVideoServerPath(data.timeline.composedVideoUrl);
        }
      }

      // 记录文件路径和时间
      if (data.filePath) {
        setSaveFilePath(data.filePath);
      }
      if (data.timestamp) {
        const savedTime = new Date(data.timestamp);
        const timeStr = savedTime.toLocaleString('zh-CN');
        console.log(`已加载文件 (${timeStr})`);
      }

      // 加载文件后清空 FileHandle，因为加载的文件不是通过 FileHandle 选择的
      setSaveFileHandle(null);

      handleCloseContextMenu();
    }
    // 重置文件输入框
    if (event.target) {
      event.target.value = '';
    }
  }, [setNodes, setEdges, handleCloseContextMenu]);

  const handleOpenFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 时间轴相关处理函数已迁移到 useTimeline Hook 中 (src/hooks/useTimeline.js)

  return (
    <div style={globalStyles.appContainer}>
      <NodePalette onDragStart={onDragStart} composedVideoUrl={composedVideoUrl} composeProgress={composeProgress} />

      {/* 隐藏的文件输入框 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadFromFile}
      />

      <div style={canvasStyles.wrapper} ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionChange={onSelectionChange}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          style={canvasStyles.reactFlow}
        >
          <MiniMap
            nodeColor={(node) => getNodeColor(node.type)}
            nodeStrokeWidth={2}
            style={{
              ...miniMapStyles.container,
              position: 'absolute',
              bottom: isTimelineCollapsed ? '40px' : '160px',
              right: '10px',
              transition: 'bottom 0.3s ease'
            }}
          />
          <Controls
            style={{
              position: 'absolute',
              bottom: isTimelineCollapsed ? '40px' : '160px',
              left: '10px',
              transition: 'bottom 0.3s ease'
            }}
          />
          <Background color="#eaeef2" gap={16} />

          <Panel position="top-left" style={canvasStyles.panel}>
            <div style={canvasStyles.buttonGroup}>
              <button
                onClick={handleRunWorkflow}
                style={canvasStyles.primaryButton}
              >
                ▶️ 运行工作流
              </button>
              <button
                onClick={handleClearCanvas}
                style={canvasStyles.secondaryButton}
              >
                🗑️ 清空画布
              </button>
              <button
                onClick={handleSaveToFile}
                style={canvasStyles.secondaryButton}
              >
                💾 保存
              </button>
              <button
                onClick={handleSaveToCustomPath}
                style={canvasStyles.secondaryButton}
              >
                💾 另存为
              </button>
              <button
                onClick={handleOpenFileDialog}
                style={canvasStyles.secondaryButton}
              >
                📂 打开文件
              </button>
            </div>
          </Panel>

          {nodes.length === 0 && (
            <Panel position="center" style={canvasStyles.emptyState}>
              <div style={canvasStyles.emptyStateIcon}>🎨</div>
              <h3 style={canvasStyles.emptyStateTitle}>空白画布</h3>
              <p style={canvasStyles.emptyStateText}>
                从左侧拖拽节点开始构建工作流<br/>
                直接拖拽图片或视频到画布生成输入节点<br/>
                右键点击画布快速创建节点<br/>
                点击"💾 保存文件"保存当前工作流<br/>
                点击"📂 打开文件"加载已保存的工作流
              </p>
            </Panel>
          )}
          </ReactFlow>

          {/* 视频时间轴 */}
          {timelineItems.length > 0 && (
            <div style={{
              ...canvasStyles.timelineContainer,
              height: isTimelineCollapsed ? '40px' : '160px',
              transition: 'height 0.3s ease'
            }}>
              {/* 折叠按钮 - 时间轴顶部中间，与标题栏对齐 */}
              <button
                type="button"
                onClick={() => setIsTimelineCollapsed(!isTimelineCollapsed)}
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: colors.background.hover,
                  border: `1px solid ${colors.border.default}`,
                  borderRadius: '6px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: colors.text.light,
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                  ':hover': {
                    background: colors.background.secondary,
                    borderColor: colors.text.light
                  }
                }}
                title={isTimelineCollapsed ? '展开时间轴' : '折叠时间轴'}
              >
                {isTimelineCollapsed ? '▲ 展开' : '▼ 折叠'}
              </button>
              <div style={canvasStyles.timelineHeader}>
                <div style={canvasStyles.timelineTitle}>
                  🎬 视频时间轴
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 400,
                    color: colors.text.light,
                    marginLeft: '6px'
                  }}>
                    ({timelineItems.length} 个视频)
                  </span>
                </div>
                <div style={{
                  ...canvasStyles.timelineActions,
                  opacity: isTimelineCollapsed ? 0 : 1,
                  transition: 'opacity 0.3s ease',
                  pointerEvents: isTimelineCollapsed ? 'none' : 'auto'
                }}>
                  <button
                    type="button"
                    onClick={handleSelectAllTimeline}
                    style={{
                      ...canvasStyles.timelineButton,
                      ...canvasStyles.timelineButtonSecondary
                    }}
                  >
                    全选
                  </button>
                  <button
                    type="button"
                    onClick={handleClearTimelineSelection}
                    style={{
                      ...canvasStyles.timelineButton,
                      ...canvasStyles.timelineButtonSecondary
                    }}
                  >
                    清空
                  </button>
                  <button
                    type="button"
                    onClick={handleComposeVideo}
                    disabled={selectedTimelineItems.length < 2}
                    style={{
                      ...canvasStyles.timelineButton,
                      ...canvasStyles.timelineButtonPrimary,
                      ...(selectedTimelineItems.length < 2 ? {
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      } : {})
                    }}
                  >
                    🎥 合成视频 ({selectedTimelineItems.length})
                  </button>
                </div>
              </div>
              <div style={{
                ...canvasStyles.timelineContent,
                opacity: isTimelineCollapsed ? 0 : 1,
                transition: 'opacity 0.3s ease',
                pointerEvents: isTimelineCollapsed ? 'none' : 'auto'
              }}>
                {timelineItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleTimelineItemClick(item.id)}
                    style={{
                      ...canvasStyles.timelineItem,
                      ...(selectedTimelineItems.includes(item.id) ? canvasStyles.timelineItemSelected : {})
                    }}
                  >
                    {selectedTimelineItems.includes(item.id) && (
                      <div style={canvasStyles.timelineItemSelectedBadge}>
                        <span style={canvasStyles.timelineItemSelectedCheck}>✓</span>
                      </div>
                    )}
                    <div style={canvasStyles.timelineItemSequence}>
                      #{item.sequenceNumber}
                    </div>
                    {item.preview && (
                      item.type === 'video-gen' || item.type === 'video-input' ? (
                        <video
                          src={item.preview}
                          muted
                          loop
                          autoPlay
                          playsInline
                          onMouseEnter={(e) => e.target.play()}
                          onMouseLeave={(e) => e.target.pause()}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '104px',
                            height: '64px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            marginTop: '4px'
                          }}
                        />
                      ) : (
                        <img
                          src={item.preview}
                          alt={item.label}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '104px',
                            height: '64px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            marginTop: '4px'
                          }}
                        />
                      )
                    )}
                  </div>
                ))}
                {timelineItems.length === 0 && (
                  <div style={canvasStyles.timelinePlaceholder}>
                    暂无视频节点<br/>添加有序号的视频输入或视频生成节点
                  </div>
                )}
              </div>
            </div>
          )}

        {contextMenu.visible && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={handleCloseContextMenu}
            onCreateNode={handleCreateNodeFromContextMenu}
            onDuplicateNode={handleDuplicateNode}
            targetNode={contextMenu.targetNode}
          />
        )}
      </div>
    </div>
  );
};

export default App;
