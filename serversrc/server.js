/**
 * Ti2V 视频生成后端服务
 * 依赖：express cors crypto fs-extra node-fetch
 * 安装：npm install express cors crypto fs-extra node-fetch
 */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');
const multer = require('multer');

// 动态导入 node-fetch（适配 Node.js v24+）
const fetch = async (...args) => {
  const { default: fetch } = await import('node-fetch');
  return fetch(...args);
};

// ===================== 1. 基础配置（替换为你的火山引擎信息） =====================
const BASE_CONFIG = {
  accessKeyId: "",
  secretAccessKey: "",
  serviceName: "cv",
  region: "cn-north-1",
  host: "visual.volcengineapi.com",
  version: "2022-08-31",
  reqKey: "jimeng_i2v_first_v30",
  downloadDir: path.resolve(__dirname, "./ti2v_videos"), // 视频下载目录
  localImagePath: path.resolve(__dirname, "./test.png"), // 默认测试图片（可选）
};

const HEADER_KEYS_TO_IGNORE = new Set([
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
]);

// ===================== 2. 复用 jimengWeb.js 的核心工具函数 =====================
/**
 * 获取纯净的Base64（移除data:image/xxx;base64,前缀）
 * @param {string} imagePath 本地图片路径
 * @returns {string} 纯净Base64字符串
 */
function getPureBase64(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在：${imagePath}`);
    }
    const buffer = fs.readFileSync(imagePath);
    return buffer.toString('base64');
  } catch (error) {
    console.error("获取Base64失败：", error);
    throw error;
  }
}

/**
 * 生成火山引擎API签名
 * @param {Object} params 签名参数
 * @returns {string} 授权签名
 */
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

/**
 * HMAC加密（辅助函数）
 * @param {string} secret 密钥
 * @param {string} s 待加密字符串
 * @returns {string} 加密结果
 */
function hmac(secret, s) {
  return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
}

/**
 * SHA256哈希（辅助函数）
 * @param {string} s 待哈希字符串
 * @returns {string} 哈希结果
 */
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

function uriEscape(str) {
  try {
    return encodeURIComponent(str)
      .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
      .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch (e) {
    return '';
  }
}


/**
 * 获取当前时间（火山引擎格式）
 * @returns {string} 时间字符串（如：20250820T123456Z）
 */
function getDateTimeNow() {
  const now = new Date();
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

/**
 * 获取请求体的SHA256哈希
 * @param {string} body 请求体字符串
 * @returns {string} 哈希结果
 */
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


/**
 * 创建视频下载目录（不存在则创建）
 */
function createDownloadDir() {
  if (!fs.existsSync(BASE_CONFIG.downloadDir)) {
    fs.mkdirSync(BASE_CONFIG.downloadDir, { recursive: true });
    console.log(`创建下载目录：${BASE_CONFIG.downloadDir}`);
  }
}

/**
 * 延迟函数（毫秒）
 * @param {number} ms 延迟时间
 * @returns {Promise} 延迟Promise
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================== 3. Ti2V 核心业务逻辑 =====================
/**
 * 提交Ti2V视频生成任务
 * @param {Object} options 自定义参数（覆盖默认配置）
 * @returns {Promise<Object>} 任务提交结果
 */
async function doTi2VRequest(options = {}) {
  try {
    // 合并默认参数和自定义参数
    const {
      prompt = "生成动态视频，风格自然流畅",
      imageBase64 = getPureBase64(BASE_CONFIG.localImagePath),
      seed = 12345,
      frames = 121,
      aspect_ratio = "16:9"
    } = options;

    // 构造请求参数
    const ti2vParams = {
      req_key: BASE_CONFIG.reqKey,
      prompt,
      binary_data_base64: [imageBase64],
      seed,
      frames,
      aspect_ratio,
    };
    const bodyStr = JSON.stringify(ti2vParams);
    const bodySha = getBodySha(bodyStr);

    // 构造签名参数
    const signParams = {
      headers: { "X-Date": getDateTimeNow(), "Host": BASE_CONFIG.host },
      method: 'POST',
      pathName: '/',
      query: { Version: BASE_CONFIG.version, Action: "CVSync2AsyncSubmitTask" },
      accessKeyId: BASE_CONFIG.accessKeyId,
      secretAccessKey: BASE_CONFIG.secretAccessKey,
      serviceName: BASE_CONFIG.serviceName,
      region: BASE_CONFIG.region,
      bodySha,
    };
    const authorization = sign(signParams);
    const requestUrl = `https://${BASE_CONFIG.host}/?${new URLSearchParams(signParams.query).toString()}`;

    // 发送请求
    console.log("提交Ti2V任务：", requestUrl);
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
    
    // 解析响应（兼容非JSON情况）
    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Ti2V接口返回非JSON：${responseText.substring(0, 200)}`);
    }

    if (responseJson.code !== 10000) {
      throw new Error(`任务提交失败：${responseJson.message || '未知错误'}（code: ${responseJson.code}）`);
    }

    return responseJson;
  } catch (error) {
    console.error("提交Ti2V任务异常：", error);
    throw error;
  }
}

/**
 * 查询Ti2V任务状态
 * @param {string} taskId 任务ID
 * @returns {Promise<Object>} 任务状态结果
 */
async function doTi2VQueryRequest(taskId) {
  if (!taskId) {
    throw new Error("查询任务失败：缺少taskId");
  }

  try {
    // 构造查询参数
    const queryBody = {
      req_key: BASE_CONFIG.reqKey,
      task_id: taskId,
    };
    const bodyStr = JSON.stringify(queryBody);
    const bodySha = getBodySha(bodyStr);

    // 构造签名参数
    const signParams = {
      headers: { "X-Date": getDateTimeNow(), "Host": BASE_CONFIG.host },
      method: 'POST', // 严格对齐：必须是POST
      pathName: '/',
      query: { Version: BASE_CONFIG.version, Action: "CVSync2AsyncGetResult" },
      accessKeyId: BASE_CONFIG.accessKeyId,
      secretAccessKey: BASE_CONFIG.secretAccessKey,
      serviceName: BASE_CONFIG.serviceName,
      region: BASE_CONFIG.region,
      bodySha,
    };
    const authorization = sign(signParams);
    const requestUrl = `https://${BASE_CONFIG.host}/?${new URLSearchParams(signParams.query).toString()}`;

    // 发送查询请求
    console.log(`查询Ti2V任务[${taskId}]：`, requestUrl);
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
      await downloadTi2VVideo(taskId, responseJson.data.video_url);
    }

    return responseJson;
  } catch (error) {
    console.error(`查询Ti2V任务[${taskId}]异常：`, error);
    throw error;
  }
}

