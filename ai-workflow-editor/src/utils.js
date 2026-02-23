// utils.js - shared utility helpers

import { NODE_DEFAULTS, NODE_TYPES } from './constants';

// ========== Debounce ==========
export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};

// ========== Suppress ResizeObserver warnings ==========
export const suppressResizeObserverWarning = () => {
  if (typeof window === 'undefined') return;

  const originalError = console.error;
  console.error = (...args) => {
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      /ResizeObserver|Resize loop|loop limit exceeded/i.test(args[0])
    ) {
      return;
    }
    originalError.apply(console, args);
  };

  const OriginalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
    constructor(callback) {
      const debouncedCallback = debounce((entries) => {
        callback(entries);
      }, 16);
      super(debouncedCallback);
    }
  };
};

// ========== Node creation ==========
export const createNewNode = (nodeType, position, dragData) => {
  const id = `${nodeType.id}-${Date.now()}`;
  const defaults = NODE_DEFAULTS[nodeType.id] || {};

  return {
    id,
    type: nodeType.id,
    position,
    data: {
      label: dragData?.label || nodeType.label || nodeType.id,
      description: dragData?.description || nodeType.description || `${nodeType.label || nodeType.id} 节点`,
      type: nodeType.id,
      status: 'idle',
      ...defaults,
      config: {}
    }
  };
};

const getLabelFromFileName = (fileName, fallback) => {
  if (!fileName || typeof fileName !== 'string') return fallback;
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
  return baseName || fallback;
};

export const getImageLabelFromFileName = (fileName) => {
  return getLabelFromFileName(fileName, '图片输入');
};

export const getVideoLabelFromFileName = (fileName) => {
  return getLabelFromFileName(fileName, '视频输入');
};

export const createImageNode = (file, position) => {
  const previewUrl = URL.createObjectURL(file);
  const defaults = NODE_DEFAULTS[NODE_TYPES.IMAGE_INPUT] || {};
  const imageLabel = getImageLabelFromFileName(file?.name);

  return {
    id: `image-input-${Date.now()}`,
    type: NODE_TYPES.IMAGE_INPUT,
    position,
    data: {
      label: imageLabel,
      description: `图片输入: ${file.name}`,
      type: NODE_TYPES.IMAGE_INPUT,
      status: 'idle',
      fileName: file.name,
      fileSize: file.size,
      preview: previewUrl,
      ...defaults
    }
  };
};

export const createVideoNode = (file, position) => {
  const videoUrl = URL.createObjectURL(file);
  const defaults = NODE_DEFAULTS[NODE_TYPES.VIDEO_INPUT] || {};
  const videoLabel = getVideoLabelFromFileName(file?.name);

  return {
    id: `video-input-${Date.now()}`,
    type: NODE_TYPES.VIDEO_INPUT,
    position,
    data: {
      label: videoLabel,
      description: `视频输入: ${file.name}`,
      type: NODE_TYPES.VIDEO_INPUT,
      status: 'idle',
      fileName: file.name,
      fileSize: file.size,
      preview: videoUrl,
      videoUrl,
      ...defaults
    }
  };
};

// ========== Misc ==========
export const generateId = (prefix = 'node') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// ========== File validation ==========
export const isValidImageFile = (file) => {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  return file && validTypes.includes(file.type);
};

export const isValidVideoFile = (file) => {
  if (!file || !file.type) return false;
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
  return validTypes.includes(file.type) || file.type.startsWith('video/');
};

// ========== Model helpers ==========
export const getModelInfo = (modelId, modelList) => {
  return modelList?.find((model) => model.id === modelId) || { name: modelId || '未选择', provider: '' };
};

export const updateNodesStatus = (nodes, status) => {
  return nodes.map((node) => ({
    ...node,
    data: { ...node.data, status }
  }));
};
