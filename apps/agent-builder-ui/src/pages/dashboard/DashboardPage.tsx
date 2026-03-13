
import { MetricCard } from '@/components/ui/metric-card'
import { Activity, Clock, FileText, Settings, Users } from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts'

const chartData = [
    { name: 'Mon', executions: 400, errors: 24 },
    { name: 'Tue', executions: 300, errors: 13 },
    { name: 'Wed', executions: 550, errors: 45 },
    { name: 'Thu', executions: 278, errors: 10 },
    { name: 'Fri', executions: 189, errors: 5 },
    { name: 'Sat', executions: 239, errors: 18 },
    { name: 'Sun', executions: 349, errors: 20 },
]

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
    const navigate = useNavigate()

    const { data: blueprints, isLoading } = useQuery({
        queryKey: ['dashboard-blueprints'],
        queryFn: async () => {
            const { data, error } = await apiClient.GET('/api/v1/blueprints', {})
            if (error) throw new Error('Failed to fetch blueprints')
            return data
        }
    })

    const recentBlueprints = blueprints ? blueprints.slice(0, 3) : []
    return (
        <>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">Welcome back! Here's an overview of your agents.</p>
                </div>

                {/* Key Metrics */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        label="Total Executions"
                        value="12,403"
                        icon={Activity}
                        trend={{ value: 12.5, label: "vs last week" }}
                    />
                    <MetricCard
                        label="Active Blueprints"
                        value="8"
                        icon={FileText}
                        trend={{ value: 2, label: "vs last week" }}
                    />
                    <MetricCard
                        label="Avg. Latency"
                        value="1.2s"
                        icon={Clock}
                        trend={{ value: -0.3, label: "vs last week" }}
                    />
                    <MetricCard
                        label="API Keys"
                        value="3"
                        icon={Settings}
                    />
                </div>

                {/* Charts */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <h3 className="mb-4 text-sm font-semibold text-foreground">Execution Volume (7 Days)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorExec" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Area type="monotone" dataKey="executions" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorExec)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <h3 className="mb-4 text-sm font-semibold text-foreground">Error Rates</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Recent Blueprints */}
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Recent Blueprints</h3>
                        <Link to="/blueprints" className="text-xs text-primary hover:underline">View all</Link>
                    </div>
                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : recentBlueprints.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {recentBlueprints.map((bp: any) => (
                                <div key={bp.id} onClick={() => navigate(`/blueprints/${bp.id}`)} className="group cursor-pointer rounded-lg border border-border bg-muted/50 p-4 transition-colors hover:bg-muted">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-foreground line-clamp-1">{bp.name}</h4>
                                        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${
                                            bp.status === 'published' ? 'bg-green-500/10 text-green-500' :
                                            bp.status === 'draft' ? 'bg-amber-500/10 text-amber-500' :
                                            'bg-blue-500/10 text-blue-500'
                                        }`}>
                                            {bp.status || 'draft'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                            {bp.updated_at ? formatDistanceToNow(new Date(bp.updated_at), { addSuffix: true }) : 'Unknown'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
                            <p className="text-sm font-medium text-foreground">No recent blueprints</p>
                            <Link to="/blueprints/new" className="mt-1 text-xs text-primary hover:underline">Create your first one</Link>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
