import React, { useState } from 'react';
import { Card, Form, Input, Button, Table, Space, Tag, Modal, Divider, List, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { MessageSquare, LayoutTemplate, ShieldAlert } from 'lucide-react';

const { TextArea } = Input;
const { Option } = Select;

// Mock interfaces for Hebrew support
interface TemplateSchema {
    id: str;
    name: str;
    description_he: str;
    version: str;
    fields: any[];
}

export const TemplateRegistration: React.FC = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();

    // Mock data
    const templates = [
        {
            key: '1',
            id: 'tpl-hq-992',
            name: 'דיווח תקרית מבצעית (Operational Incident)',
            version: '1.2.0',
            fieldsCount: 8,
            status: 'active'
        },
        {
            key: '2',
            id: 'tpl-log-01',
            name: 'בקשת ציוד לוגיסטי (Logistics Request)',
            version: '2.0.1',
            fieldsCount: 4,
            status: 'review'
        }
    ];

    const columns = [
        {
            title: 'שם התבנית (Template Name)',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <strong>{text}</strong>,
        },
        {
            title: 'גרסה (Version)',
            dataIndex: 'version',
            key: 'version',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'מספר שדות (Fields)',
            dataIndex: 'fieldsCount',
            key: 'fieldsCount',
        },
        {
            title: 'סטטוס (Status)',
            key: 'status',
            dataIndex: 'status',
            render: (status: string) => {
                let color = status === 'active' ? 'green' : 'orange';
                return <Tag color={color}>{status.toUpperCase()}</Tag>;
            },
        },
        {
            title: 'פעולות (Actions)',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button icon={<EditOutlined />} size="small" />
                    <Button icon={<PlayCircleOutlined />} size="small" />
                    <Button icon={<DeleteOutlined />} danger size="small" />
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: 24, direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2><LayoutTemplate size={24} style={{ marginLeft: 8, verticalAlign: 'middle' }} /> ניהול תבניות (Template Registry)</h2>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                >
                    צור תבנית חדשה
                </Button>
            </div>

            <Card>
                <Table columns={columns} dataSource={templates} />
            </Card>

            <Modal
                title="יצירת תבנית חדשה (Create New Template)"
                visible={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                width={800}
                footer={[
                    <Button key="back" onClick={() => setIsModalVisible(false)}>
                        ביטול
                    </Button>,
                    <Button key="submit" type="primary" icon={<SaveOutlined />}>
                        שמור תבנית
                    </Button>,
                ]}
            >
                <Form form={form} layout="vertical" dir="rtl">
                    <Form.Item label="שם התבנית (Template Name)" name="name" rules={[{ required: true }]}>
                        <Input placeholder="לדוגמה: דיווח תאונת דרכים" />
                    </Form.Item>

                    <Form.Item label="תיאור (Description)" name="description">
                        <TextArea rows={2} placeholder="תאר את מטרת התבנית..." />
                    </Form.Item>

                    <Divider orientation="right">הגדרת שדות JSON Schema</Divider>

                    {/* Simple mock for JSON Schema Builder */}
                    <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, fontFamily: 'monospace' }}>
                        {`{
  "type": "object",
  "properties": {
    "location": { "type": "string", "description": "מיקום האירוע" },
    "severity": { "type": "string", "enum": ["low", "medium", "high"] }
  }
}`}
                    </div>

                    <Divider orientation="right">דוגמאות הודעה לחילוץ (Few-Shot Examples)</Divider>
                    <Form.Item>
                        <TextArea rows={3} placeholder="הכנס הודעה לדוגמה בטקסט חופשי..." />
                        <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }}>
                            הוסף דוגמה נוספת
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default TemplateRegistration;
