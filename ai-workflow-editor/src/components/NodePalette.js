import { paletteStyles } from '../styles';
import { NODE_PALETTE_CATEGORIES, getNodeColor } from '../constants';

const NodePalette = ({ onDragStart, composedVideoUrl, composeProgress }) => {
  const progressPercent = composeProgress.total > 0
    ? Math.round((composeProgress.current / composeProgress.total) * 100)
    : 0;

  return (
    <div style={paletteStyles.container}>
      <div style={paletteStyles.header}>
        <h2 style={paletteStyles.title}>
          <span style={paletteStyles.titleIcon}>🧩</span>
          节点库
        </h2>
        <p style={paletteStyles.subtitle}>
          拖拽节点到右侧画布 | 直接拖拽图片生成图片节点 | 右键画布快速创建
        </p>
      </div>

      <div style={paletteStyles.content}>
        {NODE_PALETTE_CATEGORIES.map((category, idx) => (
          <div key={idx} style={paletteStyles.category}>
            <div style={paletteStyles.categoryTitle}>
              <span style={paletteStyles.categoryIndicator} />
              {category.name}
            </div>

            {category.items.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => onDragStart(e, { ...item, type: item.id })}
                style={paletteStyles.nodeItem}
                onDragEnd={(e) => e.preventDefault()}
              >
                <div style={paletteStyles.nodeIcon(getNodeColor(item.id))}>
                  {item.icon}
                </div>
                <div style={paletteStyles.nodeInfo}>
                  <div style={paletteStyles.nodeLabel}>{item.label}</div>
                  <div style={paletteStyles.nodeDescription}>{item.description}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 合成视频展示框 */}
      <div style={paletteStyles.composedVideoSection}>
        <div style={paletteStyles.composedVideoTitle}>🎥 合成视频</div>
        {composeProgress.isComposing ? (
          <div style={paletteStyles.composedVideoProgress}>
            <div style={paletteStyles.composedVideoProgressIcon}>⏳</div>
            <div style={paletteStyles.composedVideoProgressText}>
              {composeProgress.stage || '合成中...'} {progressPercent}%
            </div>
            <div style={paletteStyles.composedVideoProgressTextDetail}>
              步骤 {composeProgress.current} / {composeProgress.total}
            </div>
            <div style={paletteStyles.composedVideoProgressBar}>
              <div style={{
                ...paletteStyles.composedVideoProgressFill,
                width: `${progressPercent}%`
              }} />
            </div>
          </div>
        ) : composedVideoUrl ? (
          <video
            src={composedVideoUrl}
            crossOrigin="anonymous"
            controls
            style={paletteStyles.composedVideo}
          />
        ) : (
          <div style={paletteStyles.composedVideoEmpty}>
            <div style={paletteStyles.composedVideoEmptyIcon}>📹</div>
            <div style={paletteStyles.composedVideoEmptyText}>暂无合成视频</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodePalette;
