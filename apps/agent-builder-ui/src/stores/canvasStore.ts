/**
 * canvasStore — React Flow nodes/edges + built-in undo/redo history.
 * Uses a manual stack approach to avoid external dependencies.
 */
import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'

interface HistoryEntry {
    nodes: Node[]
    edges: Edge[]
}

interface CanvasState {
    nodes: Node[]
    edges: Edge[]
    selectedNodeId: string | null
    past: HistoryEntry[]
    future: HistoryEntry[]

    setNodes: (nodes: Node[]) => void
    setEdges: (edges: Edge[]) => void
    selectNode: (id: string | null) => void
    addNode: (node: Node) => void
    removeNode: (id: string) => void
    updateNodeData: (id: string, data: Record<string, unknown>) => void
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
    reset: () => void
}

const HISTORY_LIMIT = 50

function snapshot(state: Pick<CanvasState, 'nodes' | 'edges'>): HistoryEntry {
    return {
        nodes: state.nodes.map((n) => ({ ...n })),
        edges: state.edges.map((e) => ({ ...e })),
    }
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    past: [],
    future: [],

    setNodes: (nodes: Node[]) =>
        set((s) => ({
            past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
            future: [],
            nodes,
        })),

    setEdges: (edges: Edge[]) =>
        set((s) => ({
            past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
            future: [],
            edges,
        })),

    setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),
    selectNode: (id: string | null) => set({ selectedNodeId: id }),

    addNode: (node: Node) =>
        set((s) => ({
            past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
            future: [],
            nodes: [...s.nodes, node],
        })),

    removeNode: (id: string) =>
        set((s) => ({
            past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
            future: [],
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.source !== id && e.target !== id),
            selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        })),

    updateNodeData: (id: string, data: Record<string, unknown>) =>
        set((s) => ({
            past: [...s.past.slice(-HISTORY_LIMIT), snapshot(s)],
            future: [],
            nodes: s.nodes.map((n) =>
                n.id === id ? { ...n, data: { ...n.data, ...data } } : n
            ),
        })),

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
    reset: () => set({ nodes: [], edges: [], selectedNodeId: null, past: [], future: [] }),
}))
