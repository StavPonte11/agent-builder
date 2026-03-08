/**
 * DependencyGraphPage — Read-only org-wide dependency canvas.
 * Shows tools (blue), base_prompts (purple), blueprints (green) as React Flow nodes.
 * Full E9.3 implementation.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    ReactFlow, Background, Controls, MiniMap,
    Node, Edge, MarkerType, Panel, BackgroundVariant
} from '@xyflow/react'
import { Boxes, CircleDot, GitBranch, Wrench } from 'lucide-react'

interface DepNode {
    id: string
    label: string
    type: 'blueprint' | 'tool' | 'base_prompt'
    domain?: string
    status?: string
}

interface DepEdge {
    source: string
    target: string
    label: string
}

interface DepGraph {
    nodes: DepNode[]
    edges: DepEdge[]
}

interface SidePanelData {
    nodeId: string
    label: string
    dependents: string[]
}

// ── Custom node colors by type ────────────────────────────────────────────────

const NODE_STYLES = {
    blueprint: {
        bg: 'bg-green-500/10',
        border: 'border-green-500/40',
        text: 'text-green-700 dark:text-green-400',
        rfBg: '#16a34a1a',
        rfBorder: '#16a34a66',
    },
    tool: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/40',
        text: 'text-blue-700 dark:text-blue-400',
        rfBg: '#2563eb1a',
        rfBorder: '#2563eb66',
    },
    base_prompt: {
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/40',
        text: 'text-purple-700 dark:text-purple-400',
        rfBg: '#7c3aed1a',
        rfBorder: '#7c3aed66',
    },
}

function buildRFNodes(nodes: DepNode[]): Node[] {
    // Group by type for layout
    const byType: Record<string, DepNode[]> = { blueprint: [], tool: [], base_prompt: [] }
    nodes.forEach(n => (byType[n.type] ??= []).push(n))

    const result: Node[] = []
    const cols = [byType.blueprint, byType.tool, byType.base_prompt]
    const colX = [100, 500, 900]

    cols.forEach((col, ci) => {
        col.forEach((n, ri) => {
            const style = NODE_STYLES[n.type]
            result.push({
                id: n.id,
                position: { x: colX[ci], y: 80 + ri * 120 },
                data: { label: n.label, type: n.type, domain: n.domain, status: n.status },
                style: {
                    background: style.rfBg,
                    border: `1.5px solid ${style.rfBorder}`,
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--foreground)',
                    minWidth: '160px',
                },
            })
        })
    })
    return result
}

function buildRFEdges(edges: DepEdge[]): Edge[] {
    return edges.map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.label,
        labelStyle: { fontSize: '10px', fill: 'var(--muted-foreground)' },
        labelBgStyle: { fill: 'var(--background)', opacity: 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        style: { strokeWidth: 1.5, stroke: '#6366f1' },
        animated: false,
    }))
}

export function DependencyGraphPage() {
    const [sidePanel, setSidePanel] = useState<SidePanelData | null>(null)

    const { data, isLoading } = useQuery<DepGraph>({
        queryKey: ['dependency-graph'],
        queryFn: () => fetch('/api/v1/admin/dependency-graph').then(r => r.json()),
        staleTime: 60_000,
    })

    const nodes: Node[] = data ? buildRFNodes(data.nodes) : []
    const edges: Edge[] = data ? buildRFEdges(data.edges) : []

    const handleNodeClick = async (_: React.MouseEvent, node: Node) => {
        const res = await fetch(`/api/v1/blueprints/${node.id}/dependents`)
        const deps = await res.json()
        setSidePanel({
            nodeId: node.id,
            label: node.data.label as string,
            dependents: deps.map((d: { name: string }) => d.name),
        })
    }

    const legend = [
        { type: 'blueprint' as const, label: 'Blueprints', icon: Boxes },
        { type: 'tool' as const, label: 'Tools', icon: Wrench },
        { type: 'base_prompt' as const, label: 'Base Prompts', icon: CircleDot },
    ]

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="border-b border-border bg-card/80 shrink-0">
                <div className="max-w-full px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Dependency Graph</h1>
                        <p className="text-sm text-muted-foreground">
                            Org-wide view of blueprint, tool, and base prompt dependencies
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {legend.map(({ type, label, icon: Icon }) => {
                            const s = NODE_STYLES[type]
                            return (
                                <div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <div className={`h-3 w-3 rounded-sm border ${s.bg} ${s.border}`} />
                                    <Icon className={`h-3.5 w-3.5 ${s.text}`} />
                                    {label}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        Loading dependency graph…
                    </div>
                ) : (
                    <div className="flex h-full">
                        <div className="flex-1">
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodeClick={handleNodeClick}
                                fitView
                                fitViewOptions={{ padding: 0.2 }}
                                nodesDraggable={false}
                                nodesConnectable={false}
                                elementsSelectable={true}
                            >
                                <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
                                <Controls showInteractive={false} />
                                <MiniMap
                                    nodeColor={(n) => NODE_STYLES[(n.data?.type as keyof typeof NODE_STYLES) ?? 'blueprint']?.rfBorder ?? '#6366f1'}
                                    style={{ background: 'var(--card)' }}
                                />
                                <Panel position="top-left">
                                    <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm px-3 py-2 text-xs text-muted-foreground">
                                        <GitBranch className="h-3.5 w-3.5 inline mr-1.5" />
                                        {data?.nodes.length ?? 0} nodes · {data?.edges.length ?? 0} dependencies
                                    </div>
                                </Panel>
                            </ReactFlow>
                        </div>

                        {/* Side panel */}
                        {sidePanel && (
                            <div className="w-72 border-l border-border bg-card flex flex-col">
                                <div className="flex items-center justify-between border-b border-border p-4">
                                    <h3 className="font-semibold text-sm text-foreground truncate">{sidePanel.label}</h3>
                                    <button onClick={() => setSidePanel(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                                        USED BY ({sidePanel.dependents.length})
                                    </p>
                                    {sidePanel.dependents.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No dependents</p>
                                    ) : (
                                        <ul className="space-y-1">
                                            {sidePanel.dependents.map(name => (
                                                <li key={name} className="text-sm text-foreground py-1 border-b border-border/50 last:border-0">
                                                    {name}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
