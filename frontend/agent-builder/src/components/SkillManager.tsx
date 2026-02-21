/**
 * SkillManager.tsx
 * Management UI for reusable AI skills.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Plus, Save,
    Wrench, BarChart, Cpu
} from 'lucide-react';
import {
    Form, Input, Select,
    Popconfirm, message, Empty,
    Badge, Checkbox, Slider, Divider
} from 'antd';

const API = 'http://localhost:8000';

interface Skill {
    id: string;
    name: string;
    description?: string;
    skill_type: string;
    prompt_template: string;
    tools: string[];
    parameters: any;
}

const SkillManager: React.FC = () => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();

    const fetchSkills = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API}/api/skills`);
            const data = await resp.json();
            setSkills(Array.isArray(data) ? data : []);
        } catch (e) {
            message.error('Failed to load skills');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSkills(); }, []);

    const handleCreate = () => {
        setSelectedId(null);
        setIsEditing(true);
        form.resetFields();
        form.setFieldsValue({
            name: 'New Structuring Skill',
            skill_type: 'structuring',
            prompt_template: 'You are an extraction assistant. Extract JSON from the following Hebrew text using this schema: {template_schema}',
            tools: ['geocode_address'],
            parameters: { model: 'gpt-4o', temperature: 0.1, max_tokens: 2048 }
        });
    };

    const handleSave = async (values: any) => {
        try {
            const url = selectedId ? `${API}/api/skills/${selectedId}` : `${API}/api/skills`;
            const method = selectedId ? 'PUT' : 'POST';

            const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!resp.ok) throw new Error('Save failed');

            message.success('Skill saved');
            await fetchSkills();
            setIsEditing(false);
        } catch (e) {
            message.error('Failed to save skill');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await fetch(`${API}/api/skills/${id}`, { method: 'DELETE' });
            message.success('Skill deleted');
            if (selectedId === id) {
                setSelectedId(null);
                setIsEditing(false);
            }
            fetchSkills();
        } catch (e) {
            message.error('Delete failed');
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', background: 'var(--bg-base)', overflow: 'hidden' }}>

            {/* 1. Sidebar: List */}
            <div style={{
                width: 300, borderRight: '1px solid var(--border)',
                background: 'var(--bg-surface)', display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Sparkles size={18} color="var(--brand-primary)" />
                        <span style={{ fontWeight: 800, fontSize: 15 }}>Skills</span>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={handleCreate}>
                        <Plus size={16} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                    {skills.length === 0 ? (
                        <Empty description="No skills yet" style={{ marginTop: 40 }} />
                    ) : (
                        skills.map(s => (
                            <motion.div
                                key={s.id}
                                onClick={() => { setSelectedId(s.id); setIsEditing(true); form.setFieldsValue(s); }}
                                style={{
                                    padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                                    marginBottom: 6, transition: '0.2s',
                                    background: selectedId === s.id ? 'var(--bg-elevated)' : 'transparent',
                                    border: selectedId === s.id ? '1px solid var(--border)' : '1px solid transparent'
                                }}
                            >
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{s.name}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                    <Badge status="processing" text={s.skill_type} style={{ fontSize: 10, opacity: 0.7 }} />
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            </div>

            {/* 2. Editor */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <AnimatePresence mode="wait">
                    {!isEditing ? (
                        <motion.div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <Sparkles size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                            <div>Select a skill to edit its prompt and tool configuration</div>
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ padding: '32px 48px', maxWidth: 900 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Cpu size={20} color="var(--brand-primary)" />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Skill Configuration</h2>
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Re-architecting the agent's core capabilities</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {selectedId && (
                                        <Popconfirm title="Delete skill?" onConfirm={() => handleDelete(selectedId)}>
                                            <button className="btn btn-danger btn-sm">Delete</button>
                                        </Popconfirm>
                                    )}
                                    <button className="btn btn-primary btn-sm" onClick={() => form.submit()}>
                                        <Save size={14} /> Save Changes
                                    </button>
                                </div>
                            </div>

                            <Form form={form} layout="vertical" onFinish={handleSave}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
                                    <Form.Item label="Skill Name" name="name" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Hebrew Structurer" />
                                    </Form.Item>
                                    <Form.Item label="Skill Type" name="skill_type">
                                        <Select options={[
                                            { label: 'Structuring', value: 'structuring' },
                                            { label: 'Retrieval (RAG)', value: 'retrieval' },
                                            { label: 'Classifier', value: 'classifier' },
                                            { label: 'Validation', value: 'validation' },
                                        ]} />
                                    </Form.Item>
                                </div>

                                <Form.Item label="System Prompt Template" name="prompt_template" extra="Use {template_schema} and {glossary} as variables.">
                                    <Input.TextArea rows={8} style={{ fontFamily: 'monospace', fontSize: 13 }} />
                                </Form.Item>

                                <Divider style={{ margin: '32px 0' }} />

                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32 }}>
                                    <div>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                            <Wrench size={16} /> Available Tools
                                        </h4>
                                        <Form.Item name="tools">
                                            <Checkbox.Group style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <Checkbox value="geocode_address" />
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600 }}>geocode_address</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Resolves Hebrew addresses to lat/lng using GIS</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <Checkbox value="glossary_lookup" />
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600 }}>glossary_lookup</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expands organizational abbreviations from RAG store</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <Checkbox value="validation_loop" />
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600 }}>validation_loop</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Asks user for clarification on missing fields</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Checkbox.Group>
                                        </Form.Item>
                                    </div>

                                    <div>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                            <BarChart size={16} /> Parameters
                                        </h4>
                                        <Form.Item label="Model" name={['parameters', 'model']}>
                                            <Select options={[
                                                { label: 'GPT-4o', value: 'gpt-4o' },
                                                { label: 'GPT-4o-mini', value: 'gpt-4o-mini' },
                                                { label: 'Qwen2.5-7B (On-Prem)', value: 'qwen2.5-7b' },
                                                { label: 'Llama-3.1-8B (On-Prem)', value: 'llama-3.1-8b' },
                                            ]} />
                                        </Form.Item>
                                        <Form.Item label="Temperature" name={['parameters', 'temperature']}>
                                            <Slider min={0} max={1} step={0.1} />
                                        </Form.Item>
                                        <Form.Item label="Max Tokens" name={['parameters', 'max_tokens']}>
                                            <Input type="number" />
                                        </Form.Item>
                                    </div>
                                </div>
                            </Form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default SkillManager;
