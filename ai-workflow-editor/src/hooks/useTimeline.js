import { useCallback, useReducer } from 'react';

// API 基础地址
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Reducer 状态管理
const initialState = {
  selectedTimelineItems: [],
  isTimelineCollapsed: false,
  composedVideoUrl: '',
  composedVideoServerPath: '',
  composeProgress: { current: 0, total: 0, isComposing: false }
};

const timelineReducer = (state, action) => {
  switch (action.type) {
    case 'TOGGLE_ITEM_SELECTION':
      const { itemId } = action.payload;
      const isSelected = state.selectedTimelineItems.includes(itemId);
      return {
        ...state,
        selectedTimelineItems: isSelected
          ? state.selectedTimelineItems.filter(id => id !== itemId)
          : [...state.selectedTimelineItems, itemId]
      };
    case 'SET_SELECTED_ITEMS':
      return { ...state, selectedTimelineItems: action.payload };
    case 'TOGGLE_COLLAPSED':
      return { ...state, isTimelineCollapsed: !state.isTimelineCollapsed };
    case 'SET_COLLAPSED':
      return { ...state, isTimelineCollapsed: action.payload };
    case 'SET_COMPOSED_VIDEO':
      return { ...state, composedVideoUrl: action.payload };
    case 'SET_COMPOSED_SERVER_PATH':
      return { ...state, composedVideoServerPath: action.payload };
    case 'SET_COMPOSE_PROGRESS':
      return { ...state, composeProgress: action.payload };
    default:
      return state;
  }
};

/**
 * 时间轴和视频合成 Hook
 */
