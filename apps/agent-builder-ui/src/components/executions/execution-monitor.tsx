import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, CircleDashed, XCircle, PlayCircle, Loader2 } from 'lucide-react'
import { useExecutionStream, ExecutionEvent } from '@/hooks/useExecutionStream'

function EventIcon({ type }: { type: ExecutionEvent['type'] }) {
    switch (type) {
        case 'execution_start': return <PlayCircle className="h-4 w-4 text-blue-500" />
        case 'node_start': return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
        case 'node_finish': return <CheckCircle2 className="h-4 w-4 text-green-500" />
        case 'node_error': return <XCircle className="h-4 w-4 text-destructive" />
        case 'execution_finish': return <CheckCircle2 className="h-4 w-4 text-primary" />
        default: return <CircleDashed className="h-4 w-4 text-muted-foreground" />
    }
}

export function ExecutionMonitor({ executionId }: { executionId: string | null }) {
    const { events, status } = useExecutionStream(executionId)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [events])

    if (!executionId) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <CircleDashed className="mb-4 h-8 w-8 text-muted/50" />
                <p className="text-sm font-medium">No Execution Selected</p>
                <p className="text-xs">Run a test to see live events</p>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Execution Monitor</h3>
                <span className="flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <div className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                    {status}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="space-y-4">
                    {events.map((ev, i) => (
                        <motion.div
                            key={`${ev.timestamp}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="group relative flex gap-3 pb-4 last:pb-0"
                        >
                            {i !== events.length - 1 && (
                                <div className="absolute left-[7px] top-6 bottom-0 w-px bg-border group-last:hidden" />
                            )}

                            <div className="relative z-10 mt-0.5 rounded-full bg-background">
                                <EventIcon type={ev.type} />
                            </div>

                            <div className="flex-1 flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground capitalize">
                                        {ev.type.replace('_', ' ')}
                                        {ev.node_id && <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-xs font-mono lowercase">{ev.node_id}</span>}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {new Date(ev.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>

                                {ev.data && (
                                    <div className="rounded bg-muted/50 p-2 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(ev.data, null, 2)}
                                    </div>
                                )}

                                {ev.error && (
                                    <div className="rounded bg-destructive/10 border border-destructive/20 p-2 text-xs font-mono text-destructive overflow-x-auto">
                                        {ev.error}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    )
}
