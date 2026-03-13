/**
 * NodePalette — Full 4-section palette: Core Primitives, YOUR TOOLS,
 * YOUR BLUEPRINTS, TEMPLATES. Fetches live tool catalog and blueprint list.
 */
import { useCallback, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Play, BrainCircuit, Wrench, GitBranch, SplitSquareHorizontal,
    CheckSquare, Code, ArrowRightSquare, Database, MemoryStick,
    Shuffle, Repeat2, Scale, Package, ChevronDown, ChevronRight,
    Search, Zap, LayoutTemplate, Circle
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Tool, ToolHealthStatus } from '@/types/blueprint'

// ─── Node Definitions ─────────────────────────────────────────────────────────

interface PaletteNode {
    type: string
    label: string
    icon: React.ElementType
    desc: string
    color: string
    category: 'core' | 'composite'
}

const CORE_NODES: PaletteNode[] = [
    { type: 'trigger', label: 'Trigger', icon: Play, desc: 'Entry point for the workflow', color: 'text-green-500', category: 'core' },
    { type: 'llm', label: 'LLM', icon: BrainCircuit, desc: 'Call any language model', color: 'text-purple-500', category: 'core' },
    { type: 'tool', label: 'Tool', icon: Wrench, desc: 'Call a registered tool capability', color: 'text-blue-500', category: 'core' },
    { type: 'condition', label: 'Condition', icon: GitBranch, desc: 'Jinja2 if/else branch — no LLM', color: 'text-orange-500', category: 'core' },
    { type: 'router', label: 'Router', icon: Shuffle, desc: 'LLM-powered multi-way routing', color: 'text-amber-500', category: 'core' },
    { type: 'approval', label: 'Approval', icon: CheckSquare, desc: 'Pause for human decision', color: 'text-yellow-500', category: 'core' },
    { type: 'memory_read', label: 'Memory Read', icon: Database, desc: 'Read from Redis or Postgres', color: 'text-cyan-500', category: 'core' },
    { type: 'memory_write', label: 'Memory Write', icon: MemoryStick, desc: 'Write to Redis or Postgres', color: 'text-cyan-600', category: 'core' },
    { type: 'code', label: 'Code', icon: Code, desc: 'Run sandboxed Python', color: 'text-pink-500', category: 'core' },
    { type: 'sub_blueprint', label: 'Sub-Blueprint', icon: Package, desc: 'Call another blueprint as child', color: 'text-indigo-500', category: 'core' },
    { type: 'output', label: 'Output', icon: ArrowRightSquare, desc: 'Return value — terminal node', color: 'text-slate-400', category: 'core' },
]

const COMPOSITE_NODES: PaletteNode[] = [
    { type: 'parallel_fork', label: 'Parallel Fork', icon: SplitSquareHorizontal, desc: 'Fan out to N branches concurrently', color: 'text-violet-500', category: 'composite' },
    { type: 'loop', label: 'Loop', icon: Repeat2, desc: 'Iterate over a list in state', color: 'text-teal-500', category: 'composite' },
    { type: 'llm_judge', label: 'LLM Judge', icon: Scale, desc: 'Evaluate output against a rubric', color: 'text-rose-500', category: 'composite' },
    { type: 'supervisor', label: 'Swarm Supervisor', icon: Circle, desc: 'Multi-Agent orchestrator', color: 'text-fuchsia-500', category: 'composite' },
]

// ─── Health Badge ─────────────────────────────────────────────────────────────

function HealthDot({ status }: { status?: ToolHealthStatus }) {
    const colorMap: Record<ToolHealthStatus, string> = {
        healthy: 'bg-green-500',
        degraded: 'bg-amber-500',
        offline: 'bg-red-500',
        unknown: 'bg-slate-400',
    }
    return (
        <span
            className={`inline-block h-2 w-2 rounded-full shrink-0 ${colorMap[status ?? 'unknown']}`}
            title={`Tool status: ${status ?? 'unknown'}`}
        />
    )
}

// ─── Palette Item ─────────────────────────────────────────────────────────────

