/**
 * Node Configuration Panel
 * Type-specific configuration forms for Blueprint Nodes
 */

import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
  message,
  Divider,
  Tag
} from 'antd';
import React, { useEffect, useState } from 'react';
import type { BlueprintNode } from '../types';
import apiClient from '../client';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

interface NodeConfigPanelProps {
  node: BlueprintNode | null;
  visible: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updates: Record<string, any>) => void;
  onDelete?: (nodeId: string) => void;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  visible,
  onClose,
  onSave,
  onDelete,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const [mcpTools, setMcpTools] = useState<any[]>([]);

  useEffect(() => {
    if (node && visible) {
      // Flatten config for the form
      form.setFieldsValue({
        label: node.label,
        description: node.description,
        ...node.config,
      });

      // Fetch MCP tools if needed
      if (node.type === 'tool_executor' || node.type === 'llm') {
        const fetchTools = async () => {
          try {
            const tools = await apiClient.listMCPTools();
            setMcpTools(tools);
          } catch (e) {
            console.error('Failed to fetch MCP tools', e);
          }
        };
        fetchTools();
      }
    }
  }, [node, visible, form]);

  const handleSave = async () => {
    if (!node) return;

    try {
      setLoading(true);
      const values = await form.validateFields();

      // Separate base fields from config fields
      const { label, description, ...configValues } = values;

      const updates: Record<string, any> = {
        label,
        description,
        config: configValues,
      };

      await onSave(node.id, updates);
      message.success('Node configuration saved');
      onClose();
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (node && onDelete) {
      onDelete(node.id);
      onClose();
    }
  };

  const renderLLMConfig = () => (
    <>
      <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px', color: 'var(--text-primary)' }}>
          Model Configuration
        </Title>
        <Form.Item
          label="Provider"
          name="provider"
          rules={[{ required: true }]}
        >
          <Select placeholder="Select Provider">
            <Option value="openai">OpenAI</Option>
            <Option value="anthropic">Anthropic</Option>
            <Option value="google">Google</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Model"
          name="model"
          rules={[{ required: true }]}
        >
          <Input placeholder="gpt-4, claude-3-5-sonnet, etc." />
        </Form.Item>
      </div>

      <div style={{ background: 'var(--bg-overlay)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)', marginBottom: '20px' }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px', color: 'var(--brand-accent)' }}>
          Agentic Capabilities (n8n Style)
        </Title>
        <Form.Item
          label="Memory (Checkpointing)"
          name="memory_id"
          tooltip="Enable persistent memory for this agent"
        >
          <Select placeholder="Choose memory store..." allowClear>
            <Option value="session_memory">Short-term Session Memory</Option>
            <Option value="persistent_memory">Long-term User Memory</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Connected Tools"
          name="tools"
          tooltip="Tools that this LLM can invoke"
        >
          <Select mode="multiple" placeholder="Select tools for this node..." allowClear>
            <Option value="search">Web Search</Option>
            <Option value="calculator">Calculator</Option>
            <Option value="mcp_tools">MCP Tools (Dynamic)</Option>
          </Select>
        </Form.Item>
      </div>

      <Divider orientation="left">Parameters</Divider>
      <Form.Item
        label="Temperature"
        name="temperature"
        rules={[{ required: true }]}
      >
        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label="Max Tokens"
        name="max_tokens"
        rules={[{ required: true }]}
      >
        <InputNumber min={1} max={128000} style={{ width: '100%' }} />
      </Form.Item>

      <Space align="center" style={{ marginBottom: 16 }}>
        <Form.Item name="streaming" valuePropName="checked" noStyle>
          <Switch />
        </Form.Item>
        <span>Streaming Mode</span>
      </Space>

      <Divider orientation="left">Prompts</Divider>
      <Form.Item
        label="System Prompt"
        name="system_prompt"
        tooltip="Core personality and instructions"
      >
        <TextArea rows={4} placeholder="You are a helpful assistant..." style={{ borderRadius: '6px' }} />
      </Form.Item>

      <Form.Item
        label="User Prompt Template"
        name="user_prompt_template"
        tooltip="Use {variable} for dynamic values"
      >
        <TextArea
          rows={4}
          placeholder="Answer this: {user_query}"
          style={{ borderRadius: '6px' }}
        />
      </Form.Item>
    </>
  );

  const renderToolExecutorConfig = () => (
    <>
      <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px' }}>
          MCP Tool Configuration
        </Title>
        <Form.Item
          label="Tool Source"
          name="mcp_server"
          rules={[{ required: true, message: 'Select an MCP server' }]}
        >
          <Select placeholder="Select MCP Server" className="modern-select">
            <Option value="google-drive">Google Drive MCP</Option>
            <Option value="slack">Slack MCP</Option>
            <Option value="brave-search">Brave Search</Option>
            <Option value="local-tools">Local File System</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Function"
          name="tool_name"
          dependencies={['mcp_server']}
          rules={[{ required: true, message: 'Select a specific tool' }]}
        >
          <Select placeholder="Choose a tool from server..." className="modern-select">
            {mcpTools
              .filter(t => !form.getFieldValue('mcp_server') || t.server === form.getFieldValue('mcp_server'))
              .map(t => (
                <Option key={t.id || t.name} value={t.name}>{t.name}</Option>
              ))}
            {/* Fallback mock tools if list is empty */}
            {mcpTools.length === 0 && (
              <>
                <Option value="get_files">get_files</Option>
                <Option value="search">web_search</Option>
              </>
            )}
          </Select>
        </Form.Item>
      </div>

      <Form.Item
        label="Timeout (seconds)"
        name="timeout"
      >
        <InputNumber min={1} max={600} defaultValue={30} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );

  const renderMemoryConfig = () => (
    <>
      <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <Title level={5} style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px' }}>
          Memory Engine
        </Title>
        <Form.Item
          label="Memory Type"
          name="memory_type"
          rules={[{ required: true }]}
        >
          <Select className="modern-select">
            <Option value="short_term">Short Term (Context Window)</Option>
            <Option value="long_term">Long Term (Vector Store)</Option>
            <Option value="persistent">Persistent (Entity Store)</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Storage Provider"
          name="storage_backend"
          rules={[{ required: true }]}
        >
          <Select className="modern-select">
            <Option value="redis">Redis (Fast/Ephemeral)</Option>
            <Option value="postgres">PostgreSQL (Relational)</Option>
            <Option value="chroma">ChromaDB (Vector)</Option>
          </Select>
        </Form.Item>
      </div>

      <Form.Item
        label="Context Window Size"
        name="window_size"
      >
        <InputNumber min={1} max={100} defaultValue={10} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );

  const renderRouterConfig = () => (
    <>
      <Form.Item
        label="Routing Strategy"
        name="routing_strategy"
        rules={[{ required: true }]}
      >
        <Select>
          <Option value="llm">LLM Based (Decision)</Option>
          <Option value="rule_based">Rule Based (Condition)</Option>
        </Select>
      </Form.Item>

      {/* Dynamic routes configuration could go here */}
    </>
  );

  const renderHumanApprovalConfig = () => (
    <>
      <Form.Item
        label="Timeout (seconds)"
        name="timeout_seconds"
      >
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label="Required Role"
        name="required_role"
      >
        <Input placeholder="admin, supervisor" />
      </Form.Item>
    </>
  );

  const renderConfigForm = () => {
    if (!node) return null;

    const items = [
      {
        key: 'basic',
        label: 'General',
        children: (
          <>
            <Form.Item
              label="Node ID"
            >
              <Input value={node.id} disabled />
            </Form.Item>
            <Form.Item
              label="Label"
              name="label"
              rules={[{ required: true, message: 'Label is required' }]}
            >
              <Input placeholder="Enter node label" />
            </Form.Item>

            <Form.Item
              label="Description"
              name="description"
            >
              <TextArea rows={2} placeholder="Optional description" />
            </Form.Item>
          </>
        ),
      },
      {
        key: 'config',
        label: 'Configuration',
        children: (
          <>
            {node.type === 'llm' && renderLLMConfig()}
            {node.type === 'tool_executor' && renderToolExecutorConfig()}
            {node.type === 'memory' && renderMemoryConfig()}
            {node.type === 'router' && renderRouterConfig()}
            {node.type === 'human_approval' && renderHumanApprovalConfig()}
            {(node.type === 'start' || node.type === 'end') && <Text type="secondary">No configuration needed.</Text>}
          </>
        )
      }
    ];

    return <Tabs items={items} defaultActiveKey="config" />;
  };

  return (
    <Drawer
      title={
        <Space>
          <span>Configure Node</span>
          {node && (
            <Tag color="blue">{node.type}</Tag>
          )}
        </Space>
      }
      placement="right"
      width={600}
      open={visible}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          {onDelete && (
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={loading}
          >
            Save
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          temperature: 0.7,
          max_tokens: 1000,
          streaming: false,
        }}
      >
        {renderConfigForm()}
      </Form>
    </Drawer>
  );
};

export default NodeConfigPanel;
