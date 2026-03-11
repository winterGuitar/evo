import { useCallback, useReducer, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// API 基础地址
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Reducer 状态管理
const initialState = {
  selectedTimelineItems: [],
  isTimelineCollapsed: false,
  composedVideoUrl: '',
  composedVideoServerPath: '',
  composeProgress: { current: 0, total: 0, isComposing: false, stage: '' }
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
  const ffmpegRef = useRef(null);
  const ffmpegLoadedRef = useRef(false);

  /**
   * 加载 FFmpeg
   */
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoadedRef.current && ffmpegRef.current) {
      return ffmpegRef.current;
    }

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    // 设置日志回调
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // 设置进度回调
    ffmpeg.on('progress', ({ progress }) => {
      const percent = Math.round(progress * 100);
      console.log(`FFmpeg 进度: ${percent}%`);
    });

    // 设置错误回调
    ffmpeg.on('loaded', () => {
      console.log('FFmpeg 核心加载完成');
    });

    try {
      // 使用本地 ffmpeg 文件
      const baseURL = '/ffmpeg';
      
      console.log('开始加载 FFmpeg，从本地:', baseURL);
      
      await ffmpeg.load({
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        workerURL: `${baseURL}/ffmpeg-core.worker.js`,
      });

      ffmpegLoadedRef.current = true;
      console.log('FFmpeg 加载完成');
      return ffmpeg;
    } catch (loadError) {
      console.error('本地 FFmpeg 加载失败，尝试 CDN:', loadError);
      
      // 如果本地加载失败，尝试从 CDN 加载
      try {
        const cdnURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        console.log('尝试从 CDN 加载:', cdnURL);
        
        await ffmpeg.load({
          coreURL: await toBlobURL(`${cdnURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${cdnURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpegLoadedRef.current = true;
        console.log('FFmpeg 从 CDN 加载完成');
        return ffmpeg;
      } catch (cdnError) {
        console.error('CDN FFmpeg 加载也失败:', cdnError);
        throw new Error(`FFmpeg 加载失败: ${cdnError.message}。请检查网络连接。`);
      }
    }
  }, []);

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
   * 使用 FFmpeg 合成视频
   */
  const handleComposeVideo = useCallback(async () => {
    const { selectedTimelineItems } = state;
    if (selectedTimelineItems.length < 2) {
      alert('请至少选择 2 个视频节点进行合成');
      return;
    }

    // 获取按顺序排列的选中项目
    const sortedItems = timelineItems
      .filter((item) => selectedTimelineItems.includes(item.id));

    const selectedUrls = sortedItems.map((item) => item.preview);
    const selectedIds = sortedItems.map((item) => item.id);

    console.log('开始合成视频，顺序:', selectedIds);
    console.log('视频URLs:', selectedUrls);

    try {
      // 阶段1：加载 FFmpeg
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { 
        current: 0, total: 4, isComposing: true, stage: '加载 FFmpeg...' 
      }});
      
      const ffmpeg = await loadFFmpeg();

      // 阶段2：下载所有视频文件
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { 
        current: 1, total: 4, isComposing: true, stage: '下载视频文件...' 
      }});

      const videoFiles = [];
      for (let i = 0; i < selectedUrls.length; i++) {
        const url = selectedUrls[i];
        console.log(`下载视频 ${i + 1}/${selectedUrls.length}:`, url);
        
        try {
          let videoData;
          if (url.startsWith('blob:')) {
            // 处理 blob URL：使用 fetch 获取
            const response = await fetch(url);
            const blob = await response.arrayBuffer();
            videoData = new Uint8Array(blob);
          } else if (url.startsWith('data:')) {
            // 处理 data URL
            const base64 = url.split(',')[1];
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }
            videoData = bytes;
          } else {
            // 处理普通 URL
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            videoData = new Uint8Array(arrayBuffer);
          }
          
          const fileName = `input_${i}.mp4`;
          
          await ffmpeg.writeFile(fileName, videoData);
          videoFiles.push(fileName);
          console.log(`视频 ${fileName} 写入完成，大小: ${videoData.length} bytes`);
        } catch (err) {
          console.error(`下载视频失败: ${url}`, err);
          throw new Error(`下载视频 ${i + 1} 失败: ${err.message}`);
        }
      }

      // 阶段3：创建 concat 文件列表
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { 
        current: 2, total: 4, isComposing: true, stage: '创建合成列表...' 
      }});

      // 创建 concat 文件内容
      const concatContent = videoFiles
        .map(file => `file '${file}'`)
        .join('\n');
      
      await ffmpeg.writeFile('concat.txt', concatContent);
      console.log('Concat 文件内容:\n', concatContent);

      // 阶段4：执行 FFmpeg concat 命令
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { 
        current: 3, total: 4, isComposing: true, stage: '合成视频中...' 
      }});

      // 使用 concat demuxer 合并视频
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',
        '-y',
        'output.mp4'
      ]);

      console.log('FFmpeg 合成完成');

      // 读取输出文件
      const outputData = await ffmpeg.readFile('output.mp4');
      console.log('输出文件大小:', outputData.length, 'bytes');

      // 创建 Blob
      const blob = new Blob([outputData.buffer], { type: 'video/mp4' });

      // 上传合成视频到服务器
      let serverUrl = '';
      let serverPath = '';
      
      try {
        const formData = new FormData();
        formData.append('file', blob, `composed_video_${Date.now()}.mp4`);
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

      // 清理临时文件
      for (const file of videoFiles) {
        try {
          await ffmpeg.deleteFile(file);
        } catch (e) {
          console.warn('清理临时文件失败:', file, e);
        }
      }
      try {
        await ffmpeg.deleteFile('concat.txt');
        await ffmpeg.deleteFile('output.mp4');
      } catch (e) {
        console.warn('清理临时文件失败:', e);
      }

      // 保存服务器路径
      dispatch({ type: 'SET_COMPOSED_SERVER_PATH', payload: serverPath });
      
      let finalVideoUrl = serverUrl;
      if (!serverUrl) {
        finalVideoUrl = URL.createObjectURL(blob);
        // 自动下载
        const a = document.createElement('a');
        a.href = finalVideoUrl;
        a.download = `composed_video_${Date.now()}.mp4`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(finalVideoUrl), 1000);
      }

      dispatch({ type: 'SET_COMPOSED_VIDEO', payload: finalVideoUrl });
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { 
        current: 4, total: 4, isComposing: false, stage: '完成' 
      }});

      console.log('视频合成完成:', finalVideoUrl);

    } catch (error) {
      console.error('视频合成失败:', error);
      dispatch({ type: 'SET_COMPOSE_PROGRESS', payload: { 
        current: 0, total: 0, isComposing: false, stage: '' 
      }});
      alert(`视频合成失败: ${error.message}\n请查看控制台获取详细信息`);
    }
  }, [state.selectedTimelineItems, timelineItems, loadFFmpeg]);

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
