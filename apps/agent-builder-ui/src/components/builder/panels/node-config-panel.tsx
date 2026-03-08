import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '@/stores/canvasStore'

export function NodeConfigPanel() {
    const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
    const nodes = useCanvasStore((s) => s.nodes)
    const updateNodeData = useCanvasStore((s) => s.updateNodeData)
    const selectNode = useCanvasStore((s) => s.selectNode)

    const selectedNode = nodes.find((n) => n.id === selectedNodeId)

    return (
        <AnimatePresence>
            {selectedNode && (
                <motion.aside
                    initial={{ x: 300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 300, opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    className="absolute bottom-4 right-4 top-4 z-10 flex w-80 flex-col rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border p-4">
                        <h3 className="font-semibold text-foreground">Configure Node</h3>
                        <button
                            onClick={() => selectNode(null)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-foreground">
                                    Node Label
                                </label>
                                <input
                                    type="text"
                                    value={selectedNode.data.label as string || ''}
                                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                                    placeholder="Enter a descriptive name"
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-foreground">
                                    Node Type
                                </label>
                                <div className="rounded-md bg-muted px-3 py-1.5 text-sm font-mono text-muted-foreground uppercase">
                                    {selectedNode.type}
                                </div>
                            </div>

                            {/* Dynamic fields based on node type */}
                            {selectedNode.type === 'llm' && (
                                <>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-foreground">
                                            Model
                                        </label>
                                        <select
                                            value={selectedNode.data.model as string || 'gpt-4o-mini'}
                                            onChange={(e) => updateNodeData(selectedNode.id, { model: e.target.value })}
                                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        >
                                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                                            <option value="gpt-4o">GPT-4o</option>
                                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-foreground">
                                            System Prompt
                                        </label>
                                        <textarea
                                            value={selectedNode.data.prompt as string || ''}
                                            onChange={(e) => updateNodeData(selectedNode.id, { prompt: e.target.value })}
                                            className="min-h-[120px] w-full resize-y rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                                            placeholder="Enter instructions for the LLM..."
                                        />
                                    </div>
                                </>
                            )}

                            {selectedNode.type === 'code' && (
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-foreground">
                                        Python Code
                                    </label>
                                    <textarea
                                        value={selectedNode.data.code as string || ''}
                                        onChange={(e) => updateNodeData(selectedNode.id, { code: e.target.value })}
                                        className="min-h-[200px] w-full resize-y rounded-md border border-border bg-gray-900 p-3 font-mono text-xs text-green-400 outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="def execute(state):&#10;    return state"
                                        spellCheck={false}
                                    />
                                </div>
                            )}

                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}
