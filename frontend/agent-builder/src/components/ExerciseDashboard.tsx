/**
 * ExerciseDashboard.tsx — Police Simulation Exercise Runner
 * Start, monitor and control live exercises.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, Play, Square, RefreshCw, MapPin,
    Users, Clock, AlertTriangle, CheckCircle2,
    Settings, BarChart3, ChevronRight,
} from 'lucide-react';
import { Form, Input, InputNumber, Select, Switch, message } from 'antd';

const API = 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────

interface ExerciseConfig {
    exercise_id: string;
    blueprint_id: string;
    num_units: number;
    scenario_type: string;
    sim_time_multiplier: number;
    inject_chaos: boolean;
    assessment_mode: boolean;
    max_sim_minutes: number;
}

interface ExerciseStatus {
    exercise_id: string;
    status: 'running' | 'completed' | 'failed' | 'paused';
    elapsed_minutes: number;
    active_events: number;
    units_engaged: number;
    total_units: number;
    decisions_count: number;
    fatigue_violations: number;
}

// ── Stat Card ──────────────────────────────────────────────────────

const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color?: string;
    sub?: string;
}> = ({ icon, label, value, color = 'var(--brand-primary)', sub }) => (
    <motion.div
        className="card"
        style={{ padding: '16px 20px', flex: 1, minWidth: 140 }}
        whileHover={{ y: -2, borderColor: color + '60' }}
        transition={{ duration: 0.15 }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: color + '18', border: `1px solid ${color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {icon}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {label}
            </span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </motion.div>
);

// ── Status Badge ───────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ExerciseStatus['status'] }> = ({ status }) => {
    const map: Record<string, { color: string; label: string }> = {
        running: { color: '#10b981', label: 'Running' },
        completed: { color: '#6366f1', label: 'Completed' },
        failed: { color: '#ef4444', label: 'Failed' },
        paused: { color: '#f59e0b', label: 'Paused' },
    };
    const { color, label } = map[status] ?? { color: 'var(--text-muted)', label: status };
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
            background: color + '18', color, border: `1px solid ${color}35`,
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: '50%', background: color,
                animation: status === 'running' ? 'pulse-success 1.5s ease-in-out infinite' : 'none',
            }} />
            {label}
        </span>
    );
};

// ── Exercise Card ──────────────────────────────────────────────────

const ExerciseCard: React.FC<{
    ex: ExerciseStatus;
    onStop: (id: string) => void;
}> = ({ ex, onStop }) => (
    <motion.div
        className="card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        style={{ padding: '16px 20px', marginBottom: 12 }}
    >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Zap size={15} color="#818cf8" />
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{ex.exercise_id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {ex.elapsed_minutes.toFixed(0)} min elapsed
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusBadge status={ex.status} />
                {ex.status === 'running' && (
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => onStop(ex.exercise_id)} title="Stop">
                        <Square size={12} />
                    </button>
                )}
            </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
                { icon: <AlertTriangle size={11} />, label: 'Active Events', val: ex.active_events, color: '#f59e0b' },
                { icon: <Users size={11} />, label: 'Engaged', val: `${ex.units_engaged}/${ex.total_units}`, color: '#06b6d4' },
                { icon: <BarChart3 size={11} />, label: 'Decisions', val: ex.decisions_count, color: '#6366f1' },
                { icon: <CheckCircle2 size={11} />, label: 'Fatigue Violations', val: ex.fatigue_violations, color: ex.fatigue_violations > 0 ? '#ef4444' : '#10b981' },
            ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ color: item.color }}>{item.icon}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.label}:</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.val}</span>
                </div>
            ))}
        </div>
    </motion.div>
);

// ── Main Dashboard ─────────────────────────────────────────────────

const ExerciseDashboard: React.FC = () => {
    const [form] = Form.useForm<ExerciseConfig>();
    const [starting, setStarting] = useState(false);
    const [exercises, setExercises] = useState<ExerciseStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [showConfig, setShowConfig] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API}/api/exercises`);
            if (resp.ok) {
                const data = await resp.json();
                setExercises(Array.isArray(data) ? data : []);
            }
        } catch {
            // Backend may not be running
        } finally {
            setLoading(false);
        }
    }, []);

    const handleStart = async () => {
        try {
            const values = await form.validateFields();
            setStarting(true);
            const resp = await fetch(`${API}/api/exercises/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            if (!resp.ok) throw new Error(await resp.text());
            const data = await resp.json();
            message.success(`Exercise "${data.exercise_id}" started!`);
            setShowConfig(false);
            setTimeout(refresh, 800);
        } catch (e: any) {
            message.error(e.message || 'Failed to start exercise');
        } finally {
            setStarting(false);
        }
    };

    const handleStop = async (exerciseId: string) => {
        try {
            await fetch(`${API}/api/exercises/${exerciseId}/stop`, { method: 'POST' });
            message.success('Exercise stopped');
            refresh();
        } catch {
            message.error('Failed to stop exercise');
        }
    };

    const totalRunning = exercises.filter(e => e.status === 'running').length;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', background: 'var(--bg-base)', padding: '24px 28px', gap: 24 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                        }}
                    >
                        <Zap size={18} color="white" />
                    </motion.div>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Exercise Runner</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Police Simulation — Multi-agent orchestration</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
                        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                    <button
                        className={`btn btn-sm ${showConfig ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setShowConfig(!showConfig)}
                    >
                        <Settings size={13} /> {showConfig ? 'Hide Config' : 'New Exercise'}
                    </button>
                </div>
            </div>

            {/* Summary stats */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <StatCard icon={<Zap size={14} color="#6366f1" />} label="Running" value={totalRunning} color="#6366f1" />
                <StatCard icon={<CheckCircle2 size={14} color="#10b981" />} label="Completed" value={exercises.filter(e => e.status === 'completed').length} color="#10b981" />
                <StatCard icon={<Clock size={14} color="#f59e0b" />} label="Total" value={exercises.length} color="#f59e0b" />
                <StatCard icon={<MapPin size={14} color="#06b6d4" />} label="Blueprint" value="Police v1" color="#06b6d4" sub="police_simulation_v1" />
            </div>

            {/* Config panel */}
            <AnimatePresence>
                {showConfig && (
                    <motion.div
                        className="card"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 0 }}>
                            <Settings size={14} color="var(--brand-primary)" />
                            Configure New Exercise
                        </div>
                        <div className="card-body">
                            <Form
                                form={form}
                                layout="vertical"
                                initialValues={{
                                    exercise_id: `ex_${Date.now().toString(36)}`,
                                    blueprint_id: 'police_simulation_v1',
                                    num_units: 8,
                                    scenario_type: 'crowd_control',
                                    sim_time_multiplier: 10.0,
                                    inject_chaos: true,
                                    assessment_mode: true,
                                    max_sim_minutes: 60,
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0 20px' }}>
                                    <Form.Item label="Exercise ID" name="exercise_id" rules={[{ required: true }]}>
                                        <Input />
                                    </Form.Item>
                                    <Form.Item label="Blueprint ID" name="blueprint_id" rules={[{ required: true }]}>
                                        <Input />
                                    </Form.Item>
                                    <Form.Item label="Num Units" name="num_units">
                                        <InputNumber min={1} max={32} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item label="Scenario Type" name="scenario_type">
                                        <Select>
                                            <Select.Option value="crowd_control">Crowd Control</Select.Option>
                                            <Select.Option value="pursuit">Vehicle Pursuit</Select.Option>
                                            <Select.Option value="mass_casualty">Mass Casualty</Select.Option>
                                            <Select.Option value="counter_terrorism">Counter-Terrorism</Select.Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item label="Time Multiplier (×)" name="sim_time_multiplier">
                                        <InputNumber min={1} max={100} step={0.5} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item label="Max Duration (min)" name="max_sim_minutes">
                                        <InputNumber min={5} max={480} style={{ width: '100%' }} />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                                    <Form.Item name="inject_chaos" valuePropName="checked" noStyle>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Switch size="small" defaultChecked />
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Inject chaos events</span>
                                        </div>
                                    </Form.Item>
                                    <Form.Item name="assessment_mode" valuePropName="checked" noStyle>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Switch size="small" defaultChecked />
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Assessment mode (Langfuse scoring)</span>
                                        </div>
                                    </Form.Item>
                                </div>
                                <motion.button
                                    className="btn btn-primary"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleStart}
                                    disabled={starting}
                                    style={{ minWidth: 160 }}
                                >
                                    <Play size={14} />
                                    {starting ? 'Starting…' : 'Start Exercise'}
                                    <ChevronRight size={14} />
                                </motion.button>
                            </Form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active exercises list */}
            <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Active Exercises ({exercises.length})
                </div>
                {exercises.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                        No exercises yet. Configure one above and click <strong>Start Exercise</strong>.
                    </div>
                ) : (
                    <AnimatePresence>
                        {exercises.map(ex => (
                            <ExerciseCard key={ex.exercise_id} ex={ex} onStop={handleStop} />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default ExerciseDashboard;
