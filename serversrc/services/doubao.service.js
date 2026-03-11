/**
 * 豆包语言模型服务
 * 基于 OpenAI 兼容的 API
 */
const fetch = async (...args) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(...args);
};

class DoubaoService {
  constructor(apiKey, baseUrl = 'https://ark.cn-beijing.volces.com/api/v3') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = 'doubao-seed-2-0-pro-260215';
  }

  /**
   * 创建聊天请求
   * @param {string|Array} input - 输入内容
   * @param {string} model - 模型ID
   * @param {object} options - 其他参数
   * @returns {Promise<object>}
   */
  async createResponse(input, model = this.defaultModel, options = {}) {
    const {
      previous_response_id = null,
      max_output_tokens = null,
      temperature = null,
      top_p = null,
      stream = false
    } = options;

    const requestBody = {
      model,
      input
    };

    if (previous_response_id) {
      requestBody.previous_response_id = previous_response_id;
    }

    if (max_output_tokens !== null) {
      requestBody.max_output_tokens = max_output_tokens;
    }

    if (temperature !== null) {
      requestBody.temperature = temperature;
    }

    if (top_p !== null) {
      requestBody.top_p = top_p;
    }

    if (stream !== undefined) {
      requestBody.stream = stream;
    }

    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Doubao service error:', error);
      throw error;
    }
  }

  /**
   * 获取响应详情
   * @param {string} responseId - 响应ID
   * @returns {Promise<object>}
   */
  async getResponse(responseId) {
    try {
      const response = await fetch(`${this.baseUrl}/responses/${responseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Doubao get response error:', error);
      throw error;
    }
  }

  /**
   * 提取回复文本
   * @param {object} response - API返回的响应对象
   * @returns {string}
   */
  extractResponseText(response) {
    if (!response || !response.output || !Array.isArray(response.output)) {
      return '';
    }

    const message = response.output.find(item => item.type === 'message');
    if (!message || !Array.isArray(message.content)) {
      return '';
    }

    const textContent = message.content.find(item => item.type === 'output_text');
    return textContent ? textContent.text : '';
  }

  /**
   * 格式化消息为 input 格式
   * @param {string} content - 消息内容
   * @returns {object}
   */
  formatMessage(content) {
    return {
      role: 'user',
      content
    };
  }
}

module.exports = DoubaoService;
