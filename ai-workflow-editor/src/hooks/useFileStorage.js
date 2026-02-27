import { useCallback } from 'react';

/**
 * 文件存储 Hook
 * 处理工作流的保存和加载
 */
export const useFileStorage = () => {
  /**
   * 处理节点数据，保存服务器相对路径
   */
  const processNodesForSave = useCallback(async (nodes) => {
    return nodes.map((node) => {
      const processedNode = { ...node };
      if (processedNode.data) {
        const data = { ...processedNode.data };

        // 保存服务器相对路径（如 /ti2v_videos/xxx.mp4）
        if (data.serverPath) {
          data.preview = data.serverPath;
          data.videoUrl = data.serverPath;
        } else if (data.preview?.startsWith('http://localhost:3001/')) {
          // 如果是完整URL，转换为相对路径
          data.preview = data.preview.replace('http://localhost:3001', '');
          data.videoUrl = data.videoUrl?.replace('http://localhost:3001', '') || data.preview;
        }

        // lastFrame 清空
        if (data.lastFrame) {
          data.lastFrame = '';
        }

        processedNode.data = data;
      }
      return processedNode;
    });
  }, []);

  /**
   * 保存数据到文件
   */
  const saveDataToFile = useCallback(async (nodes, edges, filePath = null, timelineData = null) => {
    try {
      console.log('开始保存文件，节点数量:', nodes.length);

      // 处理节点数据
      const processedNodes = await processNodesForSave(nodes);
      console.log('节点数据处理完成');

      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        nodes: processedNodes,
        edges,
        timeline: timelineData,
        filePath // 保存文件路径元数据
      };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 检查文件大小
      const fileSizeMB = blob.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        console.warn(`文件大小较大: ${fileSizeMB.toFixed(2)}MB，可能需要较长时间保存`);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // 如果有指定路径则使用该路径，否则生成新文件名
      a.download = filePath || `ai-workflow-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('文件已保存:', a.download, `(${fileSizeMB.toFixed(2)}MB)`);
      return a.download;
    } catch (error) {
      console.error('保存文件失败:', error);
      alert(`保存文件失败: ${error.message}`);
      return null;
    }
  }, [processNodesForSave]);

  /**
   * 保存数据到文件（使用文件选择器指定位置和名称）
   * 返回 { fileName, fileHandle }
   */
  const saveDataToFileWithCustomPath = useCallback(async (nodes, edges, timelineData = null) => {
    try {
      console.log('开始保存文件，节点数量:', nodes.length);

      // 处理节点数据
      const processedNodes = await processNodesForSave(nodes);
      console.log('节点数据处理完成');

      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        nodes: processedNodes,
        edges,
        timeline: timelineData,
      };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 检查文件大小
      const fileSizeMB = blob.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        console.warn(`文件大小较大: ${fileSizeMB.toFixed(2)}MB，可能需要较长时间保存`);
      }

      // 使用 showSaveFilePicker API（支持指定保存位置和文件名）
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: `ai-workflow-${new Date().toISOString().slice(0, 10)}.json`,
          types: [
            {
              description: 'JSON 文件',
              accept: {
                'application/json': ['.json'],
              },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        console.log('文件已保存:', fileHandle.name, `(${fileSizeMB.toFixed(2)}MB)`);
        return { fileName: fileHandle.name, fileHandle };
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log('用户取消保存');
          return null;
        }

        // 如果 showSaveFilePicker 不可用，回退到默认方式
        console.warn('showSaveFilePicker 不可用，使用默认保存方式:', err.message);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-workflow-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('文件已保存:', a.download, `(${fileSizeMB.toFixed(2)}MB)`);
        return { fileName: a.download, fileHandle: null };
      }
    } catch (error) {
      console.error('保存文件失败:', error);
      alert(`保存文件失败: ${error.message}`);
      return null;
    }
  }, [processNodesForSave]);

  /**
   * 覆盖保存到已有文件（使用 FileHandle）
   */
  const saveToExistingFile = useCallback(async (nodes, edges, fileHandle, timelineData = null) => {
    try {
      if (!fileHandle) {
        throw new Error('文件句柄不存在');
      }

      console.log('开始覆盖保存文件，节点数量:', nodes.length);

      // 处理节点数据
      const processedNodes = await processNodesForSave(nodes);
      console.log('节点数据处理完成');

      const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        nodes: processedNodes,
        edges,
        timeline: timelineData,
      };
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 检查文件大小
      const fileSizeMB = blob.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        console.warn(`文件大小较大: ${fileSizeMB.toFixed(2)}MB，可能需要较长时间保存`);
      }

      // 使用 FileHandle 覆盖文件
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      console.log('文件已覆盖保存:', fileHandle.name, `(${fileSizeMB.toFixed(2)}MB)`);
      return { fileName: fileHandle.name, fileHandle };
    } catch (error) {
      console.error('覆盖保存文件失败:', error);
      alert(`保存失败: ${error.message}`);
      return null;
    }
  }, [processNodesForSave]);

  /**
   * 从文件加载数据
   */
  const loadDataFromFile = useCallback(async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) {
        console.warn('未选择文件');
        return null;
      }

      console.log('开始读取文件:', file.name);
      const text = await file.text();
      const data = JSON.parse(text);

      // 验证文件格式
      if (!data.version || !data.nodes) {
        throw new Error('无效的工作流文件格式');
      }

      console.log('文件读取成功，版本:', data.version);
      return data;
    } catch (error) {
      console.error('读取文件失败:', error);
      alert(`读取文件失败: ${error.message}`);
      return null;
    }
  }, []);

  return {
    processNodesForSave,
    saveDataToFile,
    saveDataToFileWithCustomPath,
    saveToExistingFile,
    loadDataFromFile,
  };
};
