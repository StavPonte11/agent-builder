/**
 * EvaluationPage — Langfuse dataset builder + judge config + run history.
 *
 * Requirement 3: Evaluation
 * ──────────────────────────
 * Tab 1 — Dataset Builder: browse past executions, add to Langfuse dataset
 * Tab 2 — Judge Config: per-blueprint scoring dimensions (name/rubric/weight/threshold)
 * Tab 3 — Run History: table of all evaluation runs with scores + trends
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
    Database, FlaskConical, TrendingUp, Plus, Trash2, CheckCircle,
    XCircle, Loader2, ExternalLink, BarChart2, Save
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Tab = 'dataset' | 'judge' | 'history'

interface EvalDimension {
    name: string
    rubric: string
    weight: number
    pass_threshold: number
}

interface EvalRun {
    id: string
    execution_id: string
    created_at: string
    aggregate_score: number
    passed: boolean
    judge_model: string
    dimensions: Array<{ dimension: string; score: number; reasoning: string; weight: number }>
}

interface ExecutionItem {
    id: string
    status: string
    started_at: string
    aggregate_eval_score: number | null
    output_data: Record<string, unknown>
}

function TabButton({ id, label, icon: Icon, active, onClick }: {
    id: Tab; label: string; icon: React.ElementType; active: boolean; onClick: () => void
}) {
    return (
        <button onClick={onClick}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors
      ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
            <Icon className="h-4 w-4" />
            {label}
        </button>
    )
}

// ── Tab 1: Dataset Builder ─────────────────────────────────────────────────────

function DatasetTab({ blueprintId }: { blueprintId: string }) {
    const [datasetId, setDatasetId] = useState('')
    const [selectedExecutions, setSelectedExecutions] = useState<Set<string>>(new Set())
    const qc = useQueryClient()

    const { data: executions = [] } = useQuery<ExecutionItem[]>({
        queryKey: ['executions-for-dataset', blueprintId],
        queryFn: () => fetch(`/api/v1/executions?blueprint_id=${blueprintId}&page_size=50`).then(r => r.json()),
        enabled: !!blueprintId,
    })

    const addItems = useMutation({
        mutationFn: async () => {
            const r = await fetch(`/api/v1/evaluation/datasets/${datasetId}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ execution_ids: Array.from(selectedExecutions) }),
            })
            return r.json()
        },
        onSuccess: () => {
            setSelectedExecutions(new Set())
            qc.invalidateQueries({ queryKey: ['eval-datasets'] })
        },
    })

    const createDataset = useMutation({
        mutationFn: async (name: string) => {
            const r = await fetch('/api/v1/evaluation/datasets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, blueprint_id: blueprintId }),
            })
            return r.json()
        },
        onSuccess: (d: { id: string }) => setDatasetId(d.id),
    })

    const toggle = (id: string) =>
        setSelectedExecutions(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Langfuse Dataset</h3>
                <div className="flex gap-3">
                    <input
                        value={datasetId}
                        onChange={e => setDatasetId(e.target.value)}
                        placeholder="Dataset ID (paste from Langfuse or create new)"
                        className="flex-1 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                        onClick={() => createDataset.mutate(`Blueprint ${blueprintId.slice(0, 6)} Eval`)}
                        disabled={createDataset.isPending}
                        className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
                    >
                        {createDataset.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        New Dataset
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">
                        Select Executions ({selectedExecutions.size} selected)
                    </h3>
                    <button
                        onClick={() => addItems.mutate()}
                        disabled={selectedExecutions.size === 0 || !datasetId || addItems.isPending}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                    >
                        {addItems.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                        Add to Dataset
                    </button>
                </div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                    {executions.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">No completed executions yet</p>
                    ) : executions.map(ex => (
                        <div
                            key={ex.id}
                            className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors
                ${selectedExecutions.has(ex.id) ? 'bg-primary/5' : ''}`}
                            onClick={() => toggle(ex.id)}
                        >
                            <div className={`h-4 w-4 rounded border-2 flex items-center justify-center
                ${selectedExecutions.has(ex.id) ? 'bg-primary border-primary' : 'border-border'}`}>
                                {selectedExecutions.has(ex.id) && <div className="h-2 w-2 rounded-sm bg-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-mono text-foreground">{ex.id.slice(0, 8)}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {new Date(ex.started_at).toLocaleString()} · {ex.status}
                                </p>
                            </div>
                            {ex.aggregate_eval_score !== null && (
                                <span className={`text-xs font-semibold ${ex.aggregate_eval_score >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                                    {Math.round(ex.aggregate_eval_score * 100)}%
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Tab 2: Judge Config ────────────────────────────────────────────────────────

function JudgeConfigTab({ blueprintId }: { blueprintId: string }) {
    const qc = useQueryClient()

    const { data: config } = useQuery<{ evaluation_config: { scoring_dimensions: EvalDimension[]; judge_model: string; pass_threshold: number; auto_evaluate: boolean } }>({
        queryKey: ['blueprint-eval-config', blueprintId],
        queryFn: () => fetch(`/api/v1/blueprints/${blueprintId}`).then(r => r.json()),
        enabled: !!blueprintId,
    })

    const [dimensions, setDimensions] = useState<EvalDimension[]>(
        config?.evaluation_config?.scoring_dimensions ?? []
    )
    const [judgeModel, setJudgeModel] = useState(config?.evaluation_config?.judge_model ?? 'gpt-4o')
    const [passThreshold, setPassThreshold] = useState(config?.evaluation_config?.pass_threshold ?? 0.7)
    const [autoEvaluate, setAutoEvaluate] = useState(config?.evaluation_config?.auto_evaluate ?? true)

    const save = useMutation({
        mutationFn: () => fetch(`/api/v1/blueprints/${blueprintId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                evaluation_config: {
                    scoring_dimensions: dimensions,
                    judge_model: judgeModel,
                    pass_threshold: passThreshold,
                    auto_evaluate: autoEvaluate,
                }
            }),
        }).then(r => r.json()),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['blueprint-eval-config', blueprintId] }),
    })

    const addDim = () => setDimensions(d => [...d, { name: 'accuracy', rubric: '', weight: 1.0, pass_threshold: 0.7 }])
    const removeDim = (i: number) => setDimensions(d => d.filter((_, j) => j !== i))
    const updateDim = (i: number, field: keyof EvalDimension, value: string | number) =>
        setDimensions(d => d.map((x, j) => j === i ? { ...x, [field]: value } : x))

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Global Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Judge Model</label>
                        <select value={judgeModel} onChange={e => setJudgeModel(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none">
                            <option value="gpt-4o">gpt-4o</option>
                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                            <option value="claude-3-7-sonnet-20250219">claude-3-7-sonnet</option>
                            <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">
                            Pass Threshold: {Math.round(passThreshold * 100)}%
                        </label>
                        <input type="range" min={0} max={1} step={0.05} value={passThreshold}
                            onChange={e => setPassThreshold(Number(e.target.value))}
                            className="mt-2 w-full accent-primary" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Auto-evaluate on completion</label>
                        <div className="mt-2 flex items-center gap-2">
                            <button onClick={() => setAutoEvaluate(x => !x)}
                                className={`relative h-5 w-9 rounded-full transition-colors ${autoEvaluate ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${autoEvaluate ? 'translate-x-4' : ''}`} />
                            </button>
                            <span className="text-sm text-muted-foreground">{autoEvaluate ? 'On' : 'Off'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Scoring Dimensions</h3>
                    <button onClick={addDim}
                        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-accent">
                        <Plus className="h-3.5 w-3.5" /> Add Dimension
                    </button>
                </div>

                {dimensions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                        <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No dimensions yet — add one to enable LLM-as-judge evaluation</p>
                    </div>
                ) : dimensions.map((dim, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <input value={dim.name} onChange={e => updateDim(i, 'name', e.target.value)}
                                placeholder="Dimension name (e.g. accuracy)"
                                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-muted-foreground">Weight</label>
                                <input type="number" min="0.1" max="5" step="0.1" value={dim.weight}
                                    onChange={e => updateDim(i, 'weight', Number(e.target.value))}
                                    className="w-16 rounded-lg border border-border bg-muted/30 px-2 py-1.5 text-sm text-center focus:outline-none" />
                            </div>
                            <button onClick={() => removeDim(i)} className="text-muted-foreground hover:text-red-500">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                        <textarea
                            value={dim.rubric}
                            onChange={e => updateDim(i, 'rubric', e.target.value)}
                            placeholder="Rubric: describe what perfect score looks like…"
                            rows={2}
                            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                ))}
            </div>

            <button onClick={() => save.mutate()} disabled={save.isPending}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Configuration
            </button>
        </div>
    )
}

// ── Tab 3: Run History ─────────────────────────────────────────────────────────

function RunHistoryTab({ blueprintId }: { blueprintId: string }) {
    const { data: runs = [] } = useQuery<EvalRun[]>({
        queryKey: ['eval-runs', blueprintId],
        queryFn: () => fetch(`/api/v1/evaluation/runs?blueprint_id=${blueprintId}`).then(r => r.json()),
        enabled: !!blueprintId,
    })

    // Build trend data from runs
    const trendData = runs.slice().reverse().map(r => {
        const point: Record<string, number | string> = {
            date: new Date(r.created_at).toLocaleDateString(),
            aggregate: Math.round(r.aggregate_score * 100) / 100,
        }
        for (const dim of r.dimensions) {
            point[dim.dimension] = Math.round(dim.score * 100) / 100
        }
        return point
    })

    const allDimensions = runs.length > 0
        ? [...new Set(runs.flatMap(r => r.dimensions.map(d => d.dimension)))]
        : []

    const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#22c55e', '#f59e0b']

    return (
        <div className="space-y-5">
            {trendData.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Score Trends</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={trendData}>
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v * 100)}%`} />
                            <Tooltip formatter={(v: number) => `${Math.round(v * 100)}%`} />
                            <Legend />
                            <Line type="monotone" dataKey="aggregate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Aggregate" />
                            {allDimensions.map((dim, i) => (
                                <Line key={dim} type="monotone" dataKey={dim} stroke={COLORS[(i + 1) % COLORS.length]}
                                    strokeWidth={1.5} strokeDasharray="4 2" dot={false} name={dim} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Evaluation Runs</h3>
                </div>
                {runs.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                        No evaluation runs yet — enable auto-evaluate in Judge Config
                    </p>
                ) : (
                    <div className="divide-y divide-border">
                        {runs.map(run => (
                            <div key={run.id} className="px-5 py-3 flex items-center gap-4">
                                {run.passed ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                    : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-mono text-muted-foreground">{run.execution_id.slice(0, 8)}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {new Date(run.created_at).toLocaleString()} · {run.judge_model}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {run.dimensions.map(d => (
                                        <div key={d.dimension} className="text-center">
                                            <p className={`text-xs font-semibold ${d.score >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                                                {Math.round(d.score * 100)}%
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{d.dimension}</p>
                                        </div>
                                    ))}
                                    <div className="text-center border-l border-border pl-3">
                                        <p className={`text-sm font-bold ${run.passed ? 'text-green-600' : 'text-red-600'}`}>
                                            {Math.round(run.aggregate_score * 100)}%
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">aggregate</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function EvaluationPage() {
    const { id: blueprintId } = useParams<{ id: string }>()
    const [tab, setTab] = useState<Tab>('dataset')

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-primary" /> Evaluation
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Build datasets, configure LLM judge, and track quality over time
                        </p>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
                        <TabButton id="dataset" label="Dataset" icon={Database} active={tab === 'dataset'} onClick={() => setTab('dataset')} />
                        <TabButton id="judge" label="Judge Config" icon={FlaskConical} active={tab === 'judge'} onClick={() => setTab('judge')} />
                        <TabButton id="history" label="Run History" icon={TrendingUp} active={tab === 'history'} onClick={() => setTab('history')} />
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6">
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                    {blueprintId && tab === 'dataset' && <DatasetTab blueprintId={blueprintId} />}
                    {blueprintId && tab === 'judge' && <JudgeConfigTab blueprintId={blueprintId} />}
                    {blueprintId && tab === 'history' && <RunHistoryTab blueprintId={blueprintId} />}
                </motion.div>
            </div>
        </div>
    )
}
