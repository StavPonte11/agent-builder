/**
 * TemplateManager.tsx
 * Management UI for chat group message templates.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Plus, Save, Trash2,
    ChevronRight, Search, Globe,
    ListOrdered, BookOpen, Lightbulb,
    Send, CheckCircle2,
    MapPin, Sparkles, Settings
} from 'lucide-react';
import {
    Form, Input, Select, Switch,
    Button, Tabs, Badge, Empty,
    Tag, message, Popconfirm
} from 'antd';

const API = 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────

interface TemplateField {
    name: string;
    type: string;
    description: string;
    required: boolean;
    example: string;
    is_geo: boolean;
}

interface GlossaryEntry {
    term: string;
    meaning: string;
    aliases?: string[];
}

interface FewShotExample {
    input: string;
    output: any;
}

interface MessageTemplate {
    id: string;
    group_id: string;
    name: string;
    description?: string;
    language: string;
    fields: TemplateField[];
    glossary_terms: GlossaryEntry[];
    few_shot_examples: FewShotExample[];
}

// ── Components ─────────────────────────────────────────────────────

const TemplateManager: React.FC = () => {
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();

    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
    const [availableSkills, setAvailableSkills] = useState<any[]>([]);

    // Test State
    const [testInput, setTestInput] = useState('');
    const [testResult, setTestResult] = useState<any>(null);
    const [testing, setTesting] = useState(false);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API}/api/message-templates`);
            const data = await resp.json();
            setTemplates(Array.isArray(data) ? data : []);
        } catch (e) {
            message.error('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const fetchSkills = async () => {
        try {
            const resp = await fetch(`${API}/api/skills`);
            const data = await resp.json();
            setAvailableSkills(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to load skills');
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchSkills();
    }, []);

    const selectedTemplate = templates.find(t => t.id === selectedId);

    const handleCreate = () => {
        setSelectedId(null);
        setIsEditing(true);
        form.resetFields();
        form.setFieldsValue({
            name: 'New Template',
            group_id: `group_${Date.now()}`,
            language: 'he',
            fields: [],
            glossary_terms: [],
            few_shot_examples: []
        });
    };

    const handleSave = async (values: any) => {
        try {
            const url = selectedId ? `${API}/api/message-templates/${selectedId}` : `${API}/api/message-templates`;
            const method = selectedId ? 'PUT' : 'POST';

            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!resp.ok) throw new Error('Save failed');

            message.success('Template saved successfully');
            await fetchTemplates();
            setIsEditing(false);
        } catch (e) {
            message.error('Failed to save template');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`${API}/api/message-templates/${id}`, { method: 'DELETE' });
            message.success('Template deleted');
            if (selectedId === id) setSelectedId(null);
            fetchTemplates();
        } catch (e) {
            message.error('Delete failed');
        }
    };

    const runTest = async () => {
        if (!selectedTemplate || !testInput) return;
        setTesting(true);
        try {
            const resp = await fetch(`${API}/api/structure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: selectedTemplate.group_id,
                    free_text: testInput,
                    skill_id: selectedSkillId
                }),
            });
            const data = await resp.json();
            setTestResult(data);
        } catch (e) {
            message.error('Test extraction failed');
        } finally {
            setTesting(false);
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', background: 'var(--bg-base)', overflow: 'hidden' }}>

            {/* 1. Left Sidebar: List */}
            <div style={{
                width: 320, borderRight: '1px solid var(--border)',
                background: 'var(--bg-surface)', display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '20px 20px 10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={18} color="var(--brand-primary)" />
                        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>Templates</span>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={handleCreate}>
                        <Plus size={16} />
                    </button>
                </div>

                <div style={{ padding: '0 16px 12px 16px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                        <input
                            placeholder="Search chat groups..."
                            style={{
                                width: '100%', background: 'var(--bg-base)',
                                border: '1px solid var(--border)', borderRadius: 8,
                                padding: '7px 10px 7px 32px', fontSize: 12, outline: 'none'
                            }}
                        />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                    {templates.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No templates yet" style={{ marginTop: 40 }} />
                    ) : (
                        templates.map(t => (
                            <motion.div
                                key={t.id}
                                whileHover={{ background: 'rgba(99,102,241,0.08)' }}
                                onClick={() => { setSelectedId(t.id); setIsEditing(true); setTestResult(null); }}
                                style={{
                                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                                    marginBottom: 6, transition: '0.2s',
                                    background: selectedId === t.id ? 'var(--bg-elevated)' : 'transparent',
                                    border: selectedId === t.id ? '1px solid var(--border)' : '1px solid transparent'
                                }}
                            >
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Globe size={10} /> {t.group_id}
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* 2. Main Area: Editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                    {!isEditing ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}
                        >
                            <FileText size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                            <div>Select a template or create a new one to begin</div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="editor"
                            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                        >
                            {/* Header */}
                            <div style={{
                                padding: '16px 24px', borderBottom: '1px solid var(--border)',
                                background: 'var(--bg-surface)', display: 'flex',
                                alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: 'rgba(99,102,241,0.1)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FileText size={16} color="var(--brand-primary)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedId ? 'Edit Template' : 'New Template'}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Configure restructuring logic for chat groups</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {selectedId && (
                                        <Popconfirm title="Delete template?" onConfirm={() => handleDelete(selectedId)}>
                                            <button className="btn btn-danger btn-sm">
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </Popconfirm>
                                    )}
                                    <button className="btn btn-primary btn-sm" onClick={() => form.submit()}>
                                        <Save size={14} /> Save Template
                                    </button>
                                </div>
                            </div>

                            {/* Form Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                                <Form form={form} layout="vertical" onFinish={handleSave}>
                                    <Tabs defaultActiveKey="basic" items={[
                                        {
                                            key: 'basic',
                                            label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Settings size={14} /> Basic</div>,
                                            children: (
                                                <div style={{ maxWidth: 600 }}>
                                                    <Form.Item label="Template Name" name="name" rules={[{ required: true }]}>
                                                        <Input placeholder="e.g. Unit Status Update" />
                                                    </Form.Item>
                                                    <Form.Item label="Group ID (Unique)" name="group_id" rules={[{ required: true }]}>
                                                        <Input placeholder="e.g. group_patrol_south" />
                                                    </Form.Item>
                                                    <Form.Item label="Description" name="description">
                                                        <Input.TextArea rows={3} placeholder="What does this group handle?" />
                                                    </Form.Item>
                                                    <Form.Item label="Source Language" name="language">
                                                        <Select options={[
                                                            { label: 'Hebrew (עברית)', value: 'he' },
                                                            { label: 'English', value: 'en' },
                                                            { label: 'Arabic (العربية)', value: 'ar' },
                                                        ]} />
                                                    </Form.Item>
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'fields',
                                            label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ListOrdered size={14} /> Fields & Schema</div>,
                                            children: (
                                                <div>
                                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                                                        Define the structured data points the AI should extract from the free-text message.
                                                    </p>
                                                    <Form.List name="fields">
                                                        {(fields, { add, remove }) => (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                                {fields.map(({ key, name, ...restField }) => (
                                                                    <div key={key} className="card" style={{ padding: 16 }}>
                                                                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                                                            <Form.Item {...restField} name={[name, 'name']} label="Field Key" rules={[{ required: true }]} style={{ flex: 1 }}>
                                                                                <Input placeholder="e.g. event_type" />
                                                                            </Form.Item>
                                                                            <Form.Item {...restField} name={[name, 'type']} label="Type" style={{ width: 120 }}>
                                                                                <Select options={[
                                                                                    { label: 'String', value: 'string' },
                                                                                    { label: 'Number', value: 'number' },
                                                                                    { label: 'Date', value: 'datetime' },
                                                                                    { label: 'Location', value: 'location' },
                                                                                    { label: 'Boolean', value: 'boolean' },
                                                                                ]} />
                                                                            </Form.Item>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 30 }}>
                                                                                <Form.Item {...restField} name={[name, 'required']} valuePropName="checked" noStyle>
                                                                                    <Switch checkedChildren="Req" unCheckedChildren="Opt" />
                                                                                </Form.Item>
                                                                            </div>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 25 }}>
                                                                                <Button type="text" danger onClick={() => remove(name)} icon={<Trash2 size={14} />} />
                                                                            </div>
                                                                        </div>
                                                                        <Form.Item {...restField} name={[name, 'description']} label="AI Extraction Hint">
                                                                            <Input placeholder="Tell the LLM how to identify this field..." />
                                                                        </Form.Item>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                                                            <Form.Item {...restField} name={[name, 'is_geo']} valuePropName="checked" label="Geographic Field?" style={{ marginBottom: 0 }}>
                                                                                <Switch size="small" />
                                                                            </Form.Item>
                                                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Trigger auto-geocoding into coordinates</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>Add Field</Button>
                                                            </div>
                                                        )}
                                                    </Form.List>
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'glossary',
                                            label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={14} /> Glossary</div>,
                                            children: (
                                                <div>
                                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                                                        Define organizational abbreviations, slang or terminology to help the LLM understand context.
                                                    </p>
                                                    <Form.List name="glossary_terms">
                                                        {(fields, { add, remove }) => (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                                {fields.map(({ key, name, ...restField }) => (
                                                                    <div key={key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                                                        <Form.Item {...restField} name={[name, 'term']} rules={[{ required: true }]} style={{ flex: 1 }}>
                                                                            <Input placeholder="Hebrew term / acronym" />
                                                                        </Form.Item>
                                                                        <ChevronRight size={14} style={{ marginTop: 10, opacity: 0.3 }} />
                                                                        <Form.Item {...restField} name={[name, 'meaning']} rules={[{ required: true }]} style={{ flex: 1 }}>
                                                                            <Input placeholder="Global meaning / translation" />
                                                                        </Form.Item>
                                                                        <Button type="text" danger onClick={() => remove(name)} icon={<Trash2 size={14} />} style={{ marginTop: 4 }} />
                                                                    </div>
                                                                ))}
                                                                <Button type="dashed" onClick={() => add()} icon={<Plus size={14} />}>Add Term</Button>
                                                            </div>
                                                        )}
                                                    </Form.List>
                                                </div>
                                            )
                                        },
                                        {
                                            key: 'examples',
                                            label: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lightbulb size={14} /> Few-Shot</div>,
                                            children: (
                                                <Form.List name="few_shot_examples">
                                                    {(fields, { add, remove }) => (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                                            {fields.map(({ key, name, ...restField }) => (
                                                                <div key={key} className="card" style={{ padding: 16 }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                                                        <span style={{ fontWeight: 600, fontSize: 12 }}>Example #{key + 1}</span>
                                                                        <Button type="text" danger onClick={() => remove(name)} icon={<Trash2 size={14} />} />
                                                                    </div>
                                                                    <Form.Item {...restField} name={[name, 'input']} label="Raw Hebrew Input">
                                                                        <Input.TextArea placeholder="כאן מדביקים הודעת ווטסאפ לדוגמה..." />
                                                                    </Form.Item>
                                                                    <Form.Item {...restField} name={[name, 'output']} label="Expected JSON Output">
                                                                        <Input.TextArea placeholder='{ "event": "...", "date": "..." }' style={{ fontFamily: 'monospace', fontSize: 12 }} />
                                                                    </Form.Item>
                                                                </div>
                                                            ))}
                                                            <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>Add Example</Button>
                                                        </div>
                                                    )}
                                                </Form.List>
                                            )
                                        }
                                    ]} />
                                </Form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 3. Right Sidebar: Live Preview & Test */}
            {isEditing && (
                <div style={{
                    width: 360, borderLeft: '1px solid var(--border)',
                    background: 'var(--bg-surface)', padding: 24,
                    display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <Sparkles size={16} color="var(--brand-primary)" />
                            <span style={{ fontWeight: 700, fontSize: 14 }}>Live Extraction Test</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ marginBottom: 4 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Selection Extraction Skill</div>
                                <Select
                                    placeholder="Use Default Structurer"
                                    allowClear
                                    style={{ width: '100%' }}
                                    value={selectedSkillId}
                                    onChange={setSelectedSkillId}
                                    options={availableSkills.map(s => ({ label: s.name, value: s.id }))}
                                />
                            </div>
                            <Input.TextArea
                                placeholder="Paste real message text here to test the template..."
                                rows={4}
                                value={testInput}
                                onChange={e => setTestInput(e.target.value)}
                                style={{ fontSize: 13 }}
                            />
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                                onClick={runTest}
                                disabled={testing || !testInput}
                            >
                                {testing ? 'Analyzing...' : <><Send size={14} /> Run Structurer</>}
                            </button>
                        </div>
                    </div>

                    <AnimatePresence>
                        {testResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                style={{ background: 'var(--bg-base)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckCircle2 size={14} color="#10b981" />
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>Results</span>
                                    </div>
                                    <Badge status="success" text={`${(testResult.confidence * 100).toFixed(0)}% Match`} />
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8, fontFamily: 'monospace', fontSize: 11, overflowX: 'auto' }}>
                                    <pre style={{ margin: 0 }}>{JSON.stringify(testResult.structured, null, 2)}</pre>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <MapPin size={14} color="var(--text-muted)" />
                            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>Auto-Resolved Entities</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            <Tag color="blue" bordered={false}>רחוב הרצל 45</Tag>
                            <Tag color="cyan" bordered={false}>הצוות הטכני</Tag>
                            <Tag color="purple" bordered={false}>פרויקט אלפא</Tag>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateManager;
