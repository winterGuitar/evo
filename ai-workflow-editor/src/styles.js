// styles.js - 集中管理所有样式

// ========== 主题颜色 ==========
export const colors = {
  // 节点颜色
  node: {
    'image-gen': '#FF9800',
    'video-gen': '#3F51B5',
    'image-input': '#00ACC1',
    'video-input': '#26A69A',
    default: '#757575'
  },
  // 状态颜色
  status: {
    running: '#4CAF50',
    completed: '#2196F3',
    idle: '#9E9E9E',
    error: '#F44336',
    warning: '#f59e0b'
  },
  // 背景色
  background: {
    primary: '#ffffff',
    secondary: '#f8f9fa',
    hover: '#f0f4f8',
    panel: '#fafbfc',
    success: '#E8F5E9',
    info: '#E3F2FD',
    light: '#F5F5F5'
  },
  // 边框
  border: {
    light: '#eaeef2',
    default: '#e0e8ef',
    dark: '#edf2f6'
  },
  // 文字
  text: {
    primary: '#1a2634',
    secondary: '#2a3a4a',
    tertiary: '#3a4a5c',
    muted: '#5f6c80',
    light: '#6b7b8d',
    lighter: '#8a9aa8',
    placeholder: '#a0b0bd'
  }
};

// ========== 节点样式 ==========
export const nodeStyles = {
  container: (selected, nodeColor) => ({
    width: 260,
    padding: '14px 16px',
    border: selected ? `2px solid ${nodeColor}` : `1px solid ${colors.border.dark}`,
    borderRadius: 12,
    backgroundColor: colors.background.primary,
    boxShadow: selected
      ? `0 8px 16px rgba(0,0,0,0.1), 0 0 0 2px ${nodeColor}20`
      : '0 2px 8px rgba(0,0,0,0.04)',
    position: 'relative',
    transition: 'all 0.2s ease',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    overflow: 'hidden',
    ':hover $deleteButton': {
      opacity: 1
    }
  }),
  
  header: (nodeColor) => ({
    position: 'absolute',
    top: -10,
    left: 12,
    backgroundColor: nodeColor,
    color: 'white',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 20,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    maxWidth: '180px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }),

  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: colors.status.error,
    color: 'white',
    border: '2px solid white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
    opacity: 0,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(244, 67, 54, 0.3)',
    zIndex: 10,
    
    '&:hover': {
      transform: 'scale(1.1)',
      backgroundColor: '#d32f2f',
      boxShadow: '0 4px 8px rgba(244, 67, 54, 0.4)'
    }
  },

  deleteButtonVisible: {
    opacity: 1
  },

  disconnectAllButton: {
    position: 'absolute',
    top: 0,
    right: 30,
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid #fff',
    backgroundColor: colors.status.warning,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
    zIndex: 10,
    transition: 'opacity 0.2s ease'
  },

  disconnectAllButtonSelected: {
    opacity: 1
  },

  disconnectAllButtonDefault: {
    opacity: 0.85
  },

  resizeHandle: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 12,
    height: 12,
    borderRight: `2px solid ${colors.text.lighter}`,
    borderBottom: `2px solid ${colors.text.lighter}`,
    borderRadius: 2,
    cursor: 'nwse-resize',
    zIndex: 12,
    opacity: 0.9
  },

  iconContainer: (nodeColor) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${nodeColor}10`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    color: nodeColor,
    fontSize: 18
  }),

  modelInfo: {
    fontSize: 11,
    color: colors.text.light,
    marginBottom: 8,
    padding: '6px 10px',
    backgroundColor: colors.background.hover,
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6
  },

  modelSelect: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: `1px solid ${colors.border.default}`,
    fontSize: 12,
    color: colors.text.secondary,
    backgroundColor: colors.background.primary,
    outline: 'none'
  },

  modelMeta: {
    fontSize: 11,
    color: colors.text.light
  },

  textInputSection: {
    marginBottom: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },

  textInputLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.text.light
  },

  textInput: {
    width: '100%',
    height: 32,
    padding: '6px 10px',
    borderRadius: 6,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box'
  },

  sendButtonSection: {
    marginBottom: 10
  },

  sendButton: (nodeColor) => ({
    width: '100%',
    height: 34,
    borderRadius: 6,
    border: 'none',
    backgroundColor: nodeColor,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease'
  }),

  sendButtonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed'
  },

  filePickerSection: {
    marginBottom: 10
  },

  filePickerButton: {
    width: '100%',
    height: 32,
    borderRadius: 6,
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.primary,
    color: colors.text.secondary,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  },

  hiddenFileInput: {
    display: 'none'
  },

  inputPreviewContainer: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary
  },

  inputPreviewHeader: {
    fontSize: 11,
    padding: '4px 8px',
    backgroundColor: colors.background.light,
    color: colors.text.light,
    borderBottom: `1px solid ${colors.border.default}`
  },

  inputPreviewList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: 8
  },

  inputPreviewItem: {
    width: 50,
    height: 50,
    borderRadius: 6,
    overflow: 'hidden',
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.hover
  },

  inputPreviewImage: {
    width: 50,
    height: 50,
    display: 'block',
    objectFit: 'contain',
    backgroundColor: colors.background.hover
  },

  previewContainer: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    border: `1px solid ${colors.border.default}`,
    backgroundColor: colors.background.secondary
  },

  previewImage: {
    width: '100%',
    height: 240,
    display: 'block',
    objectFit: 'contain',
    backgroundColor: colors.background.hover
  },

  previewVideo: {
    width: '100%',
    height: 240,
    display: 'block',
    objectFit: 'contain',
    backgroundColor: '#000'
  },

  previewPlaceholder: {
    width: '100%',
    height: 240,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.hover,
    color: colors.text.placeholder,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.2px'
  },

  previewFooter: {
    fontSize: 11,
    padding: '4px 8px',
    backgroundColor: colors.background.secondary,
    color: colors.text.light,
    borderTop: `1px solid ${colors.border.default}`
  },

  description: (nodeColor) => ({
    fontSize: 12,
    color: colors.text.light,
    marginBottom: 12,
    padding: '8px 10px',
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
    borderLeft: `3px solid ${nodeColor}`,
    lineHeight: 1.5
  }),

  status: (status) => {
    const textColor = status === 'running'
      ? colors.status.running
      : status === 'completed'
        ? colors.status.completed
        : status === 'error'
          ? colors.status.error
          : colors.status.idle;
    const backgroundColor = status === 'running'
      ? colors.background.success
      : status === 'completed'
        ? colors.background.info
        : status === 'error'
          ? '#FDECEC'
          : colors.background.light;

    return {
      fontSize: 11,
      color: textColor,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      padding: '4px 8px',
      backgroundColor,
      borderRadius: 4
    };
  },

  statusDot: (status) => {
    const dotColor = status === 'running'
      ? colors.status.running
      : status === 'completed'
        ? colors.status.completed
        : status === 'error'
          ? colors.status.error
          : colors.status.idle;

    return {
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: dotColor,
      display: 'inline-block',
      animation: status === 'running' ? 'pulse 1.5s infinite' : 'none'
    };
  },

  handle: {
    base: {
      width: 12,
      height: 12,
      border: '2px solid white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    target: {
      top: '50%',
      left: -8,
      backgroundColor: colors.node['image-input'],
    },
    source: {
      top: '50%',
      right: -8,
      backgroundColor: colors.node.default,
    }
  }
};

// ========== 边样式 ==========
export const edgeStyles = {
  disconnectButton: {
    container: {
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'all',
      zIndex: 1000
    },
    button: {
      border: 'none',
      borderRadius: 999,
      padding: '4px 10px',
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      background: colors.status.error,
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      
      '&:hover': {
        background: '#d32f2f',
        transform: 'scale(1.05)',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
      }
    }
  },

  edge: {
    stroke: colors.node.default,
    strokeWidth: 2,
    animated: true
  },

  clickablePath: {
    fill: 'none',
    stroke: 'transparent',
    strokeWidth: 20,
    pointerEvents: 'stroke',
    cursor: 'pointer'
  }
};

// ========== 节点库样式 ==========
export const paletteStyles = {
  container: {
    width: 280,
    backgroundColor: colors.background.primary,
    borderRight: `1px solid ${colors.border.light}`,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    boxShadow: '2px 0 8px rgba(0,0,0,0.02)'
  },

  header: {
    padding: '24px 20px',
    borderBottom: `1px solid ${colors.border.light}`,
    background: `linear-gradient(145deg, ${colors.background.primary} 0%, ${colors.background.panel} 100%)`
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },

  titleIcon: {
    fontSize: 24
  },

  subtitle: {
    margin: '8px 0 0',
    fontSize: 13,
    color: colors.text.muted
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px'
  },

  category: {
    marginBottom: 28
  },

  categoryTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.text.tertiary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },

  categoryIndicator: {
    width: 4,
    height: 16,
    backgroundColor: colors.node.default,
    borderRadius: 2,
    display: 'inline-block'
  },

  nodeItem: {
    padding: '14px 16px',
    marginBottom: 10,
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.dark}`,
    borderRadius: 12,
    cursor: 'grab',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    
    '&:hover': {
      borderColor: colors.node.default,
      boxShadow: `0 4px 12px rgba(33, 150, 243, 0.12)`,
      transform: 'translateY(-1px)'
    },
    
    '&:active': {
      cursor: 'grabbing'
    }
  },

  nodeIcon: (color) => ({
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${color}10`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    color: color
  }),

  nodeInfo: {
    flex: 1
  },

  nodeLabel: {
    fontWeight: 600,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4
  },

  nodeDescription: {
    fontSize: 12,
    color: colors.text.light,
    lineHeight: 1.4
  }
};

// ========== 画布样式 ==========
export const canvasStyles = {
  wrapper: {
    flex: 1,
    position: 'relative'
  },

  reactFlow: {
    backgroundColor: colors.background.secondary
  },

  panel: {
    margin: '12px'
  },

  buttonGroup: {
    display: 'flex',
    gap: '8px'
  },

  primaryButton: {
    padding: '8px 16px',
    backgroundColor: colors.node.default,
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.2s',
    
    '&:hover': {
      backgroundColor: '#1976D2',
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 8px rgba(33, 150, 243, 0.3)'
    },
    
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 2px 4px rgba(33, 150, 243, 0.3)'
    }
  },

  secondaryButton: {
    padding: '8px 16px',
    backgroundColor: colors.background.hover,
    color: colors.text.light,
    border: `1px solid ${colors.border.default}`,
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    
    '&:hover': {
      backgroundColor: colors.background.secondary,
      borderColor: colors.text.light
    }
  },

  emptyState: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: '32px 48px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    textAlign: 'center'
  },

  emptyStateTitle: {
    margin: '0 0 8px 0',
    color: colors.text.primary,
    fontSize: 18
  },

  emptyStateText: {
    margin: 0,
    color: colors.text.light,
    fontSize: 14,
    lineHeight: 1.6
  },

  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16
  },

  emptyStateHighlight: {
    color: colors.status.error,
    fontWeight: 600
  },

  autoSaveIndicator: {
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 500,
    color: colors.text.light,
    backgroundColor: `${colors.status.running}15`,
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    border: `1px solid ${colors.status.running}30`
  },

  timelineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '120px',
    backgroundColor: colors.background.panel,
    borderTop: `1px solid ${colors.border.default}`,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 100,
    boxShadow: '0 -2px 8px rgba(0,0,0,0.05)'
  },

  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },

  timelineTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },

  timelineActions: {
    display: 'flex',
    gap: '8px'
  },

  timelineButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s'
  },

  timelineButtonPrimary: {
    backgroundColor: colors.node.default,
    color: 'white',
    ':hover': {
      backgroundColor: '#1976D2'
    }
  },

  timelineButtonSecondary: {
    backgroundColor: colors.background.hover,
    color: colors.text.secondary,
    border: `1px solid ${colors.border.default}`,
    ':hover': {
      backgroundColor: colors.background.secondary
    }
  },

  timelineContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '2px 0'
  },

  timelineItem: {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '8px',
    backgroundColor: colors.background.primary,
    border: `1px solid ${colors.border.default}`,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '112px',
    minHeight: '96px',
    ':hover': {
      borderColor: colors.node.default,
      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)'
    }
  },

  timelineItemSelected: {
    borderColor: colors.node.default,
    backgroundColor: `${colors.node.default}08`,
    position: 'relative',
    overflow: 'visible'
  },

  timelineItemSelectedBadge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '20px',
    height: '20px',
    backgroundColor: colors.status.running,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(76, 175, 80, 0.4)',
    zIndex: 10
  },

  timelineItemSelectedCheck: {
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold',
    lineHeight: 1
  },

  timelineItemSequence: {
    fontSize: '10px',
    fontWeight: 700,
    color: colors.node.default,
    backgroundColor: `${colors.node.default}15`,
    padding: '1px 6px',
    borderRadius: '10px',
    minWidth: '20px',
    textAlign: 'center'
  },

  timelineItemLabel: {
    fontSize: '10px',
    color: colors.text.light,
    textAlign: 'center',
    maxWidth: '80px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },

  timelinePlaceholder: {
    fontSize: '12px',
    color: colors.text.placeholder,
    textAlign: 'center',
    padding: '24px',
    fontStyle: 'italic'
  }
};

// ========== 右键菜单样式 ==========
export const contextMenuStyles = {
  container: {
    position: 'fixed',
    zIndex: 1000,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
    width: 260,
    overflow: 'hidden',
    animation: 'fadeIn 0.2s ease'
  },
  
  header: {
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.panel
  },
  
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.text.primary
  },
  
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: colors.text.light,
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    transition: 'all 0.2s',
    
    '&:hover': {
      backgroundColor: colors.background.hover,
      color: colors.text.primary
    }
  },
  
  content: {
    padding: '8px'
  },
  
  category: {
    marginBottom: 8
  },
  
  categoryTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: colors.text.tertiary,
    padding: '8px 12px 4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: colors.text.primary,
    
    '&:hover': {
      backgroundColor: colors.background.hover,
      transform: 'translateX(2px)'
    }
  },
  
  itemIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center'
  },
  
  itemLabel: {
    fontSize: 13,
    fontWeight: 500
  },

  divider: {
    borderTop: `1px solid ${colors.border.light}`,
    marginTop: 8,
    paddingTop: 8
  }
};

// ========== MiniMap 样式 ==========
export const miniMapStyles = {
  container: {
    backgroundColor: colors.background.primary,
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  }
};

// ========== 动画 ==========
export const contextMenuAnimations = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

export const animations = `
  @keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
  
  ${contextMenuAnimations}
`;

// ========== 全局样式 ==========
export const globalStyles = {
  appContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw'
  }
};

// ========== React Flow Position 常量 ==========
export const Position = {
  Left: 'left',
  Right: 'right',
  Top: 'top',
  Bottom: 'bottom'
};
