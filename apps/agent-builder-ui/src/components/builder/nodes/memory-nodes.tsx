import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { Database, Download, Upload } from 'lucide-react'
import { BaseNode } from './base-node'

export const MemoryReadNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="memory_read"
        title={(data.label as string) || 'Read Memory'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs">
            <span>Key: </span>
            <span className="font-mono">{(data.memory_key as string) || (data.key as string) || 'state.user_data'}</span>
        </div>
    </BaseNode>
))

export const MemoryWriteNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="memory_write"
        title={(data.label as string) || 'Write Memory'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs">
            <span>Key: </span>
            <span className="font-mono">{(data.memory_key as string) || (data.key as string) || 'state.user_data'}</span>
        </div>
    </BaseNode>
))
