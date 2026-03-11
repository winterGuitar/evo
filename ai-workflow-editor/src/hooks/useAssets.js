import { useState, useEffect, useCallback, useRef } from 'react';

const ASSETS_STORAGE_KEY = 'ai-workflow-assets';

/**
 * 资产 Hook
 * 管理视频资产（合成视频、视频生成等）
 */
export const useAssets = () => {
  const [assets, setAssets] = useState([]);
  const [isAssetsPanelOpen, setIsAssetsPanelOpen] = useState(false);
  const loadAssetsRef = useRef(false);

  /**
   * 从外部数据加载资产
   * @param {Array} externalAssets - 从文件加载的资产数据
   */
  const loadAssetsFromFile = useCallback((externalAssets) => {
    if (Array.isArray(externalAssets) && externalAssets.length > 0) {
      console.log('从文件加载资产:', externalAssets.length);
      setAssets(externalAssets);
      saveAssetsToLocalStorage(externalAssets);
    }
  }, []);

  /**
   * 从 localStorage 加载资产记录
   */
  const loadAssetsFromLocalStorage = useCallback(() => {
    if (loadAssetsRef.current) return;
    
    try {
      const saved = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAssets(parsed);
      }
      loadAssetsRef.current = true;
    } catch (e) {
      console.error('加载资产记录失败:', e);
    }
  }, []);

  // 初始化时从 localStorage 加载
  useEffect(() => {
    loadAssetsFromLocalStorage();
  }, [loadAssetsFromLocalStorage]);

  /**
   * 保存资产记录到 localStorage
   */
  const saveAssetsToLocalStorage = useCallback((newAssets) => {
    try {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(newAssets));
      setAssets(newAssets);
    } catch (e) {
      console.error('保存资产记录失败:', e);
    }
  }, []);

  /**
   * 保存资产记录到 localStorage（供外部调用）
   */
  const saveAssets = useCallback((newAssets) => {
    saveAssetsToLocalStorage(newAssets);
  }, [saveAssetsToLocalStorage]);

  /**
   * 获取当前资产数据（用于保存到文件）
   */
  const getAssetsData = useCallback(() => {
    return assets;
  }, [assets]);

  /**
   * 添加视频资产
   * @param {string} url - 视频 URL
   * @param {string} type - 资产类型 ('composed' | 'generated')
   * @param {string} name - 视频名称
   */
  const addAsset = useCallback((url, type = 'composed', name = '') => {
    const asset = {
      id: `asset-${Date.now()}`,
      url,
      type,
      name: name || `${type === 'composed' ? '合成视频' : '生成视频'}_${new Date().toLocaleString('zh-CN')}`,
      createdAt: new Date().toISOString()
    };

    saveAssets([asset, ...assets]);
    return asset.id;
  }, [assets, saveAssets]);

  /**
   * 检查 URL 是否为服务器路径
   */
  const isServerPath = (url) => {
    if (!url) return false;
    return url.startsWith('/ti2v_videos/') || 
           url.includes('/ti2v_videos/') || 
           url.startsWith('http://localhost:3001/ti2v_videos/') ||
           url.startsWith('http://127.0.0.1:3001/ti2v_videos/');
  };

  /**
   * 从 URL 提取服务器路径
   */
  const extractServerPath = (url) => {
    if (!url) return null;
    if (url.startsWith('/ti2v_videos/')) return url;
    const match = url.match(/(\/ti2v_videos\/[^\s?]+)/);
    return match ? match[1] : null;
  };

  /**
   * 删除资产
   */
  const deleteAsset = useCallback(async (assetId) => {
    const assetToDelete = assets.find(asset => asset.id === assetId);
    console.log('=== 删除资产 ===');
    console.log('资产URL:', assetToDelete?.url);

    // 如果资产有服务器路径，尝试删除后端文件
    const serverPath = extractServerPath(assetToDelete?.url);
    console.log('提取的服务器路径:', serverPath);

    if (serverPath) {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const requestBody = JSON.stringify({ path: serverPath });
        console.log('发送删除请求:', requestBody);
        
        const response = await fetch(`${API_BASE_URL}/api/ti2v/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        });
        const result = await response.json();
        console.log('后端删除响应:', result);
        if (result.code === 0) {
          console.log('后端文件已删除:', serverPath);
        } else {
          console.warn('后端删除失败:', result.message);
        }
      } catch (error) {
        console.error('删除后端文件失败:', error);
      }
    } else {
      console.log('不是服务器路径，跳过后端删除');
    }

    // 从资产列表中移除
    const newAssets = assets.filter(asset => asset.id !== assetId);
    saveAssets(newAssets);
  }, [assets, saveAssets]);

  /**
   * 清空所有资产
   */
  const clearAllAssets = useCallback(async () => {
    if (!window.confirm('确定要清空所有资产记录吗？')) {
      return;
    }

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // 删除所有后端文件
    for (const asset of assets) {
      const serverPath = extractServerPath(asset.url);
      if (serverPath) {
        try {
          await fetch(`${API_BASE_URL}/api/ti2v/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: serverPath })
          });
          console.log('后端文件已删除:', serverPath);
        } catch (error) {
          console.error('删除后端文件失败:', serverPath, error);
        }
      }
    }

    // 清空资产列表
    saveAssets([]);
  }, [assets, saveAssets]);

  /**
   * 清除所有视频资产
   */
  const clearVideoAssets = useCallback(async () => {
    const assetsToDelete = assets.filter(a => a.type === 'composed' || a.type === 'generated');

    if (!window.confirm(`确定要清除所有视频资产吗？(${assetsToDelete.length} 个)`)) {
      return;
    }

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // 删除后端文件
    for (const asset of assetsToDelete) {
      const serverPath = extractServerPath(asset.url);
      if (serverPath) {
        try {
          await fetch(`${API_BASE_URL}/api/ti2v/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: serverPath })
          });
          console.log('后端文件已删除:', serverPath);
        } catch (error) {
          console.error('删除后端文件失败:', serverPath, error);
        }
      }
    }

    // 从资产列表中移除视频资产
    const newAssets = assets.filter(a => a.type !== 'composed' && a.type !== 'generated');
    saveAssets(newAssets);
  }, [assets, saveAssets]);

  /**
   * 清除所有图片资产
   */
  const clearImageAssets = useCallback(async () => {
    const assetsToDelete = assets.filter(a => a.type === 'image');

    if (!window.confirm(`确定要清除所有图片资产吗？(${assetsToDelete.length} 个)`)) {
      return;
    }

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    // 删除后端文件（如果有）
    for (const asset of assetsToDelete) {
      const serverPath = extractServerPath(asset.url);
      if (serverPath) {
        try {
          await fetch(`${API_BASE_URL}/api/ti2v/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: serverPath })
          });
          console.log('后端文件已删除:', serverPath);
        } catch (error) {
          console.error('删除后端文件失败:', serverPath, error);
        }
      }
    }

    // 从资产列表中移除图片资产
    const newAssets = assets.filter(a => a.type !== 'image');
    saveAssets(newAssets);
  }, [assets, saveAssets]);

  /**
   * 下载资产
   */
  const downloadAsset = useCallback((asset) => {
    const a = document.createElement('a');
    a.href = asset.url;
    a.download = `${asset.name}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    assets,
    isAssetsPanelOpen,
    setIsAssetsPanelOpen,
    addAsset,
    deleteAsset,
    clearAllAssets,
    clearVideoAssets,
    clearImageAssets,
    downloadAsset,
    loadAssetsFromFile,
    getAssetsData
  };
};
