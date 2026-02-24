import React, { useState } from 'react';
import { Card, Input, Button, Spin, Tag, Typography, Alert, Steps, Space, Divider } from 'antd';
import { SendOutlined, CheckCircleOutlined, SyncOutlined, ExperimentOutlined, UserOutlined } from '@ant-design/icons';
import { MessageSquareText, ShieldCheck, HelpCircle } from 'lucide-react';

const { TextArea } = Input;
const { Text, Title } = Typography;

export const MessageProcessingUI: React.FC = () => {
    const [message, setMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState(0);
    const [needsClarification, setNeedsClarification] = useState(false);

    const handleSend = () => {
        setIsProcessing(true);
        setStep(1);

        // Simulate real-time LangGraph steps
        setTimeout(() => setStep(2), 1000); // Routing
        setTimeout(() => setStep(3), 2000); // Extraction
        setTimeout(() => {
            setStep(4); // Validation
            setNeedsClarification(true);
            setIsProcessing(false);
        }, 3500);
    };

    return (
        <div style={{ padding: 24, direction: 'rtl', maxWidth: 1000, margin: '0 auto' }}>
            <Title level={2}><MessageSquareText size={28} style={{ marginLeft: 8, verticalAlign: 'middle' }} /> חילוץ נתונים אגנטי (Agentic Extraction)</Title>

            <div style={{ display: 'flex', gap: 24 }}>
                {/* Left Side: Input & Steps */}
                <div style={{ flex: 1 }}>
                    <Card title="הודעה נכנסת (Input Message)">
                        <TextArea
                            rows={5}
                            placeholder="הכנס טקסט חופשי כאן למשוך ממנו מידע מובנה..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            style={{ marginTop: 16 }}
                            onClick={handleSend}
                            loading={isProcessing}
                            block
                        >
                            התחל יצירת תבנית (Run Extraction)
                        </Button>
                    </Card>

                    <Card title="מחזור חיים - LangGraph Trace" style={{ marginTop: 24 }}>
                        <Steps
                            direction="vertical"
                            current={step}
                            items={[
                                { title: 'קבלת הודעה', description: 'Loading Session Context', icon: <UserOutlined /> },
                                { title: 'ניתוב לתבנית טקסט', description: 'Vector Search against PGVector', icon: <SyncOutlined spin={step === 1} /> },
                                { title: 'חילוץ מידע', description: 'Llama-3 Structured Output JSON', icon: <ExperimentOutlined spin={step === 2} /> },
                                { title: 'ולידציה ובדיקה', description: 'Confidence scoring & Rule validation', icon: <ShieldCheck size={18} /> },
                                { title: 'אישור הומני (HITL)', description: 'Waiting for clarification', status: needsClarification ? 'error' : 'wait', icon: <HelpCircle size={18} /> },
                            ]}
                        />
                    </Card>
                </div>

                {/* Right Side: Output & Hitl */}
                <div style={{ flex: 1 }}>
                    <Card title="תוצאה מובנית (Structured Output)" style={{ minHeight: 400, background: '#fafafa' }}>
                        {!isProcessing && step === 0 && (
                            <div style={{ textAlign: 'center', color: '#888', marginTop: 100 }}>
                                ממתין לקלט משתמש...
                            </div>
                        )}

                        {isProcessing && (
                            <div style={{ textAlign: 'center', marginTop: 100 }}>
                                <Spin size="large" />
                                <div style={{ marginTop: 16 }}>הסוכן מעבד את הטקסט...</div>
                            </div>
                        )}

                        {needsClarification && (
                            <div>
                                <Alert
                                    message="נדרשת הבהרה מהמשתמש (Human in the loop)"
                                    description="האלגוריתם לא הצליח לחלץ מיקומים ברמת ודאות גבוהה. אנא השלם את החסר."
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 16 }}
                                />

                                <div style={{ background: '#fff', padding: 16, border: '1px solid #d9d9d9', borderRadius: 8 }}>
                                    <Text strong>שדה חסר:</Text> <Tag color="red">location.coordinates</Tag>
                                    <div style={{ marginTop: 8, marginBottom: 16 }}>
                                        "לא מצאתי ציון מדויק של קואורדינטות בטקסט, רק תיאור כללי של 'צומת הרצל'. מה המיקום המדויק?"
                                    </div>
                                    <Input placeholder="הכנס תשובה כאן..." />
                                    <Button type="primary" style={{ marginTop: 8 }} onClick={() => {
                                        setNeedsClarification(false);
                                        setStep(5);
                                    }}>עדכן והמשך</Button>
                                </div>
                            </div>
                        )}

                        {!isProcessing && !needsClarification && step > 0 && (
                            <div>
                                <Alert message="החילוץ עבר בהצלחה (Confidence: 0.96)" type="success" showIcon style={{ marginBottom: 16 }} />
                                <pre style={{ background: '#2b2b2b', color: '#a9b7c6', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
                                    {`{
  "report_type": "suspicious_drone",
  "timestamp": "2026-02-24T14:30:00",
  "location": {
    "description": "צומת הרצל והנשיא",
    "coordinates": [32.0853, 34.7818],
    "polygon": null
  },
  "responding_unit": "יחידה 5",
  "status": "en_route"
}`}
                                </pre>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default MessageProcessingUI;
