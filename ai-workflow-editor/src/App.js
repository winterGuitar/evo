import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
} from './styles';
import {
  NODE_PALETTE_CATEGORIES,
  getNodeColor,
} from './constants';
import {
  getNodeHttpRequestConfig,
  HTTP_REQUEST_DEFAULT_HEADERS,
  HTTP_REQUEST_DEFAULT_TIMEOUT_MS
} from './httpRequestConfig';
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
  getImageLabelFromFileName,
  getVideoLabelFromFileName
} from './utils';

// ========== 抑制 ResizeObserver 警告 ==========
suppressResizeObserverWarning();

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

const collectImageInputPayload = (targetNodeId, allNodes, allEdges) => {
  if (!targetNodeId) return [];
  const nodeMap = new Map(allNodes.map((node) => [node.id, node]));

  return allEdges
    .filter((edge) => edge.target === targetNodeId)
    .map((edge) => nodeMap.get(edge.source))
    .filter((sourceNode) => ['image-input', 'video-input', 'video-gen', 'image-gen'].includes(sourceNode?.type))
    .map((sourceNode) => {
      let preview = '';
      let fileName = '';
      let isVideoSource = false;

      if (sourceNode.type === 'image-input') {
        preview = sourceNode.data?.preview || '';
        fileName = sourceNode.data?.fileName || '';
      } else if (sourceNode.type === 'video-input') {
        const videoSrc = sourceNode.data?.videoUrl || sourceNode.data?.preview;
        preview = videoSrc || '';
        fileName = sourceNode.data?.fileName || 'video_frame.jpg';
        isVideoSource = true;
      } else if (sourceNode.type === 'video-gen') {
        const videoSrc = sourceNode.data?.videoUrl || sourceNode.data?.preview;
        preview = videoSrc || '';
        fileName = sourceNode.data?.fileName || 'generated_video_frame.jpg';
        isVideoSource = true;
      } else if (sourceNode.type === 'image-gen') {
        preview = sourceNode.data?.preview || '';
        fileName = sourceNode.data?.fileName || 'generated_image.jpg';
      }

      return {
        nodeId: sourceNode.id,
        fileName,
        preview,
        isVideoSource
      };
    })
    .filter((item) => item.preview);
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

const readResponsePayload = async (response) => {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const jsonBody = await response.json();
    return { body: jsonBody, contentType, previewFromBinary: '' };
  }

  if (contentType.startsWith('image/')) {
    const imageBlob = await response.blob();
    return {
      body: {
        contentType,
        size: imageBlob.size
      },
      contentType,
      previewFromBinary: URL.createObjectURL(imageBlob)
    };
  }

  const textBody = await response.text();
  return {
    body: textBody,
    contentType,
    previewFromBinary: isPreviewLikeValue(textBody) ? textBody.trim() : ''
  };
};

const isPreviewLikeValue = (value) => {
  if (typeof value !== 'string') return false;
  const normalizedValue = value.trim();
  if (!normalizedValue) return false;
  return (
    /^https?:\/\//i.test(normalizedValue) ||
    normalizedValue.startsWith('/') ||
    normalizedValue.startsWith('data:image/') ||
    normalizedValue.startsWith('blob:')
  );
};

