import React from 'react';
import { paletteStyles } from '../styles';
import { NODE_PALETTE_CATEGORIES, getNodeColor } from '../constants';

const NodePalette = ({ onDragStart }) => {
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
    </div>
  );
};

export default NodePalette;
