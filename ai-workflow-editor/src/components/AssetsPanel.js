import React, { useState } from 'react';
import { assetsPanelStyles } from '../styles';

/**
 * 资产面板组件
 * 展示所有资产（图片、视频等），按类型和日期分组
 */
const AssetsPanel = ({ assets, onClose, onDownload, onDelete, onClearVideos, onClearImages }) => {
  const [activeTab, setActiveTab] = useState('video');

  // 按类型分组资产
  const videoAssets = assets.filter(a => a.type === 'composed' || a.type === 'generated');
  const imageAssets = assets.filter(a => a.type === 'image');

  // 按日期分组资产
  const groupByDate = (assetList) => {
    const groups = {};
    assetList.forEach(asset => {
      const date = new Date(asset.createdAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(asset);
    });
    return groups;
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const AssetCard = ({ asset, isImage }) => (
    <div style={assetsPanelStyles.card}>
      {isImage ? (
        <img
          src={asset.url}
          alt={asset.name}
          style={assetsPanelStyles.image}
        />
      ) : (
        <video
          src={asset.url}
          style={assetsPanelStyles.video}
          controls
        />
      )}
      <div style={assetsPanelStyles.cardInfo}>
        <div style={assetsPanelStyles.cardName} title={asset.name}>
          {asset.name}
        </div>
        <div style={assetsPanelStyles.cardDate}>
          {formatDate(asset.createdAt)}
        </div>
      </div>
      <div style={assetsPanelStyles.cardActions}>
        <button
          type="button"
          onClick={() => onDownload(asset)}
          style={assetsPanelStyles.actionButton}
          title="下载"
        >
          下载
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('确定要删除这个资产吗？')) {
              onDelete(asset.id);
            }
          }}
          style={assetsPanelStyles.deleteButton}
          title="删除"
        >
          删除
        </button>
      </div>
    </div>
  );

  const TabButton = ({ id, label, count }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        ...assetsPanelStyles.tabButton,
        ...(activeTab === id ? assetsPanelStyles.tabButtonActive : {})
      }}
    >
      {label} ({count})
    </button>
  );

  const renderAssetGroup = (assetGroups, isImage) => {
    const sortedDates = Object.keys(assetGroups).sort((a, b) => new Date(b) - new Date(a));

    return sortedDates.map((dateKey, index) => (
      <div key={dateKey}>
        {index > 0 && <div style={assetsPanelStyles.dateDivider} />}
        <div style={assetsPanelStyles.sectionTitle}>
          {dateKey}
        </div>
        <div style={assetsPanelStyles.grid}>
          {assetGroups[dateKey].map(asset => (
            <AssetCard key={asset.id} asset={asset} isImage={isImage} />
          ))}
        </div>
      </div>
    ));
  };

  const currentAssets = activeTab === 'video' ? videoAssets : imageAssets;
  const isImage = activeTab === 'image';
  const groupedAssets = groupByDate(currentAssets);

  return (
    <div style={assetsPanelStyles.container}>
      <div style={assetsPanelStyles.header}>
        <h3 style={assetsPanelStyles.title}>资产库</h3>
        <button
          type="button"
          onClick={onClose}
          style={assetsPanelStyles.closeButton}
        >
          ✕
        </button>
      </div>

      <div style={assetsPanelStyles.tabs}>
        <TabButton id="video" label="视频" count={videoAssets.length} />
        <TabButton id="image" label="图片" count={imageAssets.length} />
      </div>

      <div style={assetsPanelStyles.content}>
        {currentAssets.length === 0 ? (
          <div style={assetsPanelStyles.empty}>
            <p>暂无{isImage ? '图片' : '视频'}资产</p>
            <p style={assetsPanelStyles.emptyHint}>
              {isImage ? '生成图片后会显示在这里' : '合成视频或生成视频后会显示在这里'}
            </p>
          </div>
        ) : (
          renderAssetGroup(groupedAssets, isImage)
        )}
      </div>

      {assets.length > 0 && (
        <div style={assetsPanelStyles.footer}>
          {activeTab === 'video' ? (
            <button
              type="button"
              onClick={onClearVideos}
              style={assetsPanelStyles.clearAllButton}
              disabled={videoAssets.length === 0}
            >
              清除所有视频 ({videoAssets.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={onClearImages}
              style={assetsPanelStyles.clearAllButton}
              disabled={imageAssets.length === 0}
            >
              清除所有图片 ({imageAssets.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetsPanel;
