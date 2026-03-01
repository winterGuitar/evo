/**
 * 即梦视频生成服务
 * 从 server.js 抽取的即梦后端流程
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// 动态导入 node-fetch（适配 Node.js v24+）
const fetch = async (...args) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(...args);
};

// ===================== 配置 =====================
const CONFIG = {
  accessKeyId: "",
  secretAccessKey: "",
  serviceName: "cv",
  region: "cn-north-1",
  host: "visual.volcengineapi.com",
  version: "2022-08-31",
  reqKey: "jimeng_ti2v_v30_pro",
  downloadDir: null, // 从外部传入
};

const HEADER_KEYS_TO_IGNORE = new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
]);

// ===================== 签名工具函数 =====================

function hmac(secret, s) {
  return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
}

function hash(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function queryParamsToString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const val = params[key];
      if (typeof val === 'undefined' || val === null) {
        return undefined;
      }
      const escapedKey = uriEscape(key);
      if (!escapedKey) {
        return undefined;
      }
      if (Array.isArray(val)) {
        return `${escapedKey}=${val.map(uriEscape).sort().join(`&${escapedKey}=`)}`;
      }
      return `${escapedKey}=${uriEscape(val)}`;
    })
    .filter((v) => v)
    .join('&');
}

function uriEscape(str) {
  try {
    return encodeURIComponent(str)
      .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
      .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch (e) {
    return '';
  }
}

function getSignHeaders(originHeaders, needSignHeaders) {
  function trimHeaderValue(header) {
    return header.toString?.().trim().replace(/\s+/g, ' ') ?? '';
  }

  let h = Object.keys(originHeaders);
  if (Array.isArray(needSignHeaders)) {
    const needSignSet = new Set([...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase()));
    h = h.filter((k) => needSignSet.has(k.toLowerCase()));
  }
  h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));
  const signedHeaderKeys = h
    .slice()
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');
  const canonicalHeaders = h
    .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
    .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
    .join('\n');
  return [signedHeaderKeys, canonicalHeaders];
}

function sign(params) {
  const {
    headers = {},
    query = {},
    region = '',
    serviceName = '',
    method = '',
    pathName = '/',
    accessKeyId = '',
    secretAccessKey = '',
    needSignHeaderKeys = [],
    bodySha,
  } = params;
  const datetime = headers["X-Date"];
  const date = datetime.substring(0, 8); // YYYYMMDD
  const [signedHeaders, canonicalHeaders] = getSignHeaders(headers, needSignHeaderKeys);
  const canonicalRequest = [
    method.toUpperCase(),
    pathName,
    queryParamsToString(query) || '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    bodySha || hash(''),
  ].join('\n');
  const credentialScope = [date, region, serviceName, "request"].join('/');
  const stringToSign = ["HMAC-SHA256", datetime, credentialScope, hash(canonicalRequest)].join('\n');
  const kDate = hmac(secretAccessKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, serviceName);
  const kSigning = hmac(kService, "request");
  const signature = hmac(kSigning, stringToSign).toString('hex');
  console.log('--------CanonicalString:\n%s\n--------SignString:\n%s', canonicalRequest, stringToSign);

  return [
    "HMAC-SHA256",
    `Credential=${accessKeyId}/${credentialScope},`,
    `SignedHeaders=${signedHeaders},`,
    `Signature=${signature}`,
  ].join(' ');
}

function getDateTimeNow() {
  const now = new Date();
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getBodySha(body) {
  const hash = crypto.createHash('sha256');
  if (typeof body === 'string') {
    hash.update(body);
  } else if (body instanceof url.URLSearchParams) {
    hash.update(body.toString());
  } else if (util.isBuffer(body)) {
    hash.update(body);
  }
  return hash.digest('hex');
}

// ===================== 即梦服务类 =====================

class JimengService {
  constructor(downloadDir) {
    this.downloadDir = downloadDir;
  }

  /**
   * 提交即梦视频生成任务
   * @param {Object} options - { prompt, imageBase64, seed, frames, aspectRatio }
   * @returns {Promise<Object>} 任务提交结果
   */
  async submitTask(options = {}) {
    try {
      const {
        prompt = "生成动态视频，风格自然流畅",
        imageBase64 = "",
        seed = 12345,
        frames = 121,
        aspectRatio = "16:9"
      } = options;

      if (!imageBase64) {
        throw new Error("即梦API需要imageBase64参数");
      }

      // 构造请求参数
      const params = {
        req_key: CONFIG.reqKey,
        prompt,
        binary_data_base64: [imageBase64],
        seed,
        frames,
        aspect_ratio: aspectRatio
      };
      const bodyStr = JSON.stringify(params);
      const bodySha = getBodySha(bodyStr);

      // 构造签名参数
      const signParams = {
        headers: { "X-Date": getDateTimeNow(), "Host": CONFIG.host },
        method: 'POST',
        pathName: '/',
        query: { Version: CONFIG.version, Action: "CVSync2AsyncSubmitTask" },
        accessKeyId: CONFIG.accessKeyId,
        secretAccessKey: CONFIG.secretAccessKey,
        serviceName: CONFIG.serviceName,
        region: CONFIG.region,
        bodySha,
        needSignHeaderKeys: []
      };
      const authorization = sign(signParams);
      const requestUrl = `https://${CONFIG.host}/?${new URLSearchParams(signParams.query).toString()}`;

      // 发送请求
      console.log("提交即梦任务：", requestUrl);
      const response = await fetch(requestUrl, {
        headers: {
          ...signParams.headers,
          'Authorization': authorization,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: bodyStr,
        timeout: 30000,
      });

      const responseText = await response.text();
      console.log("提交任务响应：", responseText);

      // 解析响应
      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`即梦接口返回非JSON：${responseText.substring(0, 200)}`);
      }

      if (responseJson.code !== 10000) {
        throw new Error(`任务提交失败：${responseJson.message || '未知错误'}（code: ${responseJson.code}）`);
      }

      return responseJson;
    } catch (error) {
      console.error("提交即梦任务异常：", error);
      throw error;
    }
  }

  /**
   * 查询即梦任务状态
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 任务状态结果
   */
  async queryTask(taskId) {
    if (!taskId) {
      throw new Error("查询即梦任务失败：缺少taskId");
    }

    try {
      // 构造查询参数
      const queryBody = {
        req_key: CONFIG.reqKey,
        task_id: taskId,
      };
      const bodyStr = JSON.stringify(queryBody);
      const bodySha = getBodySha(bodyStr);

      // 构造签名参数
      const signParams = {
        headers: { "X-Date": getDateTimeNow(), "Host": CONFIG.host },
        method: 'POST',
        pathName: '/',
        query: { Version: CONFIG.version, Action: "CVSync2AsyncGetResult" },
        accessKeyId: CONFIG.accessKeyId,
        secretAccessKey: CONFIG.secretAccessKey,
        serviceName: CONFIG.serviceName,
        region: CONFIG.region,
        bodySha,
        needSignHeaderKeys: []
      };
      const authorization = sign(signParams);
      const requestUrl = `https://${CONFIG.host}/?${new URLSearchParams(signParams.query).toString()}`;

      // 发送查询请求
      console.log(`查询即梦任务[${taskId}]：`, requestUrl);
      const response = await fetch(requestUrl, {
        headers: {
          ...signParams.headers,
          'Authorization': authorization,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: bodyStr,
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

      if (responseJson.code !== 10000) {
        throw new Error(`查询任务失败：${responseJson.message || '未知错误'}（code: ${responseJson.code}）`);
      }

      // 如果任务完成，自动下载视频
      if (responseJson.data?.status === "done" && responseJson.data?.video_url) {
        await this.downloadVideo(taskId, responseJson.data.video_url);
      }

      return responseJson;
    } catch (error) {
      console.error(`查询即梦任务[${taskId}]异常：`, error);
      throw error;
    }
  }

  /**
   * 下载即梦生成的视频
   * @param {string} taskId - 任务ID
   * @param {string} videoUrl - 视频URL
   * @returns {Promise<string>} 本地视频路径
   */
  async downloadVideo(taskId, videoUrl) {
    try {
      console.log(`下载即梦视频[${taskId}]：`, videoUrl);
      const response = await fetch(videoUrl, { timeout: 60000 });
      if (!response.ok) {
        throw new Error(`下载失败：HTTP ${response.status} ${response.statusText}`);
      }

      const videoFileName = `${taskId}_${Date.now()}.mp4`;
      const videoPath = path.join(this.downloadDir, videoFileName);

      const fileStream = fs.createWriteStream(videoPath);
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
      });

      console.log(`即梦视频下载完成：${videoPath}`);
      return videoPath;
    } catch (error) {
      console.error(`下载即梦视频[${taskId}]异常：`, error);
      throw error;
    }
  }

  /**
   * 解析任务状态为统一格式
   * @param {Object} response - API响应
   * @returns {Object} 统一格式的任务状态
   */
  parseStatus(response) {
    return {
      taskId: response.data?.task_id || "",
      status: response.data?.status || "unknown",
      videoUrl: response.data?.video_url || "",
      errorMsg: response.data?.error_msg || "",
      rawResponse: response
    };
  }
}

module.exports = JimengService;
