import { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvasStore'

interface BaseNodeProps {
    id: string
    title: string
    icon: ReactNode
    colorClass: string
    selected?: boolean
    children?: ReactNode
    handles?: {
        type: 'source' | 'target'
        position: Position
        id?: string
        className?: string
    }[]
}

export function BaseNode({
    id,
    title,
    icon,
    colorClass,
    selected,
    children,
    handles = [],
}: BaseNodeProps) {
    const selectNode = useCanvasStore((s) => s.selectNode)

    return (
        <div
            onClick={() => selectNode(id)}
            className={cn(
                'group relative min-w-[240px] rounded-xl border bg-card text-card-foreground shadow-sm transition-all',
                selected ? 'border-primary ring-1 ring-primary shadow-md' : 'border-border hover:border-primary/50'
            )}
        >
            {/* Header */}
            <div className={cn('flex items-center gap-2 rounded-t-xl border-b border-border p-3', colorClass)}>
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background/50 text-foreground">
                    {icon}
                </div>
                <div className="flex-1 font-semibold text-sm leading-none tracking-tight">{title}</div>
            </div>

            {/* Body */}
            <div className="p-3 text-sm text-muted-foreground">{children}</div>

            {/* Handles */}
            {handles.map((handle, i) => (
                <Handle
                    key={handle.id || `${handle.type}-${i}`}
                    type={handle.type}
                    position={handle.position}
                    id={handle.id}
                    className={cn(
                        'h-3 w-3 border-2 border-background bg-muted-foreground transition-colors hover:bg-primary',
                        handle.type === 'target' ? '-ml-1' : '-mr-1',
                        handle.className
                    )}
                />
            ))}
        </div>
    )
}
