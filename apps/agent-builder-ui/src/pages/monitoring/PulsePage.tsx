import { useQuery } from '@tanstack/react-query'
import { Activity, Clock, Server, CheckCircle2, XCircle, DollarSign, AlertTriangle } from 'lucide-react'
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { apiClient } from '@/lib/api'
import { cn } from '@/lib/utils'

function MetricCard({ title, value, subValue, icon: Icon, trend, isLoading }: any) {
    return (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            {isLoading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted"></div>
            ) : (
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight">{value}</span>
                    {trend !== undefined && (
                        <span className={cn("text-xs font-medium", trend > 0 ? "text-emerald-500" : "text-red-500")}>
                            {trend > 0 ? '+' : ''}{trend}%
                        </span>
                    )}
                </div>
            )}
            {subValue && <p className="mt-1 text-xs text-muted-foreground">{subValue}</p>}
        </div>
    )
}

export default function PulsePage() {
    const { data: rawData, isLoading } = useQuery({
        queryKey: ['monitoring-pulse'],
        queryFn: async () => {
            // Since codegen didn't run, we bypass the strong typing here using Type assertion
            const res = await (apiClient as any).GET('/api/v1/monitoring/pulse')
            if (res.error) throw new Error(res.error)
            return res.data
        },
        refetchInterval: 10000 // auto-refresh every 10s
    })

    const data = rawData || {
        system_success_rate: 0,
        avg_latency_ms: 0,
        total_executions: 0,
        cumulative_cost_usd: 0,
        time_data: [],
        cost_data: []
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-500 backdrop-blur-sm">
                        <Activity className="h-4 w-4" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold tracking-tight">Pulse</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Observability & Health</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard isLoading={isLoading} title="System Success Rate" value={`${data.system_success_rate}%`} subValue="Last 24 hours" icon={CheckCircle2} />
                    <MetricCard isLoading={isLoading} title="Avg Latency" value={`${data.avg_latency_ms.toLocaleString()}ms`} subValue="Aggregated" icon={Clock} />
                    <MetricCard isLoading={isLoading} title="Total Executions" value={data.total_executions.toLocaleString()} subValue="All time" icon={Server} />
                    <MetricCard isLoading={isLoading} title="Cumulative Cost" value={`$${data.cumulative_cost_usd.toFixed(2)}`} subValue="Current billing cycle" icon={DollarSign} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
                        <h3 className="text-sm font-medium mb-4">Execution Volume (Success vs Failed)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.time_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 8 }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Area type="monotone" dataKey="success" stroke="#10b981" fillOpacity={1} fill="url(#colorSuccess)" />
                                    <Area type="monotone" dataKey="failed" stroke="#ef4444" fillOpacity={1} fill="url(#colorFailed)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                        <h3 className="text-sm font-medium mb-4">Daily Token Cost (USD)</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.cost_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                    <Tooltip 
                                        cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 8 }}
                                    />
                                    <Bar dataKey="cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
