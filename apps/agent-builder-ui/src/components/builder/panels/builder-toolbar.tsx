/**
 * BuilderToolbar — Top bar of the canvas with blueprint name (inline edit),
 * undo/redo, save, NL generation bar, Validate, Estimate Cost, and mode switcher.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
    Save, Undo, Redo, Play, CloudUpload, Sparkles, CheckCircle2,
    AlertTriangle, DollarSign, LayoutGrid, Loader2, ChevronDown, X
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useCanvasStore } from '@/stores/canvasStore'
import { serializeBlueprint } from '@/lib/blueprint-serializer'
import type { ValidationResult, CostEstimate } from '@/types/blueprint'

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
    validating: 'bg-blue-500/15 text-blue-500 border-blue-500/20 animate-pulse',
    testing: 'bg-purple-500/15 text-purple-500 border-purple-500/20',
    pending_approval: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
    published: 'bg-green-500/15 text-green-500 border-green-500/20',
    archived: 'bg-slate-400/15 text-slate-400 border-slate-400/20',
    paused: 'bg-red-500/15 text-red-500 border-red-500/20',
}

export function BuilderToolbar() {
    const { id } = useParams()
    const {
        undo, redo, past, future, nodes, edges, isDirty,
        blueprintName, blueprintStatus, reviewExecutionId,
        setBlueprintName, validationResult, costEstimate,
        setValidationResult, setCostEstimate, setBlueprintStatus,
        canvasMode, setCanvasMode
    } = useCanvasStore()

    const canUndo = past.length > 0
    const canRedo = future.length > 0

    // ── Inline name editing ──────────────────────────────────────────────────
    const [editingName, setEditingName] = useState(false)
    const [nameValue, setNameValue] = useState(blueprintName)
    const nameRef = useRef<HTMLInputElement>(null)

    useEffect(() => { setNameValue(blueprintName) }, [blueprintName])
    useEffect(() => { if (editingName) nameRef.current?.select() }, [editingName])

    const commitName = () => {
        setBlueprintName(nameValue.trim() || 'Untitled Blueprint')
        setEditingName(false)
    }

    // ── NL Generation ────────────────────────────────────────────────────────
    const [nlPrompt, setNlPrompt] = useState('')
    const [nlLoading, setNlLoading] = useState(false)
    const [nlError, setNlError] = useState<string | null>(null)

    const handleGenerate = useCallback(async () => {
        if (!nlPrompt.trim()) return
        setNlLoading(true)
        setNlError(null)
        try {
            const res = await fetch('/api/v1/blueprints/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: nlPrompt,
                    existing_nodes: nodes.length > 0 ? nodes : undefined,
                    existing_edges: edges.length > 0 ? edges : undefined,
                    iterative: nodes.length > 0,
                }),
            })
            if (!res.ok) throw new Error(await res.text())
            const data = await res.json()

            const { setNodes, setEdges } = useCanvasStore.getState()

            if (nodes.length === 0) {
                // Replace entirely
                setNodes(data.nodes ?? [])
                setEdges(data.edges ?? [])
            } else {
                // Iterative: append generated nodes
                setNodes([...nodes, ...(data.new_nodes ?? [])])
                setEdges([...edges, ...(data.new_edges ?? [])])
            }
            setNlPrompt('')
        } catch (err: any) {
            setNlError(err.message ?? 'Generation failed')
        } finally {
            setNlLoading(false)
        }
    }, [nlPrompt, nodes, edges])

    // ── Save ─────────────────────────────────────────────────────────────────
    const [saving, setSaving] = useState(false)
    const handleSave = async () => {
        if (!id) return
        setSaving(true)
        try {
            const payload = serializeBlueprint(nodes, edges)
            await fetch(`/api/v1/blueprints/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ definition: payload }),
            })
        } finally {
            setSaving(false)
        }
    }

    // ── Validate ─────────────────────────────────────────────────────────────
    const [validating, setValidating] = useState(false)
    const handleValidate = async () => {
        setValidating(true)
        try {
            const payload = serializeBlueprint(nodes, edges)
            const res = await fetch('/api/v1/blueprints/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ definition: payload }),
            })
            const result: ValidationResult = await res.json()
            setValidationResult(result)
        } finally {
            setValidating(false)
        }
    }

    // ── Estimate Cost ─────────────────────────────────────────────────────────
    const [estimating, setEstimating] = useState(false)
    const [showCostPopover, setShowCostPopover] = useState(false)

    const handleEstimateCost = async () => {
        if (!id) return
        setEstimating(true)
        try {
            const res = await fetch(`/api/v1/blueprints/${id}/estimate-cost`)
            const estimate: CostEstimate = await res.json()
            setCostEstimate(estimate)
            setShowCostPopover(true)
        } finally {
            setEstimating(false)
        }
    }

    const errorCount = validationResult?.errors.length ?? 0
    const warnCount = validationResult?.warnings.length ?? 0

    return (
        <div className="flex-col w-full border-b border-border bg-card">
            {/* Main toolbar row */}
            <div className="flex h-12 w-full items-center justify-between px-4 gap-3">
                {/* Left: Blueprint name + status */}
                <div className="flex items-center gap-2 min-w-0">
                    {editingName ? (
                        <input
                            ref={nameRef}
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={commitName}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                            className="max-w-52 rounded border border-primary bg-background px-2 py-0.5 text-sm font-semibold text-foreground outline-none"
                            autoFocus
                        />
                    ) : (
                        <button
                            onClick={() => setEditingName(true)}
                            className="max-w-52 truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
                            title="Click to rename"
                        >
                            {blueprintName}
                        </button>
                    )}
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_COLORS[blueprintStatus] ?? STATUS_COLORS.draft}`}>
                        {blueprintStatus.replace('_', ' ')}
                    </span>
                    {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved changes" />}
                </div>

                {/* Center: Undo / Redo / Save */}
                <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 p-1">
                    <button onClick={undo} disabled={!canUndo} className="rounded p-1.5 text-foreground transition hover:bg-background disabled:opacity-40" title="Undo (Ctrl+Z)">
                        <Undo className="h-4 w-4" />
                    </button>
                    <button onClick={redo} disabled={!canRedo} className="rounded p-1.5 text-foreground transition hover:bg-background disabled:opacity-40" title="Redo (Ctrl+Shift+Z)">
                        <Redo className="h-4 w-4" />
                    </button>
                    <div className="mx-1 h-4 w-px bg-border" />
                    <button
                        onClick={handleSave}
                        disabled={saving || !isDirty}
                        className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-40"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save
                    </button>
                </div>

                {/* Right: Validate, Cost, Test Run, Publish */}
                <div className="flex items-center gap-2">
                    {/* Validation badge */}
                    {validationResult && (
                        <button
                            onClick={() => setValidationResult(null)}
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition ${validationResult.valid ? 'border-green-500/30 bg-green-500/10 text-green-600' : 'border-red-500/30 bg-red-500/10 text-red-600'}`}
                        >
                            {validationResult.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                            {validationResult.valid ? 'Valid' : `${errorCount}E ${warnCount}W`}
                            <X className="h-3 w-3 ml-1 opacity-60" />
                        </button>
                    )}

                    <button
                        onClick={handleValidate}
                        disabled={validating}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
                    >
                        {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Validate
                    </button>

                    <div className="relative">
                        <button
                            onClick={handleEstimateCost}
                            disabled={estimating}
                            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
                        >
                            {estimating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" />}
                            {costEstimate ? `~$${costEstimate.total_cost_usd.toFixed(4)}` : 'Est. Cost'}
                        </button>
                        {showCostPopover && costEstimate && (
                            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-card p-3 shadow-xl">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-xs font-semibold">Cost Breakdown</p>
                                    <button onClick={() => setShowCostPopover(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                </div>
                                {costEstimate.nodes.map((n) => (
                                    <div key={n.node_id} className="flex justify-between text-[11px] py-0.5">
                                        <span className="text-muted-foreground truncate">{n.node_label}</span>
                                        <span className="font-mono">${n.estimated_cost_usd.toFixed(4)}</span>
                                    </div>
                                ))}
                                <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs font-semibold">
                                    <span>Total</span>
                                    <span className="font-mono">${costEstimate.total_cost_usd.toFixed(4)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="h-4 w-px bg-border" />

                    {/* Canvas mode switcher */}
                    <div className="flex rounded-md border border-border bg-muted/50 p-0.5 text-xs">
                        {(['build', 'execute', 'review'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setCanvasMode(mode)}
                                disabled={mode === 'review' && !reviewExecutionId}
                                className={`rounded px-2 py-1 font-medium capitalize transition ${canvasMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-default'}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => { }}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                    >
                        <Play className="h-3.5 w-3.5 text-green-500" />
                        Test Run
                    </button>

                    <button
                        className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                        <CloudUpload className="h-3.5 w-3.5" />
                        Publish
                    </button>
                </div>
            </div>

            {/* NL Generation bar */}
            <div className="border-t border-border bg-muted/30 px-4 py-2">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-purple-500" />
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                        <input
                            type="text"
                            value={nlPrompt}
                            onChange={(e) => setNlPrompt(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleGenerate() }}
                            placeholder={nodes.length > 0 ? 'Modify canvas… e.g. "Add an approval gate before the email step"' : 'Describe your workflow… e.g. "When a webhook fires, classify intent, call CRM tool, then draft a reply"'}
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        {nlPrompt && (
                            <button onClick={() => setNlPrompt('')} className="text-muted-foreground hover:text-foreground">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={!nlPrompt.trim() || nlLoading}
                        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                    >
                        {nlLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {nlLoading ? 'Generating…' : 'Generate'}
                    </button>
                </div>
                {nlError && (
                    <p className="mt-1 text-[11px] text-red-500">{nlError}</p>
                )}
                {nodes.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Canvas has {nodes.length} nodes. Your prompt will be applied as an iterative modification.
                    </p>
                )}
            </div>
        </div>
    )
}
