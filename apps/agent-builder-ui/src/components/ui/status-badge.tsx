import { cn } from '@/lib/utils'

type StatusVariant =
    | 'idle'
    | 'running'
    | 'completed'
    | 'error'
    | 'blocked'
    | 'draft'
    | 'testing'
    | 'pending_approval'
    | 'published'
    | 'archived'
    | 'healthy'
    | 'degraded'
    | 'offline'

const variantStyles: Record<StatusVariant, string> = {
    idle: 'bg-muted text-muted-foreground',
    running: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    completed: 'bg-green-500/15 text-green-400 border border-green-500/30',
    error: 'bg-red-500/15 text-red-400 border border-red-500/30',
    blocked: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    draft: 'bg-muted text-muted-foreground',
    testing: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    pending_approval: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    published: 'bg-green-500/15 text-green-400 border border-green-500/30',
    archived: 'bg-muted/50 text-muted-foreground',
    healthy: 'bg-green-500/15 text-green-400 border border-green-500/30',
    degraded: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    offline: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

const variantDots: Record<StatusVariant, string> = {
    idle: 'bg-muted-foreground',
    running: 'bg-blue-400 animate-pulse',
    completed: 'bg-green-400',
    error: 'bg-red-400',
    blocked: 'bg-amber-400',
    draft: 'bg-muted-foreground',
    testing: 'bg-blue-400 animate-pulse',
    pending_approval: 'bg-amber-400 animate-pulse',
    published: 'bg-green-400',
    archived: 'bg-muted-foreground',
    healthy: 'bg-green-400',
    degraded: 'bg-amber-400',
    offline: 'bg-red-400',
}

interface StatusBadgeProps {
    status: StatusVariant
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                variantStyles[status],
                className
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', variantDots[status])} />
            {status.replace('_', ' ')}
        </span>
    )
}
