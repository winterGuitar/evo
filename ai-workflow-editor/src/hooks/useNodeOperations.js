import { useCallback } from 'react';
import { isValidImageFile, isValidVideoFile, getImageLabelFromFileName, getVideoLabelFromFileName, calculateFileHash, checkFileExists } from '../utils';

/**
 * 节点操作 Hook
 * 处理节点的创建、删除、修改等操作
 */
export const useNodeOperations = () => {
  /**
   * 处理节点图片选择
   */
  const handleNodeImageSelect = useCallback(async (nodeId, file, setNodes, setSelectedNode) => {
    if (!nodeId || !file) return;

    if (!isValidImageFile(file)) {
      alert('请选择有效的图片文件（jpg/png/gif/webp/svg）');
      return;
    }

    const imageLabel = getImageLabelFromFileName(file.name);
    console.log('开始处理图片文件:', file.name, `大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    let serverPath = '';
    let isReused = false;

    try {
      // 计算文件哈希
      console.log('正在计算文件哈希...');
      const fileHash = await calculateFileHash(file);
      console.log('文件哈希:', fileHash);

      // 检查后端是否已存在相同文件
      console.log('检查后端是否已存在相同文件...');
      const checkResult = await checkFileExists(fileHash, file.size);

      if (checkResult.exists && checkResult.path) {
        // 文件已存在，复用
        serverPath = checkResult.path;
        isReused = true;
        console.log('文件已存在，复用文件:', serverPath);
      } else {
        // 文件不存在，上传新文件
        console.log('文件不存在，开始上传...');
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('http://localhost:3001/api/ti2v/upload', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.code === 0) {
          serverPath = uploadData.data.path;
          console.log('图片上传成功，服务器路径:', serverPath);
        } else {
          console.error('图片上传失败:', uploadData.message);
          alert('图片上传失败: ' + uploadData.message);
          return;
        }
      }
    } catch (e) {
      console.error('处理图片文件失败:', e);
      alert('处理图片失败，请检查后端服务是否运行');
      return;
    }

    // 使用服务器路径作为预览
    const previewUrl = `http://localhost:3001${serverPath}`;
    const description = isReused
      ? `图片输入: ${file.name} (已复用)`
      : `图片输入: ${file.name}`;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          label: imageLabel,
          description,
          preview: previewUrl,
          fileName: file.name,
          fileSize: file.size,
          imageUrl: '',
          serverPath // 保存服务器相对路径
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
          description,
          preview: previewUrl,
          fileName: file.name,
          fileSize: file.size,
          imageUrl: '',
          serverPath
        }
      };
    });

    // 提示用户
    if (isReused) {
      console.log('图片已成功复用，未重复上传');
    } else {
      console.log('图片已成功上传');
    }
  }, []);

  /**
   * 处理节点视频选择
   */
  const handleNodeVideoSelect = useCallback(async (nodeId, file, setNodes, setSelectedNode) => {
    if (!nodeId || !file) return;

    if (!isValidVideoFile(file)) {
      alert('请选择有效的视频文件（mp4/webm/ogg/mov/avi/mkv）');
      return;
    }

    const videoLabel = getVideoLabelFromFileName(file.name);
    console.log('开始处理视频文件:', file.name, `大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    let serverPath = '';
    let isReused = false;

    try {
      // 计算文件哈希
      console.log('正在计算文件哈希...');
      const fileHash = await calculateFileHash(file);
      console.log('文件哈希:', fileHash);

      // 检查后端是否已存在相同文件
      console.log('检查后端是否已存在相同文件...');
      const checkResult = await checkFileExists(fileHash, file.size);

      if (checkResult.exists && checkResult.path) {
        // 文件已存在，复用
        serverPath = checkResult.path;
        isReused = true;
        console.log('文件已存在，复用文件:', serverPath);
      } else {
        // 文件不存在，上传新文件
        console.log('文件不存在，开始上传...');
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('http://localhost:3001/api/ti2v/upload', {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.code === 0) {
          serverPath = uploadData.data.path;
          console.log('视频上传成功，服务器路径:', serverPath);
        } else {
          console.error('视频上传失败:', uploadData.message);
          alert('视频上传失败: ' + uploadData.message);
          return;
        }
      }
    } catch (e) {
      console.error('处理视频文件失败:', e);
      alert('处理视频失败，请检查后端服务是否运行');
      return;
    }

    // 使用服务器路径
    const videoUrl = `http://localhost:3001${serverPath}`;
    const description = isReused
      ? `视频输入: ${file.name} (已复用)`
      : `视频输入: ${file.name}`;

    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          label: videoLabel,
          description,
          preview: videoUrl,
          videoUrl,
          fileName: file.name,
          fileSize: file.size,
          serverPath // 保存服务器相对路径
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
          description,
          preview: videoUrl,
          videoUrl,
          fileName: file.name,
          fileSize: file.size,
          serverPath
        }
      };
    });

    // 提示用户
    if (isReused) {
      console.log('视频已成功复用，未重复上传');
    } else {
      console.log('视频已成功上传');
    }
  }, []);

  /**
   * 删除节点
   */
  const handleDeleteNode = useCallback((nodeId, setNodes, setEdges, setSelectedNode) => {
    if (!nodeId) {
      console.error('节点ID为空，无法删除');
      return;
    }

    setNodes((nds) => nds.filter(node => {
      if (node.id === nodeId) {
        // 清理节点相关的定时器和任务
        if (node._timeoutIds) {
          node._timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
        }
        // 取消正在进行的查询任务
        if (node._cancelQueryTask) {
          node._cancelQueryTask.forEach(cancelFn => cancelFn());
        }
        return false; // 过滤掉这个节点
      }
      return true;
    }));
    setEdges((eds) => eds.filter(edge =>
      edge.source !== nodeId && edge.target !== nodeId
    ));

    setSelectedNode((prev) => (prev?.id === nodeId ? null : prev));
  }, []);

  /**
   * 修改节点模型
   */
  const handleNodeModelChange = useCallback((nodeId, modelId, setNodes, setSelectedNode) => {
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
  }, []);

  /**
   * 修改节点文本
   */
  const handleNodeTextChange = useCallback((nodeId, text, setNodes, setSelectedNode) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return {
        ...node,
        data: {
          ...node.data,
          text
        }
      };
    }));

    setSelectedNode((prev) => {
      if (!prev || prev.id !== nodeId) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          text
        }
      };
    });
  }, []);

  /**
   * 修改节点序号
   */
  const handleSequenceChange = useCallback((nodeId, sequenceNumber, checkDuplicate = false, nodesRef, setNodes, setSelectedNode) => {
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
  }, []);

  /**
   * 发送节点请求
   */
  const handleSendNodeRequest = useCallback(async (nodeId, nodes, setNodes, setSelectedNode) => {
    if (!nodeId) return;

    const currentNodes = nodes;
    const targetNode = currentNodes.find((node) => node.id === nodeId);
    if (!targetNode) {
      console.error('节点不存在:', nodeId);
      return;
    }

    console.log('发送节点请求:', targetNode.type, targetNode.data.label);

    // 设置节点状态为运行中
    setNodes((nds) => nds.map((node) => {
      if (node.id !== nodeId) return node;
      return { ...node, data: { ...node.data, status: 'running' } };
    }));

    // 模拟 API 请求延迟
    setTimeout(() => {
      setNodes((nds) => nds.map((node) => {
        if (node.id !== nodeId) return node;
        return { ...node, data: { ...node.data, status: 'completed' } };
      }));

      setSelectedNode((prev) => {
        if (!prev || prev.id !== nodeId) return prev;
        return { ...prev, data: { ...prev.data, status: 'completed' } };
      });

      console.log('节点请求完成:', nodeId);
    }, 2000);
  }, []);

  return {
    handleNodeImageSelect,
    handleNodeVideoSelect,
    handleDeleteNode,
    handleNodeModelChange,
    handleNodeTextChange,
    handleSequenceChange,
    handleSendNodeRequest,
  };
};
