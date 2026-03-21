/**
 * BuilderPage — Main canvas page wrapping React Flow.
 * Features: all 14 node types, right-click context menu, double-click rename,
 *          keyboard shortcuts, template drop handler, canvas modes.
 */
import { useCallback, useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from 'react'
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
    type Connection,
    type EdgeChange,
    type NodeChange,
    type Node,
    ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useCanvasStore } from '@/stores/canvasStore'

// ── Edge types ────────────────────────────────────────────────────────────────
import { ConditionEdge } from '@/components/builder/edges/condition-edge'
import { DefaultEdge } from '@/components/builder/edges/default-edge'

// ── Node types ────────────────────────────────────────────────────────────────
import { TriggerNode } from '@/components/builder/nodes/trigger-node'
import { LLMNode } from '@/components/builder/nodes/llm-node'
import { ToolNode, CodeNode, UnknownNode } from '@/components/builder/nodes/action-nodes'
import { ConditionNode, RouterNode } from '@/components/builder/nodes/logic-nodes'
import { MemoryReadNode, MemoryWriteNode } from '@/components/builder/nodes/memory-nodes'
import { ApprovalNode, OutputNode } from '@/components/builder/nodes/flow-nodes'
import { ParallelForkNode, LoopNode, LLMJudgeNode, SubBlueprintNode } from '@/components/builder/nodes/composite-nodes'

// ── Panels ────────────────────────────────────────────────────────────────────
import { BuilderToolbar } from '@/components/builder/panels/builder-toolbar'
import { NodeConfigPanel } from '@/components/builder/panels/node-config-panel'
import { NodePalette } from '@/components/builder/panels/node-palette'
import { StateSchemaInspector } from '@/components/builder/panels/state-schema-inspector'
import { Plus } from 'lucide-react'

// ── Data Loading ──────────────────────────────────────────────────────────────
import { useBlueprint } from '@/hooks/api/useBlueprints'
import { Loader2 } from 'lucide-react'

// ── Execute / Review overlays ────────────────────────────────────────────────
import { ExecutionOverlay } from '@/components/executions/execution-overlay'
import { ReviewModeTimeline } from '@/components/executions/review-mode-timeline'

// ── Mission Commander overlays (HITL + Time-Travel) ──────────────────────────
import { OversightDialog } from '@/components/builder/panels/oversight-dialog'
import { StateHistoryPanel } from '@/components/builder/panels/state-history-panel'

const edgeTypes = {
    condition: ConditionEdge,
    default: DefaultEdge,
}

const nodeTypes = {
    trigger: TriggerNode,
    llm: LLMNode,
    tool: ToolNode,
    tool_call: ToolNode,  // Backend alias
    tool_cell: ToolNode,  // Backup typo alias
    condition: ConditionNode,
    router: RouterNode,
    memory_read: MemoryReadNode,
    memory_write: MemoryWriteNode,
    approval: ApprovalNode,
    human_approval: ApprovalNode, // Backend alias
    code: CodeNode,
    output: OutputNode,
    parallel_fork: ParallelForkNode,
    parallel: ParallelForkNode, // Backend alias
    loop: LoopNode,
    llm_judge: LLMJudgeNode,
    sub_blueprint: SubBlueprintNode,
    unknown: UnknownNode,
}

const VALID_NODE_TYPES = new Set(Object.keys(nodeTypes))

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
    x: number
    y: number
    nodeId: string
    label: string
}

function CanvasContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
    const { selectNode, removeNode, nodes, setNodes } = useCanvasStore()

    const duplicate = () => {
        const original = nodes.find((n) => n.id === menu.nodeId)
        if (!original) return
        const newNode = {
            ...original,
            id: `node-${Date.now()}`,
            position: { x: original.position.x + 40, y: original.position.y + 40 },
        }
        setNodes([...nodes, newNode])
        onClose()
    }

    const deleteNode = () => {
        removeNode(menu.nodeId)
        onClose()
    }

    return (
        <div
            style={{ left: menu.x, top: menu.y }}
            className="fixed z-50 min-w-[160px] rounded-xl border border-border bg-card shadow-2xl py-1 text-sm"
        >
            <button
                onClick={() => { selectNode(menu.nodeId); onClose() }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-foreground hover:bg-accent transition-colors"
            >
                ⚙ Configure
            </button>
            <button
                onClick={duplicate}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-foreground hover:bg-accent transition-colors"
            >
                ⧉ Duplicate
            </button>
            <div className="my-1 border-t border-border" />
            <button
                onClick={deleteNode}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-destructive hover:bg-destructive/10 transition-colors"
            >
                ✕ Delete
            </button>
        </div>
    )
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────

function BuilderCanvas() {
    const { id } = useParams()
    const reactFlowWrapper = useRef<HTMLDivElement>(null)
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
    const [connectionTarget, setConnectionTarget] = useState<{ x: number, y: number, sourceNodeId: string, sourceHandleId: string | null } | null>(null)

    const nodes = useCanvasStore((s) => s.nodes)
    const edges = useCanvasStore((s) => s.edges)
    const setNodes = useCanvasStore((s) => s.setNodes)
    const setEdges = useCanvasStore((s) => s.setEdges)
    const selectNode = useCanvasStore((s) => s.selectNode)
    const undo = useCanvasStore((s) => s.undo)
    const redo = useCanvasStore((s) => s.redo)
    const canUndo = useCanvasStore((s) => s.past.length > 0)
    const canRedo = useCanvasStore((s) => s.future.length > 0)
    const canvasMode = useCanvasStore((s) => s.canvasMode)
    const pendingApproval = useCanvasStore((s) => s.pendingApproval)
    const activeExecutionId = useCanvasStore((s) => s.activeExecutionId)

    // ── Keyboard shortcuts ─────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                selectNode(null)
                setContextMenu(null)
                return
            }
            const ctrl = e.ctrlKey || e.metaKey
            if (ctrl && e.key === 'z' && !e.shiftKey && canUndo) { e.preventDefault(); undo() }
            if (ctrl && e.key === 'z' && e.shiftKey && canRedo) { e.preventDefault(); redo() }
            if (ctrl && e.key === 'y' && canRedo) { e.preventDefault(); redo() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [undo, redo, canUndo, canRedo, selectNode])

    // ── Dismiss context menu on outside click ─────────────────────────────────
    useEffect(() => {
        if (!contextMenu) return
        const dismiss = () => setContextMenu(null)
        window.addEventListener('click', dismiss)
        return () => window.removeEventListener('click', dismiss)
    }, [contextMenu])

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes(applyNodeChanges(changes, nodes) as Node[]),
        [nodes, setNodes]
    )

    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, edges)),
        [edges, setEdges]
    )

    const onConnect = useCallback(
        (params: Connection) => setEdges(addEdge({ ...params, type: 'default' }, edges)),
        [edges, setEdges]
    )
    
    const onConnectEnd = useCallback(
        (event: ReactMouseEvent | MouseEvent | TouchEvent, connectionState: any) => {
            // connectionState is available in newer @xyflow/react versions. 
            // If it ended on a valid target, we do nothing.
            if (connectionState.isValid) return;

            // Otherwise, it dropped on the canvas. Open the floating quick-palette.
            if (!reactFlowInstance) return;
            
            let clientX, clientY;
            if ('clientX' in event) {
                clientX = event.clientX;
                clientY = event.clientY;
            } else {
                clientX = (event as TouchEvent).touches[0].clientX;
                clientY = (event as TouchEvent).touches[0].clientY;
            }

            // We need screen coordinates for the popup overlay, 
            // and we'll translate to flow position when they pick an item.
            setConnectionTarget({ 
                x: clientX, 
                y: clientY,
                sourceNodeId: connectionState.fromNode?.id || '',
                sourceHandleId: connectionState.fromHandle?.id || null,
            })
        },
        [reactFlowInstance]
    )

    const addSmartConnectedNode = useCallback((type: string, label: string) => {
        if (!connectionTarget || !reactFlowInstance) return;
        
        const position = reactFlowInstance.screenToFlowPosition({ x: connectionTarget.x, y: connectionTarget.y })
        const newNodeId = `node-${Date.now()}`
        const newNode: Node = {
            id: newNodeId,
            type,
            position,
            data: { label },
        }

        setNodes([...nodes, newNode])
        
        // Auto-connect it
        const newEdge = {
            id: `edge-${Date.now()}`,
            source: connectionTarget.sourceNodeId,
            target: newNodeId,
            sourceHandle: connectionTarget.sourceHandleId,
            type: 'default'
        }
        setEdges([...edges, newEdge])
        
        setConnectionTarget(null)
        setTimeout(() => selectNode(newNodeId), 50)
    }, [connectionTarget, reactFlowInstance, nodes, edges, setNodes, setEdges, selectNode])

    const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        // Trigger inline rename by selecting the node and focusing label field
        selectNode(node.id)
    }, [selectNode])

    const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
        e.preventDefault()
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            nodeId: node.id,
            label: node.data.label as string ?? node.type ?? '',
        })
    }, [])

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }, [])

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            if (!reactFlowInstance) return

            // Check for template drop
            const templateId = e.dataTransfer.getData('application/reactflow-template')
            if (templateId) {
                // Load template from API and apply to canvas
                fetch(`/api/v1/templates/${templateId}`)
                    .then((r) => r.json())
                    .then((tmpl) => {
                        setNodes([...nodes, ...(tmpl.nodes ?? [])])
                        setEdges([...edges, ...(tmpl.edges ?? [])])
                    })
                    .catch(console.error)
                return
            }

            const type = e.dataTransfer.getData('application/reactflow')
            const label = e.dataTransfer.getData('application/reactflow-label')
            const toolId = e.dataTransfer.getData('application/reactflow-tool-id')
            const blueprintId = e.dataTransfer.getData('application/reactflow-blueprint-id')

            if (!type) return

            const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY })

            const newNode: Node = {
                id: `node-${Date.now()}`,
                type,
                position,
                data: {
                    label,
                    ...(toolId ? { tool_id: toolId } : {}),
                    ...(blueprintId ? { blueprint_id: blueprintId } : {}),
                },
            }

            setNodes([...nodes, newNode])
            // Auto-select newly dropped node to open config panel
            setTimeout(() => selectNode(newNode.id), 50)
        },
        [reactFlowInstance, nodes, edges, setNodes, setEdges, selectNode]
    )

    const onPaneClick = useCallback(() => {
        selectNode(null)
        setContextMenu(null)
        setConnectionTarget(null)
    }, [selectNode])
    // Intercept nodes to ensure unknown hallucinated types don't render as white blocks
    const safeNodes = nodes.map((n) =>
        VALID_NODE_TYPES.has(n.type || '')
            ? n
            : { ...n, type: 'unknown', data: { ...n.data, originalType: n.type } }
    )

    return (
        <div className="flex h-full w-full flex-col" ref={reactFlowWrapper}>
            <BuilderToolbar />

            <div className="flex-1 relative min-h-0">
                <ReactFlow
                    nodes={safeNodes}
                    edges={edges}
                    onNodesChange={canvasMode === 'review' ? undefined : onNodesChange}
                    onEdgesChange={canvasMode === 'review' ? undefined : onEdgesChange}
                    onConnect={canvasMode === 'review' ? undefined : onConnect}
                    onConnectEnd={canvasMode === 'build' ? onConnectEnd : undefined}
                    onInit={setReactFlowInstance}
                    onDrop={canvasMode === 'build' ? onDrop : undefined}
                    onDragOver={canvasMode === 'build' ? onDragOver : undefined}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onNodeContextMenu={canvasMode === 'build' ? onNodeContextMenu : undefined}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    deleteKeyCode={['Delete', 'Backspace']} // Delete selected nodes with keyboard
                    className="bg-background/90"
                >
                    <Background gap={24} size={1.5} color="hsl(var(--muted-foreground) / 0.4)" />
                    <Controls className="bg-card border-border fill-foreground" />
                    <MiniMap
                        nodeStrokeColor="hsl(var(--border))"
                        maskColor="hsl(var(--background) / 0.85)"
                        className="bg-card border border-border rounded-lg shadow-sm"
                    />
                </ReactFlow>

                {/* Floating Layout Panels */}
                {canvasMode === 'build' && <NodePalette />}
                {canvasMode !== 'execute' && <NodeConfigPanel />}
                {canvasMode === 'execute' && <ExecutionOverlay />}

                {/* Time-Travel Sidebar — Review Mode */}
                {canvasMode === 'review' && (
                    <div className="absolute top-0 right-0 h-full w-72 border-l border-border bg-card/95 backdrop-blur-sm z-30 overflow-hidden flex flex-col">
                        <StateHistoryPanel />
                    </div>
                )}

                {/* Context Menu */}
                {contextMenu && (
                    <CanvasContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
                )}

                {/* Smart Connection Floating Palette */}
                {connectionTarget && (
                    <div 
                        className="fixed z-50 overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl backdrop-blur-md"
                        style={{ left: connectionTarget.x, top: connectionTarget.y, width: 220 }}
                    >
                        <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
                            Suggest node
                        </div>
                        <div className="flex max-h-[300px] flex-col overflow-y-auto p-1 custom-scrollbar">
                            {[
                                { t: 'llm', l: 'LLM' },
                                { t: 'tool', l: 'Tool' },
                                { t: 'condition', l: 'Condition' },
                                { t: 'output', l: 'Output' },
                                { t: 'memory_read', l: 'Memory' },
                            ].map(n => (
                                <button
                                    key={n.t}
                                    onClick={() => addSmartConnectedNode(n.t, n.l)}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                                >
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                    {n.l} node
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* State Schema Inspector (bottom panel) */}
            {canvasMode === 'build' && (
                <div className="h-40 shrink-0 overflow-hidden">
                    <StateSchemaInspector />
                </div>
            )}

            {/* Review Mode Timeline (footer) */}
            {canvasMode === 'review' && <ReviewModeTimeline />}

            {/* HITL OversightDialog — floats above everything when approval is pending */}
            {pendingApproval && activeExecutionId && (
                <OversightDialog executionId={activeExecutionId} />
            )}
        </div>
    )
}

function BuilderDataWrapper() {
    const { id } = useParams()
    const { data: blueprint, isLoading, error } = useBlueprint(id)
    const {
        setNodes, setEdges, setBlueprintName,
        setBlueprintId, setBlueprintStatus, reset
    } = useCanvasStore()

    // Hydrate store on load
    useEffect(() => {
        if (!blueprint) return

        // Reset old state first
        reset()

        setBlueprintId(blueprint.id)
        setBlueprintName(blueprint.name)
        setBlueprintStatus(blueprint.status)

        const def = blueprint.definition as any
        if (def) {
            setNodes(def.nodes || [])
            setEdges(def.edges || [])
        } else {
            setNodes([])
            setEdges([])
        }
    }, [blueprint, setNodes, setEdges, setBlueprintName, setBlueprintId, setBlueprintStatus, reset])

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Loading Blueprint...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-background">
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
                    <h2 className="text-lg font-semibold">Failed to load blueprint</h2>
                    <p className="text-sm opacity-80">{error.message}</p>
                </div>
            </div>
        )
    }

    return <BuilderCanvas />
}

export default function BuilderPage() {
    return (
        <ReactFlowProvider>
            <BuilderDataWrapper />
        </ReactFlowProvider>
    )
}
