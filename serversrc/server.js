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

// ===================== 1. 引入服务 =====================
const JimengService = require('./services/jimeng.service');

// ===================== 2. 基础配置（替换为你的火山引擎信息） =====================
const BASE_CONFIG = {
  downloadDir: path.resolve(__dirname, "./ti2v_videos"), // 视频下载目录
  localImagePath: path.resolve(__dirname, "./test.png"), // 默认测试图片（可选）
  // 万相API配置
  dashScopeApiKey: process.env.DASHSCOPE_API_KEY || "" // 阿里云DashScope API Key
};

// 初始化即梦服务
const jimengService = new JimengService(BASE_CONFIG.downloadDir);
console.log('即梦服务初始化完成');

// ===================== 文件哈希缓存 =====================
// 文件缓存结构：{ 文件路径: { hash: SHA256, size: 文件大小, mtime: 修改时间 } }
const fileHashCache = new Map();
let cacheInitialized = false;

// 缓存文件路径
const CACHE_FILE_PATH = path.join(__dirname, 'file_hash_cache.json');

/**
 * 从文件加载缓存
 */
async function loadCacheFromFile() {
  try {
    if (!fs.existsSync(CACHE_FILE_PATH)) {
      console.log('缓存文件不存在，将创建新缓存');
      return false;
    }

    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, 'utf-8'));
    let validCount = 0;
    let invalidCount = 0;

    for (const [filePath, info] of Object.entries(cacheData)) {
      // 检查文件是否仍然存在
      if (fs.existsSync(filePath)) {
        // 检查文件是否被修改
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs === info.mtime) {
          // 文件未修改，使用缓存
          fileHashCache.set(filePath, info);
          validCount++;
        } else {
          // 文件已修改，缓存无效
          invalidCount++;
          console.log(`文件已修改，缓存无效: ${path.basename(filePath)}`);
        }
      } else {
        // 文件已删除，移除缓存
        invalidCount++;
        console.log(`文件已删除，移除缓存: ${path.basename(filePath)}`);
      }
    }

    console.log(`从缓存文件加载：${validCount} 个有效，${invalidCount} 个无效`);
    return true;
  } catch (error) {
    console.error('加载缓存文件失败:', error.message);
    return false;
  }
}

/**
 * 将缓存保存到文件
 */
function saveCacheToFile() {
  try {
    // 将 Map 转换为对象
    const cacheData = {};
    fileHashCache.forEach((info, filePath) => {
      cacheData[filePath] = info;
    });

    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log(`缓存已保存到文件: ${path.basename(CACHE_FILE_PATH)} (${fileHashCache.size} 个文件)`);
  } catch (error) {
    console.error('保存缓存文件失败:', error.message);
  }
}

/**
 * 初始化文件哈希缓存
 * 先尝试从文件加载，然后扫描目录补充新文件
 */
async function initializeFileCache() {
  try {
    console.log('正在初始化文件哈希缓存...');
    const startTime = Date.now();

    // 1. 先从文件加载已有缓存
    await loadCacheFromFile();

    // 2. 扫描目录，补充新文件或更新已修改的文件
    const files = await fsExtra.readdir(BASE_CONFIG.downloadDir);
    let newCachedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const filePath = path.join(BASE_CONFIG.downloadDir, file);

      try {
        const stats = await fsExtra.stat(filePath);

        // 只缓存文件，跳过目录
        if (stats.isDirectory()) continue;

        // 检查缓存中是否存在且有效
        const cached = fileHashCache.get(filePath);
        if (cached && cached.mtime === stats.mtimeMs) {
          skippedCount++;
          continue;
        }

        // 缓存不存在或文件已修改，重新计算哈希
        const fileBuffer = await fsExtra.readFile(filePath);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // 存入缓存
        fileHashCache.set(filePath, {
          hash: fileHash,
          size: stats.size,
          mtime: stats.mtimeMs
        });

        if (cached) {
          updatedCount++;
          console.log(`文件已更新: ${path.basename(filePath)}`);
        } else {
          newCachedCount++;
          console.log(`新文件已缓存: ${path.basename(filePath)}`);
        }
      } catch (error) {
        console.error(`缓存文件 ${file} 失败:`, error.message);
        continue;
      }
    }

    // 3. 保存缓存到文件
    saveCacheToFile();

    const duration = Date.now() - startTime;
    const totalFiles = fileHashCache.size;
    console.log(`文件哈希缓存初始化完成`);
    console.log(`  总计: ${totalFiles} 个文件`);
    console.log(`  新增: ${newCachedCount} 个`);
    console.log(`  更新: ${updatedCount} 个`);
    console.log(`  跳过: ${skippedCount} 个`);
    console.log(`  耗时: ${duration}ms`);
    cacheInitialized = true;
  } catch (error) {
    console.error('初始化文件哈希缓存失败:', error);
  }
}

