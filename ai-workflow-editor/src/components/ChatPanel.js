import { useState, useRef, useEffect } from 'react';
import { colors } from '../styles';

const chatPanelStyles = {
  container: {
    position: 'fixed',
    right: 0,
    top: 0,
    width: '380px',
    height: '100vh',
    backgroundColor: '#1a2634',
    borderLeft: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.3)'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a'
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  closeBtn: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  message: {
    maxWidth: '85%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    lineHeight: '1.5',
    wordBreak: 'break-word'
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    borderBottomRightRadius: '4px'
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    color: '#e2e8f0',
    borderBottomLeftRadius: '4px'
  },
  inputContainer: {
    padding: '16px',
    borderTop: '1px solid #334155',
    backgroundColor: '#0f172a'
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    maxHeight: '200px',
    padding: '12px',
    backgroundColor: '#1e293b',
    border: '1px solid #475569',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '13px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s'
  },
  textareaFocus: {
    borderColor: '#3b82f6'
  },
  sendBtn: {
    marginTop: '8px',
    width: '100%',
    padding: '10px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    opacity: 1
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  sendBtnHover: {
    backgroundColor: '#2563eb'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#94a3b8',
    fontSize: '12px',
    padding: '8px 0'
  },
  loadingDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'bounce 1.4s infinite ease-in-out'
  }
};

const ChatPanel = ({ isOpen, onClose, serverUrl }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState(null);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // 添加欢迎消息
      setMessages([{
        role: 'assistant',
        content: '你好！我是豆包AI助手，有什么可以帮你的吗？'
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: userMessage.content,
          previous_response_id: previousResponseId
        })
      });

      const result = await response.json();

      if (result.code === 0 && result.data) {
        const responseData = result.data;
        const assistantContent = extractAssistantContent(responseData);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantContent
        }]);

        // 保存 response_id 用于多轮对话
        if (responseData.id) {
          setPreviousResponseId(responseData.id);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '抱歉，我遇到了一些问题，请稍后再试。'
        }]);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '网络错误，请检查连接后重试。'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const extractAssistantContent = (responseData) => {
    if (!responseData.output || !Array.isArray(responseData.output)) {
      return responseData.error || '';
    }

    const message = responseData.output.find(item => item.type === 'message');
    if (!message || !Array.isArray(message.content)) {
      return '';
    }

    const textContent = message.content.find(item => item.type === 'output_text');
    return textContent ? textContent.text : '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={chatPanelStyles.container}>
      <div style={chatPanelStyles.header}>
        <h3 style={chatPanelStyles.title}>
          <span>💬</span>
          <span>豆包助手</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          style={chatPanelStyles.closeBtn}
          onMouseEnter={(e) => e.target.style.color = '#e2e8f0'}
          onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
        >
          ✕
        </button>
      </div>

      <div style={chatPanelStyles.messagesContainer}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...chatPanelStyles.message,
              ...(msg.role === 'user' ? chatPanelStyles.userMessage : chatPanelStyles.assistantMessage)
            }}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={chatPanelStyles.loading}>
            <span style={chatPanelStyles.loadingDot} />
            <span style={chatPanelStyles.loadingDot} style={{ animationDelay: '0.2s' }} />
            <span style={chatPanelStyles.loadingDot} style={{ animationDelay: '0.4s' }} />
            <span>思考中...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={chatPanelStyles.inputContainer}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsTextareaFocused(true)}
          onBlur={() => setIsTextareaFocused(false)}
          placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
          style={{
            ...chatPanelStyles.textarea,
            ...(isTextareaFocused ? chatPanelStyles.textareaFocus : {})
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!inputText.trim() || isLoading}
          style={{
            ...chatPanelStyles.sendBtn,
            ...(!inputText.trim() || isLoading ? chatPanelStyles.sendBtnDisabled : {})
          }}
          onMouseEnter={(e) => {
            if (inputText.trim() && !isLoading) {
              e.target.style.backgroundColor = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#3b82f6';
          }}
        >
          {isLoading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
