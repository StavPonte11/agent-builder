/**
 * ReviewModeTimeline — Time-machine scrubber for replaying past executions.
 * Shows a timeline of all node events with scrubbing, split I/O panel, re-run.
 */
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, SkipBack, SkipForward, ExternalLink, RotateCcw, FileDown, X } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'

interface Checkpoint {
    id: string
    node_id: string
    node_label: string
    node_type: string
    status: 'completed' | 'failed' | 'skipped'
    started_at: string
    completed_at: string
    duration_ms: number
    input_snapshot: unknown
    output_snapshot: unknown
    error_message?: string
    token_usage?: { prompt: number; completion: number; total: number }
    cost_usd?: number
}

function formatJson(val: unknown): string {
    try { return JSON.stringify(val, null, 2) } catch { return String(val) }
}

function getDurationPercentile(checkpoints: Checkpoint[], ms: number): number {
    const sorted = [...checkpoints].sort((a, b) => a.duration_ms - b.duration_ms)
    const idx = sorted.findIndex((c) => c.duration_ms >= ms)
    return idx < 0 ? 1 : idx / Math.max(sorted.length - 1, 1)
}

const heatColor = (pct: number) => {
    // Green (fast) → Yellow → Red (slow)
    if (pct < 0.33) return 'bg-green-500/40 border-green-500/30'
    if (pct < 0.66) return 'bg-amber-500/40 border-amber-500/30'
    return 'bg-red-500/40 border-red-500/30'
}

