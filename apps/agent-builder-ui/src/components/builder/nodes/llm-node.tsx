import { memo } from 'react'
import { NodeProps, Position, useNodeConnections, useNodesData, type Connection } from '@xyflow/react'
import { BaseNode } from './base-node'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Database } from 'lucide-react'

export const LLMNode = memo(({ id, data, selected }: NodeProps) => {
    // Legacy support: read from data.tools if it was manually set in older blueprints
    const legacyTools = (data.tools as string[]) || []

    // New n8n style: read visually connected Tool nodes
    const toolConnections = useNodeConnections({
        handleType: 'target',
        handleId: 'tools'
    });
    
    // Get the data of all nodes connected to the 'tools' handle
    const connectedToolNodesData = useNodesData(
        toolConnections.map((connection) => connection.source)
    );

    // Extract the tool_ids from the connected nodes
    const connectedTools = connectedToolNodesData
        .map((nodeData) => (nodeData?.data as any)?.tool_id as string)
        .filter(Boolean); // Filter out undefined/null

    // Combine legacy tools with visually connected tools, removing duplicates
    const selectedTools = Array.from(new Set([...legacyTools, ...connectedTools]));

    const { data: tools = [] } = useQuery<{ tool_id: string; name: string; status?: string }[]>({
        queryKey: ['tools'],
        queryFn: () => fetch('/api/v1/tools').then((r) => r.json()),
    })

    const nodeTools = tools.filter(t => selectedTools.includes(t.tool_id))
    const hasUnhealthyTool = nodeTools.some(t => t.status === 'offline' || t.status === 'error')

    return (
        <BaseNode
            id={id}
            selected={selected}
            nodeType="llm"
            title={(data.label as string) || 'LLM Call'}
            handles={[
                { type: 'target', position: Position.Left, id: 'in' },
                { type: 'source', position: Position.Right, id: 'out' },
                { type: 'target', position: Position.Bottom, id: 'tools' }
            ]}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                    <span className="mt-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-mono text-purple-700 dark:text-purple-300 w-fit">
                        {((data.model as string) || 'No model')}
                    </span>
                    {Boolean(data.enable_memory) && (
                        <span title="Persistence Enabled" className="flex items-center mt-1">
                            <Database className="h-3.5 w-3.5 text-blue-500" />
                        </span>
                    )}
                </div>
                
                <span className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {(data.system_prompt as string) || (data.prompt as string) || 'Configure prompt...'}
                </span>

                {selectedTools.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 items-center">
                        {hasUnhealthyTool && (
                            <span title="One or more tools are offline" className="flex items-center">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-500 drop-shadow-sm" />
                            </span>
                        )}
                        {selectedTools.map(tId => {
                            const t = tools.find(x => x.tool_id === tId)
                            const isOffline = t?.status === 'offline' || t?.status === 'error'
                            const toolName = t?.name || (tId as string)
                            return (
                                <span key={tId as string} className={`rounded px-1.5 py-0.5 text-[9px] font-medium border ${isOffline ? 'border-red-500/30 bg-red-500/10 text-red-600' : 'border-slate-500/30 bg-slate-500/10 text-slate-600'}`} title={toolName}>
                                    {toolName}
                                </span>
                            )
                        })}
                    </div>
                )}
            </div>
        </BaseNode>
    )
})
