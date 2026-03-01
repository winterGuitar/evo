// constants.js - centralized app constants and node configuration

// ========== Node icons ==========
export const NODE_ICONS = {
  'image-gen': '🖼️',
  'video-gen': '🎬',
  'image-input': '🖼️',
  'video-input': '📹',
  default: 'AI'
};

// ========== Node types ==========
export const NODE_TYPES = {
  IMAGE_INPUT: 'image-input',
  VIDEO_INPUT: 'video-input',
  IMAGE_GEN: 'image-gen',
  VIDEO_GEN: 'video-gen'
};

// ========== AI model options ==========
export const AI_MODELS = {
  'image-gen': [
    { id: 'dall-e-3', name: 'DALL-E 3', provider: 'OpenAI', description: 'High-quality text-to-image generation' },
    { id: 'sd-xl', name: 'Stable Diffusion XL', provider: 'Stability AI', description: 'Fast and flexible image generation' },
    { id: 'sd-3', name: 'Stable Diffusion 3', provider: 'Stability AI', description: 'Latest SD image model' },
    { id: 'wenxin-image', name: 'Wenxin Yige', provider: 'Baidu', description: 'Chinese optimized image generation' },
    { id: 'qwen-image', name: 'Qwen Image', provider: 'Alibaba', description: 'Creative image generation' }
  ],
  'video-gen': [
    { id: 'jimeng', name: '即梦', provider: 'ByteDance', description: '即梦视频生成' },
    { id: 'wanxiang', name: '万相', provider: 'Alibaba', description: '万相图生视频' }
  ],
  'image-input': [],
  'video-input': []
};

// ========== Node default config ==========
export const NODE_DEFAULTS = {
  [NODE_TYPES.IMAGE_GEN]: {
    model: AI_MODELS['image-gen'][0]?.id,
    size: '1024x1024',
    n: 1
  },
  [NODE_TYPES.VIDEO_GEN]: {
    model: AI_MODELS['video-gen'][0]?.id,
    duration: 5,
    aspectRatio: '16:9'
  },
  [NODE_TYPES.IMAGE_INPUT]: {
    task: 'input'
  },
  [NODE_TYPES.VIDEO_INPUT]: {
    task: 'input'
  }
};

// ========== Node status ==========
export const NODE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETED: 'completed',
  ERROR: 'error'
};

// ========== Node palette ==========
export const NODE_PALETTE_CATEGORIES = [
  {
    name: '输入输出',
    items: [
      {
        id: NODE_TYPES.IMAGE_INPUT,
        label: '图片输入',
        description: '拖拽上传图片，作为后续节点输入',
        icon: NODE_ICONS['image-input']
      },
      {
        id: NODE_TYPES.VIDEO_INPUT,
        label: '视频输入',
        description: '拖拽上传视频，可在节点中直接播放',
        icon: NODE_ICONS['video-input']
      }
    ]
  },
  {
    name: 'AI 模型',
    items: [
      {
        id: NODE_TYPES.IMAGE_GEN,
        label: '图像生成',
        description: '文生图、图生图、AI 绘画',
        icon: NODE_ICONS['image-gen']
      },
      {
        id: NODE_TYPES.VIDEO_GEN,
        label: '视频生成',
        description: '文生视频、图生视频、AI 视频创作',
        icon: NODE_ICONS['video-gen']
      }
    ]
  }
];

// ========== Helpers ==========
export const getNodeColor = (type) => {
  switch (type) {
    case NODE_TYPES.IMAGE_GEN:
      return '#FF9800';
    case NODE_TYPES.VIDEO_GEN:
      return '#3F51B5';
    case NODE_TYPES.IMAGE_INPUT:
      return '#00ACC1';
    case NODE_TYPES.VIDEO_INPUT:
      return '#26A69A';
    default:
      return '#757575';
  }
};

export const getNodeIcon = (type) => {
  return NODE_ICONS[type] || NODE_ICONS.default;
};
