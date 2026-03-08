import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface GlowCardProps {
    children: ReactNode
    className?: string
    glowColor?: 'primary' | 'cyan' | 'purple' | 'green' | 'amber'
}

const glowColors = {
    primary: 'hover:shadow-primary/20',
    cyan: 'hover:shadow-cyan-500/20',
    purple: 'hover:shadow-purple-500/20',
    green: 'hover:shadow-green-500/20',
    amber: 'hover:shadow-amber-500/20',
}

/**
 * GlowCard — a card with a soft glow effect on hover.
 */
export function GlowCard({ children, className, glowColor = 'primary' }: GlowCardProps) {
    return (
        <div
            className={cn(
                'rounded-xl border border-border bg-card p-4',
                'shadow-md transition-all duration-300',
                'hover:shadow-xl',
                glowColors[glowColor],
                className
            )}
        >
            {children}
        </div>
    )
}
