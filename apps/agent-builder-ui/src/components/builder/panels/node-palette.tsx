import { motion } from 'framer-motion'
import { Play, BrainCircuit, Wrench, Split, Database, CheckSquare, Code, ArrowRightSquare } from 'lucide-react'

const NODE_TYPES = [
    { type: 'trigger', label: 'Trigger', icon: Play, desc: 'Start workflow', color: 'text-green-500' },
    { type: 'llm', label: 'LLM Call', icon: BrainCircuit, desc: 'Generate text', color: 'text-purple-500' },
    { type: 'tool', label: 'Tool', icon: Wrench, desc: 'Execute MCP Tool', color: 'text-blue-500' },
    { type: 'router', label: 'Router', icon: Split, desc: 'Branch logic', color: 'text-orange-500' },
    { type: 'memory_read', label: 'Read Memory', icon: Database, desc: 'Get state', color: 'text-cyan-500' },
    { type: 'memory_write', label: 'Write Memory', icon: Database, desc: 'Save state', color: 'text-cyan-600' },
    { type: 'approval', label: 'Approval', icon: CheckSquare, desc: 'Human in loop', color: 'text-amber-500' },
    { type: 'code', label: 'Code', icon: Code, desc: 'Python script', color: 'text-pink-500' },
    { type: 'output', label: 'Output', icon: ArrowRightSquare, desc: 'End and return', color: 'text-slate-500' },
]

export function NodePalette() {
    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType)
        event.dataTransfer.setData('application/reactflow-label', label)
        event.dataTransfer.effectAllowed = 'move'
    }

    return (
        <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            className="absolute bottom-4 left-4 top-4 z-10 flex w-64 flex-col rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md"
        >
            <div className="mb-4">
                <h3 className="font-semibold text-foreground">Node Library</h3>
                <p className="text-xs text-muted-foreground">Drag and drop nodes onto the canvas</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {NODE_TYPES.map((node) => (
                    <div
                        key={node.type}
                        className="group flex cursor-grab items-center gap-3 rounded-lg border border-border/50 bg-surface p-2.5 transition-all hover:border-primary/50 hover:bg-accent hover:shadow-sm active:cursor-grabbing"
                        onDragStart={(e) => onDragStart(e, node.type, node.label)}
                        draggable
                    >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-md bg-background ${node.color} shadow-sm group-hover:scale-110 transition-transform`}>
                            <node.icon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{node.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight">{node.desc}</span>
                        </div>
                    </div>
                ))}
            </div>
        </motion.aside>
    )
}
