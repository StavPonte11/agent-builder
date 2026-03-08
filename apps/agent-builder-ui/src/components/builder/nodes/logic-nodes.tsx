import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { Split, GitBranch } from 'lucide-react'
import { BaseNode } from './base-node'

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        title={(data.label as string) || 'Condition'}
        icon={<GitBranch className="h-3 w-3" />}
        colorClass="bg-orange-500/10 text-orange-700 dark:text-orange-400"
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'true', className: 'mt-[-10px] !bg-primary' },
            { type: 'source', position: Position.Right, id: 'false', className: 'mt-[10px] !bg-destructive' }
        ]}
    >
        <div className="text-xs font-mono line-clamp-2 text-muted-foreground">
            {(data.expression as string) || 'if (state.value === true)'}
        </div>
    </BaseNode>
))

export const RouterNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        title={(data.label as string) || 'LLM Router'}
        icon={<Split className="h-3 w-3" />}
        colorClass="bg-orange-600/10 text-orange-700 dark:text-orange-500"
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'routeA', className: 'mt-[-15px]' },
            { type: 'source', position: Position.Right, id: 'routeB', className: 'mt-[-5px]' },
            { type: 'source', position: Position.Right, id: 'default', className: 'mt-[15px] !bg-muted-foreground' }
        ]}
    >
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Routes input based on classes</span>
            <span className="font-medium text-foreground">{(data.model as string) || 'gpt-4o-mini'}</span>
        </div>
    </BaseNode>
))
