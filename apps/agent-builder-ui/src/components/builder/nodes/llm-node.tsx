import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { BrainCircuit } from 'lucide-react'
import { BaseNode } from './base-node'

export const LLMNode = memo(({ id, data, selected }: NodeProps) => {
    return (
        <BaseNode
            id={id}
            selected={selected}
            title={(data.label as string) || 'LLM Call'}
            icon={<BrainCircuit className="h-3 w-3" />}
            colorClass="bg-purple-500/10 text-purple-700 dark:text-purple-400"
            handles={[
                { type: 'target', position: Position.Left, id: 'in' },
                { type: 'source', position: Position.Right, id: 'out' }
            ]}
        >
            <div className="flex flex-col gap-1">
                <span className="text-xs line-clamp-2" title={data.prompt as string}>
                    {(data.prompt as string) || 'Configure prompt instructions...'}
                </span>
                <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{(data.model as string) || 'gpt-4o-mini'}</span>
                </div>
            </div>
        </BaseNode>
    )
})
