/**
 * Validation Panel
 * Displays validation results, errors, warnings, and cost estimates
 */

import React from 'react';
import { Card, Alert, List, Space, Tag, Statistic, Row, Col, Typography } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ValidationResult, ValidationIssue } from '../types';

const { Text } = Typography;

interface ValidationPanelProps {
  validation: ValidationResult;
  compact?: boolean;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({
  validation,
  compact = false,
}) => {
  const getStatusIcon = () => {
    if (validation.status === 'valid') {
      return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '20px' }} />;
    } else if (validation.status === 'warnings') {
      return <WarningOutlined style={{ color: '#faad14', fontSize: '20px' }} />;
    } else {
      return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '20px' }} />;
    }
  };

  const getStatusColor = () => {
    if (validation.status === 'valid') return '#52c41a';
    if (validation.status === 'warnings') return '#faad14';
    return '#ff4d4f';
  };

  const getIssueIcon = (severity: string) => {
    if (severity === 'error') {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    } else if (severity === 'warning') {
      return <WarningOutlined style={{ color: '#faad14' }} />;
    } else {
      return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const errors = validation.issues.filter((i) => i.severity === 'error');
  const warnings = validation.issues.filter((i) => i.severity === 'warning');

  if (compact) {
    return (
      <Card
        size="small"
        style={{ borderColor: getStatusColor() }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            {getStatusIcon()}
            <Text strong>
              {validation.status === 'valid'
                ? 'All checks passed'
                : validation.status === 'warnings'
                  ? `${warnings.length} warning(s)`
                  : `${errors.length} error(s)`}
            </Text>
          </Space>

          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Cost"
                value={validation.estimated_cost}
                prefix={<DollarOutlined />}
                precision={3}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Duration"
                value={validation.estimated_duration}
                suffix="s"
                prefix={<ClockCircleOutlined />}
                precision={1}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Tokens"
                value={validation.estimated_tokens}
                prefix={<ThunderboltOutlined />}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
          </Row>
        </Space>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          {getStatusIcon()}
          <span>Validation Results</span>
        </Space>
      }
    >
      {validation.status === 'valid' ? (
        <Alert
          message="All validation checks passed!"
          type="success"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      ) : (
        <>
          {errors.length > 0 && (
            <Alert
              message={`${errors.length} Error(s) - Fix required before execution`}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
          {warnings.length > 0 && (
            <Alert
              message={`${warnings.length} Warning(s) - Review recommended`}
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
          )}
        </>
      )}

      {/* Estimates */}
      <Card size="small" title="Estimated Metrics" style={{ marginBottom: '16px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="Cost"
              value={validation.estimated_cost}
              prefix={<DollarOutlined />}
              precision={4}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Duration"
              value={validation.estimated_duration}
              suffix="seconds"
              prefix={<ClockCircleOutlined />}
              precision={1}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Tokens"
              value={validation.estimated_tokens}
              prefix={<ThunderboltOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* Issues List */}
      {validation.issues.length > 0 && (
        <List
          size="small"
          header={<Text strong>Issues ({validation.issues.length})</Text>}
          dataSource={validation.issues}
          renderItem={(issue: ValidationIssue) => (
            <List.Item>
              <List.Item.Meta
                avatar={getIssueIcon(issue.severity)}
                title={
                  <Space>
                    <Text>{issue.message}</Text>
                    {issue.node_id && (
                      <Tag style={{ fontSize: '10px' }}>{issue.node_id}</Tag>
                    )}
                  </Space>
                }
                description={
                  issue.suggestion && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      💡 {issue.suggestion}
                    </Text>
                  )
                }
              />
              {issue.auto_fix_available && (
                <Tag color="blue" style={{ fontSize: '11px' }}>
                  Auto-fix available
                </Tag>
              )}
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

export default ValidationPanel;
