/**
 * ExecutionOverlay — Fixed HUD shown during Execute Mode.
 * Top bar: cost, tokens, budget %, elapsed time, progress.
 * Approval banner: full-width with context + approve/reject.
 * LLM streaming: floating chip above active LLM nodes.
 */
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Zap, DollarSign, Loader2, SkipForward, TerminalSquare, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useExecutionStream } from '@/hooks/useExecutionStream'
import { cn } from '@/lib/utils'

// ─── Elapsed Timer ───────────────────────────────────────────────────────────

function ElapsedTimer() {
    const [elapsed, setElapsed] = useState(0)
    const startRef = useRef(Date.now())

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
    const ss = String(elapsed % 60).padStart(2, '0')
    return <span className="font-mono">{mm}:{ss}</span>
}

// ─── Approval Banner ─────────────────────────────────────────────────────────

function ApprovalBanner() {
    const approval = useCanvasStore((s) => s.pendingApproval)
    const activeExecutionId = useCanvasStore((s) => s.activeExecutionId)
    const [approving, setApproving] = useState(false)
    const [rejecting, setRejecting] = useState(false)

    const handleDecision = async (decision: 'approve' | 'reject') => {
        if (!activeExecutionId || !approval) return
        const setter = decision === 'approve' ? setApproving : setRejecting
        setter(true)
        try {
            await fetch(`/api/v1/executions/${activeExecutionId}/approvals/${approval.approvalId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision }),
            })
        } finally {
            setter(false)
        }
    }

    const [timeLeft, setTimeLeft] = useState<number>(approval?.timeoutMinutes ? approval.timeoutMinutes * 60 : 0)

    useEffect(() => {
        if (!approval) return
        const expiry = new Date(approval.createdAt).getTime() + (approval.timeoutMinutes * 60 * 1000)
        const interval = setInterval(() => {
            setTimeLeft(Math.max(0, Math.floor((expiry - Date.now()) / 1000)))
        }, 1000)
        return () => clearInterval(interval)
    }, [approval])

    return (
        <AnimatePresence>
            {approval && (
                <motion.div
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -80, opacity: 0 }}
                    className="absolute left-4 right-4 top-16 z-30 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-2xl backdrop-blur-sm"
                >
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                            <Clock className="h-5 w-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-foreground">Human Approval Required</p>
                                <span className="font-mono text-xs text-amber-600">
                                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} remaining
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">{approval.context || 'Review and approve to continue execution.'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <button
                                onClick={() => handleDecision('reject')}
                                disabled={rejecting || approving}
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                                {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                Reject
                            </button>
                            <button
                                onClick={() => handleDecision('approve')}
                                disabled={approving || rejecting}
                                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                            >
                                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Approve
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// ─── Streaming Chip ────────────────────────────────────────────────────────────

function StreamingChips() {
    const nodeExecutionData = useCanvasStore((s) => s.nodeExecutionData)

    const streamingNodes = Object.entries(nodeExecutionData)
        .filter(([, d]) => d.status === 'running' && d.streamingChunk && d.streamingChunk.length > 0)

    return (
        <div className="absolute left-72 top-16 z-20 space-y-2">
            {streamingNodes.map(([nodeId, d]) => (
                <motion.div
                    key={nodeId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xs rounded-xl border border-purple-500/30 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
                >
                    <p className="text-[10px] font-medium text-purple-500 mb-1">Streaming…</p>
                    <p className="text-[11px] text-foreground line-clamp-3 font-mono leading-relaxed">
                        {(d.streamingChunk ?? '').slice(-300)}
                        <span className="inline-block h-3.5 w-0.5 bg-purple-500 animate-pulse align-bottom ml-0.5" />
                    </p>
                </motion.div>
            ))}
        </div>
    )
}

// ─── Live Logs Drawer ─────────────────────────────────────────────────────────

function LiveLogsDrawer() {
    const [isOpen, setIsOpen] = useState(false)
    const logs = useCanvasStore((s) => (s as any).executionLogs) || []
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (isOpen && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, isOpen])

    return (
        <div className={cn(
            "absolute right-0 top-16 bottom-16 z-30 flex transition-all duration-300 ease-in-out",
            isOpen ? "w-80" : "w-10"
        )}>
            {/* Toggle Tab */}
            <div 
                className="absolute -left-10 top-4 flex h-10 w-10 cursor-pointer items-center justify-center rounded-l-lg border border-r-0 border-border bg-card/95 shadow-md backdrop-blur-sm hover:bg-accent transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <TerminalSquare className="h-4 w-4 text-muted-foreground" />}
            </div>

            {/* Panel */}
            <div className={cn(
                "h-full w-full border-l border-border bg-card/95 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col transition-opacity duration-300",
                isOpen ? "opacity-100" : "opacity-0"
            )}>
                <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4 py-2 bg-muted/30">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                        <TerminalSquare className="h-3.5 w-3.5" />
                        Live Logs
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] leading-relaxed">
                    {logs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Waiting for logs...
                        </div>
                    ) : (
                        logs.map((log: any, i: number) => (
                            <div key={i} className="mb-1 text-muted-foreground whitespace-pre-wrap">
                                <span className="text-blue-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                                <span className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-foreground'}>
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    )
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────

export function ExecutionOverlay() {
    const activeExecutionId = useCanvasStore((s) => s.activeExecutionId)
    const meta = useCanvasStore((s) => s.executionMeta)
    const setCanvasMode = useCanvasStore((s) => s.setCanvasMode)
    const startReview = useCanvasStore((s) => s.startReview)
    const isStreaming = useCanvasStore((s) => s.isExecutionStreaming)

    useExecutionStream({
        executionId: activeExecutionId,
        onComplete: () => {
            // Offer review mode when done
        },
        onError: (err) => {
            console.error('[Execution]', err)
        },
    })

    const progressPct = meta.totalNodes > 0
        ? Math.round((meta.completedNodes / meta.totalNodes) * 100)
        : 0

    const handleCancel = async () => {
        if (!activeExecutionId) return
        await fetch(`/api/v1/executions/${activeExecutionId}/cancel`, { method: 'POST' })
    }

    return (
        <>
            {/* Top HUD bar */}
            <div className="absolute left-4 right-4 top-2 z-20 flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-sm">
                {/* Status */}
                <div className="flex items-center gap-1.5">
                    {isStreaming ? (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <span className="text-xs font-semibold text-foreground">
                        {isStreaming ? 'Executing…' : 'Completed'}
                    </span>
                </div>

                <div className="h-4 w-px bg-border" />

                {/* Elapsed */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <ElapsedTimer />
                </div>

                {/* Tokens */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="font-mono">{meta.cumulativeTokens.toLocaleString()} tok</span>
                </div>

                {/* Cost */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="font-mono">${meta.cumulativeCostUsd.toFixed(4)}</span>
                    {meta.estimatedCostUsd && (
                        <span className="text-[10px] text-muted-foreground">/ ${meta.estimatedCostUsd.toFixed(4)} est.</span>
                    )}
                </div>

                {/* Budget bar */}
                {meta.budgetPctUsed > 0 && (
                    <div className="flex items-center gap-1.5 flex-1 max-w-32">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${meta.budgetPctUsed > 90 ? 'bg-red-500' : meta.budgetPctUsed > 70 ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(100, meta.budgetPctUsed)}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{Math.round(meta.budgetPctUsed)}%</span>
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2">
                    {!isStreaming && (
                        <button
                            onClick={() => setCanvasMode('review')}
                            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
                        >
                            Review Results →
                        </button>
                    )}
                    {isStreaming && (
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/20"
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={() => setCanvasMode('build')}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        ← Back to Build
                    </button>
                </div>
            </div>

            {/* Bottom progress bar */}
            <div className="absolute bottom-2 left-4 right-4 z-20">
                <div className="rounded-xl border border-border bg-card/90 px-4 py-2 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Progress</span>
                        <span className="text-xs font-medium text-foreground">
                            {meta.completedNodes}/{meta.totalNodes} nodes
                        </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-primary"
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                    </div>
                </div>
            </div>

            {/* Approval Banner */}
            <ApprovalBanner />

            {/* Streaming Chips */}
            <StreamingChips />
            
            {/* Live Logs Drawer */}
            <LiveLogsDrawer />
        </>
    )
}
