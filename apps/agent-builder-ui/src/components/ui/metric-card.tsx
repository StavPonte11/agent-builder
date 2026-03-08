import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
    label: string
    value: string | number
    subvalue?: string
    icon?: LucideIcon
    trend?: { value: number; label: string }
    className?: string
    iconColor?: string
}

/**
 * MetricCard — compact KPI card used in the dashboard.
 */
export function MetricCard({
    label,
    value,
    subvalue,
    icon: Icon,
    trend,
    className,
    iconColor = 'text-primary',
}: MetricCardProps) {
    return (
        <div
            className={cn(
                'rounded-xl border border-border bg-card p-5 shadow-sm',
                'transition-all duration-200 hover:shadow-md hover:border-primary/30',
                className
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="mt-1.5 text-2xl font-bold text-foreground truncate">{value}</p>
                    {subvalue && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{subvalue}</p>
                    )}
                    {trend && (
                        <p
                            className={cn(
                                'mt-2 text-xs font-medium',
                                trend.value >= 0 ? 'text-green-400' : 'text-red-400'
                            )}
                        >
                            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
                        </p>
                    )}
                </div>
                {Icon && (
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10', iconColor)}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>
        </div>
    )
}
