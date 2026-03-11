import React from 'react';
import { assetsPanelStyles } from '../styles';

/**
 * 资产面板组件
 * 展示所有视频资产（合成视频、视频生成等）
 */
const AssetsPanel = ({ assets, onClose, onDownload, onDelete, onClearAll }) => {
  const composedVideos = assets.filter(a => a.type === 'composed');
  const generatedVideos = assets.filter(a => a.type === 'generated');

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const AssetCard = ({ asset }) => (
    <div style={assetsPanelStyles.card}>
      <video
        src={asset.url}
        style={assetsPanelStyles.video}
        controls
      />
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

  return (
    <div style={assetsPanelStyles.container}>
      <div style={assetsPanelStyles.header}>
        <h3 style={assetsPanelStyles.title}>视频资产库</h3>
        <button
          type="button"
          onClick={onClose}
          style={assetsPanelStyles.closeButton}
        >
          ✕
        </button>
      </div>

      {assets.length === 0 ? (
        <div style={assetsPanelStyles.empty}>
          <p>暂无视频资产</p>
          <p style={assetsPanelStyles.emptyHint}>
            合成视频或生成视频后会显示在这里
          </p>
        </div>
      ) : (
        <>
          {composedVideos.length > 0 && (
            <>
              <div style={assetsPanelStyles.sectionTitle}>
                合成视频 ({composedVideos.length})
              </div>
              <div style={assetsPanelStyles.grid}>
                {composedVideos.map(asset => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </>
          )}

          {generatedVideos.length > 0 && (
            <>
              <div style={assetsPanelStyles.sectionTitle}>
                生成视频 ({generatedVideos.length})
              </div>
              <div style={assetsPanelStyles.grid}>
                {generatedVideos.map(asset => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </>
          )}

          <div style={assetsPanelStyles.footer}>
            <button
              type="button"
              onClick={onClearAll}
              style={assetsPanelStyles.clearAllButton}
            >
              清空所有资产
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AssetsPanel;
