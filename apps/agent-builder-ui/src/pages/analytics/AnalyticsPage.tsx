/**
 * AnalyticsPage — Global + per-blueprint analytics dashboard.
 * Covers E8 spec: execution volume, success rates, cost, latency, eval trends.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Activity, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe']

interface GlobalStats {
    total_executions: number
    success_rate: number
    avg_cost_usd: number
    avg_duration_ms: number
    total_cost_usd: number
    pending_approvals: number
    oldest_approval_age_hours: number
}

interface DailyVolume {
    date: string
    total: number
    succeeded: number
    failed: number
}

interface BlueprintStat {
    id: string
    name: string
    executions: number
    success_rate: number
    avg_cost: number
    avg_latency_ms: number
}

interface EvalTrend {
    date: string
    [dimension: string]: number | string
}

function StatCard({
    label, value, sub, icon: Icon, trend
}: {
    label: string
    value: string
    sub?: string
    icon: React.ElementType
    trend?: 'up' | 'down' | null
}) {
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {sub && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
                    {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                    {sub}
                </div>
            )}
        </div>
    )
}

export function AnalyticsPage() {
    const navigate = useNavigate()
    const [range, setRange] = useState<'7d' | '30d'>('7d')

    const { data: stats } = useQuery<GlobalStats>({
        queryKey: ['analytics', 'global', range],
        queryFn: () => fetch(`/api/v1/analytics/global?range=${range}`).then(r => r.json()),
    })

    const { data: volume = [] } = useQuery<DailyVolume[]>({
        queryKey: ['analytics', 'volume', range],
        queryFn: () => fetch(`/api/v1/analytics/volume?range=${range}`).then(r => r.json()),
    })

    const { data: blueprintStats = [] } = useQuery<BlueprintStat[]>({
        queryKey: ['analytics', 'blueprints', range],
        queryFn: () => fetch(`/api/v1/analytics/blueprints?range=${range}`).then(r => r.json()),
    })

    const { data: evalTrends = [] } = useQuery<EvalTrend[]>({
        queryKey: ['analytics', 'eval-trends', range],
        queryFn: () => fetch(`/api/v1/analytics/eval-trends?range=${range}`).then(r => r.json()),
    })

    const costData = blueprintStats
        .slice(0, 10)
        .sort((a, b) => b.avg_cost - a.avg_cost)
        .map(b => ({ name: b.name.slice(0, 18), cost: b.avg_cost }))

    const evalDimensions = evalTrends.length > 0
        ? Object.keys(evalTrends[0]).filter(k => k !== 'date')
        : []

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
                        <p className="text-sm text-muted-foreground">Global execution health and performance</p>
                    </div>
                    <div className="flex gap-2">
                        {(['7d', '30d'] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${range === r ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}
                            >
                                {r === '7d' ? 'Last 7 days' : 'Last 30 days'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* KPI cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Total Executions" value={stats.total_executions.toLocaleString()} icon={Activity} />
                        <StatCard
                            label="Success Rate"
                            value={`${(stats.success_rate * 100).toFixed(1)}%`}
                            icon={CheckCircle}
                            trend={stats.success_rate > 0.9 ? 'up' : 'down'}
                        />
                        <StatCard
                            label="Total Cost"
                            value={`$${stats.total_cost_usd.toFixed(2)}`}
                            sub={`~$${stats.avg_cost_usd.toFixed(4)} avg`}
                            icon={DollarSign}
                        />
                        <StatCard
                            label="Pending Approvals"
                            value={stats.pending_approvals.toString()}
                            sub={stats.oldest_approval_age_hours > 0 ? `Oldest: ${stats.oldest_approval_age_hours}h ago` : undefined}
                            icon={Clock}
                            trend={stats.pending_approvals > 10 ? 'down' : null}
                        />
                    </div>
                )}

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Execution volume */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold text-foreground mb-4">Execution Volume</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={volume}>
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="succeeded" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Cost by blueprint */}
                    <div className="rounded-2xl border border-border bg-card p-5">
                        <h3 className="text-sm font-semibold text-foreground mb-4">Avg Cost by Blueprint</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={costData} layout="vertical">
                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toFixed(3)}`} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                                <Tooltip formatter={(v: number) => `$${v.toFixed(4)}`} />
                                <Bar dataKey="cost" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Eval score trends */}
                    {evalTrends.length > 0 && (
                        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
                            <h3 className="text-sm font-semibold text-foreground mb-4">Evaluation Score Trends</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={evalTrends}>
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    {evalDimensions.map((dim, i) => (
                                        <Line key={dim} type="monotone" dataKey={dim} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Blueprint performance table */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <h3 className="text-sm font-semibold text-foreground">Blueprint Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    {['Blueprint', 'Executions', 'Success Rate', 'Avg Cost', 'Avg Latency'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {blueprintStats.map(b => (
                                    <tr
                                        key={b.id}
                                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                                        onClick={() => navigate(`/blueprints/${b.id}`)}
                                    >
                                        <td className="px-4 py-3 font-medium text-foreground">{b.name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{b.executions.toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <span className={`font-semibold ${b.success_rate >= 0.9 ? 'text-green-600' : b.success_rate >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {(b.success_rate * 100).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-muted-foreground">${b.avg_cost.toFixed(4)}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{b.avg_latency_ms.toLocaleString()}ms</td>
                                    </tr>
                                ))}
                                {blueprintStats.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No data yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
