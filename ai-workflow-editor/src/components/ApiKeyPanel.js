import { useState, useEffect } from 'react';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
  },
  panel: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '600px',
    maxHeight: '80vh',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  apiKeySection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
  },
  description: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: '#64748b',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
    color: '#475569',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'monospace',
    transition: 'border-color 0.2s',
  },
  inputFocused: {
    outline: 'none',
    borderColor: '#3b82f6',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  cancelButtonHover: {
    backgroundColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  },
  saveButtonHover: {
    backgroundColor: '#2563eb',
  },
  infoBox: {
    padding: '12px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#92400e',
    marginBottom: '16px',
  },
};

const ApiKeyPanel = ({ onClose, onSave }) => {
  const [apiKeys, setApiKeys] = useState({
    jimengAccessKeyId: '',
    jimengSecretAccessKey: '',
    dashscopeApiKey: '',
    doubaoApiKey: '',
  });

  useEffect(() => {
    // 从 localStorage 加载已保存的密钥
    const savedKeys = localStorage.getItem('ai-workflow-api-keys');
    if (savedKeys) {
      setApiKeys(JSON.parse(savedKeys));
    }
  }, []);

  const handleInputChange = (field, value) => {
    setApiKeys(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    // 保存到 localStorage
    localStorage.setItem('ai-workflow-api-keys', JSON.stringify(apiKeys));
    console.log('API 密钥已保存:', apiKeys);
    
    // 通知后端更新密钥
    onSave(apiKeys);
    onClose();
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} />
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>API 密钥配置</h2>
          <button
            style={styles.closeButton}
            onClick={onClose}
            onMouseOver={(e) => e.target.style.color = '#1e293b'}
            onMouseOut={(e) => e.target.style.color = '#64748b'}
          >
            ×
          </button>
        </div>

        <div style={styles.content}>
          <div style={styles.infoBox}>
            ⚠️ 密钥将保存在浏览器本地存储中，仅在本地使用，不会上传到任何服务器。
          </div>

          {/* 即梦配置 */}
          <div style={styles.apiKeySection}>
            <h3 style={styles.sectionTitle}>即梦（火山引擎）</h3>
            <p style={styles.description}>
              用于图生视频功能。需要在火山引擎平台申请密钥。
            </p>
            <label style={styles.label}>Access Key ID</label>
            <input
              type="text"
              style={styles.input}
              value={apiKeys.jimengAccessKeyId}
              onChange={(e) => handleInputChange('jimengAccessKeyId', e.target.value)}
              placeholder="AKLT..."
            />
          </div>

          <div style={styles.apiKeySection}>
            <label style={styles.label}>Secret Access Key</label>
            <input
              type="password"
              style={styles.input}
              value={apiKeys.jimengSecretAccessKey}
              onChange={(e) => handleInputChange('jimengSecretAccessKey', e.target.value)}
              placeholder="TVR..."
            />
          </div>

          {/* 万相配置 */}
          <div style={styles.apiKeySection}>
            <h3 style={styles.sectionTitle}>万相（阿里云）</h3>
            <p style={styles.description}>
              用于视频生成功能。需要在阿里云 DashScope 平台申请 API Key。
            </p>
            <label style={styles.label}>API Key</label>
            <input
              type="password"
              style={styles.input}
              value={apiKeys.dashscopeApiKey}
              onChange={(e) => handleInputChange('dashscopeApiKey', e.target.value)}
              placeholder="sk-..."
            />
          </div>

          {/* 豆包配置 */}
          <div style={styles.apiKeySection}>
            <h3 style={styles.sectionTitle}>豆包（火山方舟）</h3>
            <p style={styles.description}>
              用于对话和 AI 助手功能。需要在火山方舟平台申请 API Key。
            </p>
            <label style={styles.label}>API Key</label>
            <input
              type="password"
              style={styles.input}
              value={apiKeys.doubaoApiKey}
              onChange={(e) => handleInputChange('doubaoApiKey', e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button
            style={styles.cancelButton}
            onClick={onClose}
            onMouseOver={(e) => e.target.style.backgroundColor = '#e2e8f0'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#f1f5f9'}
          >
            取消
          </button>
          <button
            style={styles.saveButton}
            onClick={handleSave}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            保存密钥
          </button>
        </div>
      </div>
    </>
  );
};

export default ApiKeyPanel;