/**
 * 下载Ti2V生成的视频
 * @param {string} taskId 任务ID
 * @param {string} videoUrl 视频下载URL
 * @returns {Promise<string>} 本地视频路径
 */
async function downloadTi2VVideo(taskId, videoUrl) {
  createDownloadDir(); // 确保下载目录存在

  try {
    console.log(`下载视频[${taskId}]：`, videoUrl);
    const response = await fetch(videoUrl, { timeout: 60000 });
    if (!response.ok) {
      throw new Error(`下载失败：HTTP ${response.status} ${response.statusText}`);
    }

    // 构造本地文件名
    const videoFileName = `${taskId}_${Date.now()}.mp4`;
    const videoPath = path.join(BASE_CONFIG.downloadDir, videoFileName);

    // 写入文件（流式下载，适配大文件）
    const fileStream = fs.createWriteStream(videoPath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    console.log(`视频下载完成：${videoPath}`);
    return videoPath;
  } catch (error) {
    console.error(`下载视频[${taskId}]异常：`, error);
    throw error;
  }
}

// ===================== 4. Express 服务配置 =====================
const app = express();
const PORT = process.env.PORT || 3001;

// 跨域配置（生产环境建议限制origin）
app.use(cors({
  origin: "*", // 开发环境允许所有域名，生产环境改为你的前端域名（如：http://localhost:3000）
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Accept"],
}));

// 解析JSON请求体（适配大文件Base64）
app.use(express.json({ limit: '50mb' }));
// 解析表单请求体（备用）
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务：暴露视频下载目录（前端可直接访问）
app.use('/ti2v-videos', express.static(BASE_CONFIG.downloadDir));

// ===================== 5. 接口路由 =====================
/**
 * 接口1：提交Ti2V视频生成任务
 * POST /api/ti2v/submit
 * 请求体：{ prompt, imageBase64, seed, frames, aspect_ratio }
 * 响应：{ code, message, data: { taskId } }
 */
app.post('/api/ti2v/submit', async (req, res) => {
  try {
    const { prompt, imageBase64, seed, frames, aspect_ratio } = req.body;
    
    // 参数校验
    if (!imageBase64) {
      return res.status(400).json({
        code: -1,
        message: "参数错误：imageBase64为必填项",
        data: null
      });
    }

    // 提交任务
    const submitResult = await doTi2VRequest({
      prompt,
      imageBase64,
      seed: seed || 12345,
      frames: frames || 121,
      aspect_ratio: aspect_ratio || "16:9"
    });

    // 返回结果
    res.status(200).json({
      code: 0,
      message: "任务提交成功",
      data: {
        taskId: submitResult.data?.task_id || "",
        rawResponse: submitResult // 保留原始响应（便于调试）
      }
    });
  } catch (error) {
    res.status(500).json({
      code: -1,
      message: `提交任务失败：${error.message}`,
      data: null
    });
  }
});

/**
 * 接口2：查询Ti2V任务状态（严格POST）
 * POST /api/ti2v/query
 * 请求体：{ taskId }
 * 响应：{ code, message, data: { taskStatus, videoUrl, localVideoPath } }
 */
app.post('/api/ti2v/query', async (req, res) => {
  try {
    const { taskId } = req.body;
    
    // 参数校验
    if (!taskId) {
      return res.status(400).json({
        code: -1,
        message: "参数错误：taskId为必填项",
        data: null
      });
    }

    // 查询任务
    const queryResult = await doTi2VQueryRequest(taskId);
    const taskStatus = queryResult.data?.status || "unknown";
    const videoUrl = queryResult.data?.video_url || "";
    
    // 构造本地视频访问路径（前端可直接预览）
    let localVideoPath = "";
    if (taskStatus === "done" && videoUrl) {
      // 查找已下载的视频文件
      const files = fs.existsSync(BASE_CONFIG.downloadDir) ? fs.readdirSync(BASE_CONFIG.downloadDir) : [];
      const videoFile = files.find(file => file.startsWith(taskId) && file.endsWith('.mp4'));
      if (videoFile) {
        localVideoPath = `http://localhost:${PORT}/ti2v-videos/${videoFile}`;
      }
    }

    // 返回结果
    res.status(200).json({
      code: 0,
      message: "查询任务成功",
      data: {
        taskId,
        taskStatus,
        videoUrl,
        localVideoPath, // 前端可直接访问的本地视频URL
        errorMsg: queryResult.data?.error_msg || "",
        rawResponse: queryResult
      }
    });
  } catch (error) {
    res.status(500).json({
      code: -1,
      message: `查询任务失败：${error.message}`,
      data: null
    });
  }
});

/**
 * 接口3：下载视频文件
 * GET /api/ti2v/download?taskId=xxx
 * 响应：视频文件流（触发浏览器下载）
 */
app.get('/api/ti2v/download', async (req, res) => {
  try {
    const { taskId } = req.query;
    
    if (!taskId) {
      return res.status(400).json({
        code: -1,
        message: "参数错误：taskId为必填项",
        data: null
      });
    }

    // 查找视频文件
    const files = fs.existsSync(BASE_CONFIG.downloadDir) ? fs.readdirSync(BASE_CONFIG.downloadDir) : [];
    const videoFile = files.find(file => file.startsWith(taskId) && file.endsWith('.mp4'));
    
    if (!videoFile) {
      return res.status(404).json({
        code: -1,
        message: `未找到任务[${taskId}]的视频文件`,
        data: null
      });
    }

    const videoPath = path.join(BASE_CONFIG.downloadDir, videoFile);
    res.download(videoPath, videoFile, (err) => {
      if (err) {
        res.status(500).json({
          code: -1,
          message: `下载失败：${err.message}`,
          data: null
        });
      }
    });
  } catch (error) {
    res.status(500).json({
      code: -1,
      message: `下载视频失败：${error.message}`,
      data: null
    });
  }
});

/**
 * 接口4：上传文件
 * POST /api/ti2v/upload
 * 响应：{ code: 0, data: { path: "/ti2v_videos/xxx.mp4" } }
 */
const upload = multer({
  dest: BASE_CONFIG.downloadDir,
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, BASE_CONFIG.downloadDir);
    },
    filename: (req, file, cb) => {
      // 生成唯一文件名：时间戳-随机字符串-原始文件名
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      cb(null, uniqueName);
    }
  })
}).single('file');

