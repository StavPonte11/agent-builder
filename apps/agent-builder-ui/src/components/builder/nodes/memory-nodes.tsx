import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { Database, Download, Upload } from 'lucide-react'
import { BaseNode } from './base-node'

export const MemoryReadNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        title={(data.label as string) || 'Read Memory'}
        icon={<Download className="h-3 w-3" />}
        colorClass="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs">
            <span>Key: </span>
            <span className="font-mono">{(data.memory_key as string) || 'state.user_data'}</span>
        </div>
    </BaseNode>
))

export const MemoryWriteNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        title={(data.label as string) || 'Write Memory'}
        icon={<Upload className="h-3 w-3" />}
        colorClass="bg-cyan-600/10 text-cyan-700 dark:text-cyan-500"
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs">
            <span>Key: </span>
            <span className="font-mono">{(data.memory_key as string) || 'state.user_data'}</span>
        </div>
    </BaseNode>
))
