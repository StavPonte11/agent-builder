/**
 * StateHistoryPanel — Time-Travel Debugging for Review Mode
 *
 * Shown in the right sidebar when canvasMode === 'review'.
 * Displays the full execution checkpoint history with:
 *  - "Fork from here" → creates new execution starting at that node
 *  - "View State" → opens the JSON snapshot modal
 *  - "Patch State" → opens an inline editor to surgically repair state
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    GitFork,
    Eye,
    PenTool,
    CheckCircle2,
    XCircle,
    Clock,
    SkipForward,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Loader2,
    AlertCircle,
} from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Checkpoint {
    checkpoint_id?: string
    node_id: string
    node_label?: string
    node_type?: string
    status: 'completed' | 'failed' | 'skipped' | 'running' | string
    duration_ms?: number | null
    started_at?: string | null
    input_snapshot?: Record<string, unknown> | unknown[] | string | number | null
    output_snapshot?: Record<string, unknown> | unknown[] | string | number | null
    error_message?: string | null
    cost_usd?: number | null
    token_usage?: { prompt: number; completion: number; total: number } | null
}

// ── Status icon helpers ───────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'completed':
            return <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
        case 'failed':
            return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        case 'skipped':
            return <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        case 'running':
            return <Loader2 className="h-3.5 w-3.5 text-blue-400 shrink-0 animate-spin" />
        default:
            return <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    }
}

function durationLabel(ms: number | null | undefined): string {
    if (ms == null) return '—'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

function costLabel(usd: number | null | undefined): string {
    if (usd == null || usd === 0) return ''
    if (usd < 0.001) return `<$0.001`
    return `$${usd.toFixed(4)}`
}

// ── JSON Viewer Modal ─────────────────────────────────────────────────────────

function JsonModal({ title, data, onClose }: { title: string; data: unknown; onClose: () => void }) {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
                >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <p className="text-sm font-medium text-foreground">{title}</p>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xs">Close</button>
                    </div>
                    <pre className="max-h-96 overflow-auto p-4 text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap">
                        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
                    </pre>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}

// ── Patch State Modal ─────────────────────────────────────────────────────────

function PatchModal({
    executionId,
    onClose,
}: {
    executionId: string
    onClose: () => void
}) {
    const [json, setJson] = useState('{\n  \n}')
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handlePatch = async () => {
        setSubmitting(true)
        setError(null)
        try {
            const patches = JSON.parse(json)
            const res = await fetch(`/api/v1/executions/${executionId}/state/patch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patches, reason: reason || 'Manual state patch from Time-Travel UI' }),
            })
            if (!res.ok) throw new Error(`Server returned ${res.status}`)
            setSuccess(true)
            setTimeout(onClose, 1200)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Patch failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl"
            >
                <div className="border-b border-border px-4 py-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <p className="text-sm font-medium text-foreground">Patch Execution State</p>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                        Surgically edit the live execution state. Every patch is audited. Use with caution.
                    </p>
                    <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">State Patch (JSON)</label>
                        <textarea
                            value={json}
                            onChange={(e) => setJson(e.target.value)}
                            rows={6}
                            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            spellCheck={false}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-foreground mb-1 block">Reason (required for audit)</label>
                        <input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Why are you patching this state?"
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1.5 border border-destructive/30">{error}</p>
                    )}
                    {success && (
                        <p className="text-xs text-green-400 bg-green-500/10 rounded-md px-2 py-1.5 border border-green-500/30">✓ Patch applied successfully</p>
                    )}
                </div>
                <div className="border-t border-border px-4 py-3 flex gap-2">
                    <button onClick={onClose} className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors">Cancel</button>
                    <button
                        onClick={handlePatch}
                        disabled={submitting || !reason.trim()}
                        className="flex-1 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-400 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? 'Applying…' : 'Apply Patch'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}

// ── Checkpoint Row ─────────────────────────────────────────────────────────────

function CheckpointRow({
    cp,
    index,
    executionId,
}: {
    cp: Checkpoint
    index: number
    executionId: string
}) {
    const [expanded, setExpanded] = useState(false)
    const [forking, setForking] = useState(false)
    const [forked, setForked] = useState<string | null>(null)
    const [forkError, setForkError] = useState<string | null>(null)
    const [viewModal, setViewModal] = useState<'input' | 'output' | null>(null)

    const handleFork = useCallback(async () => {
        setForking(true)
        setForkError(null)
        try {
            const res = await fetch(
                `/api/v1/executions/${executionId}/resume?from_node=${encodeURIComponent(cp.node_id)}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' } }
            )
            if (!res.ok) throw new Error(`Server returned ${res.status}`)
            const data = await res.json()
            setForked(data.id)
        } catch (e) {
            setForkError(e instanceof Error ? e.message : 'Fork failed')
        } finally {
            setForking(false)
        }
    }, [executionId, cp.node_id])

    const cost = costLabel(cp.cost_usd)
    const duration = durationLabel(cp.duration_ms)

    return (
        <>
            <div
                className={`relative border-b border-border last:border-b-0 ${expanded ? 'bg-muted/30' : ''}`}
            >
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" style={{ top: index === 0 ? '50%' : 0 }} />

                <div className="pl-8 pr-3 py-2.5">
                    {/* Main row */}
                    <div className="flex items-start gap-2">
                        {/* Dot on timeline */}
                        <div className="absolute left-[13px] top-1/2 -translate-y-1/2 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-card border border-border z-10">
                            <div className={`h-1.5 w-1.5 rounded-full ${cp.status === 'completed' ? 'bg-green-400' : cp.status === 'failed' ? 'bg-red-400' : cp.status === 'skipped' ? 'bg-muted-foreground' : 'bg-blue-400'}`} />
                        </div>

                        <StatusIcon status={cp.status} />

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                                    {cp.node_label || cp.node_id}
                                </span>
                                {cp.node_type && (
                                    <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                                        {cp.node_type}
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span>{duration}</span>
                                {cost && <span className="text-emerald-500">{cost}</span>}
                                {cp.error_message && (
                                    <span className="text-red-400 truncate max-w-[120px]" title={cp.error_message}>
                                        {cp.error_message}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Expand toggle */}
                        <button
                            onClick={() => setExpanded((x) => !x)}
                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                        >
                            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                    </div>

                    {/* Fork result */}
                    <AnimatePresence>
                        {forked && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1.5 rounded-md bg-green-500/10 border border-green-500/30 px-2 py-1.5">
                                    <p className="text-[10px] text-green-400">
                                        ✓ Forked as execution <span className="font-mono">{forked.slice(0, 8)}…</span>
                                    </p>
                                </div>
                            </motion.div>
                        )}
                        {forkError && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1.5 rounded-md bg-red-500/10 border border-red-500/30 px-2 py-1.5">
                                    <p className="text-[10px] text-red-400">{forkError}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Expanded actions */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-border/50"
                        >
                            <div className="pl-8 pr-3 py-2 flex items-center gap-1.5 flex-wrap">
                                {/* Fork */}
                                <button
                                    onClick={handleFork}
                                    disabled={forking}
                                    className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                                >
                                    {forking ? (
                                        <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                                    ) : (
                                        <GitFork className="h-3 w-3 text-primary" />
                                    )}
                                    Fork from here
                                </button>

                                {/* View input */}
                                {cp.input_snapshot && (
                                    <button
                                        onClick={() => setViewModal('input')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent transition-colors"
                                    >
                                        <Eye className="h-3 w-3 text-blue-400" />
                                        View Input
                                    </button>
                                )}

                                {/* View output */}
                                {cp.output_snapshot && (
                                    <button
                                        onClick={() => setViewModal('output')}
                                        className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-accent transition-colors"
                                    >
                                        <Eye className="h-3 w-3 text-green-400" />
                                        View Output
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {viewModal === 'input' && cp.input_snapshot && (
                    <JsonModal
                        key="input-modal"
                        title={`Input — ${cp.node_label || cp.node_id}`}
                        data={cp.input_snapshot}
                        onClose={() => setViewModal(null)}
                    />
                )}
                {viewModal === 'output' && cp.output_snapshot && (
                    <JsonModal
                        key="output-modal"
                        title={`Output — ${cp.node_label || cp.node_id}`}
                        data={cp.output_snapshot}
                        onClose={() => setViewModal(null)}
                    />
                )}
            </AnimatePresence>
        </>
    )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function StateHistoryPanel() {
    const { reviewExecutionId, reviewCheckpoints } = useCanvasStore()
    const [showPatch, setShowPatch] = useState(false)

    const checkpoints = reviewCheckpoints as Checkpoint[]

    if (!reviewExecutionId) return null

    const completedCount = checkpoints.filter((c) => c.status === 'completed').length
    const totalCost = checkpoints.reduce((sum, c) => sum + (c.cost_usd ?? 0), 0)
    const totalDuration = checkpoints.reduce((sum, c) => sum + (c.duration_ms ?? 0), 0)

    return (
        <>
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="border-b border-border px-4 py-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-primary" />
                                Execution Timeline
                            </p>
                            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground truncate">
                                {reviewExecutionId}
                            </p>
                        </div>
                        <button
                            onClick={() => setShowPatch(true)}
                            className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                            <PenTool className="h-3 w-3" />
                            Patch State
                        </button>
                    </div>

                    {/* Summary metrics */}
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                            { label: 'Nodes', value: `${completedCount}/${checkpoints.length}` },
                            { label: 'Duration', value: durationLabel(totalDuration) },
                            { label: 'Cost', value: totalCost > 0 ? `$${totalCost.toFixed(4)}` : '—' },
                        ].map((m) => (
                            <div key={m.label} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                                <p className="text-xs font-semibold text-foreground">{m.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto relative">
                    {checkpoints.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
                            <p className="text-xs text-muted-foreground">No checkpoint data available.</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                Run an execution first, then enter Review mode.
                            </p>
                        </div>
                    ) : (
                        <div className="relative">
                            {checkpoints.map((cp, i) => (
                                <CheckpointRow
                                    key={cp.checkpoint_id || cp.node_id + i}
                                    cp={cp}
                                    index={i}
                                    executionId={reviewExecutionId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Patch modal */}
            <AnimatePresence>
                {showPatch && (
                    <PatchModal
                        key="patch-modal"
                        executionId={reviewExecutionId}
                        onClose={() => setShowPatch(false)}
                    />
                )}
            </AnimatePresence>
        </>
    )
}