/**
 * 检查文件是否在缓存中，如果不在则添加
 * @param {string} filePath - 文件路径
 * @returns {object|null} - 返回缓存信息 { hash, size, mtime }
 */
async function getOrCacheFileHash(filePath) {
  try {
    const stats = await fsExtra.stat(filePath);

    // 如果是目录，返回 null
    if (stats.isDirectory()) return null;

    // 检查缓存中是否存在
    const cached = fileHashCache.get(filePath);

    // 如果缓存存在且修改时间未变，直接返回
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached;
    }

    // 缓存不存在或文件已修改，重新计算
    console.log(`重新计算文件哈希: ${path.basename(filePath)}`);
    const fileBuffer = await fsExtra.readFile(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const cacheInfo = {
      hash: fileHash,
      size: stats.size,
      mtime: stats.mtimeMs
    };

    fileHashCache.set(filePath, cacheInfo);
    return cacheInfo;
  } catch (error) {
    console.error(`获取文件哈希缓存失败: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 添加新文件到缓存
 * @param {string} filePath - 文件路径
 */
function addFileToCache(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    fileHashCache.set(filePath, {
      hash: fileHash,
      size: stats.size,
      mtime: stats.mtimeMs
    });

    console.log(`文件已添加到缓存: ${path.basename(filePath)}`);

    // 自动保存缓存到文件
    saveCacheToFile();
  } catch (error) {
    console.error(`添加文件到缓存失败: ${filePath}`, error.message);
  }
}

// ===================== 3. Express 服务配置 =====================
/**
 * 创建视频下载目录（不存在则创建）
 */
function createDownloadDir() {
  if (!fs.existsSync(BASE_CONFIG.downloadDir)) {
    fs.mkdirSync(BASE_CONFIG.downloadDir, { recursive: true });
    console.log(`创建下载目录：${BASE_CONFIG.downloadDir}`);
  }
}
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
 * 接口1：提交视频生成任务
 * POST /api/ti2v/submit
 * 请求体：{ model, prompt, imageBase64, seed, frames, aspect_ratio, duration }
 * 响应：{ code, message, data: { taskId, model } }
 */
app.post('/api/ti2v/submit', async (req, res) => {
  try {
    const { model, prompt, imageBase64, seed, frames, aspect_ratio, duration } = req.body;
    
    // 参数校验
    if (!imageBase64) {
      return res.status(400).json({
        code: -1,
        message: "参数错误：imageBase64为必填项",
        data: null
      });
    }

    const selectedModel = model || 'jimeng';
    let submitResult;

    // 根据模型类型调用不同服务
    if (selectedModel === 'jimeng') {
      submitResult = await jimengService.submitTask({
        prompt,
        imageBase64,
        seed,
        frames,
        aspectRatio: aspect_ratio
      });
    } else {
      return res.status(400).json({
        code: -1,
        message: `不支持的模型：${selectedModel}`,
        data: null
      });
    }

    // 提取taskId
    const taskId = submitResult.data?.task_id || "";

    // 返回结果
    res.status(200).json({
      code: 0,
      message: "任务提交成功",
      data: {
        taskId,
        model: selectedModel,
        rawResponse: submitResult
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
 * 接口2：查询任务状态
 * POST /api/ti2v/query
 * 请求体：{ taskId, model }
 * 响应：{ code, message, data: { taskStatus, videoUrl, localVideoPath } }
 */
app.post('/api/ti2v/query', async (req, res) => {
  try {
    const { taskId, model = 'jimeng' } = req.body;

    // 参数校验
    if (!taskId) {
      return res.status(400).json({
        code: -1,
        message: "参数错误：taskId为必填项",
        data: null
      });
    }

    const selectedModel = model || 'jimeng';
    let result;

    // 根据模型类型调用不同服务
    if (selectedModel === 'jimeng') {
      const queryResult = await jimengService.queryTask(taskId);
      result = jimengService.parseStatus(queryResult);
    } else {
      return res.status(400).json({
        code: -1,
        message: `不支持的模型：${selectedModel}`,
        data: null
      });
    }

    // 构造本地视频访问路径
    let localVideoPath = "";
    if (result.status === 'done' && result.videoUrl) {
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
        taskStatus: result.status,
        videoUrl: result.videoUrl,
        localVideoPath,
        errorMsg: result.errorMsg,
        rawResponse: result.rawResponse
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

    // 将视频文件添加到缓存
    addFileToCache(videoPath);

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
 * 接口4.1：检查文件是否已存在
 * POST /api/ti2v/check-exist
 * 请求体：{ hash: "文件SHA-256哈希", size: 文件大小 }
 * 响应：
 *   - 存在：{ code: 0, data: { path: "/ti2v_videos/xxx.mp4", exists: true } }
 *   - 不存在：{ code: 0, data: { exists: false } }
 */
app.post('/api/ti2v/check-exist', async (req, res) => {
  try {
    const { hash, size } = req.body;

    if (!hash || !size) {
      return res.status(400).json({
        code: -1,
        message: "缺少必要参数：hash 和 size",
        data: null
      });
    }

    // 遍历 ti2v_videos 目录，查找匹配的文件
    const files = await fsExtra.readdir(BASE_CONFIG.downloadDir);
    for (const file of files) {
      const filePath = path.join(BASE_CONFIG.downloadDir, file);

      try {
        // 从缓存获取文件信息
        const fileInfo = await getOrCacheFileHash(filePath);

        if (!fileInfo) continue;

        // 先检查文件大小是否匹配（快速筛选）
        if (fileInfo.size === parseInt(size)) {
          // 大小匹配，再比较哈希
          if (fileInfo.hash === hash) {
            // 找到相同文件
            const relativePath = `/ti2v_videos/${file}`;
            console.log(`文件已存在，复用文件: ${relativePath}`);
            return res.json({
              code: 0,
              message: "文件已存在",
              data: {
                path: relativePath,
                exists: true
              }
            });
          }
        }
      } catch (error) {
        // 跳过无法读取的文件
        console.error(`检查文件 ${file} 失败:`, error.message);
        continue;
      }
    }

    // 未找到匹配的文件
    res.json({
      code: 0,
      message: "文件不存在",
      data: {
        exists: false
      }
    });
  } catch (error) {
    console.error('检查文件是否存在失败:', error);
    res.status(500).json({
      code: -1,
      message: `检查文件失败：${error.message}`,
      data: null
    });
  }
});

/**
 * 接口5：上传文件
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

    // 将新上传的文件添加到缓存
    const filePath = path.join(BASE_CONFIG.downloadDir, req.file.filename);
    addFileToCache(filePath);

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
 * 接口6：提供静态文件访问
 * GET /ti2v_videos/*
 */
app.use('/ti2v_videos', express.static(BASE_CONFIG.downloadDir));

/**
 * 接口7：获取缓存统计信息
 * GET /api/cache/stats
 */
app.get('/api/cache/stats', (req, res) => {
  const cacheInfo = {
    fileCount: fileHashCache.size,
    initialized: cacheInitialized
  };

  res.status(200).json({
    code: 0,
    message: "获取缓存统计成功",
    data: cacheInfo
  });
});

/**
 * 接口8：清除文件哈希缓存
 * POST /api/cache/clear
 */
app.post('/api/cache/clear', (req, res) => {
  fileHashCache.clear();

  // 删除缓存文件
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      fs.unlinkSync(CACHE_FILE_PATH);
      console.log('缓存文件已删除');
    }
  } catch (error) {
    console.error('删除缓存文件失败:', error.message);
  }

  console.log('文件哈希缓存已清除');

  res.status(200).json({
    code: 0,
    message: "缓存已清除",
    data: {
      fileCount: 0
    }
  });
});

/**
 * 接口9：健康检查接口
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
app.listen(PORT, async () => {
  // 提前创建下载目录
  createDownloadDir();

  // 初始化文件哈希缓存
  await initializeFileCache();

  console.log(`====================================`);
  console.log(`Ti2V后端服务已启动：http://localhost:${PORT}`);
  console.log(`健康检查：http://localhost:${PORT}/api/health`);
  console.log(`缓存统计：http://localhost:${PORT}/api/cache/stats`);
  console.log(`清除缓存：POST http://localhost:${PORT}/api/cache/clear`);
  console.log(`视频下载目录：${BASE_CONFIG.downloadDir}`);
  console.log(`文件哈希缓存：已启用 (缓存 ${fileHashCache.size} 个文件)`);
  console.log(`缓存文件路径：${CACHE_FILE_PATH}`);
  console.log(`====================================`);
});

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error("未捕获的异常：", err);
  // 保存缓存
  saveCacheToFile();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error("未处理的Promise拒绝：", reason, promise);
});

// 进程退出时保存缓存
process.on('exit', () => {
  console.log('进程退出，保存文件哈希缓存...');
  saveCacheToFile();
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在保存缓存...');
  saveCacheToFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n收到 SIGTERM 信号，正在保存缓存...');
  saveCacheToFile();
  process.exit(0);
});