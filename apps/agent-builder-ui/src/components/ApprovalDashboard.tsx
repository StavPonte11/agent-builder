/**
 * Approval Dashboard
 * Admin interface for reviewing and approving build publications
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import apiClient from '../client';
import type { ApprovalRequest } from '../types';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface ApprovalDashboardProps {
  adminId: string;
}

const ApprovalDashboard: React.FC<ApprovalDashboardProps> = ({ adminId }) => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);

  const [form] = Form.useForm();

  // In production, fetch from API
  useEffect(() => {
    loadApprovals();
  }, []);

  const loadApprovals = async () => {
    setLoading(true);
    try {
      // TODO: Implement API endpoint to get pending approvals
      // const response = await apiClient.getPendingApprovals();
      // setApprovals(response.approvals);

      // Mock data for demo
      setApprovals([]);
    } catch (error) {
      message.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    setLoading(true);
    try {
      await apiClient.approvePublish(approvalId, adminId);
      message.success('Build approved and published');
      loadApprovals();
      setDetailsVisible(false);
    } catch (error) {
      message.error('Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApproval) return;

    try {
      const values = await form.validateFields();
      await apiClient.rejectPublish(
        selectedApproval.id,
        adminId,
        values.reason
      );
      message.success('Build rejected');
      loadApprovals();
      setRejectModalVisible(false);
      setDetailsVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('Failed to reject');
    }
  };

  const renderSanityChecks = (checks: Record<string, any>) => {
    const items = Object.entries(checks).map(([key, value]) => {
      if (key === 'all_passed') return null;

      const passed =
        typeof value === 'boolean'
          ? value
          : value.passed !== undefined
            ? value.passed
            : true;

      return (
        <Descriptions.Item
          key={key}
          label={
            <Space>
              {passed ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              )}
              <span>{key.replace(/_/g, ' ').toUpperCase()}</span>
            </Space>
          }
        >
          {typeof value === 'object' ? (
            <pre style={{ fontSize: '11px', margin: 0 }}>
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <Tag color={passed ? 'success' : 'error'}>
              {passed ? 'Passed' : 'Failed'}
            </Tag>
          )}
        </Descriptions.Item>
      );
    });

    return <Descriptions column={1} bordered>{items}</Descriptions>;
  };

  const columns = [
    {
      title: 'Build Name',
      dataIndex: ['build', 'name'],
      key: 'name',
      render: (_: any, record: ApprovalRequest) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.build_id}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Requested by: {record.requested_by}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Requested',
      dataIndex: 'requested_at',
      key: 'requested_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Tests',
      dataIndex: 'passed_tests',
      key: 'tests',
      render: (passed: boolean) => (
        <Tag color={passed ? 'success' : 'error'}>
          {passed ? 'Passed' : 'Failed'}
        </Tag>
      ),
    },
    {
      title: 'Sanity Checks',
      key: 'sanity',
      render: (_: any, record: ApprovalRequest) => {
        const allPassed = record.sanity_check_results?.every(c => c.passed);
        return (
          <Tag color={allPassed ? 'success' : 'warning'}>
            {allPassed ? 'All Passed' : 'Review Needed'}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ApprovalRequest) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedApproval(record);
              setDetailsVisible(true);
            }}
          >
            Review
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <SafetyOutlined style={{ color: '#1890ff' }} />
          <span>Approval Dashboard</span>
          <Badge count={approvals.length} style={{ backgroundColor: '#1890ff' }} />
        </Space>
      }
      extra={
        <Button onClick={loadApprovals} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Alert
        message="Admin Approval Required"
        description="Review build configurations, test results, and sanity checks before approving for publication."
        type="info"
        showIcon
        closable
        style={{ marginBottom: '16px' }}
      />

      <Table
        columns={columns}
        dataSource={approvals}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: 'No pending approvals' }}
      />

      {/* Details Modal */}
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            <span>Review Approval Request</span>
          </Space>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={900}
        footer={
          selectedApproval && (
            <Space>
              <Button onClick={() => setDetailsVisible(false)}>Cancel</Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  setRejectModalVisible(true);
                }}
              >
                Reject
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(selectedApproval.id)}
                loading={loading}
                disabled={!selectedApproval.passed_tests}
              >
                Approve & Publish
              </Button>
            </Space>
          )
        }
      >
        {selectedApproval && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Basic Info */}
            <Card size="small" title="Request Information">
              <Descriptions column={2} bordered>
                <Descriptions.Item label="Build ID">
                  {selectedApproval.build_id}
                </Descriptions.Item>
                <Descriptions.Item label="Evaluation ID">
                  {selectedApproval.evaluation_id}
                </Descriptions.Item>
                <Descriptions.Item label="Requested By">
                  {selectedApproval.requested_by}
                </Descriptions.Item>
                <Descriptions.Item label="Requested At">
                  {new Date(selectedApproval.requested_at).toLocaleString()}
                </Descriptions.Item>
              </Descriptions>

              {selectedApproval.notes && (
                <>
                  <Divider />
                  <Text strong>Notes from Developer:</Text>
                  <Paragraph>{selectedApproval.notes}</Paragraph>
                </>
              )}
            </Card>

            {/* Test Results */}
            <Card
              size="small"
              title="Test Results"
              extra={
                <Tag color={selectedApproval.passed_tests ? 'success' : 'error'}>
                  {selectedApproval.passed_tests ? 'Passed' : 'Failed'}
                </Tag>
              }
            >
              {selectedApproval.passed_tests ? (
                <Alert
                  message="All tests passed successfully"
                  type="success"
                  showIcon
                />
              ) : (
                <Alert
                  message="Some tests failed - Review required"
                  type="error"
                  showIcon
                />
              )}
            </Card>

            {/* Sanity Checks */}
            <Card
              size="small"
              title="Automated Sanity Checks"
              extra={
                <Tag
                  color={
                    selectedApproval.sanity_check_results?.every(c => c.passed)
                      ? 'success'
                      : 'warning'
                  }
                >
                  {selectedApproval.sanity_check_results?.every(c => c.passed)
                    ? 'All Passed'
                    : 'Review Needed'}
                </Tag>
              }
            >
              {selectedApproval.sanity_check_results &&
                renderSanityChecks(selectedApproval.sanity_check_results)}
            </Card>
          </Space>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Reject Build Publication"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalVisible(false);
          form.resetFields();
        }}
      >
        <Alert
          message="Provide a reason for rejection"
          description="This will be shared with the build owner"
          type="warning"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        <Form form={form} layout="vertical">
          <Form.Item
            label="Rejection Reason"
            name="reason"
            rules={[{ required: true, message: 'Reason is required' }]}
          >
            <TextArea
              rows={4}
              placeholder="Explain why this build cannot be published..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ApprovalDashboard;
