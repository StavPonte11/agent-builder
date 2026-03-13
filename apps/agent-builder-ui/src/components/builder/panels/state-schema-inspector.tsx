/**
 * StateSchemaInspector — Bottom panel that derives the state field schema
 * from node input/output mappings and highlights orphaned or undefined fields.
 */
import { useMemo, useCallback } from 'react'
import { AlertTriangle, ArrowRight, Database, Info } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvasStore'
import type { DerivedStateField } from '@/types/blueprint'
import type { Node } from '@xyflow/react'
import type { MappingEntry } from '@/types/blueprint'

// ─── Derivation Logic ─────────────────────────────────────────────────────────

function deriveStateFields(nodes: Node[]): DerivedStateField[] {
    // Collect all writes (output_mapping) and reads (input_mapping) per field
    const written: Record<string, string[]> = {}  // field → [nodeId]
    const read: Record<string, string[]> = {}      // field → [nodeId]

    for (const node of nodes) {
        const d = node.data as Record<string, unknown>
        const nodeId = node.id
        const nodeLabel = (d.label as string) || nodeId

        // Output mappings write to state fields
        const rawOutput = d.output_mapping as MappingEntry[] | undefined
        const outputMappings = Array.isArray(rawOutput) ? rawOutput : []
        for (const m of outputMappings) {
            if (!m.param) continue
            if (!written[m.param]) written[m.param] = []
            written[m.param].push(nodeLabel)
        }

        // Input mappings read from state fields (via expressions like {{ state.field }})
        const rawInput = d.input_mapping as MappingEntry[] | undefined
        const inputMappings = Array.isArray(rawInput) ? rawInput : []
        for (const m of inputMappings) {
            if (!m.expression) continue
            const matches = m.expression.matchAll(/\{\{[\s]*state\.([\w.]+)[\s]*\}\}/g)
            for (const match of matches) {
                const field = match[1]
                if (!read[field]) read[field] = []
                read[field].push(nodeLabel)
            }
        }

        // Also scan Jinja2 expressions in type-specific fields
        const jinja2Fields = ['iterate_over', 'expression', 'context_template', 'routing_prompt']
        for (const fieldName of jinja2Fields) {
            const expr = d[fieldName] as string | undefined
            if (!expr) continue
            const matches = expr.matchAll(/\{\{[\s]*state\.([\w.]+)[\s]*\}\}/g)
            for (const match of matches) {
                const field = match[1]
                if (!read[field]) read[field] = []
                if (!read[field].includes(nodeLabel)) read[field].push(nodeLabel)
            }
        }
    }

    // Union all field names
    const allFields = new Set([...Object.keys(written), ...Object.keys(read)])

    return Array.from(allFields).sort().map((field) => ({
        field,
        type: 'any',  // Could be inferred from output_schema in a future pass
        written_by: written[field]?.[0] ?? '',
        read_by: read[field] ?? [],
        is_orphaned: !!written[field]?.length && !read[field]?.length,
        is_undefined: !written[field]?.length && !!read[field]?.length,
    }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StateSchemaInspector() {
    const nodes = useCanvasStore((s) => s.nodes)
    const highlightedFieldNodes = useCanvasStore((s) => s.highlightedFieldNodes)
    const highlightFieldNodes = useCanvasStore((s) => s.highlightFieldNodes)
    const clearHighlight = useCanvasStore((s) => s.clearHighlight)
    const canvasMode = useCanvasStore((s) => s.canvasMode)

    const fields = useMemo(() => deriveStateFields(nodes), [nodes])
    const warnings = fields.filter((f) => f.is_orphaned || f.is_undefined)

    const handleFieldClick = useCallback((field: DerivedStateField) => {
        if (
            highlightedFieldNodes.producer === field.written_by &&
            JSON.stringify(highlightedFieldNodes.consumers) === JSON.stringify(field.read_by)
        ) {
            clearHighlight()
            return
        }
        // Find node IDs by label
        const producerNode = nodes.find((n) => (n.data.label as string) === field.written_by)
        const consumerIds = field.read_by.map((label) => nodes.find((n) => (n.data.label as string) === label)?.id).filter(Boolean) as string[]
        highlightFieldNodes(producerNode?.id ?? null, consumerIds)
    }, [nodes, highlightedFieldNodes, highlightFieldNodes, clearHighlight])

    if (canvasMode === 'execute') return null

    return (
        <div className="border-t border-border bg-card/80 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">State Schema</span>
                        <span className="text-[10px] text-muted-foreground">{fields.length} fields</span>
                        {warnings.length > 0 && (
                            <span className="flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3" />
                                {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <span className="text-[9px] text-muted-foreground ml-5 mt-0.5">
                        Shared memory fields extracted from your nodes' Jinja templates (e.g. {'{{state.user_query}}'})
                    </span>
                </div>

                {highlightedFieldNodes.producer || highlightedFieldNodes.consumers.length > 0 ? (
                    <button onClick={clearHighlight} className="text-[10px] text-muted-foreground hover:text-foreground">
                        Clear highlight
                    </button>
                ) : (
                    <span className="text-[10px] text-muted-foreground">Click a field to highlight producers & consumers</span>
                )}
            </div>

            {/* Table */}
            {fields.length === 0 ? (
                <div className="flex items-center justify-center gap-2 px-4 py-3 text-[11px] text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    No state fields defined yet. Add Input/Output Mappings in node config.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="border-t border-border/50 bg-muted/30">
                                <th className="px-4 py-1.5 text-left font-medium text-muted-foreground">STATE FIELD</th>
                                <th className="px-4 py-1.5 text-left font-medium text-muted-foreground">WRITTEN BY</th>
                                <th className="px-4 py-1.5 text-left font-medium text-muted-foreground">READ BY</th>
                                <th className="px-4 py-1.5 text-left font-medium text-muted-foreground">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((field) => {
                                const isHighlighted =
                                    highlightedFieldNodes.producer === field.written_by ||
                                    field.read_by.some((r) => highlightedFieldNodes.consumers.some((c) => c === r))
                                return (
                                    <tr
                                        key={field.field}
                                        onClick={() => handleFieldClick(field)}
                                        className={`cursor-pointer border-t border-border/30 transition-colors hover:bg-muted/50 ${isHighlighted ? 'bg-primary/5' : ''}`}
                                    >
                                        <td className="px-4 py-1.5">
                                            <span className="font-mono font-medium text-foreground">{field.field}</span>
                                        </td>
                                        <td className="px-4 py-1.5">
                                            {field.written_by ? (
                                                <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400 font-medium">
                                                    {field.written_by}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-1.5">
                                            <div className="flex flex-wrap gap-1">
                                                {field.read_by.length > 0 ? (
                                                    field.read_by.map((r) => (
                                                        <span key={r} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400 font-medium">
                                                            {r}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-muted-foreground italic">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-1.5">
                                            {field.is_orphaned && (
                                                <span className="flex items-center gap-1 text-amber-500">
                                                    <AlertTriangle className="h-3 w-3" /> Orphaned
                                                </span>
                                            )}
                                            {field.is_undefined && (
                                                <span className="flex items-center gap-1 text-red-500">
                                                    <AlertTriangle className="h-3 w-3" /> Undefined source
                                                </span>
                                            )}
                                            {!field.is_orphaned && !field.is_undefined && (
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <ArrowRight className="h-3 w-3" /> OK
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