export function ReviewModeTimeline() {
    const reviewExecutionId = useCanvasStore((s) => s.reviewExecutionId)
    const reviewCheckpoints = useCanvasStore((s) => s.reviewCheckpoints) as Checkpoint[]
    const stopReview = useCanvasStore((s) => s.stopReview)
    const setCanvasMode = useCanvasStore((s) => s.setCanvasMode)
    const updateNodeExecution = useCanvasStore((s) => s.updateNodeExecution)

    const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null)
    const [ioTab, setIoTab] = useState<'input' | 'output'>('output')
    const [playing, setPlaying] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [rerunLoading, setRerunLoading] = useState(false)

    // Apply checkpoint state to canvas nodes when step changes
    useEffect(() => {
        const visible = reviewCheckpoints.slice(0, currentStep + 1)
        // Reset all
        reviewCheckpoints.forEach((cp) => {
            updateNodeExecution(cp.node_id, { status: 'idle', outputPreview: undefined })
        })
        // Apply visible ones
        visible.forEach((cp) => {
            updateNodeExecution(cp.node_id, {
                status: cp.status === 'skipped' ? 'skipped' : cp.status,
                outputPreview: cp.output_snapshot ? formatJson(cp.output_snapshot).slice(0, 200) : undefined,
                durationMs: cp.duration_ms,
                inputSnapshot: cp.input_snapshot,
                outputSnapshot: cp.output_snapshot,
                errorMessage: cp.error_message,
            })
        })
    }, [currentStep, reviewCheckpoints, updateNodeExecution])

    // Auto-play
    useEffect(() => {
        if (!playing) return
        if (currentStep >= reviewCheckpoints.length - 1) { setPlaying(false); return }
        const timer = setTimeout(() => setCurrentStep((s) => s + 1), 800)
        return () => clearTimeout(timer)
    }, [playing, currentStep, reviewCheckpoints.length])

    const totalDurationMs = useMemo(() => {
        if (!reviewCheckpoints.length) return 0
        const last = reviewCheckpoints[reviewCheckpoints.length - 1]
        return new Date(last.completed_at).getTime() - new Date(reviewCheckpoints[0].started_at).getTime()
    }, [reviewCheckpoints])

    const handleRerun = async () => {
        if (!reviewExecutionId) return
        setRerunLoading(true)
        try {
            const res = await fetch(`/api/v1/executions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rerun_execution_id: reviewExecutionId }),
            })
            if (res.ok) {
                const newExec = await res.json()
                const { startExecution } = useCanvasStore.getState()
                startExecution(newExec.id, reviewCheckpoints.length)
            }
        } finally {
            setRerunLoading(false)
        }
    }

    const handleRerunFromNode = async (nodeId: string) => {
        if (!reviewExecutionId) return
        try {
            const res = await fetch(`/api/v1/executions/${reviewExecutionId}/resume?from_node=${nodeId}`, { method: 'POST' })
            if (res.ok) {
                const newExec = await res.json()
                const { startExecution } = useCanvasStore.getState()
                startExecution(newExec.id, reviewCheckpoints.length)
            }
        } catch (e) { console.error(e) }
    }

    const handleExportReport = () => {
        if (!reviewExecutionId) return
        window.open(`/api/v1/executions/${reviewExecutionId}/report`, '_blank')
    }

    if (!reviewCheckpoints.length) {
        return (
            <div className="border-t border-border bg-card/80 px-6 py-4 flex items-center justify-center gap-3">
                <p className="text-sm text-muted-foreground">No checkpoint data available for this execution.</p>
                <button onClick={() => setCanvasMode('build')} className="text-sm text-primary hover:underline">← Back to Build</button>
            </div>
        )
    }

    return (
        <div className="border-t border-border bg-card/90 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <span className="text-xs font-semibold text-foreground">Review Mode</span>
                <span className="text-[10px] text-muted-foreground">Execution {reviewExecutionId?.slice(0, 8)}…</span>
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={handleRerun} disabled={rerunLoading} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50">
                        <RotateCcw className="h-3.5 w-3.5" /> Re-run
                    </button>
                    <button onClick={handleExportReport} className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent">
                        <FileDown className="h-3.5 w-3.5" /> Export
                    </button>
                    <button onClick={() => setCanvasMode('build')} className="text-xs text-muted-foreground hover:text-foreground">
                        ← Build
                    </button>
                </div>
            </div>

            {/* Split: Timeline + I/O panel */}
            <div className="flex gap-0 h-44">
                {/* Timeline scrubber */}
                <div className="flex-1 overflow-x-auto px-4 py-3">
                    <div className="flex items-end gap-1.5 h-full min-w-max">
                        {reviewCheckpoints.map((cp, idx) => {
                            const pct = getDurationPercentile(reviewCheckpoints, cp.duration_ms)
                            const barHeight = 20 + Math.round(pct * 60)
                            const isActive = idx <= currentStep
                            const isCurrent = idx === currentStep
                            return (
                                <button
                                    key={cp.id}
                                    onClick={() => { setCurrentStep(idx); setSelectedCheckpoint(cp) }}
                                    title={`${cp.node_label} — ${cp.duration_ms}ms`}
                                    className={`flex flex-col items-center gap-1 rounded transition-all ${isCurrent ? 'scale-110' : ''}`}
                                >
                                    <div
                                        className={`w-8 rounded-t-sm border transition-all ${isActive ? heatColor(pct) : 'bg-muted/30 border-border/30'} ${cp.status === 'failed' ? '!bg-red-500/50 !border-red-500' : ''} ${cp.status === 'skipped' ? 'opacity-30' : ''}`}
                                        style={{ height: `${barHeight}px` }}
                                    />
                                    <span className="max-w-[32px] text-[8px] text-muted-foreground truncate leading-tight text-center">{cp.node_label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Playback controls */}
                <div className="flex flex-col items-center justify-center gap-2 px-3 border-l border-border">
                    <button onClick={() => setCurrentStep(0)} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground">
                        <SkipBack className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setPlaying((p) => !p)}
                        className="rounded-full bg-primary p-2 text-primary-foreground hover:bg-primary/90"
                    >
                        <Play className="h-4 w-4" />
                    </button>
                    <button onClick={() => setCurrentStep(reviewCheckpoints.length - 1)} className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground">
                        <SkipForward className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] font-mono text-muted-foreground mt-1">{currentStep + 1}/{reviewCheckpoints.length}</span>
                </div>

                {/* I/O Panel */}
                <AnimatePresence>
                    {selectedCheckpoint && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="border-l border-border bg-card overflow-hidden flex flex-col"
                        >
                            <div className="flex items-center gap-1 border-b border-border px-3 py-2 shrink-0">
                                <button
                                    onClick={() => setIoTab('input')}
                                    className={`rounded px-2 py-0.5 text-xs font-medium transition ${ioTab === 'input' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    INPUT
                                </button>
                                <button
                                    onClick={() => setIoTab('output')}
                                    className={`rounded px-2 py-0.5 text-xs font-medium transition ${ioTab === 'output' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                    OUTPUT
                                </button>
                                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{selectedCheckpoint.duration_ms}ms</span>
                                <button onClick={() => setSelectedCheckpoint(null)} className="text-muted-foreground hover:text-foreground ml-1">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                                    {ioTab === 'input'
                                        ? formatJson(selectedCheckpoint.input_snapshot)
                                        : selectedCheckpoint.status === 'failed'
                                            ? `ERROR: ${selectedCheckpoint.error_message}`
                                            : formatJson(selectedCheckpoint.output_snapshot)
                                    }
                                </pre>
                            </div>
                            {selectedCheckpoint.status !== 'skipped' && (
                                <div className="border-t border-border px-3 py-2 shrink-0">
                                    <button
                                        onClick={() => handleRerunFromNode(selectedCheckpoint.node_id)}
                                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
                                    >
                                        ↺ Re-run from {selectedCheckpoint.node_label}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Slider */}
            <div className="px-4 py-2 border-t border-border">
                <input
                    type="range"
                    min={0}
                    max={Math.max(0, reviewCheckpoints.length - 1)}
                    value={currentStep}
                    onChange={(e) => {
                        const idx = Number(e.target.value)
                        setCurrentStep(idx)
                        setSelectedCheckpoint(reviewCheckpoints[idx] ?? null)
                    }}
                    className="w-full h-1 accent-primary"
                />
            </div>
        </div>
    )
}