export const useTimeline = (timelineItems) => {
  const [state, dispatch] = useReducer(timelineReducer, initialState);

  /**
   * 点击时间轴项目
   */
  const handleTimelineItemClick = useCallback((itemId) => {
    dispatch({ type: 'TOGGLE_ITEM_SELECTION', payload: { itemId } });
  }, []);

  /**
   * 选择所有时间轴项目
   */
  const handleSelectAllTimeline = useCallback(() => {
    const allIds = timelineItems.map((item) => item.id);
    dispatch({ type: 'SET_SELECTED_ITEMS', payload: allIds });
  }, [timelineItems]);

  /**
   * 清除时间轴选择
   */
  const handleClearTimelineSelection = useCallback(() => {
    dispatch({ type: 'SET_SELECTED_ITEMS', payload: [] });
  }, []);

  /**
   * 加载单个视频（带超时清理）
   */
  const loadVideoWithTimeout = useCallback((video, url, timeout = 10000) => {
    return new Promise((resolve) => {
      let timeoutId = null;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      video.onloadedmetadata = () => {
        console.log('视频加载完成:', url);
        cleanup();
      };

      video.onerror = (e) => {
        console.error('视频加载失败:', url, e);
        cleanup();
      };

      timeoutId = setTimeout(() => {
        console.warn('视频加载超时:', url);
        cleanup();
      }, timeout);

      video.src = url;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.load();
    });
  }, []);

  /**
   * 合成视频
   */
  const handleComposeVideo = useCallback(async () => {
    const { selectedTimelineItems } = state;
    if (selectedTimelineItems.length < 2) {
      alert('请至少选择 2 个视频节点进行合成');
      return;
    }

    // timelineItems 已经按顺序排列，直接过滤选中的项目
    const sortedItems = timelineItems
      .filter((item) => selectedTimelineItems.includes(item.id));

    const selectedUrls = sortedItems.map((item) => item.preview);
    const selectedIds = sortedItems.map((item) => item.id);

    console.log('开始合成视频，顺序:', selectedIds);
    console.log('视频URLs:', selectedUrls);

    // 前端本地视频合成
    try {
      // 初始化进度
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { current: 0, total: selectedUrls.length, isComposing: true } });

      // 使用 MediaRecorder API 在浏览器中合并视频
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 并行加载所有视频（优化：并行而非串行）
      const videoElements = [];
      await Promise.all(selectedUrls.map(async (url) => {
        const video = document.createElement('video');
        await loadVideoWithTimeout(video, url);
        videoElements.push(video);
      }));

      // 更新进度：开始合成
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { current: 0, total: videoElements.length, isComposing: true } });

      // 设置画布尺寸（使用第一个视频的尺寸）
      const firstVideo = videoElements[0];
      const canvasWidth = firstVideo.videoWidth || 1280;
      const canvasHeight = firstVideo.videoHeight || 720;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      console.log('画布尺寸:', canvasWidth, 'x', canvasHeight);

      // 检查 MediaRecorder 支持的格式
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      console.log('使用媒体格式:', mimeType);

      // 创建 MediaRecorder
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5000000 // 5 Mbps
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });

        // 上传合成视频到服务器
        let serverUrl = '';
        let serverPath = '';
        try {
          const formData = new FormData();
          formData.append('file', blob, `composed_video_${Date.now()}.webm`);
          const uploadRes = await fetch(`${API_BASE_URL}/api/ti2v/upload`, {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.code === 0) {
            serverPath = uploadData.data.path;
            serverUrl = `${API_BASE_URL}${serverPath}`;
            console.log('合成视频上传成功，服务器路径:', serverPath);
          } else {
            console.error('合成视频上传失败:', uploadData.message);
          }
        } catch (e) {
          console.error('上传合成视频失败:', e);
        }

        // 保存服务器路径，用于保存文件时使用
        dispatch({ type: 'SET_COMPOSED_SERVER_PATH', payload: serverPath });
        let finalVideoUrl = serverUrl;
        if (!serverUrl) {
          // 只在需要时创建 Blob URL
          finalVideoUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = finalVideoUrl;
          a.download = `composed_video_${Date.now()}.webm`;
          a.click();
          // 立即释放 Blob URL
          setTimeout(() => URL.revokeObjectURL(finalVideoUrl), 100);
        }
        // 直接设置视频 URL，不显示弹窗，视频会自动播放
        dispatch({ type: 'SET_COMPOSED_VIDEO', payload: finalVideoUrl });
        dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { current: videoElements.length, total: videoElements.length, isComposing: false } });
      };

      mediaRecorder.start();
      console.log('MediaRecorder 已启动');

      // 依次播放并绘制每个视频到画布
      for (let i = 0; i < videoElements.length; i++) {
        const video = videoElements[i];
        console.log(`正在处理第 ${i + 1}/${videoElements.length} 个视频`);

        // 更新进度
        dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { current: i + 1, total: videoElements.length, isComposing: true } });

        await new Promise((resolve) => {
          video.currentTime = 0;
          video.onended = resolve;

          const drawFrame = () => {
            ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
            if (!video.ended) {
              requestAnimationFrame(drawFrame);
            }
          };

          video.play().then(() => {
            drawFrame();
          }).catch((e) => {
            console.error('视频播放失败:', e);
            resolve();
          });
        });
      }

      // 等待一小段时间确保最后几帧被录制
      await new Promise(r => setTimeout(r, 100));

      mediaRecorder.stop();
      console.log('MediaRecorder 已停止');

      // 清理所有视频元素
      videoElements.forEach(video => {
        video.pause();
        video.src = '';
        video.load();
        video.remove();
      });
    } catch (error) {
      console.error('视频合成失败:', error);
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { current: 0, total: 0, isComposing: false } });
      alert(`视频合成失败: ${error.message}\n请查看控制台获取详细信息`);
    }
  }, [state.selectedTimelineItems, timelineItems, loadVideoWithTimeout]);

  return {
    selectedTimelineItems: state.selectedTimelineItems,
    setSelectedTimelineItems: (items) => dispatch({ type: 'SET_SELECTED_ITEMS', payload: items }),
    isTimelineCollapsed: state.isTimelineCollapsed,
    setIsTimelineCollapsed: (collapsed) => dispatch({ type: 'SET_COLLAPSED', payload: collapsed }),
    composedVideoUrl: state.composedVideoUrl,
    setComposedVideoUrl: (url) => dispatch({ type: 'SET_COMPOSED_VIDEO', payload: url }),
    composedVideoServerPath: state.composedVideoServerPath,
    setComposedVideoServerPath: (path) => dispatch({ type: 'SET_COMPOSED_SERVER_PATH', payload: path }),
    composeProgress: state.composeProgress,
    handleTimelineItemClick,
    handleSelectAllTimeline,
    handleClearTimelineSelection,
    handleComposeVideo,
  };
};
