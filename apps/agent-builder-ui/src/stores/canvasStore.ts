/**
 * canvasStore — Central state for the visual canvas.
 * Manages canvas mode (build/execute/review), node/edge state,
 * undo/redo history, and live execution status.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Edge, Node } from '@xyflow/react'
import type {
    CanvasMode,
    NodeStatus,
    BlueprintStatus,
    DerivedStateField,
    ValidationResult,
    CostEstimate,
} from '@/types/blueprint'

interface HistoryEntry {
    nodes: Node[]
    edges: Edge[]
}

// Per-node execution data shown in Execute/Review modes
interface NodeExecutionData {
    status: NodeStatus
    outputPreview?: string
    errorMessage?: string
    errorType?: string
    attempt?: number
    maxAttempts?: number
    durationMs?: number
    tokenUsage?: { prompt: number; completion: number; total: number }
    streamingChunk?: string  // accumulates LLM stream chunks
    inputSnapshot?: unknown  // for Review mode I/O panel
    outputSnapshot?: unknown
    reason?: string         // for skipped nodes
}

// Per-approval gate data
interface ApprovalData {
    approvalId: string
    nodeId: string
    context: string
    timeoutMinutes: number
    createdAt: string
}

interface ExecutionMeta {
    blueprintName?: string
    version?: string
    cumulativeTokens: number
    cumulativeCostUsd: number
    budgetPctUsed: number
    elapsedMs: number
    completedNodes: number
    totalNodes: number
    estimatedCostUsd?: number
}

interface CanvasState {
    // ── Blueprint Identity ────────────────────────────────────────
    blueprintId: string | null
    blueprintName: string
    blueprintStatus: BlueprintStatus
    isDirty: boolean

    // ── Canvas Mode ───────────────────────────────────────────────
    canvasMode: CanvasMode
    setCanvasMode: (mode: CanvasMode) => void

    // ── Graph Data ────────────────────────────────────────────────
    nodes: Node[]
    edges: Edge[]
    selectedNodeId: string | null
    past: HistoryEntry[]
    future: HistoryEntry[]

    // ── Live Execution (Execute Mode) ─────────────────────────────
    activeExecutionId: string | null
    nodeExecutionData: Record<string, NodeExecutionData>
    pendingApproval: ApprovalData | null
    executionMeta: ExecutionMeta
    isExecutionStreaming: boolean

    // ── Review Mode ───────────────────────────────────────────────
    reviewExecutionId: string | null
    reviewTimelineMs: number   // current scrubber position in ms from execution start
    reviewCheckpoints: unknown[]

    // ── Derived State ─────────────────────────────────────────────
    derivedStateFields: DerivedStateField[]
    highlightedFieldNodes: { producer: string | null; consumers: string[] }

    // ── Validation & Cost ─────────────────────────────────────────
    validationResult: ValidationResult | null
    costEstimate: CostEstimate | null

    // ── Blueprint Metadata ────────────────────────────────────────
    setBlueprintId: (id: string) => void
    setBlueprintName: (name: string) => void
    setBlueprintStatus: (status: BlueprintStatus) => void
    setValidationResult: (result: ValidationResult | null) => void
    setCostEstimate: (estimate: CostEstimate | null) => void

    // ── Graph Mutations ───────────────────────────────────────────
    setNodes: (nodes: Node[]) => void
    setEdges: (edges: Edge[]) => void
    selectNode: (id: string | null) => void
    addNode: (node: Node) => void
    removeNode: (id: string) => void
    updateNodeData: (id: string, data: Record<string, unknown>) => void

    // ── History ───────────────────────────────────────────────────
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
    reset: () => void

    // ── Execution Control ─────────────────────────────────────────
    startExecution: (executionId: string, totalNodes: number, estimatedCost?: number) => void
    stopExecution: () => void
    updateNodeExecution: (nodeId: string, data: Partial<NodeExecutionData>) => void
    appendStreamChunk: (nodeId: string, chunk: string) => void
    setPendingApproval: (approval: ApprovalData | null) => void
    updateExecutionMeta: (meta: Partial<ExecutionMeta>) => void

    // ── Review Mode Control ───────────────────────────────────────
    startReview: (executionId: string, checkpoints: unknown[]) => void
    stopReview: () => void
    setReviewTimeline: (ms: number) => void

    // ── State Schema ──────────────────────────────────────────────
    setDerivedStateFields: (fields: DerivedStateField[]) => void
    highlightFieldNodes: (producer: string | null, consumers: string[]) => void
    clearHighlight: () => void
}

const HISTORY_LIMIT = 50

function snapshot(state: Pick<CanvasState, 'nodes' | 'edges'>): HistoryEntry {
    return {
        nodes: state.nodes.map((n) => ({ ...n })),
        edges: state.edges.map((e) => ({ ...e })),
    }
}

const defaultExecutionMeta: ExecutionMeta = {
    cumulativeTokens: 0,
    cumulativeCostUsd: 0,
    budgetPctUsed: 0,
    elapsedMs: 0,
    completedNodes: 0,
    totalNodes: 0,
}

export const useCanvasStore = create<CanvasState>()(
    subscribeWithSelector((set, get) => ({
        // ── Blueprint ─────────────────────────────────────────────────
        blueprintId: null,
        blueprintName: 'Untitled Blueprint',
        blueprintStatus: 'draft',
        isDirty: false,

        // ── Mode ──────────────────────────────────────────────────────
        canvasMode: 'build',
        setCanvasMode: (mode) => {
            // Clear execution data when leaving execute mode
            set((s) => ({
                canvasMode: mode,
                ...(mode === 'build' && {
                    activeExecutionId: null,
                    nodeExecutionData: {},
                    pendingApproval: null,
                    executionMeta: defaultExecutionMeta,
                    isExecutionStreaming: false,
                }),
                ...(mode === 'build' && { reviewExecutionId: null, reviewCheckpoints: [] }),
            }))
        },

        // ── Graph ─────────────────────────────────────────────────────
        nodes: [],
        edges: [],
        selectedNodeId: null,
        past: [],
        future: [],

        // ── Execution ─────────────────────────────────────────────────
        activeExecutionId: null,
        nodeExecutionData: {},
        pendingApproval: null,
        executionMeta: defaultExecutionMeta,
        isExecutionStreaming: false,

        // ── Review ─────────────────────────────────────────────────────
        reviewExecutionId: null,
        reviewTimelineMs: 0,
        reviewCheckpoints: [],

        // ── Derived ───────────────────────────────────────────────────
        derivedStateFields: [],
        highlightedFieldNodes: { producer: null, consumers: [] },

        // ── Validation ────────────────────────────────────────────────
        validationResult: null,
        costEstimate: null,

        // ── Setters ───────────────────────────────────────────────────
        setBlueprintId: (id) => set({ blueprintId: id }),
        setBlueprintName: (name) => set({ blueprintName: name, isDirty: true }),
        setBlueprintStatus: (status) => set({ blueprintStatus: status }),
        setValidationResult: (result) => set({ validationResult: result }),
        setCostEstimate: (estimate) => set({ costEstimate: estimate }),

        // ── Graph Mutations ───────────────────────────────────────────
        setNodes: (nodes) =>
            set((s) => ({
                past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
                future: [],
                nodes,
                isDirty: true,
            })),

        setEdges: (edges) =>
            set((s) => ({
                past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
                future: [],
                edges,
                isDirty: true,
            })),

        selectNode: (id) => set({ selectedNodeId: id }),

        addNode: (node) =>
            set((s) => ({
                past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
                future: [],
                nodes: [...s.nodes, node],
                isDirty: true,
            })),

        removeNode: (id) =>
            set((s) => ({
                past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
                future: [],
                nodes: s.nodes.filter((n) => n.id !== id),
                edges: s.edges.filter((e) => e.source !== id && e.target !== id),
                selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
                isDirty: true,
            })),

        updateNodeData: (id, data) =>
            set((s) => ({
                past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
                future: [],
                nodes: s.nodes.map((n) =>
                    n.id === id ? { ...n, data: { ...n.data, ...data } } : n
                ),
                isDirty: true,
            })),

        // ── History ───────────────────────────────────────────────────
        undo: () =>
            set((s) => {
                if (s.past.length === 0) return s
                const prev = s.past[s.past.length - 1]
                return {
                    past: s.past.slice(0, -1),
                    future: [snapshot(s), ...s.future],
                    nodes: prev.nodes,
                    edges: prev.edges,
                }
            }),

        redo: () =>
            set((s) => {
                if (s.future.length === 0) return s
                const next = s.future[0]
                return {
                    past: [...s.past, snapshot(s)],
                    future: s.future.slice(1),
                    nodes: next.nodes,
                    edges: next.edges,
                }
            }),

        canUndo: () => get().past.length > 0,
        canRedo: () => get().future.length > 0,

        reset: () =>
            set({
                nodes: [],
                edges: [],
                selectedNodeId: null,
                past: [],
                future: [],
                isDirty: false,
                validationResult: null,
                costEstimate: null,
                derivedStateFields: [],
            }),

        // ── Execution Control ─────────────────────────────────────────
        startExecution: (executionId, totalNodes, estimatedCost) =>
            set({
                canvasMode: 'execute',
                activeExecutionId: executionId,
                nodeExecutionData: {},
                pendingApproval: null,
                isExecutionStreaming: true,
                executionMeta: {
                    ...defaultExecutionMeta,
                    totalNodes,
                    estimatedCostUsd: estimatedCost,
                },
            }),

        stopExecution: () =>
            set({
                isExecutionStreaming: false,
                pendingApproval: null,
            }),

        updateNodeExecution: (nodeId, data) =>
            set((s) => ({
                nodeExecutionData: {
                    ...s.nodeExecutionData,
                    [nodeId]: { ...(s.nodeExecutionData[nodeId] ?? {}), ...data } as NodeExecutionData,
                },
            })),

        appendStreamChunk: (nodeId, chunk) =>
            set((s) => {
                const existing = s.nodeExecutionData[nodeId]
                return {
                    nodeExecutionData: {
                        ...s.nodeExecutionData,
                        [nodeId]: {
                            ...(existing ?? {}),
                            streamingChunk: ((existing?.streamingChunk ?? '') + chunk),
                        } as NodeExecutionData,
                    },
                }
            }),

        setPendingApproval: (approval) => set({ pendingApproval: approval }),

        updateExecutionMeta: (meta) =>
            set((s) => ({
                executionMeta: { ...s.executionMeta, ...meta },
            })),

        // ── Review Mode ───────────────────────────────────────────────
        startReview: (executionId, checkpoints) =>
            set({
                canvasMode: 'review',
                reviewExecutionId: executionId,
                reviewCheckpoints: checkpoints,
                reviewTimelineMs: 0,
            }),

        stopReview: () =>
            set({
                reviewExecutionId: null,
                reviewCheckpoints: [],
                reviewTimelineMs: 0,
            }),

        setReviewTimeline: (ms) => set({ reviewTimelineMs: ms }),

        // ── State Schema ──────────────────────────────────────────────
        setDerivedStateFields: (fields) => set({ derivedStateFields: fields }),
        highlightFieldNodes: (producer, consumers) =>
            set({ highlightedFieldNodes: { producer, consumers } }),
        clearHighlight: () =>
            set({ highlightedFieldNodes: { producer: null, consumers: [] } }),
    }))
)
