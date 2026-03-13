/**
 * ToolsPage — Full E5.4 tool catalog with health monitoring,
 * 24h sparklines, capability test modal, and tool registration.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Activity, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
    ExternalLink, Play, Plus, RefreshCw, WifiOff, Wifi, Zap,
    XCircle, Clock, BarChart2
} from 'lucide-react'

interface ToolCapability {
    name: string
    description: string
    when_to_use: string
    input_schema: Record<string, unknown>
    estimated_latency_ms?: number
}

interface Tool {
    tool_id?: string
    id?: string
    name: string
    display_name?: string
    version?: string
    description: string
    tags?: string[]
    capabilities?: ToolCapability[]
    health_status?: 'healthy' | 'degraded' | 'offline' | 'unknown'
    used_in_blueprints?: number
    metrics?: {
        calls_24h: number
        error_rate: number
        p95_latency_ms: number
        sparkline: number[]
    }
}

function HealthBadge({ status }: { status: Tool['health_status'] }) {
    const map = {
        healthy: { color: 'bg-green-500', text: 'Healthy', icon: CheckCircle },
        degraded: { color: 'bg-amber-500', text: 'Degraded', icon: AlertTriangle },
        offline: { color: 'bg-red-500', text: 'Offline', icon: XCircle },
        unknown: { color: 'bg-muted-foreground', text: 'Unknown', icon: WifiOff },
    }
    const { color, text, icon: Icon } = map[status ?? 'unknown'] ?? map.unknown
    return (
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${color}`}>
            <Icon className="h-3 w-3" />
            {text}
        </span>
    )
}

function Sparkline({ data }: { data: number[] }) {
    if (!data.length) return null
    const max = Math.max(...data, 1)
    const w = 80
    const h = 24
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
    return (
        <svg width={w} height={h} className="text-primary">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    )
}

// ── Test Modal ─────────────────────────────────────────────────────────────────

function TestCapabilityModal({ tool, cap, onClose }: {
    tool: Tool
    cap: ToolCapability
    onClose: () => void
}) {
    const [input, setInput] = useState('{}')
    const [result, setResult] = useState<unknown>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const run = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            const res = await fetch(`/api/v1/tools/${tool.tool_id}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ capability: cap.name, input: JSON.parse(input) }),
            })
            const data = await res.json()
            if (!res.ok) setError(data.detail || 'Test failed')
            else setResult(data)
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-[600px] max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-border p-4">
                    <div>
                        <p className="text-sm font-semibold text-foreground">Test: {cap.name}</p>
                        <p className="text-xs text-muted-foreground">{tool.name}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Input JSON</label>
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="w-full h-32 rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <button
                        onClick={run}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        {loading ? 'Running...' : 'Run Test'}
                    </button>
                    {error && <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-600 font-mono">{error}</div>}
                    {result !== null && (
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Result</label>
                            <pre className="rounded-lg bg-muted/30 p-3 text-xs font-mono text-foreground overflow-x-auto">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    )
}

// ── Tool Card ──────────────────────────────────────────────────────────────────

function ToolCard({ tool }: { tool: Tool }) {
    const [expanded, setExpanded] = useState(false)
    const [testState, setTestState] = useState<{ cap: ToolCapability } | null>(null)
    const qc = useQueryClient()

    const refresh = useMutation({
        mutationFn: () => fetch(`/api/v1/tools/${tool.tool_id}/health`).then(r => r.json()),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }),
    })

    return (
        <motion.div
            layout
            className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div
                className="flex cursor-pointer items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                    {tool.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm">{tool.name}</p>
                        <span className="text-[10px] text-muted-foreground font-mono">v{tool.version}</span>
                        <HealthBadge status={tool.health_status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {tool.metrics && <Sparkline data={tool.metrics.sparkline} />}
                    {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-border"
                    >
                        <div className="p-4 space-y-4">
                            {/* Metrics row */}
                            {tool.metrics && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                                        <p className="text-xs text-muted-foreground">24h Calls</p>
                                        <p className="text-lg font-semibold text-foreground">{tool.metrics.calls_24h.toLocaleString()}</p>
                                    </div>
                                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                                        <p className="text-xs text-muted-foreground">Error Rate</p>
                                        <p className={`text-lg font-semibold ${tool.metrics.error_rate > 0.05 ? 'text-red-500' : 'text-foreground'}`}>
                                            {(tool.metrics.error_rate * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                                        <p className="text-xs text-muted-foreground">P95 Latency</p>
                                        <p className="text-lg font-semibold text-foreground">{tool.metrics.p95_latency_ms}ms</p>
                                    </div>
                                </div>
                            )}

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1">
                                {(tool.tags || []).map(tag => (
                                    <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                                ))}
                                {tool.used_in_blueprints !== undefined && (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                        Used in {tool.used_in_blueprints} blueprints
                                    </span>
                                )}
                            </div>

                            {/* Capabilities */}
                            {(tool.capabilities || []).length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">CAPABILITIES</p>
                                    <div className="space-y-2">
                                        {(tool.capabilities || []).map(cap => (
                                            <div key={cap.name} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{cap.name}</p>
                                                    <p className="text-xs text-muted-foreground">{cap.description}</p>
                                                    {cap.estimated_latency_ms && (
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">~{cap.estimated_latency_ms}ms</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setTestState({ cap })}
                                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
                                                >
                                                    <Play className="h-3 w-3" /> Test
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => refresh.mutate()}
                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
                                    Refresh Health
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {testState && (
                <TestCapabilityModal tool={tool} cap={testState.cap} onClose={() => setTestState(null)} />
            )}
        </motion.div>
    )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function ToolsPage() {
    const [search, setSearch] = useState('')
    const [healthFilter, setHealthFilter] = useState<string>('all')

    const { data: tools = [], isLoading } = useQuery<Tool[]>({
        queryKey: ['tools'],
        queryFn: () => fetch('/api/v1/tools').then(r => r.json()),
        refetchInterval: 30_000,
    })

    const filtered = (Array.isArray(tools) ? tools : []).filter(t => {
        const matchSearch = !search ||
            (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
            (t.tags || []).some(tag => tag.includes(search.toLowerCase()))
        const matchHealth = healthFilter === 'all' || t.health_status === healthFilter
        return matchSearch && matchHealth
    })

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Tool Catalog</h1>
                        <p className="text-sm text-muted-foreground">{tools.length} registered adapters</p>
                    </div>
                    <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Plus className="h-4 w-4" /> Register Tool
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
                {/* Filters */}
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search tools..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 max-w-xs rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    {(['all', 'healthy', 'degraded', 'offline'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setHealthFilter(s)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${healthFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4">
                    {[
                        { label: 'Total Tools', value: tools.length, icon: Zap },
                        { label: 'Healthy', value: tools.filter(t => t.health_status === 'healthy').length, icon: CheckCircle },
                        { label: 'Degraded', value: tools.filter(t => t.health_status === 'degraded').length, icon: AlertTriangle },
                        { label: 'Offline', value: tools.filter(t => t.health_status === 'offline').length, icon: WifiOff },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="rounded-2xl border border-border bg-card p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{label}</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{value}</p>
                        </div>
                    ))}
                </div>

                {/* Tool grid */}
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading tools...</div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(tool => <ToolCard key={tool.tool_id} tool={tool} />)}
                        {filtered.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">No tools match your filters.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
