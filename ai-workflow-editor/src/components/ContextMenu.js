import React, { useRef, useEffect } from 'react';
import { contextMenuStyles } from '../styles';
import { NODE_PALETTE_CATEGORIES, NODE_ICONS } from '../constants';

const ContextMenu = ({ x, y, onClose, onCreateNode, onDuplicateNode, targetNode }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const isNodeMenu = targetNode !== null;

  return (
    <div
      ref={menuRef}
      style={{
        ...contextMenuStyles.container,
        left: x,
        top: y
      }}
    >
      <div style={contextMenuStyles.header}>
        <span style={contextMenuStyles.title}>
          {isNodeMenu && targetNode ? `${NODE_ICONS[targetNode.type] || 'AI'} 节点操作` : '📌 创建节点'}
        </span>
        <button onClick={onClose} style={contextMenuStyles.closeButton}>✕</button>
      </div>

      <div style={contextMenuStyles.content}>
        {isNodeMenu ? (
          <>
            {/* 节点操作菜单 */}
            <div style={contextMenuStyles.menuItem} onClick={() => onDuplicateNode(targetNode)}>
              <span style={contextMenuStyles.itemIcon}>📋</span>
              <span style={contextMenuStyles.itemLabel}>复制节点</span>
            </div>
            <div style={{ ...contextMenuStyles.category, ...contextMenuStyles.divider }}>
              <div style={contextMenuStyles.menuItem} onClick={onClose}>
                <span style={contextMenuStyles.itemIcon}>❌</span>
                <span style={contextMenuStyles.itemLabel}>取消</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 创建节点菜单 */}
            {NODE_PALETTE_CATEGORIES.map((category, idx) => (
              <div key={idx} style={contextMenuStyles.category}>
                <div style={contextMenuStyles.categoryTitle}>{category.name}</div>
                {category.items.map((item) => (
                  <div
                    key={item.id}
                    style={contextMenuStyles.menuItem}
                    onClick={() => onCreateNode(item.id)}
                  >
                    <span style={contextMenuStyles.itemIcon}>{item.icon}</span>
                    <span style={contextMenuStyles.itemLabel}>{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ ...contextMenuStyles.category, ...contextMenuStyles.divider }}>
              <div style={contextMenuStyles.menuItem} onClick={onClose}>
                <span style={contextMenuStyles.itemIcon}>❌</span>
                <span style={contextMenuStyles.itemLabel}>取消</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ContextMenu;
