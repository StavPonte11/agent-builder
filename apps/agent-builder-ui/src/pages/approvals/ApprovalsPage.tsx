/**
 * ApprovalsPage — Human-in-the-loop review dashboard.
 * Shows pending executions waiting for approval, allowing
 * admins to review context, approve, or reject.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { Check, X, Clock, Play, FileText, Activity, AlertCircle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ApprovalRequest {
    execution_id: string
    blueprint_id: string
    blueprint_name: string
    node_id: string
    status: 'pending' | 'approved' | 'rejected'
    requested_at: string
    resolved_at: string | null
    context: Record<string, any>
    prompt_text?: string
}

// ─── Components ───────────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center max-w-sm mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground mb-4">
                <Check className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground">You're all caught up!</h3>
            <p className="text-sm text-muted-foreground mt-2">
                There are no pending executions waiting for human approval. Kick back and relax.
            </p>
        </div>
    )
}

function ApprovalCard({ req }: { req: ApprovalRequest }) {
    const qc = useQueryClient()
    const [expanded, setExpanded] = useState(false)
    const [reason, setReason] = useState('')

    const respond = useMutation({
        mutationFn: (action: 'approve' | 'reject') =>
            fetch(`/api/v1/executions/${req.execution_id}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, reason }),
            }).then(r => r.json()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['approvals'] })
            qc.invalidateQueries({ queryKey: ['analytics'] })
        },
    })

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
        >
            {/* Header / Summary */}
            <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-semibold text-foreground truncate">{req.blueprint_name}</h3>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {req.execution_id.split('-')[0]}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Activity className="h-3 w-3" /> Node: <span className="font-mono">{req.node_id}</span>
                        <span className="text-border mx-1">•</span>
                        Waiting {formatDistanceToNow(new Date(req.requested_at))}
                    </p>
                </div>

                {!expanded && (
                    <div className="flex gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); respond.mutate('reject') }}
                            disabled={respond.isPending}
                            className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); respond.mutate('approve') }}
                            disabled={respond.isPending}
                            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                            <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                    </div>
                )}
            </div>

            {/* Expanded Detailed Review */}
            {expanded && (
                <div className="border-t border-border bg-muted/10 p-5 space-y-5">
                    {req.prompt_text && (
                        <div>
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                <AlertCircle className="h-3.5 w-3.5" /> Review Instructions
                            </h4>
                            <p className="text-sm text-foreground bg-background rounded-xl border border-border p-3">
                                {req.prompt_text}
                            </p>
                        </div>
                    )}

                    <div>
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            <FileText className="h-3.5 w-3.5" /> Execution Context State
                        </h4>
                        <div className="rounded-xl border border-border bg-background overflow-hidden">
                            <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto max-h-64 custom-scrollbar">
                                {JSON.stringify(req.context, null, 2)}
                            </pre>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <input
                            type="text"
                            placeholder="Optional: Provide a reason or feedback for your decision..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="flex-1 w-full sm:max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => respond.mutate('reject')}
                                disabled={respond.isPending}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                            >
                                <X className="h-4 w-4" /> Reject Execution
                            </button>
                            <button
                                onClick={() => respond.mutate('approve')}
                                disabled={respond.isPending}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                <Play className="h-4 w-4" /> Approve & Resume
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    )
}

function HistoryCard({ req }: { req: ApprovalRequest }) {
    const isApproved = req.status === 'approved'

    return (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card shadow-sm opacity-75">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isApproved ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {isApproved ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{req.blueprint_name}</p>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${isApproved ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                        {req.status}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono">{req.execution_id.split('-')[0]}</span>
                    <span>•</span>
                    {req.resolved_at ? formatDistanceToNow(new Date(req.resolved_at)) + ' ago' : 'Unknown time'}
                </p>
            </div>
            <button className="text-xs text-muted-foreground underline hover:text-foreground">
                View Details
            </button>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
    const [tab, setTab] = useState<'pending' | 'history'>('pending')

    const { data: approvals = [], isLoading } = useQuery<ApprovalRequest[]>({
        queryKey: ['approvals'],
        queryFn: () => fetch('/api/v1/approvals').then(r => r.json()),
        refetchInterval: 10_000,
    })

    const pending = approvals.filter(a => a.status === 'pending')
    const history = approvals.filter(a => a.status !== 'pending')

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Human Approvals</h1>
                        <p className="text-sm text-muted-foreground">Review and authorize pending workflow executions</p>
                    </div>
                </div>
                {/* Tabs */}
                <div className="max-w-5xl mx-auto px-6 flex gap-6">
                    {(['pending', 'history'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`relative pb-3 text-sm font-medium transition-colors ${tab === t ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                            {t === 'pending' && pending.length > 0 && (
                                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                                    {pending.length}
                                </span>
                            )}
                            {tab === t && (
                                <motion.div layoutId="approval-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
                    </div>
                ) : tab === 'pending' ? (
                    pending.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <div className="space-y-4">
                            {pending.map(req => (
                                <ApprovalCard key={req.execution_id + req.node_id} req={req} />
                            ))}
                        </div>
                    )
                ) : (
                    history.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground text-sm">No approval history found.</div>
                    ) : (
                        <div className="space-y-3">
                            {history.map(req => (
                                <HistoryCard key={req.execution_id + req.node_id} req={req} />
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
