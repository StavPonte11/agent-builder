import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { BaseNode } from './base-node'

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
    return (
        <BaseNode
            id={id}
            selected={selected}
            nodeType="trigger"
            title={(data.label as string) || 'Trigger'}
            handles={[
                { type: 'source', position: Position.Right, id: 'out' }
            ]}
        >
            <div className="flex flex-col gap-1">
                <span className="text-xs">Starts the workflow</span>

                {data.trigger_type === 'webhook' ? (
                    <span className="mt-1 rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-400 w-fit">
                        Webhook
                    </span>
                ) : data.trigger_type === 'schedule' ? (
                    <span className="mt-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 w-fit">
                        Schedule
                    </span>
                ) : (
                    <span className="mt-1 rounded border border-muted-foreground/30 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground w-fit">
                        Manual Invoke
                    </span>
                )}

                {Boolean(data.eventType) && (
                    <span className="mt-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono w-fit">
                        {String(data.eventType)}
                    </span>
                )}
            </div>
        </BaseNode>
    )
})
