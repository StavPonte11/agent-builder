import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
    icon?: LucideIcon
    title: string
    description?: string
    action?: { label: string; onClick: () => void }
    className?: string
}

/**
 * EmptyState — illustrated empty state for lists and data views.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-4 rounded-xl',
                'border border-dashed border-border py-20 text-center',
                className
            )}
        >
            {Icon && (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-8 w-8" />
                </div>
            )}

            <div className="max-w-xs">
                <p className="font-semibold text-foreground">{title}</p>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
            </div>

            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
                >
                    {action.label}
                </button>
            )}
        </div>
    )
}
