import { useRef, useCallback, useEffect, useState, Fragment } from 'react';
import { Handle } from 'reactflow';
import { nodeStyles, animations, colors } from '../styles';
import { getNodeColor, getNodeIcon, AI_MODELS } from '../constants';

const AINode = ({
  data,
  type,
  isConnectable,
  selected,
  id,
  onDelete,
  onDisconnectAllEdges,
  onResize,
  onModelChange,
  onTextChange,
  onImageSelect,
  onVideoSelect,
  onSendRequest,
  onLastFrameCaptured,
  onAspectRatioChange,
  onToggleTimeline,
  isInTimeline = false
}) => {
  const nodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);
  const nodeType = type || data.type;
  const nodeColor = getNodeColor(nodeType);
  const isGenerativeNode = ['image-gen', 'video-gen'].includes(nodeType);
  const isInputNode = ['image-input', 'video-input'].includes(nodeType);
  const isImageInputNode = nodeType === 'image-input';
  const isVideoInputNode = nodeType === 'video-input';
  const isVideoGenNode = nodeType === 'video-gen';
  const modelOptions = isGenerativeNode ? (AI_MODELS[nodeType] || []) : [];
  const hasSelectedModel = modelOptions.some((model) => model.id === data.model);
  const selectedModelId = hasSelectedModel ? data.model : (modelOptions[0]?.id || '');
  const inputPreviews = Array.isArray(data.inputPreviews)
    ? data.inputPreviews.filter((item) => item?.preview)
    : [];

  // 视频比例选项
  const aspectRatioOptions = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
  const currentAspectRatio = data.aspectRatio || '16:9';

  // 视频时长选项（秒数 -> frame数）
  const durationOptions = [
    { label: '5s', value: '5s', frames: 121 },
    { label: '10s', value: '10s', frames: 241 }
  ];
  const currentDuration = data.duration || '5s';

  // 视频设置面板状态
  const [showVideoSettings, setShowVideoSettings] = useState(false);

  // 图片分割设置
  const [splitRows, setSplitRows] = useState(data.splitRows || 1);
  const [splitCols, setSplitCols] = useState(data.splitCols || 1);
  const [showSplitSettings, setShowSplitSettings] = useState(false);

  const formatDisplayName = useCallback((name, maxChars = 6) => {
    if (!name || typeof name !== 'string') return name || '';
    const chars = Array.from(name);
    if (chars.length <= maxChars) return name;
    return `${chars.slice(0, maxChars).join('')}...`;
  }, []);
  const displayLabel = formatDisplayName(data.label || 'Untitled Node');
  const displayFileName = formatDisplayName(data.fileName || '');

  const handleDelete = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onDelete || !id) return;
    if (window.confirm(`确定要删除节点 "${data.label || id}" 吗？`)) {
      onDelete(id);
    }
  }, [id, data.label, onDelete]);

  const handleDisconnectAllEdges = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (onDisconnectAllEdges && id) {
      onDisconnectAllEdges(id);
    }
  }, [id, onDisconnectAllEdges]);

  const handleResizeStart = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!nodeRef.current || !id || !onResize) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = nodeRef.current.offsetWidth;
    const startHeight = nodeRef.current.offsetHeight;

    const handleMouseMove = (moveEvent) => {
      const nextWidth = Math.max(220, Math.round(startWidth + (moveEvent.clientX - startX)));
      const nextHeight = Math.max(140, Math.round(startHeight + (moveEvent.clientY - startY)));
      onResize(id, { width: nextWidth, height: nextHeight });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [id, onResize]);

  const handleModelChange = useCallback((event) => {
    const nextModelId = event.target.value;
    if (!nextModelId || !onModelChange) return;
    onModelChange(id, nextModelId);
  }, [id, onModelChange]);

  const handleTextChange = useCallback((event) => {
    if (!onTextChange) return;
    onTextChange(id, event.target.value);
  }, [id, onTextChange]);

  const handleAspectRatioChange = useCallback((ratio) => {
    if (!ratio || !onAspectRatioChange) return;
    onAspectRatioChange(id, ratio);
  }, [id, onAspectRatioChange]);

  const handleDurationChange = useCallback((duration) => {
    if (!duration || !onAspectRatioChange) return;
    onAspectRatioChange(id, undefined, duration);
  }, [id, onAspectRatioChange]);

  const handleSplitRowsChange = useCallback((value) => {
    const numValue = Math.max(1, Math.min(10, parseInt(value) || 1));
    setSplitRows(numValue);
    if (onModelChange) {
      onModelChange(id, undefined, { splitRows: numValue });
    }
  }, [id, onModelChange]);

  const handleSplitColsChange = useCallback((value) => {
    const numValue = Math.max(1, Math.min(10, parseInt(value) || 1));
    setSplitCols(numValue);
    if (onModelChange) {
      onModelChange(id, undefined, { splitCols: numValue });
    }
  }, [id, onModelChange]);

  const handleOpenFilePicker = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    fileInputRef.current?.click();
  }, []);

  const handleInputFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isImageInputNode && onImageSelect) {
      onImageSelect(id, file);
    }

    if (isVideoInputNode && onVideoSelect) {
      onVideoSelect(id, file);
    }

    event.target.value = '';
  }, [id, isImageInputNode, isVideoInputNode, onImageSelect, onVideoSelect]);

  const handleSendRequest = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isGenerativeNode || !onSendRequest) return;
    onSendRequest(id);
  }, [id, isGenerativeNode, onSendRequest]);

  // 截取视频最后一帧
  const handleCaptureLastFrame = useCallback(async (videoSrc) => {
    if (!videoSrc) return null;

    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoSrc;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      const cleanup = () => {
        video.pause();
        video.remove();
      };

      let seekAttempts = 0;
      const maxSeekAttempts = 2;

      const captureFrame = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');

          // 清空画布
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 绘制视频帧
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // 检查画布是否为空（全黑）
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let isBlack = true;
          for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i] !== 0 || imageData.data[i + 1] !== 0 || imageData.data[i + 2] !== 0) {
              isBlack = false;
              break;
            }
          }

          if (isBlack && seekAttempts < maxSeekAttempts) {
            // 如果是黑屏，尝试中间帧
            seekAttempts++;
            console.warn(`捕获的视频帧为全黑，尝试提取中间帧 (尝试 ${seekAttempts}/${maxSeekAttempts})`);
            const targetTime = video.duration * (seekAttempts === 1 ? 0.5 : 0.25);
            video.currentTime = targetTime;
          } else {
            const frameData = canvas.toDataURL('image/jpeg', 0.8);
            cleanup();
            resolve(frameData);
          }
        } catch (error) {
          console.error('Failed to capture video frame:', error);
          cleanup();
          resolve(null);
        }
      };

      video.addEventListener('loadeddata', () => {
        // 等待一下再跳转，确保视频已加载
        setTimeout(() => {
          // 跳转到最后一帧的前0.1秒，避免某些视频在最后一帧是黑屏
          video.currentTime = Math.max(0, video.duration - 0.1);
        }, 100);
      });

      video.addEventListener('seeked', () => {
        // 等待一小段时间确保帧已渲染
        setTimeout(captureFrame, 200);
      });

      video.addEventListener('error', (error) => {
        console.error('Video load error:', error);
        cleanup();
        resolve(null);
      });

      video.load();
    });
  }, []);

  // 当视频源变化时，如果是视频生成节点或视频输入节点，尝试截取最后一帧
  useEffect(() => {
    if ((nodeType === 'video-gen' || isVideoInputNode) && data.preview && onLastFrameCaptured) {
      handleCaptureLastFrame(data.preview).then((frameData) => {
        if (frameData) {
          onLastFrameCaptured(id, frameData);
        }
      });
    }
  }, [data.preview, nodeType, isVideoInputNode, handleCaptureLastFrame, onLastFrameCaptured, id]);

  // 自动调整textarea高度
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 120)}px`;
    }
  }, [data.inputText]);

  const previewFooterText = nodeType === 'video-gen'
    ? 'Video Thumbnail'
    : 'Generated Image';
  const shouldShowImagePreviewContainer = nodeType === 'image-gen' || (nodeType === 'image-input' && Boolean(data.preview));
  const shouldShowVideoPreviewContainer = isVideoInputNode || (nodeType === 'video-gen' && Boolean(data.preview));

  const nodeHeaderLabelMap = {
    'image-input': '图片输入',
    'video-input': '视频输入',
    'image-gen': '图片生成',
    'video-gen': '视频生成'
  };

  return (
    <Fragment>
      <div
        ref={nodeRef}
        style={{
          ...nodeStyles.container(selected, nodeColor),
          ...(data.width ? { width: data.width } : {}),
          ...(data.height ? { height: data.height } : {})
        }}
        onClick={(event) => event.stopPropagation()}
      >
      <div style={nodeStyles.header(nodeColor)}>
        {nodeHeaderLabelMap[nodeType] || (data.type || 'AI NODE')}
      </div>

      {/* 时间轴 Toggle 按钮 (仅视频节点显示) */}
      {(nodeType === 'video-input' || nodeType === 'video-gen') && onToggleTimeline && (
        <button
          type="button"
          className="nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTimeline(id);
          }}
          style={{
            position: 'absolute',
            top: 26,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 10,
            backgroundColor: isInTimeline ? '#4CAF50' : `${nodeColor}15`,
            padding: '3px 8px',
            borderRadius: 4,
            border: isInTimeline ? '1px solid #4CAF50' : `1px solid ${nodeColor}40`,
            cursor: 'pointer',
            fontSize: 10,
            color: isInTimeline ? 'white' : colors.text.light,
            fontWeight: 600,
            outline: 'none',
            transition: 'all 0.2s'
          }}
          onMouseDown={(event) => event.stopPropagation()}
          title={isInTimeline ? '从时间轴移除' : '添加到时间轴'}
        >
          {isInTimeline ? '✓ 已添加' : '+ 时间轴'}
        </button>
      )}

      <button
        type="button"
        className="nodrag nopan"
        onClick={handleDelete}
        onPointerDown={(e) => e.stopPropagation()}
        title="Delete node"
        style={{ ...nodeStyles.deleteButton, ...nodeStyles.deleteButtonVisible }}
      >
        x
      </button>

      <button
        type="button"
        className="nodrag nopan"
        onClick={handleDisconnectAllEdges}
        onPointerDown={(e) => e.stopPropagation()}
        title="断开所有连接"
        style={{
          ...nodeStyles.disconnectAllButton,
          ...(selected ? nodeStyles.disconnectAllButtonSelected : nodeStyles.disconnectAllButtonDefault)
        }}
      >
        断
      </button>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, marginBottom: 10 }}>
        <div style={nodeStyles.iconContainer(nodeColor)}>{getNodeIcon(data.type)}</div>
        <div>
          <div
            style={{ fontWeight: 600, fontSize: 15, color: colors.text.primary }}
            title={data.label || 'Untitled Node'}
          >
            {displayLabel}
          </div>
          <div style={{ fontSize: 11, color: colors.text.light, marginTop: 2 }}>
            ID: {id?.slice(-6) || data.id?.slice(-6) || 'new'}
          </div>
        </div>
      </div>

      {/* 顶部控制栏：模型选择 + 视频设置 + Send按钮 */}
      {/* 顶部控制栏：模型选择 + 视频设置 + Send按钮 */}
      {!isInputNode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', padding: '0 4px' }}>
          {/* 模型选择 */}
          {modelOptions.length > 0 && (
            <select
              className="nodrag"
              value={selectedModelId}
              onChange={handleModelChange}
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                ...nodeStyles.modelSelect,
                fontSize: '10px',
                padding: '4px 4px',
                flex: 1,
                height: '24px'
              }}
            >
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          )}

          {/* 视频设置按钮 - 仅对视频生成节点显示 */}
          {isVideoGenNode && (
            <button
              type="button"
              className="nodrag nopan"
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoSettings(!showVideoSettings);
              }}
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                backgroundColor: showVideoSettings
                  ? '#60a5fa'
                  : '#475569',
                border: showVideoSettings
                  ? '2px solid #60a5fa'
                  : '1px solid #64748b',
                borderRadius: '4px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '10px',
                padding: '4px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                flex: 1.5,
                height: '24px'
              }}
            >
              <span>⚙️ 设置</span>
              <span style={{ fontSize: '8px' }}>{showVideoSettings ? '▼' : '▶'}</span>
            </button>
          )}

          {/* Send按钮 - 仅生成节点显示 */}
          {isGenerativeNode && (
            <button
              type="button"
              className="nodrag nopan"
              onClick={handleSendRequest}
              onMouseDown={(event) => event.stopPropagation()}
              disabled={data.status === 'running'}
              style={{
                backgroundColor: data.status === 'running' ? '#94a3b8' : nodeColor,
                borderRadius: '4px',
                border: 'none',
                color: '#ffffff',
                cursor: data.status === 'running' ? 'not-allowed' : 'pointer',
                fontSize: '10px',
                fontWeight: 600,
                padding: '4px 6px',
                flex: 0.7,
                height: '24px',
                opacity: data.status === 'running' ? 0.7 : 1
              }}
            >
              {data.status === 'running' ? 'Send' : 'Send'}
            </button>
          )}
        </div>
      )}

      {/* 图片分割设置和选择文件按钮 - 仅对图片输入节点显示，放在一排 */}
      {isImageInputNode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '0 4px' }}>
          <button
            type="button"
            className="nodrag nopan"
            onClick={(e) => {
              e.stopPropagation();
              setShowSplitSettings(!showSplitSettings);
            }}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              backgroundColor: showSplitSettings
                ? '#60a5fa'
                : '#475569',
              border: showSplitSettings
                ? '2px solid #60a5fa'
                : '1px solid #64748b',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              flex: 1,
              height: '24px'
            }}
          >
            <span>✂️ 分割</span>
            <span style={{ fontSize: '8px' }}>{showSplitSettings ? '▼' : '▶'}</span>
          </button>
          <button
            type="button"
            className="nodrag nopan"
            onClick={handleOpenFilePicker}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              backgroundColor: '#475569',
              border: '1px solid #64748b',
              borderRadius: '4px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '10px',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              height: '24px'
            }}
          >
            选择图片
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={nodeStyles.hiddenFileInput}
            onChange={handleInputFileChange}
            tabIndex={-1}
          />
        </div>
      )}

      {!isInputNode && (
        <div style={nodeStyles.textInputSection}>
          <span style={nodeStyles.textInputLabel}>Prompt:</span>
          <textarea
            ref={textAreaRef}
            className="nodrag nopan"
            value={data.inputText || ''}
            onChange={handleTextChange}
            onMouseDown={(event) => event.stopPropagation()}
            placeholder="Input prompt..."
            style={{
              ...nodeStyles.textInput,
              resize: 'none',
              overflow: 'hidden',
              minHeight: '28px',
              maxHeight: '120px',
              lineHeight: '1.4'
            }}
          />
        </div>
      )}




      {isGenerativeNode && inputPreviews.length > 0 && (
        <div style={nodeStyles.inputPreviewContainer}>
          <div style={nodeStyles.inputPreviewHeader}>Input Images</div>
          <div style={nodeStyles.inputPreviewList}>
            {inputPreviews.map((item, index) => (
              <div
                key={`${item.nodeId || 'input'}-${index}`}
                style={nodeStyles.inputPreviewItem}
                title={item.fileName || `input-${index + 1}`}
              >
                <img
                  src={item.preview}
                  alt={item.fileName || `input ${index + 1}`}
                  crossOrigin="anonymous"
                  style={nodeStyles.inputPreviewImage}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isInputNode && !isImageInputNode && (
        <div style={nodeStyles.filePickerSection}>
          <button
            type="button"
            className="nodrag nopan"
            onClick={handleOpenFilePicker}
            onMouseDown={(event) => event.stopPropagation()}
            style={nodeStyles.filePickerButton}
          >
            {isVideoInputNode ? '选择视频' : '选择图片'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={isVideoInputNode ? 'video/*' : 'image/*'}
            style={nodeStyles.hiddenFileInput}
            onChange={handleInputFileChange}
            tabIndex={-1}
          />
        </div>
      )}

      {shouldShowImagePreviewContainer && (
        <div style={nodeStyles.previewContainer}>
          {data.preview ? (
            <>
              {isImageInputNode && data.splits && data.splits.length > 1 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${data.splitCols || 1}, 1fr)`,
                  gap: '2px',
                  width: '100%'
                }}>
                  {data.splits.map((split) => (
                    <div
                      key={split.index}
                      style={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: `${split.width}/${split.height}`,
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}
                    >
                      <img
                        src={split.data}
                        alt={`Split ${split.label}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '2px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        fontSize: '10px',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        pointerEvents: 'none'
                      }}>
                        {split.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <img src={data.preview} alt="Preview" crossOrigin="anonymous" style={nodeStyles.previewImage} />
              )}
              {nodeType !== 'image-input' && (
                <div style={nodeStyles.previewFooter} title={data.fileName || previewFooterText}>
                  {data.fileName ? displayFileName : previewFooterText}
                </div>
              )}
            </>
          ) : (
            <div style={nodeStyles.previewPlaceholder}>No image yet</div>
          )}
        </div>
      )}

      {shouldShowVideoPreviewContainer && (
        <div style={nodeStyles.previewContainer}>
          {data.preview ? (
            <video
              src={data.preview}
              crossOrigin="anonymous"
              style={nodeStyles.previewVideo}
              controls
              preload="metadata"
            />
          ) : (
            <div style={nodeStyles.previewPlaceholder}>No video yet</div>
          )}
        </div>
      )}

      {!isInputNode && (
        <div style={nodeStyles.description(nodeColor)}>{data.description || 'No description'}</div>
      )}

      {data.status && (
        <div style={nodeStyles.status(data.status)}>
          <span style={nodeStyles.statusDot(data.status)} />
          {data.status === 'running'
            ? 'Running...'
            : data.status === 'completed'
              ? 'Completed'
              : data.status === 'error'
                ? 'Error'
                : 'Idle'}
        </div>
      )}

      <div
        className="nodrag nopan"
        style={nodeStyles.resizeHandle}
        onMouseDown={handleResizeStart}
        title="Resize node"
      />

      <Handle
        type="target"
        position="left"
        id="input"
        isConnectable={isConnectable}
        style={{ ...nodeStyles.handle.base, ...nodeStyles.handle.target }}
      />
      {/* 图片输入节点：根据分割数量生成多个输出 Handle */}
      {isImageInputNode && data.splitRows > 0 && data.splitCols > 0 && data.preview ? (
        Array.from({ length: data.splitRows * data.splitCols }).map((_, index) => {
          const row = Math.floor(index / data.splitCols);
          const col = index % data.splitCols;
          const totalParts = data.splitRows * data.splitCols;
          // 计算位置：从上到下，从左到右分布在右侧
          const topPercent = ((row * data.splitCols + col + 1) / (totalParts + 1)) * 100;
          return (
            <Fragment key={`split-${index}`}>
              <Handle
                type="source"
                position="right"
                id={`output-${index}`}
                isConnectable={isConnectable}
                style={{
                  ...nodeStyles.handle.base,
                  ...nodeStyles.handle.source,
                  top: `${topPercent}%`,
                  right: -4,
                  width: 10,
                  height: 10,
                  backgroundColor: '#60a5fa'
                }}
              />
              {/* 编号标签 */}
              <div
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: `calc(${topPercent}% - 7px)`,
                  backgroundColor: '#60a5fa',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '1px 4px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none'
                }}
              >
                {row + 1}-{col + 1}
              </div>
            </Fragment>
          );
        })
      ) : (
        <Handle
          type="source"
          position="right"
          id="output"
          isConnectable={isConnectable}
          style={{ ...nodeStyles.handle.base, ...nodeStyles.handle.source }}
        />
      )}

      <style>{animations}</style>
    </div>

      {/* 浮动视频设置面板 - 紧贴节点右侧 */}
      {isVideoGenNode && showVideoSettings && nodeRef.current && (
        <div
          style={{
            position: 'absolute',
            left: `${nodeRef.current.offsetWidth + 10}px`,
            top: '0px',
            width: '240px',
            padding: '16px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            backdropFilter: 'blur(8px)'
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#ffffff',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>视频设置</div>

          {/* 视频比例Toggle组 */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px',
              fontWeight: 500
            }}>视频比例</div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              {aspectRatioOptions.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  className="nodrag nopan"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAspectRatioChange(ratio);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 4,
                    border: currentAspectRatio === ratio
                      ? '2px solid #60a5fa'
                      : '1px solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: currentAspectRatio === ratio
                      ? 'rgba(96, 165, 250, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* 视频时长Toggle组 */}
          <div>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px',
              fontWeight: 500
            }}>视频时长</div>
            <div style={{
              display: 'flex',
              gap: '6px'
            }}>
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="nodrag nopan"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDurationChange(option.value);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: currentDuration === option.value
                      ? '2px solid #60a5fa'
                      : '1px solid rgba(255, 255, 255, 0.2)',
                    backgroundColor: currentDuration === option.value
                      ? 'rgba(96, 165, 250, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: '#ffffff',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 图片分割设置面板 - 紧贴节点右侧 */}
      {isImageInputNode && showSplitSettings && nodeRef.current && (
        <div
          style={{
            position: 'absolute',
            left: `${nodeRef.current.offsetWidth + 10}px`,
            top: '0px',
            width: '240px',
            padding: '16px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            zIndex: 1000,
            backdropFilter: 'blur(8px)'
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#ffffff',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>图片分割</div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px',
              fontWeight: 500
            }}>行数（横向分割）</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input
                type="number"
                min="1"
                max="10"
                value={splitRows}
                onChange={(e) => handleSplitRowsChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="nodrag nopan"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <span style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                minWidth: '60px'
              }}>
                {splitRows} 行
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px',
              fontWeight: 500
            }}>列数（纵向分割）</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <input
                type="number"
                min="1"
                max="10"
                value={splitCols}
                onChange={(e) => handleSplitColsChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="nodrag nopan"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <span style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                minWidth: '60px'
              }}>
                {splitCols} 列
              </span>
            </div>
          </div>

          <div style={{
            padding: '10px',
            borderRadius: 4,
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
            border: '1px solid rgba(96, 165, 250, 0.3)'
          }}>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: '1.5'
            }}>
              将图片分割为 <strong>{splitRows * splitCols}</strong> 部分<br/>
              从左到右，从上到下排序
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
};

export default AINode;
