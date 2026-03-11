import { useState, useEffect, useCallback } from 'react';

const ASSETS_STORAGE_KEY = 'ai-workflow-assets';

/**
 * 资产 Hook
 * 管理视频资产（合成视频、视频生成等）
 */
export const useAssets = () => {
  const [assets, setAssets] = useState([]);
  const [isAssetsPanelOpen, setIsAssetsPanelOpen] = useState(false);

  // 从 localStorage 加载资产记录
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ASSETS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAssets(parsed);
      }
    } catch (e) {
      console.error('加载资产记录失败:', e);
    }
  }, []);

  // 保存资产记录到 localStorage
  const saveAssets = useCallback((newAssets) => {
    try {
      localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(newAssets));
      setAssets(newAssets);
    } catch (e) {
      console.error('保存资产记录失败:', e);
    }
  }, []);

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
   * 删除资产
   */
  const deleteAsset = useCallback((assetId) => {
    const newAssets = assets.filter(asset => asset.id !== assetId);
    saveAssets(newAssets);
  }, [assets, saveAssets]);

  /**
   * 清空所有资产
   */
  const clearAllAssets = useCallback(() => {
    if (window.confirm('确定要清空所有资产记录吗？')) {
      saveAssets([]);
    }
  }, [saveAssets]);

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
    downloadAsset
  };
};
