/**
 * SandboxPage — Prompt iteration environment.
 *
 * Requirement 1: Sandbox
 * ─────────────────────
 * 1.1 Run tests and change prompts without affecting production
 * 1.2 Results dashboard with eval scores per run
 * 1.3 Approval gate before publish is unlocked
 *
 * Layout:
 *  ┌────────────────────────────────────────────────────────────────────┐
 *  │ HEADER: blueprint name, status, Approve button                    │
 *  ├───────────────────────┬────────────────────────────────────────────┤
 *  │  LEFT PANEL           │  RIGHT PANEL                               │
 *  │  • Input payload      │  • Run history (last 20)                   │
 *  │  • Prompt overrides   │  • Per-run eval score breakdown            │
 *  │  • Run button         │  • Diff between runs                       │
 *  └───────────────────────┴────────────────────────────────────────────┘
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Play, CheckCircle, XCircle, Clock, Loader2, Plus, Trash2,
    ChevronDown, ChevronUp, ExternalLink, ThumbsUp, AlertTriangle,
    Terminal, Sparkles, RefreshCw
} from 'lucide-react'

interface PromptOverride {
    nodeId: string
    nodeLabel: string
    newPrompt: string
}

interface EvalScore {
    dimension: string
    score: number
    reasoning: string
    weight: number
}

interface SandboxRun {
    run_id: string
    blueprint_id: string
    started_at: string
    duration_ms: number
    status: 'completed' | 'failed'
    output: Record<string, unknown>
    error?: string
    eval_scores: EvalScore[]
    aggregate_score?: number
    passed?: boolean
    override_prompts: Record<string, string>
}

function ScoreBadge({ score, passed }: { score?: number; passed?: boolean }) {
    if (score === undefined) return null
    const pct = Math.round(score * 100)
    const color = score >= 0.8 ? 'text-green-600 bg-green-500/10 border-green-500/30'
        : score >= 0.6 ? 'text-amber-600 bg-amber-500/10 border-amber-500/30'
            : 'text-red-600 bg-red-500/10 border-red-500/30'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
            {passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {pct}%
        </span>
    )
}

function RunCard({ run, onSelect, selected }: {
    run: SandboxRun; onSelect: () => void; selected: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const hasOverrides = Object.keys(run.override_prompts).length > 0

    return (
        <div
            className={`rounded-xl border transition-all cursor-pointer
        ${selected ? 'border-primary/60 bg-primary/5' : 'border-border bg-card hover:bg-muted/30'}
        ${run.status === 'failed' ? 'border-red-500/30' : ''}`}
            onClick={onSelect}
        >
            <div className="flex items-center gap-3 p-3">
                {run.status === 'failed'
                    ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    : run.passed
                        ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-muted-foreground truncate">
                            {run.run_id.slice(0, 8)}
                        </p>
                        {hasOverrides && (
                            <span className="text-[10px] rounded bg-purple-500/20 text-purple-600 px-1.5 py-0.5 font-medium">
                                custom prompts
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        {new Date(run.started_at).toLocaleTimeString()} · {run.duration_ms}ms
                    </p>
                </div>
                <ScoreBadge score={run.aggregate_score} passed={run.passed} />
                <button
                    onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
                    className="text-muted-foreground hover:text-foreground"
                >
                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
            </div>

            {expanded && (
                <div className="border-t border-border p-3 space-y-3">
                    {run.error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2 font-mono text-xs text-red-600">
                            {run.error}
                        </div>
                    )}

                    {run.eval_scores.length > 0 && (
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                Eval Scores
                            </p>
                            {run.eval_scores.map(s => (
                                <div key={s.dimension} className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${s.score >= 0.8 ? 'bg-green-500' : s.score >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
                                            style={{ width: `${s.score * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
                                        {Math.round(s.score * 100)}%
                                    </span>
                                    <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                        {s.dimension}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {!run.error && (
                        <div>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                Output
                            </p>
                            <pre className="text-[10px] font-mono bg-muted/50 rounded-lg p-2 overflow-x-auto max-h-32">
                                {JSON.stringify(run.output, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function SandboxPage() {
    const { id: blueprintId } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const qc = useQueryClient()

    const [inputPayload, setInputPayload] = useState('{\n  "message": "test input"\n}')
    const [overrides, setOverrides] = useState<PromptOverride[]>([])
    const [selectedRun, setSelectedRun] = useState<string | null>(null)
    const [newNodeId, setNewNodeId] = useState('')
    const [newPrompt, setNewPrompt] = useState('')

    const { data: blueprint } = useQuery<{ name: string; definition: { nodes: Array<{ id: string; type: string; data: { system_prompt?: string } & Record<string, unknown> }> }; config: Record<string, unknown> }>({
        queryKey: ['blueprint', blueprintId],
        queryFn: () => fetch(`/api/v1/blueprints/${blueprintId}`).then(r => r.json()),
        enabled: !!blueprintId,
    })

    const { data: runs = [], refetch: refetchRuns } = useQuery<SandboxRun[]>({
        queryKey: ['sandbox-results', blueprintId],
        queryFn: () => fetch(`/api/v1/blueprints/${blueprintId}/sandbox/results`).then(r => r.json()),
        enabled: !!blueprintId,
        refetchInterval: 5000,
    })

    const runSandbox = useMutation<SandboxRun>({
        mutationFn: async () => {
            let parsed: Record<string, unknown> = {}
            try { parsed = JSON.parse(inputPayload) } catch { /* use empty */ }
            const overrideMap: Record<string, string> = {}
            for (const ov of overrides) overrideMap[ov.nodeId] = ov.newPrompt

            const r = await fetch(`/api/v1/blueprints/${blueprintId}/sandbox`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input_data: parsed,
                    override_prompts: overrideMap,
                    eval_immediately: true,
                }),
            })
            return r.json()
        },
        onSuccess: () => {
            refetchRuns()
            qc.invalidateQueries({ queryKey: ['sandbox-results', blueprintId] })
        },
    })

    const approveSandbox = useMutation({
        mutationFn: () =>
            fetch(`/api/v1/blueprints/${blueprintId}/sandbox/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: 'Approved from sandbox' }),
            }).then(r => r.json()),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['blueprint', blueprintId] }),
    })

    const [statePatch, setStatePatch] = useState('{\n  "messages": []\n}')
    const resumeOrRewindSandbox = useMutation<SandboxRun, Error, string>({
        mutationFn: async (runId: string) => {
            let parsedPatch = {}
            try { parsedPatch = JSON.parse(statePatch) } catch { /* ignore */ }
            const overrideMap: Record<string, string> = {}
            for (const ov of overrides) overrideMap[ov.nodeId] = ov.newPrompt

            const r = await fetch(`/api/v1/blueprints/${blueprintId}/sandbox/resume_or_rewind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    run_id: runId,
                    state_patch: parsedPatch,
                    override_prompts: overrideMap,
                    eval_immediately: true,
                }),
            })
            if (!r.ok) throw new Error('Failed to resume sandbox')
            return r.json()
        },
        onSuccess: () => {
            refetchRuns()
            qc.invalidateQueries({ queryKey: ['sandbox-results', blueprintId] })
        },
    })

    const llmNodes = blueprint?.definition?.nodes?.filter(n => n.type === 'llm') ?? []
    const sandboxApproved = !!(blueprint?.config as Record<string, unknown>)?.sandbox_approved

    const passingRate = runs.length > 0
        ? Math.round((runs.filter(r => r.passed).length / runs.length) * 100)
        : null

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-primary" />
                            Sandbox
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {blueprint?.name ?? '…'} — iterate on prompts before publishing
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {runs.length > 0 && (
                            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium
                ${passingRate !== null && passingRate >= 80 ? 'bg-green-500/10 text-green-600 border border-green-500/30' : 'bg-muted text-muted-foreground'}`}>
                                {passingRate !== null ? `${passingRate}% passing` : 'No runs'}
                            </div>
                        )}
                        {sandboxApproved && (
                            <span className="flex items-center gap-1 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-600">
                                <CheckCircle className="h-3.5 w-3.5" /> Approved
                            </span>
                        )}
                        <button
                            onClick={() => approveSandbox.mutate()}
                            disabled={approveSandbox.isPending || sandboxApproved}
                            className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {approveSandbox.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                            {sandboxApproved ? 'Approved' : 'Approve for Publish'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT — Input + Overrides */}
                <div className="space-y-5">
                    {/* Input payload */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" /> Test Payload (JSON)
                        </h2>
                        <textarea
                            value={inputPayload}
                            onChange={e => setInputPayload(e.target.value)}
                            rows={8}
                            className="w-full rounded-xl border border-border bg-muted/30 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                            spellCheck={false}
                        />
                    </div>

                    {/* Prompt overrides */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold text-foreground mb-3">
                            Prompt Overrides
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                Override LLM prompts for this run only
                            </span>
                        </h2>

                        {overrides.map((ov, i) => (
                            <div key={i} className="mb-3 rounded-xl border border-border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-mono text-primary">{ov.nodeId}</p>
                                    <button onClick={() => setOverrides(o => o.filter((_, j) => j !== i))}
                                        className="text-muted-foreground hover:text-red-500">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <textarea
                                    value={ov.newPrompt}
                                    onChange={e => setOverrides(o => o.map((x, j) => j === i ? { ...x, newPrompt: e.target.value } : x))}
                                    rows={3}
                                    className="w-full rounded-lg border border-border bg-muted/30 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                                />
                            </div>
                        ))}

                        {llmNodes.length > 0 && (
                            <div className="flex gap-2">
                                <select
                                    value={newNodeId}
                                    onChange={e => setNewNodeId(e.target.value)}
                                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none"
                                >
                                    <option value="">Select LLM node…</option>
                                    {llmNodes.map(n => (
                                        <option key={n.id} value={n.id}>{n.id}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => {
                                        if (!newNodeId) return
                                        const existing = llmNodes.find(n => n.id === newNodeId)
                                        setOverrides(o => [...o, {
                                            nodeId: newNodeId,
                                            nodeLabel: newNodeId,
                                            newPrompt: existing?.data?.system_prompt ?? '',
                                        }])
                                        setNewNodeId('')
                                    }}
                                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Add
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Run button */}
                    <button
                        onClick={() => runSandbox.mutate()}
                        disabled={runSandbox.isPending}
                        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all"
                    >
                        {runSandbox.isPending
                            ? <><Loader2 className="h-5 w-5 animate-spin" /> Running…</>
                            : <><Play className="h-5 w-5" /> Run Sandbox</>}
                    </button>

                    {/* Latest result summary */}
                    {runSandbox.data && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`rounded-2xl border p-4 ${runSandbox.data.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {runSandbox.data.passed
                                    ? <CheckCircle className="h-5 w-5 text-green-500" />
                                    : <XCircle className="h-5 w-5 text-red-500" />}
                                <p className="font-semibold text-foreground">
                                    {runSandbox.data.passed ? 'Passed' : 'Failed'} — {runSandbox.data.duration_ms}ms
                                </p>
                                {runSandbox.data.aggregate_score !== undefined && (
                                    <ScoreBadge score={runSandbox.data.aggregate_score} passed={runSandbox.data.passed} />
                                )}
                            </div>
                            {runSandbox.data.error && (
                                <p className="font-mono text-xs text-red-600">{runSandbox.data.error}</p>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* RIGHT — Run history */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            Run History
                        </h2>
                        <span className="text-xs text-muted-foreground">{runs.length} runs</span>
                    </div>

                    {runs.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <Terminal className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">No runs yet</p>
                            <p className="text-xs mt-1">Click "Run Sandbox" to start testing your workflow</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {runs.map(run => (
                                <RunCard
                                    key={run.run_id}
                                    run={run}
                                    selected={selectedRun === run.run_id}
                                    onSelect={() => setSelectedRun(run.run_id === selectedRun ? null : run.run_id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* TIME TRAVEL DEBUGGER */}
                    {selectedRun && (
                        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5">
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400">
                                <Clock className="h-4 w-4" /> Time-Travel Debugger
                            </h3>
                            <p className="text-[11px] text-muted-foreground mb-4">
                                Edit the state patch JSON to modify the thread's memory. Then resume execution from this historical checkpoint.
                            </p>
                            <textarea
                                value={statePatch}
                                onChange={e => setStatePatch(e.target.value)}
                                rows={5}
                                className="w-full rounded-xl border border-purple-500/20 bg-background/50 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y mb-3"
                                spellCheck={false}
                            />
                            <button
                                onClick={() => resumeOrRewindSandbox.mutate(selectedRun)}
                                disabled={resumeOrRewindSandbox.isPending}
                                className="w-full flex justify-center items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                {resumeOrRewindSandbox.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Rewind & Resume
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
