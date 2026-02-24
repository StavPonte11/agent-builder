/**
 * Code Preview Component
 * Displays generated LangGraph code with syntax highlighting
 */

import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import { Button, Card, message, Space, Typography } from 'antd';
import React from 'react';

const { Text } = Typography;

interface CodePreviewProps {
  code: string;
  language?: string;
}

const CodePreview: React.FC<CodePreviewProps> = ({
  code,
  language: _language = 'python',
}) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    message.success('Code copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'langgraph_agent.py';
    a.click();
    URL.revokeObjectURL(url);
    message.success('Code downloaded');
  };

  return (
    <Card
      size="small"
      extra={
        <Space>
          <Button
            size="small"
            icon={<CopyOutlined />}
            onClick={handleCopy}
          >
            Copy
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            Download
          </Button>
        </Space>
      }
    >
      <div
        style={{
          backgroundColor: '#1e1e1e',
          padding: '16px',
          borderRadius: '4px',
          overflowX: 'auto',
        }}
      >
        <pre
          style={{
            margin: 0,
            color: '#d4d4d4',
            fontSize: '13px',
            fontFamily: "'Fira Code', 'Consolas', monospace",
            lineHeight: '1.6',
          }}
        >
          <code>{code || '# No code generated yet'}</code>
        </pre>
      </div>

      <div style={{ marginTop: '8px' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          This is the generated LangGraph code. It's automatically created from your visual graph.
        </Text>
      </div>
    </Card>
  );
};

export default CodePreview;