app.post('/api/ti2v/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(500).json({
        code: -1,
        message: `上传失败：${err.message}`,
        data: null
      });
    }

    if (!req.file) {
      return res.status(400).json({
        code: -1,
        message: "未找到上传文件",
        data: null
      });
    }

    // 返回相对路径（相对于服务器根目录）
    const relativePath = `/ti2v_videos/${req.file.filename}`;
    res.json({
      code: 0,
      message: "上传成功",
      data: {
        path: relativePath,
        originalName: req.file.originalname,
        size: req.file.size
      }
    });
  });
});

/**
 * 接口5：提供静态文件访问
 * GET /ti2v_videos/*
 */
app.use('/ti2v_videos', express.static(BASE_CONFIG.downloadDir));

/**
 * 健康检查接口
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    code: 0,
    message: "服务运行正常",
    data: {
      port: PORT,
      time: new Date().toISOString(),
      downloadDir: BASE_CONFIG.downloadDir
    }
  });
});

// ===================== 6. 启动服务 =====================
app.listen(PORT, () => {
  // 提前创建下载目录
  createDownloadDir();
  console.log(`====================================`);
  console.log(`Ti2V后端服务已启动：http://localhost:${PORT}`);
  console.log(`健康检查：http://localhost:${PORT}/api/health`);
  console.log(`视频下载目录：${BASE_CONFIG.downloadDir}`);
  console.log(`====================================`);
});

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error("未捕获的异常：", err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("未处理的Promise拒绝：", reason, promise);
});