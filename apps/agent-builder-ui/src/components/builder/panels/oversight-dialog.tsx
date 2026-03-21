/**
 * OversightDialog — Aviation-Style HITL Approval Component
 *
 * When a Human Approval node is reached, this dialog presents a mandatory
 * 4-item checklist that must ALL be checked before the user can confirm.
 * This prevents accidental approvals and ensures structured oversight.
 *
 * Triggered by: canvasStore.pendingApproval (set via WebSocket events)
 */
import { useState, useCallback } from 'react'
import { ShieldCheck, ShieldX, AlertTriangle, Clock, User, Zap, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '@/stores/canvasStore'

// ── Checklist item model ──────────────────────────────────────────────────────

interface ChecklistItem {
    id: string
    label: string
    description: string
    icon: React.ReactNode
}

const OVERSIGHT_CHECKLIST: ChecklistItem[] = [
    {
        id: 'intent',
        label: 'Intent Verified',
        description: 'I have read the context and understand what this action will perform.',
        icon: <User className="h-4 w-4 text-blue-400" />,
    },
    {
        id: 'data_lineage',
        label: 'Data Lineage Confirmed',
        description: 'I have verified the input data is from a trusted, expected source.',
        icon: <Zap className="h-4 w-4 text-purple-400" />,
    },
    {
        id: 'permissions',
        label: 'Permissions Authorised',
        description: 'I am authorised to approve this action on behalf of my organisation.',
        icon: <ShieldCheck className="h-4 w-4 text-green-400" />,
    },
    {
        id: 'blast_radius',
        label: 'Blast Radius Acceptable',
        description: 'I understand the scope of impact and it is within acceptable limits.',
        icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    },
]

// ── Main component ──────────────────────────────────────────────────────────

interface OversightDialogProps {
    executionId: string
}

export function OversightDialog({ executionId }: OversightDialogProps) {
    const { pendingApproval, setPendingApproval } = useCanvasStore()
    const [checked, setChecked] = useState<Record<string, boolean>>({})
    const [feedback, setFeedback] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const allChecked = OVERSIGHT_CHECKLIST.every((item) => checked[item.id])
    const checkedCount = Object.values(checked).filter(Boolean).length

    const toggle = useCallback((id: string) => {
        setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
    }, [])

    const submit = useCallback(
        async (approved: boolean) => {
            if (!pendingApproval) return
            setSubmitting(true)
            setError(null)
            try {
                const res = await fetch(
                    `/api/v1/executions/${executionId}/approve`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            node_id: pendingApproval.nodeId,
                            approved,
                            feedback: approved ? `Approved via checklist [${Object.keys(checked).join(', ')}]` : (feedback || 'Rejected by reviewer'),
                        }),
                    }
                )
                if (!res.ok) throw new Error(`Server returned ${res.status}`)
                setPendingApproval(null)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to submit approval')
            } finally {
                setSubmitting(false)
            }
        },
        [pendingApproval, executionId, checked, feedback, setPendingApproval]
    )

    if (!pendingApproval) return null

    const expiresAt = new Date(
        new Date(pendingApproval.createdAt).getTime() + pendingApproval.timeoutMinutes * 60000
    )
    const minutesLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 60000))

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            {/* Dialog */}
            <motion.div
                key="dialog"
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
                <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">

                    {/* Header */}
                    <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30">
                            <ShieldCheck className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                                Structured Oversight Required
                            </p>
                            <h2 className="mt-0.5 text-base font-semibold text-foreground truncate">
                                {pendingApproval.nodeId}
                            </h2>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{minutesLeft}m remaining</span>
                            </div>
                        </div>
                    </div>

                    {/* Context */}
                    <div className="px-5 py-3 border-b border-border bg-muted/30">
                        <p className="text-sm text-foreground leading-relaxed">{pendingApproval.context}</p>
                    </div>

                    {/* Checklist */}
                    <div className="px-5 py-4 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Authorisation Checklist ({checkedCount}/{OVERSIGHT_CHECKLIST.length})
                        </p>

                        {OVERSIGHT_CHECKLIST.map((item) => {
                            const isChecked = !!checked[item.id]
                            return (
                                <motion.button
                                    key={item.id}
                                    onClick={() => toggle(item.id)}
                                    whileHover={{ scale: 1.005 }}
                                    whileTap={{ scale: 0.995 }}
                                    className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
                                        isChecked
                                            ? 'border-green-500/40 bg-green-500/10'
                                            : 'border-border bg-background hover:border-muted-foreground/40'
                                    }`}
                                >
                                    {/* Custom checkbox */}
                                    <div
                                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all duration-200 ${
                                            isChecked
                                                ? 'border-green-500 bg-green-500'
                                                : 'border-muted-foreground/40 bg-background'
                                        }`}
                                    >
                                        {isChecked && (
                                            <motion.svg
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                viewBox="0 0 12 10"
                                                className="h-2.5 w-2.5 fill-none stroke-white stroke-2"
                                            >
                                                <polyline points="1,5 4,9 11,1" />
                                            </motion.svg>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            {item.icon}
                                            <span className={`text-sm font-medium ${isChecked ? 'text-green-400' : 'text-foreground'}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                                            {item.description}
                                        </p>
                                    </div>
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* Rejection feedback */}
                    <AnimatePresence>
                        {!allChecked && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-5 pb-3">
                                    <textarea
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Rejection reason (optional)…"
                                        rows={2}
                                        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error */}
                    {error && (
                        <div className="mx-5 mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 border-t border-border px-5 py-4">
                        <button
                            onClick={() => submit(false)}
                            disabled={submitting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-all duration-200"
                        >
                            <ShieldX className="h-4 w-4" />
                            Reject
                        </button>

                        <button
                            onClick={() => submit(true)}
                            disabled={!allChecked || submitting}
                            title={!allChecked ? 'Complete all checklist items to confirm' : undefined}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40 transition-all duration-200"
                        >
                            {submitting ? (
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                                    className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                                />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                            {submitting ? 'Submitting…' : 'Confirm All Checks'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
