/**
 * Composite node types: ParallelFork, Loop, LLMJudge, SubBlueprint
 * These nodes visually communicate their composite nature with distinct handles
 * and data previews.
 */
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { SplitSquareHorizontal, Repeat2, Scale, Package, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import type { ParallelForkNodeData, LoopNodeData, LLMJudgeNodeData, SubBlueprintNodeData } from '@/types/blueprint'

// Typed props matching React Flow's node component interface
interface TypedNodeProps<T> {
    id: string
    data: T
    selected?: boolean
}

// ─── Shared Node Frame ────────────────────────────────────────────────────────

interface NodeFrameProps {
    id: string
    icon: React.ElementType
    label: string
    color: string
    iconColor: string
    children?: React.ReactNode
}

function NodeFrame({ id, icon: Icon, label, color, iconColor, children }: NodeFrameProps) {
    const selectNode = useCanvasStore((s) => s.selectNode)
    const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
    const isSelected = selectedNodeId === id
    const canvasMode = useCanvasStore((s) => s.canvasMode)
    const nodeStatus = useCanvasStore((s) => s.nodeExecutionData[id]?.status ?? 'idle')

    const statusRingClass =
        canvasMode === 'execute' || canvasMode === 'review'
            ? nodeStatus === 'running' ? 'ring-2 ring-blue-500 animate-pulse' :
                nodeStatus === 'completed' ? 'ring-2 ring-green-500' :
                    nodeStatus === 'failed' ? 'ring-2 ring-red-500' :
                        nodeStatus === 'retrying' ? 'ring-2 ring-amber-500' :
                            nodeStatus === 'paused' ? 'ring-2 ring-amber-400' :
                                nodeStatus === 'skipped' ? 'opacity-40' : ''
            : ''

    return (
        <div
            onClick={() => selectNode(id)}
            className={`rounded-xl border bg-card shadow-md transition-all cursor-pointer min-w-[180px] overflow-hidden
        ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50 hover:shadow-lg'}
        ${statusRingClass}
      `}
        >
            {/* Header */}
            <div className={`flex items-center gap-2 px-3 py-2 ${color}`}>
                <div className={`flex h-6 w-6 items-center justify-center rounded-md bg-card/20 ${iconColor}`}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold text-white truncate">{label}</span>
                {canvasMode === 'execute' && nodeStatus === 'running' && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-white animate-ping" />
                )}
            </div>
            {children && (
                <div className="px-3 py-2">
                    {children}
                </div>
            )}
        </div>
    )
}

// ─── Parallel Fork Node ───────────────────────────────────────────────────────

export const ParallelForkNode = memo(({ id, data }: TypedNodeProps<ParallelForkNodeData>) => {
    const branches = data.branches ?? []

    return (
        <>
            <Handle type="target" position={Position.Left} className="!border-border !bg-violet-500" />
            <NodeFrame
                id={id}
                icon={SplitSquareHorizontal}
                label={data.label || 'Parallel Fork'}
                color="bg-violet-600"
                iconColor="text-violet-100"
            >
                <div className="space-y-1">
                    {branches.length > 0 ? (
                        branches.map((br) => (
                            <div key={br.id} className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-muted-foreground">⑤</span>
                                <span className="text-[11px] text-foreground">{br.name}</span>
                            </div>
                        ))
                    ) : (
                        <p className="text-[10px] text-muted-foreground italic">No branches defined</p>
                    )}
                    {data.merge_strategy && (
                        <div className="mt-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
                            merge: {data.merge_strategy}
                        </div>
                    )}
                </div>
            </NodeFrame>
            <Handle type="source" position={Position.Right} id="merged" className="!border-border !bg-violet-400" />
        </>
    )
})
ParallelForkNode.displayName = 'ParallelForkNode'

// ─── Loop Node ────────────────────────────────────────────────────────────────

export const LoopNode = memo(({ id, data }: TypedNodeProps<LoopNodeData>) => {
    return (
        <>
            <Handle type="target" position={Position.Left} className="!border-border !bg-teal-500" />
            <NodeFrame
                id={id}
                icon={Repeat2}
                label={data.label || 'Loop'}
                color="bg-teal-600"
                iconColor="text-teal-100"
            >
                <div className="space-y-1">
                    {data.iterate_over && (
                        <p className="font-mono text-[10px] text-foreground truncate max-w-[160px]">
                            over: <span className="text-teal-600 dark:text-teal-400">{data.iterate_over}</span>
                        </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {data.parallelism !== undefined && <span>⚡ ×{data.parallelism}</span>}
                        {data.max_iterations !== undefined && <span>max {data.max_iterations}</span>}
                    </div>
                </div>
            </NodeFrame>
            <Handle type="source" position={Position.Right} id="completed" className="!border-border !bg-teal-400" />
        </>
    )
})
LoopNode.displayName = 'LoopNode'

// ─── LLM Judge Node ───────────────────────────────────────────────────────────

export const LLMJudgeNode = memo(({ id, data }: TypedNodeProps<LLMJudgeNodeData>) => {
    return (
        <>
            <Handle type="target" position={Position.Left} className="!border-border !bg-rose-500" />
            <NodeFrame
                id={id}
                icon={Scale}
                label={data.label || 'LLM Judge'}
                color="bg-rose-600"
                iconColor="text-rose-100"
            >
                <div className="space-y-1">
                    {data.target_field && (
                        <p className="text-[10px] text-muted-foreground truncate">
                            Evaluates: <span className="font-mono text-foreground">{data.target_field}</span>
                        </p>
                    )}
                    {data.score_threshold !== undefined && (
                        <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-rose-500 rounded-full"
                                    style={{ width: `${(data.score_threshold ?? 0.7) * 100}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{data.score_threshold}</span>
                        </div>
                    )}
                    {data.max_attempts !== undefined && data.max_attempts >= 3 && (
                        <p className="text-[9px] text-muted-foreground">max {data.max_attempts} attempts</p>
                    )}
                </div>
            </NodeFrame>
            <Handle
                type="source"
                position={Position.Right}
                id="pass"
                style={{ top: '35%' }}
                className="!border-border !bg-green-500"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="fail"
                style={{ top: '65%' }}
                className="!border-border !bg-red-500"
            />
            <div className="absolute right-[-28px] top-[27%] text-[9px] text-green-500 font-medium pointer-events-none">pass</div>
            <div className="absolute right-[-24px] top-[57%] text-[9px] text-red-500 font-medium pointer-events-none">fail</div>
        </>
    )
})
LLMJudgeNode.displayName = 'LLMJudgeNode'

// ─── Sub-Blueprint Node ───────────────────────────────────────────────────────

export const SubBlueprintNode = memo(({ id, data }: TypedNodeProps<SubBlueprintNodeData>) => {
    return (
        <>
            <Handle type="target" position={Position.Left} className="!border-border !bg-indigo-500" />
            <NodeFrame
                id={id}
                icon={Package}
                label={data.label || 'Sub-Blueprint'}
                color="bg-indigo-600"
                iconColor="text-indigo-100"
            >
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-foreground truncate max-w-[120px]">{data.label}</span>
                    {data.version && (
                        <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
                            {data.version === 'latest' ? '★ latest' : `v${data.version}`}
                        </span>
                    )}
                </div>
                {data.version === 'latest' && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        Non-deterministic — unpinned version
                    </div>
                )}
            </NodeFrame>
            <Handle type="source" position={Position.Right} className="!border-border !bg-indigo-400" />
        </>
    )
})
SubBlueprintNode.displayName = 'SubBlueprintNode'
