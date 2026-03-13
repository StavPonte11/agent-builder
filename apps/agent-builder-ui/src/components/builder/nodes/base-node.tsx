import type { ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasStore } from '@/stores/canvasStore'
import {
    Play, BrainCircuit, Wrench, GitBranch, Shuffle,
    CheckSquare, Database, MemoryStick, Code,
    Package, ArrowRightSquare, Circle, AlertOctagon
} from 'lucide-react'

// ─── Node type → color + icon mapping ────────────────────────────────────────

const NODE_CONFIG: Record<string, { bg: string; border: string; iconBg: string; icon: React.ElementType }> = {
    trigger: { bg: 'bg-blue-600', border: 'border-blue-500', iconBg: 'bg-blue-500', icon: Play },
    llm: { bg: 'bg-purple-600', border: 'border-purple-500', iconBg: 'bg-purple-500', icon: BrainCircuit },
    tool: { bg: 'bg-cyan-600', border: 'border-cyan-500', iconBg: 'bg-cyan-500', icon: Wrench },
    condition: { bg: 'bg-orange-500', border: 'border-orange-400', iconBg: 'bg-orange-400', icon: GitBranch },
    router: { bg: 'bg-amber-500', border: 'border-amber-400', iconBg: 'bg-amber-400', icon: Shuffle },
    approval: { bg: 'bg-yellow-500', border: 'border-yellow-400', iconBg: 'bg-yellow-400', icon: CheckSquare },
    memory_read: { bg: 'bg-teal-600', border: 'border-teal-500', iconBg: 'bg-teal-500', icon: Database },
    memory_write: { bg: 'bg-teal-700', border: 'border-teal-600', iconBg: 'bg-teal-600', icon: MemoryStick },
    code: { bg: 'bg-pink-600', border: 'border-pink-500', iconBg: 'bg-pink-500', icon: Code },
    sub_blueprint: { bg: 'bg-indigo-600', border: 'border-indigo-500', iconBg: 'bg-indigo-500', icon: Package },
    output: { bg: 'bg-slate-600', border: 'border-slate-500', iconBg: 'bg-slate-500', icon: ArrowRightSquare },
    supervisor: { bg: 'bg-fuchsia-600', border: 'border-fuchsia-500', iconBg: 'bg-fuchsia-500', icon: Circle },
    unknown: { bg: 'bg-red-600', border: 'border-red-500', iconBg: 'bg-red-500', icon: AlertOctagon },
}

const FALLBACK_CONFIG = { bg: 'bg-slate-600', border: 'border-slate-500', iconBg: 'bg-slate-500', icon: AlertOctagon }

interface BaseNodeProps {
    id: string
    title: string
    nodeType?: string
    icon?: ReactNode
    colorClass?: string    // legacy: ignored in favour of nodeType lookup
    selected?: boolean
    children?: ReactNode
    handles?: {
        type: 'source' | 'target'
        position: Position
        id?: string
        className?: string
        style?: React.CSSProperties
    }[]
    statusBadge?: ReactNode
}

export function BaseNode({
    id,
    title,
    nodeType = 'unknown',
    icon,
    selected,
    children,
    handles = [],
    statusBadge,
}: BaseNodeProps) {
    const selectNode = useCanvasStore((s) => s.selectNode)
    const canvasMode = useCanvasStore((s) => s.canvasMode)
    const nodeExecData = useCanvasStore((s) => s.nodeExecutionData[id])
    const nodeStatus = nodeExecData?.status ?? 'idle'

    const cfg = NODE_CONFIG[nodeType] ?? FALLBACK_CONFIG
    const Icon = cfg.icon

    const statusRing =
        canvasMode !== 'build'
            ? nodeStatus === 'running' ? 'ring-2 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse'
                : nodeStatus === 'completed' ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : nodeStatus === 'failed' ? 'ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                        : nodeStatus === 'retrying' ? 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                            : nodeStatus === 'paused' ? 'ring-2 ring-amber-400'
                                : nodeStatus === 'skipped' ? 'opacity-40'
                                    : ''
            : ''

    return (
        <div
            onClick={() => selectNode(id)}
            className={cn(
                'group relative min-w-[240px] max-w-[300px] rounded-2xl shadow-lg transition-all duration-200 cursor-pointer overflow-hidden',
                'border bg-background/40 backdrop-blur-md',
                selected
                    ? `${cfg.border} ring-2 ring-primary/40 shadow-xl scale-[1.02] border-2`
                    : `border-border/60 hover:${cfg.border} hover:shadow-xl hover:scale-[1.01]`,
                statusRing
            )}
        >
            {/* Coloured header strip */}
            <div className={cn('flex items-center gap-2 px-3 py-2.5', cfg.bg)}>
                <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    'bg-white/20 text-white'
                )}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-tight truncate">{title}</p>
                    <p className="text-[10px] text-white/70 font-medium capitalize">{nodeType.replace(/_/g, ' ')}</p>
                </div>
                {canvasMode === 'execute' && nodeStatus === 'running' && (
                    <span className="h-2 w-2 rounded-full bg-white animate-ping shrink-0" />
                )}
                {statusBadge}
            </div>

            {/* Body */}
            {children && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-transparent">
                    {children}
                </div>
            )}

            {/* Execution overlay */}
            {canvasMode !== 'build' && nodeExecData && (
                <div className={cn(
                    'px-3 py-1.5 text-[10px] font-medium border-t border-border',
                    nodeStatus === 'completed' ? 'text-green-600 dark:text-green-400 bg-green-500/5'
                        : nodeStatus === 'failed' ? 'text-red-600 dark:text-red-400 bg-red-500/5'
                            : nodeStatus === 'running' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/5'
                                : 'text-muted-foreground'
                )}>
                    {nodeStatus === 'running' ? '⚡ Running…'
                        : nodeStatus === 'completed' ? '✓ Completed'
                            : nodeStatus === 'failed' ? `✗ ${nodeExecData.errorMessage ?? 'Error'}`
                                : nodeStatus === 'retrying' ? `↻ Retry ${nodeExecData.attempt}/${nodeExecData.maxAttempts}`
                                    : null}
                    {nodeExecData.durationMs !== undefined && nodeStatus === 'completed' && (
                        <span className="ml-1 opacity-60">{nodeExecData.durationMs}ms</span>
                    )}
                </div>
            )}

            {/* Handles */}
            {handles.map((handle, i) => (
                <Handle
                    key={handle.id || `${handle.type}-${i}`}
                    type={handle.type}
                    position={handle.position}
                    id={handle.id}
                    style={handle.style}
                    className={cn(
                        '!h-3 !w-3 !border-2 !border-white dark:!border-card transition-all hover:!scale-125',
                        handle.type === 'target' ? '!bg-slate-400' : `!${cfg.iconBg.replace('bg-', 'bg-')}`,
                        handle.className
                    )}
                />
            ))}
        </div>
    )
}
