import { useRef, useCallback, useEffect } from 'react';
import { Handle } from 'reactflow';
import { nodeStyles, animations, colors } from '../styles';
import { getNodeColor, getNodeIcon, AI_MODELS } from '../constants';
import { getModelInfo } from '../utils';

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
  onSequenceChange,
  onAspectRatioChange
}) => {
  const nodeRef = useRef(null);
  const fileInputRef = useRef(null);
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
  const currentModel = getModelInfo(selectedModelId, modelOptions);
  const inputPreviews = Array.isArray(data.inputPreviews)
    ? data.inputPreviews.filter((item) => item?.preview)
    : [];

  // 视频比例选项
  const aspectRatioOptions = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];
  const currentAspectRatio = data.aspectRatio || '16:9';

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

  const handleAspectRatioChange = useCallback((event) => {
    const ratio = event.target.value;
    if (!ratio || !onAspectRatioChange) return;
    onAspectRatioChange(id, ratio);
  }, [id, onAspectRatioChange]);

  const handleSequenceChange = useCallback((event) => {
    if (!onSequenceChange) return;
    const value = event.target.value;
    // 只允许数字输入
    const numericValue = value === '' ? '' : Math.max(1, parseInt(value, 10) || 1);
    onSequenceChange(id, numericValue, false); // false 表示这是暂存值，不检查重复
  }, [id, onSequenceChange]);

  const handleSequenceBlur = useCallback((event) => {
    if (!onSequenceChange) return;
    const value = event.target.value;
    const numericValue = value === '' ? '' : Math.max(1, parseInt(value, 10) || 1);
    onSequenceChange(id, numericValue, true); // true 表示失焦，需要检查重复
  }, [id, onSequenceChange]);

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

      const cleanup = () => {
        video.pause();
        video.remove();
      };

      video.addEventListener('loadeddata', () => {
        // 跳到最后一帧
        video.currentTime = video.duration;
      });

      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frameData = canvas.toDataURL('image/jpeg', 0.8);
          cleanup();
          resolve(frameData);
        } catch (error) {
          console.error('Failed to capture video frame:', error);
          cleanup();
          resolve(null);
        }
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

  const previewFooterText = nodeType === 'video-gen'
    ? 'Video Thumbnail'
    : 'Generated Image';
  const shouldShowImagePreviewContainer = nodeType === 'image-gen' || (nodeType === 'image-input' && Boolean(data.preview));
  const shouldShowVideoPreviewContainer = isVideoInputNode || (nodeType === 'video-gen' && Boolean(data.preview));

  const nodeHeaderLabelMap = {
    'image-input': 'IMAGE INPUT',
    'video-input': 'VIDEO INPUT',
    'image-gen': 'IMAGE GEN',
    'video-gen': 'VIDEO GEN'
  };

  return (
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

      {/* 序号输入框 */}
      <div style={{
        position: 'absolute',
        top: 26,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        zIndex: 5,
        backgroundColor: `${nodeColor}15`,
        padding: '3px 6px',
        borderRadius: 4,
        border: `1px solid ${nodeColor}40`
      }}>
        <span style={{ fontSize: 10, color: colors.text.light, fontWeight: 600 }}>序号:</span>
        <input
          type="number"
          className="nodrag nopan"
          value={data.sequenceNumber || ''}
          onChange={handleSequenceChange}
          onBlur={handleSequenceBlur}
          onMouseDown={(event) => event.stopPropagation()}
          style={{
            width: '30px',
            padding: '1px 4px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 2,
            border: `1px solid ${colors.border.default}`,
            outline: 'none',
            backgroundColor: 'white',
            color: colors.text.primary,
            textAlign: 'center'
          }}
          min="1"
          placeholder="-"
        />
      </div>

      <div
        style={{ ...nodeStyles.deleteButton, ...nodeStyles.deleteButtonVisible }}
        onClick={handleDelete}
        title="Delete node"
      >
        x
      </div>

      <button
        type="button"
        onClick={handleDisconnectAllEdges}
        title="Disconnect all edges"
        style={{
          ...nodeStyles.disconnectAllButton,
          ...(selected ? nodeStyles.disconnectAllButtonSelected : nodeStyles.disconnectAllButtonDefault)
        }}
      >
        |
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

      {!isInputNode && modelOptions.length > 0 && (
        <div style={nodeStyles.modelInfo}>
          <span style={{ fontWeight: 600 }}>Model:</span>
          <select
            className="nodrag"
            value={selectedModelId}
            onChange={handleModelChange}
            onMouseDown={(event) => event.stopPropagation()}
            style={nodeStyles.modelSelect}
          >
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>{model.name}</option>
            ))}
          </select>
          {currentModel.provider && <span style={nodeStyles.modelMeta}>Provider: {currentModel.provider}</span>}
        </div>
      )}

      {!isInputNode && (
        <div style={nodeStyles.textInputSection}>
          <span style={nodeStyles.textInputLabel}>Prompt:</span>
          <input
            type="text"
            className="nodrag nopan"
            value={data.inputText || ''}
            onChange={handleTextChange}
            onMouseDown={(event) => event.stopPropagation()}
            placeholder="Input prompt..."
            style={nodeStyles.textInput}
          />
        </div>
      )}

      {/* 视频比例选择器 - 仅对视频生成节点显示 */}
      {isVideoGenNode && (
        <div style={nodeStyles.textInputSection}>
          <span style={nodeStyles.textInputLabel}>视频比例:</span>
          <select
            className="nodrag"
            value={currentAspectRatio}
            onChange={handleAspectRatioChange}
            onMouseDown={(event) => event.stopPropagation()}
            style={nodeStyles.modelSelect}
          >
            {aspectRatioOptions.map((ratio) => (
              <option key={ratio} value={ratio}>{ratio}</option>
            ))}
          </select>
        </div>
      )}

      {isGenerativeNode && (
        <div style={nodeStyles.sendButtonSection}>
          <button
            type="button"
            className="nodrag nopan"
            onClick={handleSendRequest}
            onMouseDown={(event) => event.stopPropagation()}
            disabled={data.status === 'running'}
            style={{
              ...nodeStyles.sendButton(nodeColor),
              ...(data.status === 'running' ? nodeStyles.sendButtonDisabled : {})
            }}
          >
            {data.status === 'running' ? 'Sending...' : 'Send'}
          </button>
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
                  style={nodeStyles.inputPreviewImage}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isInputNode && (
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
            <img src={data.preview} alt="Preview" style={nodeStyles.previewImage} />
          ) : (
            <div style={nodeStyles.previewPlaceholder}>No image yet</div>
          )}
          {nodeType !== 'image-input' && (
            <div style={nodeStyles.previewFooter} title={data.fileName || previewFooterText}>
              {data.fileName ? displayFileName : previewFooterText}
            </div>
          )}
        </div>
      )}

      {shouldShowVideoPreviewContainer && (
        <div style={nodeStyles.previewContainer}>
          {data.preview ? (
            <video
              src={data.preview}
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
      <Handle
        type="source"
        position="right"
        id="output"
        isConnectable={isConnectable}
        style={{ ...nodeStyles.handle.base, ...nodeStyles.handle.source }}
      />

      <style>{animations}</style>
    </div>
  );
};

export default AINode;
