/**
 * Sandbox Chat
 * Interactive testing interface for agents
 */

import {
  DeleteOutlined,
  DollarOutlined,
  LinkOutlined,
  LoadingOutlined,
  RobotOutlined,
  SafetyOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UserOutlined
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Row,
  Space,
  Spin,
  Statistic,
  Tooltip,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import type { SandboxChatMessage } from '../types';
import apiClient from '../client';

const { Text } = Typography;
const { TextArea } = Input;

interface SandboxChatProps {
  buildId: string;
  userId: string;
  sessionId?: string;
}

const SandboxChat: React.FC<SandboxChatProps> = ({
  buildId,
  userId,
  sessionId = 'default',
}) => {
  const [messages, setMessages] = useState<SandboxChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTokens: 0,
    totalCost: 0,
    messageCount: 0,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: SandboxChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiClient.sandboxChat(
        buildId,
        input,
        userId,
        sessionId
      );

      const assistantMessage: SandboxChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        metadata: {
          tokens_used: response.tokens_used,
          cost: response.cost,
          langfuse_trace_url: response.langfuse_trace_url,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update stats
      setStats((prev) => ({
        totalTokens: prev.totalTokens + response.tokens_used,
        totalCost: prev.totalCost + response.cost,
        messageCount: prev.messageCount + 1,
      }));

      // Show warnings if any violations
      if (response.guardrail_violations.length > 0) {
        console.warn('Guardrail violations:', response.guardrail_violations);
      }
    } catch (error: any) {
      const errorMessage: SandboxChatMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.response?.data?.detail || error.message}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (message: SandboxChatMessage) => {
    const isUser = message.role === 'user';
    const isError = message.content.startsWith('Error:');

    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: '20px',
        }}
      >
        <Space align="start" dir={isUser ? 'horizontal-reverse' : 'horizontal'} size={12}>
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? '#1890ff' : '#722ed1',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          />

          <div style={{ maxWidth: '600px' }}>
            <div
              style={{
                backgroundColor: isUser ? '#1890ff' : isError ? '#fff1f0' : '#fff',
                color: isUser ? '#fff' : isError ? '#cf1322' : '#333',
                padding: '12px 16px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                boxShadow: isUser ? '0 2px 8px rgba(24, 144, 255, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                border: isUser ? 'none' : isError ? '1px solid #ffa39e' : '1px solid #f0f0f0',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            </div>

            <div style={{
              marginTop: '6px',
              fontSize: '11px',
              color: '#999',
              display: 'flex',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

              {message.metadata && (
                <>
                  <Divider type="vertical" style={{ margin: '0 4px' }} />
                  <Space size={6}>
                    <Tooltip title="Tokens used">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ThunderboltOutlined style={{ fontSize: 10 }} /> {message.metadata.tokens_used}
                      </span>
                    </Tooltip>

                    <Tooltip title="Cost">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <DollarOutlined style={{ fontSize: 10 }} /> ${message.metadata.cost?.toFixed(5)}
                      </span>
                    </Tooltip>

                    {message.metadata.langfuse_trace_url && (
                      <Tooltip title="View trace in Langfuse">
                        <a
                          href={message.metadata.langfuse_trace_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#999', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <LinkOutlined /> Trace
                        </a>
                      </Tooltip>
                    )}
                  </Space>
                </>
              )}
            </div>
          </div>
        </Space>
      </div>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Stats */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <Card size="small" style={{ flex: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.02)', border: 'none' }}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#888' }}>Messages</span>}
            value={stats.messageCount}
            prefix={<RobotOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{ fontSize: 18, fontWeight: 600 }}
          />
        </Card>
        <Card size="small" style={{ flex: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.02)', border: 'none' }}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#888' }}>Tokens</span>}
            value={stats.totalTokens}
            prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
            valueStyle={{ fontSize: 18, fontWeight: 600 }}
          />
        </Card>
        <Card size="small" style={{ flex: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.02)', border: 'none' }}>
          <Statistic
            title={<span style={{ fontSize: 12, color: '#888' }}>Cost</span>}
            value={stats.totalCost}
            prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
            precision={4}
            valueStyle={{ fontSize: 18, fontWeight: 600 }}
          />
        </Card>
        <Button
          onClick={() => {
            setMessages([]);
            setStats({ totalTokens: 0, totalCost: 0, messageCount: 0 });
          }}
          icon={<DeleteOutlined />}
          style={{ height: 'auto' }}
        >
          Clear
        </Button>
      </div>

      {/* Chat Area */}
      <Card
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          border: '1px solid #f0f0f0'
        }}
        bodyStyle={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: '#fafafa',
            backgroundImage: 'radial-gradient(#e1e1e1 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        >
          {messages.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ccc'
            }}>
              <RobotOutlined style={{ fontSize: 64, marginBottom: 16, color: '#e6e6e6' }} />
              <Typography.Title level={4} style={{ color: '#ccc', margin: 0 }}>Ready to test your agent</Typography.Title>
              <span style={{ fontSize: 13 }}>Send a message to start the conversation</span>
            </div>
          ) : (
            <>
              <Alert
                message="Sandbox Environment"
                description="All executions are tracked in Langfuse. Safeguards are active."
                type="info"
                showIcon
                closable
                style={{ marginBottom: '24px', border: 'none', background: 'rgba(24, 144, 255, 0.1)' }}
              />
              {messages.map(renderMessage)}
              {loading && (
                <div style={{ padding: '0 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#722ed1' }} />
                  <div style={{ backgroundColor: '#fff', padding: '12px 16px', borderRadius: '16px 16px 16px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: '#722ed1' }} spin />} />
                    <span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div style={{
          padding: '16px 24px',
          background: '#fff',
          borderTop: '1px solid #f0f0f0'
        }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message to your agent..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={loading}
                style={{
                  borderRadius: '12px',
                  padding: '10px 14px',
                  border: '1px solid #d9d9d9',
                  resize: 'none'
                }}
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                disabled={!input.trim()}
                style={{
                  height: '44px',
                  width: '44px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />
            </Col>
          </Row>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <SafetyOutlined /> Output is generated by AI and may be inaccurate.
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SandboxChat;