const extractPreviewFromResponse = (responseBody, nodeType) => {
  const preferredKeys = nodeType === 'video-gen'
    ? ['thumbnail', 'thumbnailUrl', 'cover', 'coverUrl', 'poster', 'posterUrl', 'preview', 'previewUrl', 'image', 'imageUrl', 'url']
    : ['preview', 'previewUrl', 'image', 'imageUrl', 'url', 'thumbnail', 'thumbnailUrl'];

  const deepSearch = (value, depth = 0) => {
    if (value == null || depth > 4) return '';

    if (typeof value === 'string') {
      return isPreviewLikeValue(value) ? value.trim() : '';
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const foundInArray = deepSearch(item, depth + 1);
        if (foundInArray) return foundInArray;
      }
      return '';
    }

    if (typeof value === 'object') {
      for (const key of preferredKeys) {
        const candidate = value[key];
        if (isPreviewLikeValue(candidate)) {
          return candidate.trim();
        }
      }

      for (const key of ['data', 'result', 'results', 'output', 'images', 'thumbnails', 'items']) {
        const nestedValue = value[key];
        const foundInNested = deepSearch(nestedValue, depth + 1);
        if (foundInNested) return foundInNested;
      }
    }

    return '';
  };

  return deepSearch(responseBody);
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
    position: null
  });
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

  // 删除节点函数
  const handleDeleteNode = useCallback((nodeId) => {
    if (!nodeId) {
      console.error('节点ID为空，无法删除');
      return;
    }

    setNodes((nds) => nds.filter(node => node.id !== nodeId));
    setEdges((eds) => eds.filter(edge => 
      edge.source !== nodeId && edge.target !== nodeId
    ));
    
    setSelectedNode((prev) => (prev?.id === nodeId ? null : prev));
  }, [setNodes, setEdges]);

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
          handleDeleteNode(selectedNode.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, handleDeleteNode]);

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
      position: position
    });
    setPendingConnection(null);
  }, [reactFlowInstance]);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, position: null });
    setPendingConnection(null);
  }, []);

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

  const handleNodeImageSelect = useCallback((nodeId, file) => {
    if (!nodeId || !file) return;

    if (!isValidImageFile(file)) {
      alert('请选择有效的图片文件（jpg/png/gif/webp/svg）');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const imageLabel = getImageLabelFromFileName(file.name);

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          label: imageLabel,
          description: `图片输入: ${file.name}`,
          preview: previewUrl,
          fileName: file.name,
          fileSize: file.size,
          imageUrl: ''
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          label: imageLabel,
          description: `图片输入: ${file.name}`,
          preview: previewUrl,
          fileName: file.name,
          fileSize: file.size,
          imageUrl: ''
        }
      };
    });
  }, [setNodes]);

  const handleNodeVideoSelect = useCallback((nodeId, file) => {
    if (!nodeId || !file) return;

    if (!isValidVideoFile(file)) {
      alert('请选择有效的视频文件（mp4/webm/ogg/mov/avi/mkv）');
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    const videoLabel = getVideoLabelFromFileName(file.name);

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          label: videoLabel,
          description: `视频输入: ${file.name}`,
          preview: videoUrl,
          videoUrl,
          fileName: file.name,
          fileSize: file.size
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          label: videoLabel,
          description: `视频输入: ${file.name}`,
          preview: videoUrl,
          videoUrl,
          fileName: file.name,
          fileSize: file.size
        }
      };
    });
  }, [setNodes]);

