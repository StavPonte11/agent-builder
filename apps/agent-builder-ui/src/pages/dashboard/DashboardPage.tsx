
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

export default function DashboardPage() {
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
            </div>
        </>
    )
}
