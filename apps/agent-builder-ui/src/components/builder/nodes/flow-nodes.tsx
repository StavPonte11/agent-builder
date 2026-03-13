import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { CheckSquare, ArrowRightSquare } from 'lucide-react'
import { BaseNode } from './base-node'

export const ApprovalNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="approval"
        title={(data.label as string) || 'Human Approval'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'approved', className: 'mt-[-10px] !bg-primary' },
            { type: 'source', position: Position.Right, id: 'rejected', className: 'mt-[10px] !bg-destructive' }
        ]}
    >
        <div className="text-xs text-muted-foreground">
            Pauses execution until an admin approves the state.
        </div>
    </BaseNode>
))

export const OutputNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="output"
        title={(data.label as string) || 'Output'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' }
        ]}
    >
        <div className="text-xs text-muted-foreground">
            Generates the final JSON output of the workflow.
        </div>
    </BaseNode>
))
