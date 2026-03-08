import { useCallback, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Connection,
    EdgeChange,
    NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useCanvasStore } from '@/stores/canvasStore'
import { ConditionEdge } from '@/components/builder/edges/condition-edge'
import { DefaultEdge } from '@/components/builder/edges/default-edge'
import { NodePalette } from '@/components/builder/panels/node-palette'

// NOTE: Implemented all 10 node types
import { TriggerNode } from '@/components/builder/nodes/trigger-node'
import { LLMNode } from '@/components/builder/nodes/llm-node'
import { ToolNode, CodeNode } from '@/components/builder/nodes/action-nodes'
import { ConditionNode, RouterNode } from '@/components/builder/nodes/logic-nodes'
import { MemoryReadNode, MemoryWriteNode } from '@/components/builder/nodes/memory-nodes'
import { ApprovalNode, OutputNode } from '@/components/builder/nodes/flow-nodes'
import { BuilderToolbar } from '@/components/builder/panels/builder-toolbar'
import { NodeConfigPanel } from '@/components/builder/panels/node-config-panel'

const edgeTypes = {
    condition: ConditionEdge,
    default: DefaultEdge,
}

const nodeTypes = {
    trigger: TriggerNode,
    llm: LLMNode,
    tool: ToolNode,
    condition: ConditionNode,
    router: RouterNode,
    memory_read: MemoryReadNode,
    memory_write: MemoryWriteNode,
    approval: ApprovalNode,
    code: CodeNode,
    output: OutputNode,
}

function BuilderCanvas() {
    const { id } = useParams()
    const reactFlowWrapper = useRef<HTMLDivElement>(null)
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)

    const nodes = useCanvasStore((s) => s.nodes)
    const edges = useCanvasStore((s) => s.edges)
    const setNodes = useCanvasStore((s) => s.setNodes)
    const setEdges = useCanvasStore((s) => s.setEdges)

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes(applyNodeChanges(changes, nodes))
        },
        [nodes, setNodes]
    )

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges(applyEdgeChanges(changes, edges))
        },
        [edges, setEdges]
    )

    const onConnect = useCallback(
        (params: Connection) => {
            setEdges(addEdge({ ...params, type: 'default' }, edges))
        },
        [edges, setEdges]
    )

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault()

            if (!reactFlowInstance) return

            const type = event.dataTransfer.getData('application/reactflow')
            const label = event.dataTransfer.getData('application/reactflow-label')

            if (typeof type === 'undefined' || !type) {
                return
            }

            // Calculate drop position
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            })

            const newNode = {
                id: `node-${Date.now()}`,
                type,
                position,
                data: { label },
            }

            setNodes([...nodes, newNode])
        },
        [reactFlowInstance, nodes, setNodes]
    )

    return (
        <div className="flex h-full w-full flex-col">
            <BuilderToolbar />
            <div className="flex-1 relative bg-background" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    className="bg-background/90"
                >
                    <Background gap={24} size={2} color="hsl(var(--muted-foreground))" />
                    <Controls className="bg-card border-border fill-foreground" />
                    <MiniMap
                        nodeStrokeColor="hsl(var(--border))"
                        maskColor="hsl(var(--background)/0.8)"
                        className="bg-card border border-border rounded-lg shadow-sm"
                    />
                </ReactFlow>

                {/* Floating node library palette */}
                <NodePalette />

                {/* Node configuration dynamic panel */}
                <NodeConfigPanel />
            </div>
        </div>
    )
}

export default function BuilderPage() {
    return (
        <ReactFlowProvider>
            <BuilderCanvas />
        </ReactFlowProvider>
    )
}
