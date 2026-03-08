import { cn } from '@/lib/utils'

interface ProgressRingProps {
    /** 0–100 */
    progress: number
    size?: number
    strokeWidth?: number
    className?: string
    label?: string
    color?: string
}

/**
 * ProgressRing — circular SVG progress indicator.
 */
export function ProgressRing({
    progress,
    size = 64,
    strokeWidth = 6,
    className,
    label,
    color = 'hsl(var(--primary))',
}: ProgressRingProps) {
    const r = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * r
    const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference

    return (
        <div className={cn('relative inline-flex items-center justify-center', className)}>
            <svg width={size} height={size} className="-rotate-90">
                {/* Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth={strokeWidth}
                />
                {/* Progress */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            {label !== undefined && (
                <span className="absolute text-xs font-semibold text-foreground">{label}</span>
            )}
        </div>
    )
}
