import { BaseEdge, EdgeProps, getBezierPath } from '@xyflow/react'

export function DefaultEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
}: EdgeProps) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    })

    return (
        <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={{ ...style, strokeWidth: 2, stroke: 'hsl(var(--border))' }}
        />
    )
}
