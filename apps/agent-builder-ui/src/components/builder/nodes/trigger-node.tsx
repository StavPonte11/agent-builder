import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { Play } from 'lucide-react'
import { BaseNode } from './base-node'

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
    return (
        <BaseNode
            id={id}
            selected={selected}
            title={(data.label as string) || 'Trigger'}
            icon={<Play className="h-3 w-3" />}
            colorClass="bg-green-500/10 text-green-700 dark:text-green-400"
            handles={[
                { type: 'source', position: Position.Right, id: 'out' }
            ]}
        >
            <div className="flex flex-col gap-1">
                <span className="text-xs">Starts the workflow</span>
                {Boolean(data.eventType) && (
                    <span className="mt-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {String(data.eventType)}
                    </span>
                )}
            </div>
        </BaseNode>
    )
})
