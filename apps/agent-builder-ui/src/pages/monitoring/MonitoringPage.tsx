/**
 * MonitoringPage — Builder-facing trace view.
 *
 * Requirement 2: Monitoring and tracing for builders (not just admins)
 * ──────────────────────────────────────────────────────────────────────
 * Features:
 * - Paginated execution traces for the org (filter by blueprint, status, time)
 * - Per-execution node timing breakdown (Gantt-style bar chart)
 * - Tool health summary cards
 * - Langfuse trace link on every row
 * - "Replay in Canvas" button
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    BarChart2, CheckCircle, XCircle, Clock, ExternalLink, ChevronDown,
    ChevronUp, Activity, Zap, AlertTriangle, Cpu
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

interface TraceItem {
    id: string
    blueprint_id: string
    blueprint_name: string
    status: string
    started_at: string
    duration_ms: number
    total_tokens: number
    cost_usd: number
    aggregate_eval_score: number | null
    langfuse_trace_url: string | null
    triggered_by_email: string | null
}

interface NodeTiming {
    node_id: string
    node_type: string
    node_label: string
    started_at: string | null
    completed_at: string | null
    duration_ms: number | null
    status: string
    error: string | null
    input_tokens: number | null
    output_tokens: number | null
    cost_usd: number | null
}

interface ToolHealth {
    tool_id: string
    tool_name: string
    tool_type: string
    health_status: string
    success_rate_24h: number | null
    avg_latency_ms: number | null
    last_called_at: string | null
    consecutive_failures: number
}

function StatusDot({ status }: { status: string }) {
    const color = status === 'completed' ? 'bg-green-500'
        : status === 'failed' ? 'bg-red-500'
            : status === 'running' ? 'bg-blue-500 animate-pulse'
                : 'bg-muted-foreground'
    return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}

function HealthDot({ status }: { status: string }) {
    const color = status === 'healthy' ? 'bg-green-500'
        : status === 'degraded' ? 'bg-amber-500'
            : 'bg-red-500'
    return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
}

function TraceRow({ trace }: { trace: TraceItem }) {
    const [expanded, setExpanded] = useState(false)
    const navigate = useNavigate()

    const { data: nodes = [] } = useQuery<NodeTiming[]>({
        queryKey: ['node-timing', trace.id],
        queryFn: () => fetch(`/api/v1/monitoring/nodes/${trace.id}`).then(r => r.json()),
        enabled: expanded,
    })

    const maxDuration = Math.max(...nodes.map(n => n.duration_ms ?? 0), 1)

    return (
        <div className={`rounded-xl border transition-colors ${trace.status === 'failed' ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(x => !x)}>
                <StatusDot status={trace.status} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{trace.blueprint_name}</p>
                        <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
                            {trace.id.slice(0, 8)}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                            {new Date(trace.started_at).toLocaleString()}
                        </span>
                        {trace.triggered_by_email && (
                            <span className="text-[11px] text-muted-foreground truncate">
                                by {trace.triggered_by_email}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    {trace.duration_ms && (
                        <div className="text-center">
                            <p className="text-xs font-mono text-foreground">{(trace.duration_ms / 1000).toFixed(1)}s</p>
                            <p className="text-[10px] text-muted-foreground">duration</p>
                        </div>
                    )}
                    {trace.cost_usd !== null && (
                        <div className="text-center">
                            <p className="text-xs font-mono text-foreground">${trace.cost_usd.toFixed(4)}</p>
                            <p className="text-[10px] text-muted-foreground">cost</p>
                        </div>
                    )}
                    {trace.aggregate_eval_score !== null && (
                        <div className={`text-center px-2 py-0.5 rounded-full text-xs font-semibold
              ${trace.aggregate_eval_score >= 0.8 ? 'bg-green-500/10 text-green-600'
                                : trace.aggregate_eval_score >= 0.6 ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-red-500/10 text-red-600'}`}>
                            {Math.round(trace.aggregate_eval_score * 100)}%
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        {trace.langfuse_trace_url && (
                            <a href={trace.langfuse_trace_url} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" /> Langfuse
                            </a>
                        )}
                        <button
                            onClick={e => { e.stopPropagation(); navigate(`/blueprints/${trace.blueprint_id}?execution=${trace.id}&mode=review`) }}
                            className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            Replay
                        </button>
                    </div>
                    {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
            </div>

            {expanded && nodes.length > 0 && (
                <div className="border-t border-border p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Node Timing Breakdown
                    </p>
                    <div className="space-y-1.5">
                        {nodes.map(node => (
                            <div key={node.node_id} className="flex items-center gap-3">
                                <div className="w-28 shrink-0">
                                    <p className="text-[11px] font-mono text-muted-foreground truncate">{node.node_id}</p>
                                    <p className="text-[10px] text-muted-foreground">{node.node_type}</p>
                                </div>
                                <div className="flex-1 h-5 rounded bg-muted/50 relative overflow-hidden">
                                    <div
                                        className={`absolute top-0 left-0 h-full rounded transition-all
                      ${node.status === 'completed' ? 'bg-primary/60' : 'bg-red-500/60'}`}
                                        style={{ width: `${((node.duration_ms ?? 0) / maxDuration) * 100}%` }}
                                    />
                                </div>
                                <div className="w-16 text-right">
                                    <p className="text-[11px] font-mono text-muted-foreground">
                                        {node.duration_ms ? `${node.duration_ms}ms` : '–'}
                                    </p>
                                </div>
                                {node.error && (
                                    <span title={node.error}>
                                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export function MonitoringPage() {
    const [statusFilter, setStatusFilter] = useState<string>('')
    const [hoursFilter, setHoursFilter] = useState<number>(24)
    const [page, setPage] = useState(1)

    const { data: traces = [], isFetching } = useQuery<TraceItem[]>({
        queryKey: ['monitoring-traces', statusFilter, hoursFilter, page],
        queryFn: () => {
            const params = new URLSearchParams({
                hours: String(hoursFilter),
                page: String(page),
                page_size: '30',
            })
            if (statusFilter) params.set('status', statusFilter)
            return fetch(`/api/v1/monitoring/traces?${params}`).then(r => r.json())
        },
        refetchInterval: 10_000,
    })

    const { data: toolHealth = [] } = useQuery<ToolHealth[]>({
        queryKey: ['tool-health'],
        queryFn: () => fetch('/api/v1/monitoring/health').then(r => r.json()),
        refetchInterval: 30_000,
    })

    const degraded = toolHealth.filter(t => t.health_status !== 'healthy')

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <Activity className="h-5 w-5 text-primary" /> Monitoring
                        </h1>
                        <p className="text-sm text-muted-foreground">Execution traces and tool health for your org</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Time filter */}
                        {[{ label: '1h', v: 1 }, { label: '24h', v: 24 }, { label: '7d', v: 168 }].map(opt => (
                            <button key={opt.v} onClick={() => { setHoursFilter(opt.v); setPage(1) }}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors
                  ${hoursFilter === opt.v ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
                                {opt.label}
                            </button>
                        ))}
                        {/* Status filter */}
                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none">
                            <option value="">All statuses</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                            <option value="running">Running</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Tool health summary */}
                {toolHealth.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-muted-foreground" /> Tool Health
                            {degraded.length > 0 && (
                                <span className="ml-2 rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-xs text-red-600 font-medium">
                                    {degraded.length} degraded
                                </span>
                            )}
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {toolHealth.slice(0, 10).map(tool => (
                                <div key={tool.tool_id} className={`rounded-xl border p-3
                  ${tool.health_status === 'healthy' ? 'border-border bg-card' : 'border-red-500/30 bg-red-500/5'}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <HealthDot status={tool.health_status} />
                                        <p className="text-xs font-medium text-foreground truncate">{tool.tool_name}</p>
                                    </div>
                                    {tool.success_rate_24h !== null && (
                                        <p className="text-[11px] text-muted-foreground">
                                            {Math.round(tool.success_rate_24h * 100)}% success
                                        </p>
                                    )}
                                    {tool.avg_latency_ms !== null && (
                                        <p className="text-[11px] text-muted-foreground">{Math.round(tool.avg_latency_ms)}ms avg</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Traces list */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-foreground">
                            Execution Traces
                            {isFetching && <span className="ml-2 text-[11px] text-muted-foreground">refreshing…</span>}
                        </h2>
                        <div className="flex items-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-accent">
                                ← Prev
                            </button>
                            <span className="text-xs text-muted-foreground">Page {page}</span>
                            <button disabled={traces.length < 30} onClick={() => setPage(p => p + 1)}
                                className="rounded-lg border border-border px-3 py-1 text-xs disabled:opacity-40 hover:bg-accent">
                                Next →
                            </button>
                        </div>
                    </div>

                    {traces.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <BarChart2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-medium">No traces found</p>
                            <p className="text-xs mt-1">Execute a blueprint to see traces here</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {traces.map(trace => (
                                <TraceRow key={trace.id} trace={trace} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
