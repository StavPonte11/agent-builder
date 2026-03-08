import { memo } from 'react'
import { NodeProps, Position } from '@xyflow/react'
import { Wrench, Code } from 'lucide-react'
import { BaseNode } from './base-node'

export const ToolNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        title={(data.label as string) || 'MCP Tool'}
        icon={<Wrench className="h-3 w-3" />}
        colorClass="bg-blue-500/10 text-blue-700 dark:text-blue-400"
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs">
            <span className="font-medium">{(data.tool_name as string) || 'Select Tool...'}</span>
        </div>
    </BaseNode>
))

export const CodeNode = memo(({ id, data, selected }: NodeProps) => (
    <BaseNode
        id={id}
        selected={selected}
        title={(data.label as string) || 'Python Code'}
        icon={<Code className="h-3 w-3" />}
        colorClass="bg-pink-500/10 text-pink-700 dark:text-pink-400"
        handles={[
            { type: 'target', position: Position.Left, id: 'in' },
            { type: 'source', position: Position.Right, id: 'out' }
        ]}
    >
        <div className="text-xs font-mono text-muted-foreground line-clamp-2">
            {(data.code as string) || '# enter python code...'}
        </div>
    </BaseNode>
))
