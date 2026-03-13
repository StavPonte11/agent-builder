import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { BaseNode } from './base-node'

export const ToolNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="tool"
        title={(data.label as string) || 'MCP Tool'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs">
            <span className="font-medium">{(data.tool_name as string) || (data.tool_id as string) || 'Select Tool...'}</span>
            {(data.capability as string) && (
                <span className="ml-1 text-muted-foreground">/ {data.capability as string}</span>
            )}
        </div>
    </BaseNode>
))

export const CodeNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="code"
        title={(data.label as string) || 'Code'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-[10px] font-mono text-muted-foreground line-clamp-2">
            {(data.code as string)?.split('\n')[0] || '# Write code...'}
        </div>
    </BaseNode>
))

export const UnknownNode = memo(({ id, data, selected, type }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        nodeType="unknown"
        title={(data.label as string) || 'Unknown Type'}
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Unsupported node type:</span>
            <span className="font-mono text-red-500">{data.originalType as string || type}</span>
        </div>
    </BaseNode>
))
