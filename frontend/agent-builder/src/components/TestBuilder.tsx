/**
 * Test Builder
 * Create and run test suites with LLM-as-a-Judge evaluation
 */

import {
  CheckCircleOutlined,
  DeleteOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography
} from 'antd';
import React, { useState } from 'react';
import apiClient from '../client';
import type { Evaluation, TestCase, TestSuite } from '../types';

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

interface TestBuilderProps {
  buildId: string;
  userId: string;
  onEvaluationComplete?: (evaluation: Evaluation) => void;
}

const TestBuilder: React.FC<TestBuilderProps> = ({
  buildId,
  userId,
  onEvaluationComplete,
}) => {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testSuiteId, setTestSuiteId] = useState<string>();
  const [modalVisible, setModalVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);

  const [form] = Form.useForm();

  const handleAddTestCase = async () => {
    try {
      const values = await form.validateFields();

      const newTestCase: TestCase = {
        id: `test_${Date.now()}`,
        name: values.name,
        description: values.description,
        input_data: JSON.parse(values.input_data),
        expected_output: values.expected_output
          ? JSON.parse(values.expected_output)
          : undefined,
        success_criteria: JSON.parse(values.success_criteria || '{}'),
        tags: values.tags || [],
      };

      setTestCases((prev) => [...prev, newTestCase]);
      setModalVisible(false);
      form.resetFields();
      message.success('Test case added');
    } catch (error) {
      message.error('Invalid JSON in input');
    }
  };

  const handleCreateTestSuite = async () => {
    if (testCases.length === 0) {
      message.warning('Add at least one test case');
      return;
    }

    try {
      const testSuite: TestSuite = {
        id: `suite_${Date.now()}`,
        build_id: buildId,
        name: 'Integration Test Suite',
        test_type: 'integration',
        test_cases: testCases,
        created_at: new Date().toISOString(),
      };

      const response = await apiClient.createTestSuite(buildId, testSuite);
      setTestSuiteId(response.test_suite_id);
      message.success('Test suite created');
    } catch (error) {
      message.error('Failed to create test suite');
    }
  };

  const handleRunTests = async () => {
    if (!testSuiteId) {
      await handleCreateTestSuite();
      return;
    }

    setRunning(true);
    try {
      const response = await apiClient.runTests(buildId, testSuiteId, userId);

      setEvaluation(response);
      message.success(
        response.passed
          ? 'All tests passed!'
          : 'Some tests failed. Review results.'
      );

      if (onEvaluationComplete) {
        // In production, fetch full evaluation from API
        onEvaluationComplete(response as any);
      }
    } catch (error: any) {
      message.error('Test execution failed');
      console.error(error);
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Typography.Text type="secondary" style={{ fontSize: 13 }}>{text}</Typography.Text>
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        tags.map((tag) => <Tag color="blue" key={tag} style={{ borderRadius: 10 }}>{tag}</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: TestCase) => (
        <Button
          danger
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() =>
            setTestCases((prev) => prev.filter((tc) => tc.id !== record.id))
          }
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Test Suite Builder</Title>
          <Typography.Text type="secondary">Define test cases evaluated by LLM-as-a-Judge</Typography.Text>
        </div>
        <Space>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
            size="large"
          >
            Add Test Case
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRunTests}
            loading={running}
            disabled={testCases.length === 0}
            size="large"
            style={{ background: '#52c41a', borderColor: '#52c41a', boxShadow: '0 4px 10px rgba(82, 196, 26, 0.3)' }}
          >
            Run All Tests
          </Button>
        </Space>
      </div>

      <Row gutter={24}>
        <Col span={16}>
          <Card
            title={<span><CheckCircleOutlined /> Test Cases ({testCases.length})</span>}
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)', borderRadius: 12 }}
            bodyStyle={{ padding: 0 }}
          >
            <Table
              columns={columns}
              dataSource={testCases}
              rowKey="id"
              pagination={false}
              locale={{
                emptyText: <Empty description="No test cases yet. Add one to get started!" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              }}
            />
          </Card>
        </Col>
        <Col span={8}>
          {evaluation ? (
            <Card
              title="Evaluation Results"
              style={{
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                borderRadius: 12,
                border: `1px solid ${evaluation.passed ? '#b7eb8f' : '#ffccc7'}`,
                overflow: 'hidden'
              }}
              headStyle={{ backgroundColor: evaluation.passed ? '#f6ffed' : '#fff1f0', color: evaluation.passed ? '#389e0d' : '#cf1322' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  {evaluation.passed ? (
                    <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 8 }} />
                  ) : (
                    <CheckCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 8 }} />
                  )}
                  <Title level={3} style={{ margin: 0, color: evaluation.passed ? '#52c41a' : '#ff4d4f' }}>
                    {evaluation.passed ? 'Passed' : 'Failed'}
                  </Title>
                  <Tag color={evaluation.passed ? 'success' : 'error'} style={{ marginTop: 8 }}>
                    {evaluation.metrics?.success_rate ? (evaluation.metrics.success_rate * 100).toFixed(0) : 0}% Success Rate
                  </Tag>
                </div>

                <Divider style={{ margin: 0 }} />

                <Row gutter={16} justify="center">
                  <Col span={12} style={{ textAlign: 'center' }}>
                    <Statistic
                      title="Avg Latency"
                      value={evaluation.metrics?.avg_latency || 0}
                      suffix="s"
                      precision={2}
                    />
                  </Col>
                  <Col span={12} style={{ textAlign: 'center' }}>
                    <Statistic
                      title="Total Cost"
                      value={evaluation.metrics?.total_cost || 0}
                      prefix="$"
                      precision={4}
                    />
                  </Col>
                </Row>

                {evaluation.langfuse_experiment_id && (
                  <Button
                    type="dashed"
                    block
                    icon={<LinkOutlined />}
                    href={`https://cloud.langfuse.com/experiment/${evaluation.langfuse_experiment_id}`}
                    target="_blank"
                  >
                    View in Langfuse
                  </Button>
                )}
              </Space>
            </Card>
          ) : (
            <Card style={{ borderRadius: 12, border: '1px dashed #d9d9d9', background: '#fafafa', textAlign: 'center', padding: '40px 0' }}>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Run tests to see evaluation metrics here.
              </Typography.Text>
              <Statistic value={0} prefix="$" title="Estimated Cost" />
            </Card>
          )}
        </Col>
      </Row>

      {/* Add Test Case Modal */}
      <Modal
        title="Add Test Case"
        open={modalVisible}
        onOk={handleAddTestCase}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Test Name"
            name="name"
            rules={[{ required: true }]}
          >
            <Input placeholder="e.g., Test greeting response" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea rows={2} placeholder="Optional description" />
          </Form.Item>

          <Form.Item
            label="Input Data (JSON)"
            name="input_data"
            rules={[{ required: true }]}
            help="The input payload to send to the agent"
          >
            <TextArea
              rows={4}
              style={{ fontFamily: 'monospace' }}
              placeholder='{"user_query": "What are your hours?"}'
            />
          </Form.Item>

          <Form.Item label="Expected Output (JSON)" name="expected_output" help="Optional exact match">
            <TextArea
              rows={3}
              style={{ fontFamily: 'monospace' }}
              placeholder='{"response": "9 AM - 5 PM EST"}'
            />
          </Form.Item>

          <Form.Item
            label="Success Criteria (JSON)"
            name="success_criteria"
            tooltip="Define how to check if test passed (LLM evaluation prompts)"
          >
            <TextArea
              rows={3}
              style={{ fontFamily: 'monospace' }}
              placeholder='{"contains": "business hours", "min_length": 10}'
            />
          </Form.Item>

          <Form.Item label="Tags" name="tags">
            <Select mode="tags" placeholder="Add tags">
              <Option value="smoke">smoke</Option>
              <Option value="regression">regression</Option>
              <Option value="performance">performance</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TestBuilder;
