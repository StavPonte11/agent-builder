import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'
import { Check, X } from 'lucide-react'

export function ConditionEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    })

    // Data dictates whether this branch is the 'true' or 'false' branch
    const isTrueBranch = data?.branch === 'true'

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2 }} />
            <g transform={`translate(${labelX}, ${labelY})`}>
                <rect
                    x="-12"
                    y="-12"
                    width="24"
                    height="24"
                    rx="12"
                    fill={isTrueBranch ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'}
                    className="drop-shadow-sm"
                />
                {isTrueBranch ? (
                    <Check x="-6" y="-6" className="h-3 w-3 text-primary-foreground" />
                ) : (
                    <X x="-6" y="-6" className="h-3 w-3 text-destructive-foreground" />
                )}
            </g>
        </>
    )
}
