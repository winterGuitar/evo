import { useState, useCallback } from 'react';

/**
 * 时间轴和视频合成 Hook
 */
export const useTimeline = (timelineItems) => {
  const [selectedTimelineItems, setSelectedTimelineItems] = useState([]);
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false);
  const [composedVideoUrl, setComposedVideoUrl] = useState('');
  const [composedVideoServerPath, setComposedVideoServerPath] = useState('');
  const [composeProgress, setComposeProgress] = useState({ current: 0, total: 0, isComposing: false });

  /**
   * 点击时间轴项目
   */
  const handleTimelineItemClick = useCallback((itemId) => {
    if (selectedTimelineItems.includes(itemId)) {
      setSelectedTimelineItems((prev) => prev.filter((id) => id !== itemId));
    } else {
      setSelectedTimelineItems((prev) => [...prev, itemId]);
    }
  }, [selectedTimelineItems]);

  /**
   * 选择所有时间轴项目
   */
  const handleSelectAllTimeline = useCallback(() => {
    const allIds = timelineItems.map((item) => item.id);
    setSelectedTimelineItems(allIds);
  }, [timelineItems]);

  /**
   * 清除时间轴选择
   */
  const handleClearTimelineSelection = useCallback(() => {
    setSelectedTimelineItems([]);
  }, []);

  /**
   * 合成视频
   */
  const handleComposeVideo = useCallback(async () => {
    if (selectedTimelineItems.length < 2) {
      alert('请至少选择 2 个视频节点进行合成');
      return;
    }

    // 按序号排序选中的节点
    const sortedItems = timelineItems
      .filter((item) => selectedTimelineItems.includes(item.id))
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    const selectedUrls = sortedItems.map((item) => item.preview);
    const selectedSequenceNumbers = sortedItems.map((item) => item.sequenceNumber);

    console.log('开始合成视频，顺序:', selectedSequenceNumbers);
    console.log('视频URLs:', selectedUrls);

    // 前端本地视频合成
    try {
      // 初始化进度
      setComposeProgress({ current: 0, total: selectedUrls.length, isComposing: true });

      // 使用 MediaRecorder API 在浏览器中合并视频
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 加载所有视频
      const videoElements = [];
      for (const url of selectedUrls) {
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = 'anonymous';
        video.muted = true;

        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            console.log('视频加载完成:', url);
            resolve();
          };
          video.onerror = (e) => {
            console.error('视频加载失败:', url, e);
            resolve(); // 即使失败也继续
          };
          // 设置超时
          setTimeout(() => {
            console.warn('视频加载超时:', url);
            resolve();
          }, 10000);
        });

        videoElements.push(video);
      }

      // 更新进度：开始合成
      setComposeProgress({ current: 0, total: videoElements.length, isComposing: true });

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
          const uploadRes = await fetch('http://localhost:3001/api/ti2v/upload', {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.code === 0) {
            serverPath = uploadData.data.path;
            serverUrl = `http://localhost:3001${serverPath}`;
            console.log('合成视频上传成功，服务器路径:', serverPath);
          } else {
            console.error('合成视频上传失败:', uploadData.message);
          }
        } catch (e) {
          console.error('上传合成视频失败:', e);
        }

        // 保存服务器路径，用于保存文件时使用
        setComposedVideoServerPath(serverPath);
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
          alert(`视频合成成功！\n合成序号: ${selectedSequenceNumbers.join(', ')}\n文件大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
          alert(`视频合成成功！\n合成序号: ${selectedSequenceNumbers.join(', ')}\n文件大小: ${(blob.size / 1024 / 1024).toFixed(2)} MB\n已保存到服务器`);
        }
        setComposedVideoUrl(finalVideoUrl);
        setComposeProgress({ current: videoElements.length, total: videoElements.length, isComposing: false });
      };

      mediaRecorder.start();
      console.log('MediaRecorder 已启动');

      // 依次播放并绘制每个视频到画布
      for (let i = 0; i < videoElements.length; i++) {
        const video = videoElements[i];
        console.log(`正在处理第 ${i + 1}/${videoElements.length} 个视频`);

        // 更新进度
        setComposeProgress(prev => ({ ...prev, current: i + 1 }));

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
      setComposeProgress({ current: 0, total: 0, isComposing: false });
      alert(`视频合成失败: ${error.message}\n请查看控制台获取详细信息`);
    }
  }, [selectedTimelineItems, timelineItems]);

  return {
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
  };
};