interface PaletteItemProps {
    type: string
    label: string
    icon: React.ElementType
    desc: string
    colorClass: string
    extra?: React.ReactNode
    onDragStart: (e: React.DragEvent, type: string, label: string) => void
}

function PaletteItem({ type, label, icon: Icon, desc, colorClass, extra, onDragStart }: PaletteItemProps) {
    return (
        <div
            className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border/40 bg-background/60 p-2 transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm active:cursor-grabbing"
            draggable
            onDragStart={(e) => onDragStart(e, type, label)}
        >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted ${colorClass} transition-transform group-hover:scale-110`}>
                <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{desc}</p>
            </div>
            {extra}
        </div>
    )
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
    title: string
    icon: React.ElementType
    count?: number
    children: React.ReactNode
    defaultOpen?: boolean
}

function Section({ title, icon: Icon, count, children, defaultOpen = true }: SectionProps) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="mb-1">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
                <Icon className="h-3 w-3" />
                <span className="flex-1">{title}</span>
                {count !== undefined && (
                    <span className="rounded px-1 font-mono text-[9px] bg-muted">{count}</span>
                )}
                {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-1 pb-2 pt-0.5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Main Palette ─────────────────────────────────────────────────────────────

export function NodePalette() {
    const [search, setSearch] = useState('')

    const { data: tools = [] } = useQuery<Tool[]>({
        queryKey: ['tools'],
        queryFn: async () => {
            const res = await fetch('/api/v1/tools')
            if (!res.ok) return []
            return res.json()
        },
        refetchInterval: 30_000, // refresh health every 30s
    })

    const { data: subBlueprints = [] } = useQuery<{ id: string; name: string; domain: string; version: string; published_at: string }[]>({
        queryKey: ['blueprints', 'sub_blueprint', 'published'],
        queryFn: async () => {
            const res = await fetch('/api/v1/blueprints?type=sub_blueprint&status=published')
            if (!res.ok) return []
            return res.json()
        },
    })

    const { data: templates = [] } = useQuery<{ id: string; name: string; description: string; node_count: number }[]>({
        queryKey: ['templates'],
        queryFn: async () => {
            const res = await fetch('/api/v1/templates')
            if (!res.ok) return []
            return res.json()
        },
    })

    const onDragStart = useCallback((e: React.DragEvent, nodeType: string, label: string) => {
        e.dataTransfer.setData('application/reactflow', nodeType)
        e.dataTransfer.setData('application/reactflow-label', label)
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const onToolDragStart = useCallback((e: React.DragEvent, tool: Tool) => {
        e.dataTransfer.setData('application/reactflow', 'tool')
        e.dataTransfer.setData('application/reactflow-label', (tool as any).display_name || tool.name)
        e.dataTransfer.setData('application/reactflow-tool-id', (tool as any).id || tool.tool_id || tool.name)
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const onSubBlueprintDragStart = useCallback((e: React.DragEvent, bp: { id: string; name: string }) => {
        e.dataTransfer.setData('application/reactflow', 'sub_blueprint')
        e.dataTransfer.setData('application/reactflow-label', bp.name)
        e.dataTransfer.setData('application/reactflow-blueprint-id', bp.id)
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const onTemplateDragStart = useCallback((e: React.DragEvent, templateId: string) => {
        e.dataTransfer.setData('application/reactflow-template', templateId)
        e.dataTransfer.effectAllowed = 'move'
    }, [])

    const q = search.toLowerCase()
    const filteredCore = useMemo(
        () => CORE_NODES.filter((n) => !q || n.label.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)),
        [q]
    )
    const filteredComposite = useMemo(
        () => COMPOSITE_NODES.filter((n) => !q || n.label.toLowerCase().includes(q) || n.desc.toLowerCase().includes(q)),
        [q]
    )
    const filteredTools = useMemo(
        () => tools.filter((t) => !q || t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)),
        [tools, q]
    )
    const filteredBlueprints = useMemo(
        () => subBlueprints.filter((b) => !q || b.name.toLowerCase().includes(q)),
        [subBlueprints, q]
    )
    const filteredTemplates = useMemo(
        () => templates.filter((t) => !q || t.name.toLowerCase().includes(q)),
        [templates, q]
    )

    return (
        <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="absolute bottom-4 left-4 top-4 z-10 flex w-64 flex-col rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md overflow-hidden"
        >
            {/* Header */}
            <div className="border-b border-border px-3 py-3">
                <h3 className="mb-2 text-sm font-semibold text-foreground">Node Library</h3>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search nodes..."
                        className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-xs outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-2 pt-2 custom-scrollbar">
                {/* Core Primitives */}
                <Section title="Core Primitives" icon={Zap} count={filteredCore.length + filteredComposite.length}>
                    {filteredCore.map((node) => (
                        <PaletteItem
                            key={node.type}
                            type={node.type}
                            label={node.label}
                            icon={node.icon}
                            desc={node.desc}
                            colorClass={node.color}
                            onDragStart={onDragStart}
                        />
                    ))}
                </Section>

                {/* Composite Nodes */}
                {filteredComposite.length > 0 && (
                    <Section title="Composite" icon={Package} defaultOpen={true}>
                        {filteredComposite.map((node) => (
                            <PaletteItem
                                key={node.type}
                                type={node.type}
                                label={node.label}
                                icon={node.icon}
                                desc={node.desc}
                                colorClass={node.color}
                                onDragStart={onDragStart}
                            />
                        ))}
                    </Section>
                )}

                {/* YOUR TOOLS */}
                <Section title="Your Tools" icon={Wrench} count={filteredTools.length}>
                    {filteredTools.length === 0 && (
                        <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                            No tools registered yet.
                        </p>
                    )}
                    {filteredTools.map((tool) => (
                        <div
                            key={(tool as any).id || tool.tool_id || tool.name}
                            className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border/40 bg-background/60 p-2 transition-all hover:border-cyan-500/40 hover:bg-accent hover:shadow-sm active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => onToolDragStart(e, tool)}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-500 transition-transform group-hover:scale-110">
                                <Wrench className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground leading-tight truncate">{(tool as any).display_name || tool.name}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight truncate">{tool.description || (tool as any).tool_type}</p>
                            </div>
                            <HealthDot status={tool.health_status} />
                        </div>
                    ))}
                </Section>

                {/* YOUR BLUEPRINTS */}
                <Section title="Your Blueprints" icon={Package} count={filteredBlueprints.length} defaultOpen={false}>
                    {filteredBlueprints.length === 0 && (
                        <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                            No published sub-blueprints.
                        </p>
                    )}
                    {filteredBlueprints.map((bp) => (
                        <div
                            key={bp.id}
                            className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-border/40 bg-background/60 p-2 transition-all hover:border-primary/40 hover:bg-accent active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => onSubBlueprintDragStart(e, bp)}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
                                <Package className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground leading-tight truncate">{bp.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] font-mono text-muted-foreground bg-muted rounded px-1">v{bp.version}</span>
                                    <span className="text-[9px] text-muted-foreground truncate">{bp.domain}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </Section>

                {/* TEMPLATES */}
                <Section title="Templates" icon={LayoutTemplate} count={filteredTemplates.length} defaultOpen={false}>
                    {filteredTemplates.length === 0 && (
                        <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                            No templates available.
                        </p>
                    )}
                    {filteredTemplates.map((tmpl) => (
                        <div
                            key={tmpl.id}
                            className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-dashed border-border/60 bg-background/40 p-2 transition-all hover:border-primary/40 hover:bg-accent active:cursor-grabbing"
                            draggable
                            onDragStart={(e) => onTemplateDragStart(e, tmpl.id)}
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-slate-400">
                                <LayoutTemplate className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground leading-tight truncate">{tmpl.name}</p>
                                <p className="text-[10px] text-muted-foreground">{tmpl.node_count} nodes</p>
                            </div>
                        </div>
                    ))}
                </Section>

                <div className="h-4" />
            </div>
        </motion.aside>
    )
}

