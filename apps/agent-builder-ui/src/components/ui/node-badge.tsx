import { cn } from '@/lib/utils'

type NodeBadgeVariant =
    | 'trigger'
    | 'llm'
    | 'tool'
    | 'condition'
    | 'router'
    | 'memory_read'
    | 'memory_write'
    | 'approval'
    | 'code'
    | 'output'

const variantStyles: Record<NodeBadgeVariant, string> = {
    trigger: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    llm: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    tool: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    condition: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    router: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    memory_read: 'bg-green-500/15 text-green-400 border-green-500/30',
    memory_write: 'bg-green-500/15 text-green-400 border-green-500/30',
    approval: 'bg-red-500/15 text-red-400 border-red-500/30',
    code: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    output: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

const variantIcons: Record<NodeBadgeVariant, string> = {
    trigger: '⚡',
    llm: '🧠',
    tool: '🔌',
    condition: '◇',
    router: '⑂',
    memory_read: '⬇',
    memory_write: '⬆',
    approval: '🛡',
    code: '⌨',
    output: '🏁',
}

interface NodeBadgeProps {
    type: NodeBadgeVariant
    label?: string
    className?: string
}

export function NodeBadge({ type, label, className }: NodeBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
                variantStyles[type],
                className
            )}
        >
            <span>{variantIcons[type]}</span>
            <span>{label ?? type.replace('_', ' ')}</span>
        </span>
    )
}