// App.js 中替换 handleSendNodeRequest 函数
const handleSendNodeRequest = useCallback(async (nodeId) => {
  if (!nodeId) return;

  const currentNodes = nodesRef.current;
  const targetNode = currentNodes.find((node) => node.id === nodeId);
  if (!targetNode || !['image-gen', 'video-gen'].includes(targetNode.type)) {
    return;
  }

  // 1. 准备请求参数（从节点数据中获取）
  const { inputText: prompt, inputPreviews = [] } = targetNode.data;
  const imageInput = inputPreviews[0]; // 取第一个关联的输入节点
  if (!imageInput?.preview) {
    alert("请先关联图片或视频输入节点！");
    return;
  }

  // 2. 处理输入源（图片或视频）
  let imageBase64 = '';
  let sourceType = 'image'; // 'image' 或 'video'

  try {
    if (imageInput.isVideoSource) {
      // 如果是视频源，提取最后一帧
      console.log('从视频源提取最后一帧...');
      sourceType = 'video';
      const videoFrameDataUrl = await extractVideoFrame(imageInput.preview);
      // 移除 data:image/jpeg;base64, 前缀
      imageBase64 = videoFrameDataUrl.split(',')[1];
      console.log('视频帧提取成功');
    } else {
      // 如果是图片源，直接使用
      if (imageInput.preview.startsWith('data:image/')) {
        imageBase64 = imageInput.preview.split(',')[1]; // 移除data:image/xxx;base64,前缀
      } else if (imageInput.preview.startsWith('blob:')) {
        // 如果是blob URL，先转换为Base64
        const response = await fetch(imageInput.preview);
        const blob = await response.blob();
        const reader = new FileReader();
        await new Promise((resolve) => {
          reader.onload = resolve;
          reader.readAsDataURL(blob);
        });
        imageBase64 = reader.result.split(',')[1];
      }
    }

    if (!imageBase64) {
      throw new Error('无法获取图片数据');
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
      // 4. 调用后端"提交任务"接口
      const submitRes = await fetch('http://localhost:3001/api/ti2v/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          prompt,
          seed: 12345,
          frames: 121,
          aspect_ratio: "16:9"
        })
      });
      const submitData = await submitRes.json();

      if (submitData.code !== 0) {
        throw new Error(submitData.message || '任务提交失败');
      }
      const { taskId } = submitData.data;
      console.log("任务提交成功，taskId：", taskId);

      // 5. 循环查询任务状态（模拟原queryTaskLoop逻辑）
      const queryTask = async () => {
        const queryRes = await fetch('http://localhost:3001/api/ti2v/query', {
            method: 'POST', // 必须和服务端app.post匹配
            headers: { 'Content-Type': 'application/json' }, // 必须传Content-Type
            body: JSON.stringify({ taskId }) // taskId放在请求体里
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
              setTimeout(queryTask, 5000);
              break;
            default:
              setTimeout(queryTask, 5000);
          }
        };
      queryTask();
    } else if (targetNode.type === 'image-gen') {
      // ========== 图片生成逻辑 ==========
      console.log('提交图片生成任务...');
      // TODO: 这里应该调用图片生成API
      // 目前只是模拟生成成功
      
      // 模拟API调用延迟
      setTimeout(() => {
        // 创建一个模拟的图片（使用输入的图片本身作为示例）
        const resultImageBase64 = imageBase64;
        
        setNodeDataById(targetNode.id, {
          status: 'completed',
          preview: `data:image/jpeg;base64,${resultImageBase64}`,
          fileName: '生成图片.jpg'
        });
        
        alert('图片生成成功！（模拟）');
        console.log('图片生成任务完成');
      }, 2000);
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
  const onConnectStart = useCallback((event, params) => {
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

  const onNodeClick = useCallback((event, node) => {
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
    'image-gen': (props) => <AINode {...props} onDelete={handleDeleteNode} onDisconnectAllEdges={handleDisconnectNodeEdges} onResize={handleResizeNode} onModelChange={handleNodeModelChange} onTextChange={handleNodeTextChange} onImageSelect={handleNodeImageSelect} onVideoSelect={handleNodeVideoSelect} onSendRequest={handleSendNodeRequest} onLastFrameCaptured={handleLastFrameCaptured} />,
    'video-gen': (props) => <AINode {...props} onDelete={handleDeleteNode} onDisconnectAllEdges={handleDisconnectNodeEdges} onResize={handleResizeNode} onModelChange={handleNodeModelChange} onTextChange={handleNodeTextChange} onImageSelect={handleNodeImageSelect} onVideoSelect={handleNodeVideoSelect} onSendRequest={handleSendNodeRequest} onLastFrameCaptured={handleLastFrameCaptured} />,
    'image-input': (props) => <AINode {...props} onDelete={handleDeleteNode} onDisconnectAllEdges={handleDisconnectNodeEdges} onResize={handleResizeNode} onModelChange={handleNodeModelChange} onTextChange={handleNodeTextChange} onImageSelect={handleNodeImageSelect} onVideoSelect={handleNodeVideoSelect} onSendRequest={handleSendNodeRequest} onLastFrameCaptured={handleLastFrameCaptured} />,
    'video-input': (props) => <AINode {...props} onDelete={handleDeleteNode} onDisconnectAllEdges={handleDisconnectNodeEdges} onResize={handleResizeNode} onModelChange={handleNodeModelChange} onTextChange={handleNodeTextChange} onImageSelect={handleNodeImageSelect} onVideoSelect={handleNodeVideoSelect} onSendRequest={handleSendNodeRequest} onLastFrameCaptured={handleLastFrameCaptured} />,
  }), [handleDeleteNode, handleDisconnectNodeEdges, handleResizeNode, handleNodeModelChange, handleNodeTextChange, handleNodeImageSelect, handleNodeVideoSelect, handleSendNodeRequest, handleLastFrameCaptured]);

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
    if (window.confirm('确定要清空画布吗？')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
      handleCloseContextMenu();
    }
  }, [setNodes, setEdges, handleCloseContextMenu]);

  return (
    <div style={globalStyles.appContainer}>
      <NodePalette onDragStart={onDragStart} />
      
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
          onSelectionChange={onSelectionChange}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
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
            style={miniMapStyles.container}
          />
          <Controls />
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
                <span style={canvasStyles.emptyStateHighlight}>点击节点右上角 ✕ 删除 | 选中后按 Delete 键删除</span>
              </p>
            </Panel>
          )}
        </ReactFlow>

        {contextMenu.visible && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={handleCloseContextMenu}
            onCreateNode={handleCreateNodeFromContextMenu}
          />
        )}
      </div>
    </div>
  );
};

export default App;
