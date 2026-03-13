import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { BaseNode } from './base-node'

export const LLMNode = memo(({ id, data, selected }: NodeProps) => {
    return (
        <BaseNode
            id={id}
            selected={selected}
            nodeType="llm"
            title={(data.label as string) || 'LLM Call'}
            handles={[
                { type: 'target', position: Position.Left, id: 'in' },
                { type: 'source', position: Position.Right, id: 'out' }
            ]}
        >
            <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground line-clamp-2">
                    {(data.system_prompt as string) || (data.prompt as string) || 'Configure prompt...'}
                </span>
                {(data.model as string) && (
                    <span className="mt-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-mono text-purple-700 dark:text-purple-300 w-fit">
                        {data.model as string}
                    </span>
                )}
            </div>
        </BaseNode>
    )
})
