export const HTTP_REQUEST_DEFAULT_TIMEOUT_MS = 20000;

export const HTTP_REQUEST_DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
};

export const NODE_HTTP_REQUEST_CONFIG = {
  'image-gen': {
    url: process.env.REACT_APP_IMAGE_GEN_ENDPOINT || 'http://localhost:8000/api/image-generate',
    method: 'POST',
    headers: {}
  },
  'video-gen': {
    url: process.env.REACT_APP_VIDEO_GEN_ENDPOINT || 'http://localhost:8000/api/video-generate',
    method: 'POST',
    headers: {}
  }
};

export const getNodeHttpRequestConfig = (nodeType) => {
  return NODE_HTTP_REQUEST_CONFIG[nodeType] || null;
};
