/**
 * executionStore — live execution state + per-node statuses.
 * Updated by WebSocket messages from the backend.
 */
import { create } from 'zustand'

export type NodeStatus = 'idle' | 'running' | 'completed' | 'error' | 'blocked'

export interface NodeExecutionState {
    nodeId: string
    status: NodeStatus
    startedAt?: string
    completedAt?: string
    output?: unknown
    error?: string
    tokensUsed?: number
    costUsd?: number
}

export interface ExecutionRun {
    id: string
    blueprintId: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    startedAt: string
    completedAt?: string
    totalTokens: number
    totalCostUsd: number
    nodeStates: Record<string, NodeExecutionState>
}

interface ExecutionState {
    activeExecution: ExecutionRun | null
    streamingNodes: Set<string>

    startExecution: (execution: ExecutionRun) => void
    updateNodeStatus: (nodeId: string, update: Partial<NodeExecutionState>) => void
    setExecutionStatus: (status: ExecutionRun['status']) => void
    addStreamingNode: (nodeId: string) => void
    removeStreamingNode: (nodeId: string) => void
    clearExecution: () => void
}

export const useExecutionStore = create<ExecutionState>((set) => ({
    activeExecution: null,
    streamingNodes: new Set(),

    startExecution: (execution) => set({ activeExecution: execution }),

    updateNodeStatus: (nodeId, update) =>
        set((s) => {
            if (!s.activeExecution) return s
            const prev = s.activeExecution.nodeStates[nodeId] ?? { nodeId, status: 'idle' }
            return {
                activeExecution: {
                    ...s.activeExecution,
                    nodeStates: {
                        ...s.activeExecution.nodeStates,
                        [nodeId]: { ...prev, ...update },
                    },
                },
            }
        }),

    setExecutionStatus: (status) =>
        set((s) => {
            if (!s.activeExecution) return s
            return { activeExecution: { ...s.activeExecution, status } }
        }),

    addStreamingNode: (nodeId) =>
        set((s) => ({ streamingNodes: new Set([...s.streamingNodes, nodeId]) })),

    removeStreamingNode: (nodeId) =>
        set((s) => {
            const next = new Set(s.streamingNodes)
            next.delete(nodeId)
            return { streamingNodes: next }
        }),

    clearExecution: () => set({ activeExecution: null, streamingNodes: new Set() }),
}))
