/**
 * 阿里云通义万相视频生成服务
 * 支持图片生视频（I2V）功能
 */
const path = require('path');
const fs = require('fs');

// 动态导入 node-fetch（适配 Node.js v24+）
const fetch = async (...args) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(...args);
};

// ===================== 配置 =====================
const CONFIG = {
  apiKey: process.env.DASHSCOPE_API_KEY || "",
  host: "https://dashscope.aliyuncs.com",
  endpoint: "/api/v1/services/aigc/image2video/video-synthesis",
  downloadDir: null, // 从外部传入
  defaultModel: "wanx2.1-kf2v-plus",
  defaultResolution: "720P",
};

// ===================== 万相服务类 =====================

class WanxiangService {
  constructor(downloadDir) {
    this.downloadDir = downloadDir;
  }

  /**
   * 提交万相视频生成任务
   * @param {Object} options - { prompt, firstFrameBase64, lastFrameBase64, model, resolution, promptExtend }
   * @returns {Promise<Object>} 任务提交结果
   */
  async submitTask(options = {}) {
    try {
      const {
        prompt = "生成动态视频，风格自然流畅",
        firstFrameBase64 = "",
        lastFrameBase64 = "",
        model = CONFIG.defaultModel,
        resolution = CONFIG.defaultResolution,
        promptExtend = true
      } = options;

      // 参数校验
      if (!firstFrameBase64) {
        throw new Error("万相API需要firstFrameBase64参数（首帧图片）");
      }

      // 构造请求体
      const requestBody = {
        model: model,
        input: {
          first_frame_url: `data:image/png;base64,${firstFrameBase64}`,
          prompt: prompt
        },
        parameters: {
          resolution: resolution,
          prompt_extend: promptExtend
        }
      };

      // 如果有尾帧图片，添加到input中
      if (lastFrameBase64) {
        requestBody.input.last_frame_url = `data:image/png;base64,${lastFrameBase64}`;
      }

      const requestUrl = `${CONFIG.host}${CONFIG.endpoint}`;

      // 发送请求
      console.log("提交万相任务：", requestUrl);
      const response = await fetch(requestUrl, {
        headers: {
          'X-DashScope-Async': 'enable',
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(requestBody),
        timeout: 30000,
      });

      const responseText = await response.text();
      console.log("提交任务响应：", responseText);

      // 解析响应
      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`万相接口返回非JSON：${responseText.substring(0, 200)}`);
      }

      // 检查响应状态
      if (!response.ok) {
        const errorMsg = responseJson.message || responseJson.error?.message || '未知错误';
        throw new Error(`任务提交失败（HTTP ${response.status}）：${errorMsg}`);
      }

      // 检查业务错误（如 InvalidApiKey 等）
      if (responseJson.code && responseJson.code !== '200') {
        throw new Error(`任务提交失败（${responseJson.code}）：${responseJson.message || '未知错误'}`);
      }

      return responseJson;
    } catch (error) {
      console.error("提交万相任务异常：", error);
      throw error;
    }
  }

  /**
   * 查询万相任务状态
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务状态结果
   */
  async queryTask(taskId) {
    if (!taskId) {
      throw new Error("查询万相任务失败：缺少taskId");
    }

    try {
      // 构造查询请求URL
      const requestUrl = `${CONFIG.host}/api/v1/tasks/${taskId}`;

      // 发送查询请求
      console.log(`查询万相任务[${taskId}]：`, requestUrl);
      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
        timeout: 30000,
      });

      const responseText = await response.text();
      console.log(`查询任务[${taskId}]响应：`, responseText);

      // 解析响应
      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`查询接口返回非JSON：${responseText.substring(0, 200)}`);
      }

      // 检查响应状态
      if (!response.ok) {
        const errorMsg = responseJson.message || responseJson.error?.message || '未知错误';
        throw new Error(`查询任务失败（HTTP ${response.status}）：${errorMsg}`);
      }

      // 检查根级别的业务错误（如 InvalidApiKey 等）
      if (responseJson.code && responseJson.code !== '200') {
        throw new Error(`查询任务失败（${responseJson.code}）：${responseJson.message || '未知错误'}`);
      }

      // 检查任务执行失败（如 InvalidParameter 等）
      if (responseJson.output?.task_status === "FAILED" && responseJson.output?.code) {
        throw new Error(`任务执行失败（${responseJson.output.code}）：${responseJson.output.message || '未知错误'}`);
      }

      // 如果任务完成，自动下载视频
      if (responseJson.output?.task_status === "SUCCEEDED" && responseJson.output?.video_url) {
        await this.downloadVideo(taskId, responseJson.output.video_url);
      }

      return responseJson;
    } catch (error) {
      console.error(`查询万相任务[${taskId}]异常：`, error);
      throw error;
    }
  }

  /**
   * 下载万相生成的视频
   * @param {string} taskId - 任务ID
   * @param {string} videoUrl - 视频URL
   * @returns {Promise<string>} 本地视频路径
   */
  async downloadVideo(taskId, videoUrl) {
    try {
      console.log(`下载万相视频[${taskId}]：`, videoUrl);
      const response = await fetch(videoUrl, { timeout: 60000 });
      if (!response.ok) {
        throw new Error(`下载失败：HTTP ${response.status} ${response.statusText}`);
      }

      const videoFileName = `wanxiang_${taskId}_${Date.now()}.mp4`;
      const videoPath = path.join(this.downloadDir, videoFileName);

      const fileStream = fs.createWriteStream(videoPath);
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
      });

      console.log(`万相视频下载完成：${videoPath}`);
      return videoPath;
    } catch (error) {
      console.error(`下载万相视频[${taskId}]异常：`, error);
      throw error;
    }
  }

  /**
   * 解析任务状态为统一格式
   * @param {Object} response - API响应
   * @returns {Object} 统一格式的任务状态
   */
  parseStatus(response) {
    const taskStatus = response.output?.task_status || "unknown";
    const videoUrl = response.output?.video_url || "";
    
    // 万相状态映射到统一格式
    let unifiedStatus = "unknown";
    switch (taskStatus) {
      case "PENDING":
        unifiedStatus = "pending"; // 任务排队中
        break;
      case "RUNNING":
        unifiedStatus = "processing"; // 任务处理中
        break;
      case "SUCCEEDED":
        unifiedStatus = "done"; // 任务执行成功
        break;
      case "FAILED":
        unifiedStatus = "failed"; // 任务执行失败
        break;
      case "CANCELED":
        unifiedStatus = "canceled"; // 任务已取消
        break;
      case "UNKNOWN":
        unifiedStatus = "unknown"; // 任务不存在或状态未知
        break;
      default:
        unifiedStatus = taskStatus.toLowerCase();
    }

    return {
      taskId: response.output?.task_id || response.task_id || "",
      status: unifiedStatus,
      videoUrl: videoUrl,
      errorMsg: response.output?.message || response.message || "",
      rawResponse: response
    };
  }
}

module.exports = WanxiangService;
