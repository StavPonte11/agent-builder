import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SendOutlined, PaperClipOutlined, ThunderboltOutlined } from '@ant-design/icons';
import './ChatPage.css';

// Mock workflow visualization placeholder
const WorkflowVisualization: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="workflow-visualization">
      <div className="workflow-header">
        <ThunderboltOutlined className="workflow-icon" />
        <span>{t('chat.workflow.title')}</span>
      </div>
      <div className="workflow-content">
        {/* Your actual workflow visualization component goes here */}
        <div className="workflow-placeholder">
          <div className="workflow-node">Agent Node 1</div>
          <div className="workflow-connector">→</div>
          <div className="workflow-node">Agent Node 2</div>
          <div className="workflow-connector">→</div>
          <div className="workflow-node">Output</div>
        </div>
      </div>
    </div>
  );
};

// Data display component for tables, JSON, charts, etc.
interface DataDisplayProps {
  type: 'table' | 'json' | 'chart' | 'map';
  data: any;
}

const DataDisplay: React.FC<DataDisplayProps> = ({ type, data }) => {
  return (
    <div className="data-display">
      <div className="data-display-header">
        <span className="data-type-badge">{type.toUpperCase()}</span>
      </div>
      <div className="data-display-content">
        {type === 'json' && (
          <pre className="json-viewer">{JSON.stringify(data, null, 2)}</pre>
        )}
        {type === 'table' && (
          <div className="table-viewer">
            {/* Your table component */}
            <div className="table-placeholder">Table data will render here</div>
          </div>
        )}
        {type === 'chart' && (
          <div className="chart-viewer">
            {/* Your chart component */}
            <div className="chart-placeholder">Chart will render here</div>
          </div>
        )}
        {type === 'map' && (
          <div className="map-viewer">
            {/* Your map component */}
            <div className="map-placeholder">Map will render here</div>
          </div>
        )}
      </div>
    </div>
  );
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  dataDisplay?: DataDisplayProps;
}

export const ChatPage: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const availableTools = [
    { id: 'search', name: 'Web Search', icon: '🔍' },
    { id: 'calculator', name: 'Calculator', icon: '🔢' },
    { id: 'code', name: 'Code Executor', icon: '💻' },
    { id: 'image', name: 'Image Gen', icon: '🎨' },
    { id: 'data', name: 'Data Analysis', icon: '📊' },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput('');
    setSelectedTools([]);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'This is a simulated AI response. Your actual agent logic will go here.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId]
    );
  };

  const handleHashtagInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Detect hashtags
    const words = value.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('#')) {
      const toolName = lastWord.substring(1).toLowerCase();
      // TODO: show tool autocomplete suggestions based on toolName
      void toolName;
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-main">
          {/* Greeting Section */}
          {messages.length === 0 && (
            <div className="greeting-section">
              <div className="greeting-content">
                <h1 className="greeting-title">
                  {t('chat.greeting.title', 'Welcome to Your AI Agent')}
                </h1>
                <p className="greeting-subtitle">
                  {t('chat.greeting.subtitle', 'How can I assist you today?')}
                </p>
                <div className="greeting-features">
                  <div className="feature-card">
                    <span className="feature-icon">🚀</span>
                    <span className="feature-text">{t('chat.features.powerful', 'Powerful Agents')}</span>
                  </div>
                  <div className="feature-card">
                    <span className="feature-icon">🔧</span>
                    <span className="feature-text">{t('chat.features.tools', 'Multiple Tools')}</span>
                  </div>
                  <div className="feature-card">
                    <span className="feature-icon">⚡</span>
                    <span className="feature-text">{t('chat.features.fast', 'Lightning Fast')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages Section */}
          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`message-wrapper ${message.role}`}>
                <div className="message-avatar">
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-bubble">
                    {message.content}
                  </div>
                  {message.dataDisplay && (
                    <DataDisplay {...message.dataDisplay} />
                  )}
                  <div className="message-timestamp">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Tool Selection Pills */}
          {selectedTools.length > 0 && (
            <div className="selected-tools">
              {selectedTools.map((toolId) => {
                const tool = availableTools.find((t) => t.id === toolId);
                return tool ? (
                  <div key={toolId} className="tool-pill">
                    <span className="tool-icon">{tool.icon}</span>
                    <span className="tool-name">{tool.name}</span>
                    <button
                      className="tool-remove"
                      onClick={() => toggleTool(toolId)}
                    >
                      ×
                    </button>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Input Section */}
          <div className="input-section">
            <div className="input-wrapper">
              <button className="input-action-btn attach-btn">
                <PaperClipOutlined />
              </button>

              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder={t('chat.input.placeholder', 'Type your message... Use # to select tools')}
                value={input}
                onChange={handleHashtagInput}
                onKeyPress={handleKeyPress}
                rows={1}
              />

              <div className="input-actions">
                <div className="tools-dropdown">
                  <button className="tools-trigger">
                    <ThunderboltOutlined />
                  </button>
                  <div className="tools-menu">
                    {availableTools.map((tool) => (
                      <button
                        key={tool.id}
                        className={`tool-item ${selectedTools.includes(tool.id) ? 'selected' : ''}`}
                        onClick={() => toggleTool(tool.id)}
                      >
                        <span className="tool-icon">{tool.icon}</span>
                        <span className="tool-name">{tool.name}</span>
                        {selectedTools.includes(tool.id) && (
                          <span className="tool-check">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={!input.trim()}
                >
                  <SendOutlined />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Visualization Panel */}
        <div className="workflow-panel">
          <WorkflowVisualization />
        </div>
      </div>
    </div>
  );
};