import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Workflow, Play, Clock, DollarSign, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber, formatUsd } from '@/lib/utils'

interface MetricCardProps {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: string
    trend?: string
    color: string
}

function MetricCard({ icon: Icon, label, value, trend, color }: MetricCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border bg-card p-4 hover:border-border-strong transition-colors hover:shadow-lg hover:shadow-black/20"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                    <p className="mt-1.5 text-2xl font-heading font-semibold text-foreground">{value}</p>
                    {trend && <p className="mt-1 text-xs text-success">{trend}</p>}
                </div>
                <div className={`rounded-md p-2 ${color}`}>
                    <Icon className="h-4 w-4 text-white" />
                </div>
            </div>
        </motion.div>
    )
}

export default function DashboardPage() {
    const { t } = useTranslation()

    // Placeholder metrics — will be fetched from API once backend routes are wired
    const metrics = [
        { icon: Workflow, label: 'Active Blueprints', value: '0', color: 'bg-primary' },
        { icon: Play, label: 'Executions (30d)', value: '0', color: 'bg-success' },
        { icon: CheckCircle, label: 'Success Rate', value: '—', color: 'bg-cyan' },
        { icon: Clock, label: 'Avg Latency', value: '—', color: 'bg-purple' },
        { icon: DollarSign, label: 'Total Cost (30d)', value: '$0.00', color: 'bg-warning' },
        { icon: AlertCircle, label: 'Pending Approvals', value: '0', color: 'bg-danger' },
    ]

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="font-heading text-2xl font-semibold text-foreground">Dashboard</h1>
                <p className="mt-1 text-sm text-muted-foreground">Welcome to Agent Builder</p>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {metrics.map((m, i) => (
                    <MetricCard key={m.label} {...m} />
                ))}
            </div>

            {/* Quick actions */}
            <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="font-heading text-base font-semibold text-foreground mb-4">Quick Actions</h2>
                <div className="flex gap-3">
                    <a
                        href="/blueprints/new"
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                    >
                        New Blueprint
                    </a>
                    <a
                        href="/blueprints"
                        className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-border transition-colors"
                    >
                        Browse Blueprints
                    </a>
                </div>
            </div>
        </div>
    )
}
