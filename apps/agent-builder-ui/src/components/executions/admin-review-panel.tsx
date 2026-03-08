import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Clock, AlertTriangle } from 'lucide-react'

interface PendingApproval {
    execution_id: string
    node_id: string
    blueprint_id: string
    status: 'pending'
    requested_at: string
    summary: string
}

export function AdminReviewPanel() {
    const [approvals, setApprovals] = useState<PendingApproval[]>([
        {
            execution_id: 'exec-101',
            node_id: 'node-human-approval',
            blueprint_id: 'bp-marketing',
            status: 'pending',
            requested_at: new Date().toISOString(),
            summary: 'Generated email copy for campaign ID 445. Needs human review before sending via SendGrid.'
        }
    ])

    const handleDecision = (id: string, decision: 'approved' | 'rejected') => {
        // STUB: Hit the Temporal signals endpoint
        console.log(`Execution ${id} was ${decision}`)
        setApprovals(prev => prev.filter(a => a.execution_id !== id))
    }

    return (
        <div className="flex h-full w-full flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground">Action Required</h3>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-500">{approvals.length}</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                {approvals.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                        <Check className="mb-2 h-8 w-8 text-green-500/50" />
                        <p className="text-sm">All caught up!</p>
                        <p className="text-xs">No pending execution approvals.</p>
                    </div>
                ) : (
                    approvals.map(app => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            key={app.execution_id}
                            className="rounded-lg border border-border bg-background p-4 shadow-sm transition-all hover:border-primary/50"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground">Execution {app.execution_id}</h4>
                                    <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        {new Date(app.requested_at).toLocaleTimeString()}
                                    </span>
                                </div>
                                <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono truncate max-w-[120px]">{app.blueprint_id}</span>
                            </div>

                            <div className="my-3 rounded bg-muted/50 p-3 text-sm text-foreground">
                                {app.summary}
                            </div>

                            <div className="flex w-full gap-2 pt-2">
                                <button
                                    onClick={() => handleDecision(app.execution_id, 'rejected')}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleDecision(app.execution_id, 'approved')}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                                >
                                    <Check className="h-3.5 w-3.5" />
                                    Approve
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    )
}
