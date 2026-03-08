/**
 * useExecutionStream — WebSocket hook that:
 *  1. Returns `events[]` and `status` for rendering in ExecutionMonitor
 *  2. Syncs all E6.3 events into canvasStore (nodeExecutionData, executionMeta, approval)
 *  3. Returns `cancel` to close the connection on demand
 *
 * Supports two call signatures:
 *   // Simple (ExecutionMonitor)
 *   const { events, status } = useExecutionStream(executionId)
 *
 *   // With callbacks (ExecutionOverlay)
 *   useExecutionStream({ executionId, onComplete, onError })
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import type { ExecutionEvent } from '@/types/blueprint'

// ─── Local event shape for ExecutionMonitor ───────────────────────────────────

export interface ExecutionStreamEvent {
    type: string
    node_id?: string
    timestamp: string
    data?: unknown
    error?: string
}

export type ExecutionStreamStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

// ─── Options type for the advanced call signature ─────────────────────────────

export interface UseExecutionStreamOptions {
    executionId: string | null
    onComplete?: () => void
    onError?: (error: string) => void
}

// ─── Overloads ────────────────────────────────────────────────────────────────

export function useExecutionStream(
    args: string | null | UseExecutionStreamOptions,
    _unused?: never
): {
    events: ExecutionStreamEvent[]
    status: ExecutionStreamStatus
    cancel: () => void
} {
    // Normalise the two call signatures
    const executionId = typeof args === 'string' || args === null
        ? args
        : args?.executionId ?? null
    const onComplete = typeof args === 'object' && args !== null && !('executionId' in args === false)
        ? (args as UseExecutionStreamOptions).onComplete
        : undefined
    const onError = typeof args === 'object' && args !== null
        ? (args as UseExecutionStreamOptions).onError
        : undefined

    const wsRef = useRef<WebSocket | null>(null)
    const [events, setEvents] = useState<ExecutionStreamEvent[]>([])
    const [status, setStatus] = useState<ExecutionStreamStatus>('idle')

    // ── canvasStore updaters ──────────────────────────────────────────────────
    const updateNodeExecution = useCanvasStore((s) => s.updateNodeExecution)
    const appendStreamChunk = useCanvasStore((s) => s.appendStreamChunk)
    const setPendingApproval = useCanvasStore((s) => s.setPendingApproval)
    const updateExecutionMeta = useCanvasStore((s) => s.updateExecutionMeta)
    const stopExecution = useCanvasStore((s) => s.stopExecution)

    const pushEvent = useCallback((ev: ExecutionStreamEvent) => {
        setEvents((prev) => [...prev, ev])
    }, [])

    const handleEvent = useCallback((event: ExecutionEvent) => {
        // 1. Push raw event to local events list (for ExecutionMonitor feed)
        pushEvent({
            type: event.type,
            node_id: event.node_id,
            timestamp: event.timestamp,
            data: event.output_preview !== undefined ? { output: event.output_preview } : undefined,
            error: event.error_message,
        })

        // 2. Sync to canvasStore
        switch (event.type) {
            case 'node_queued':
                if (event.node_id) updateNodeExecution(event.node_id, { status: 'idle' })
                break

            case 'node_started':
                if (event.node_id) updateNodeExecution(event.node_id, { status: 'running', streamingChunk: '' })
                break

            case 'node_streaming':
                if (event.node_id && event.chunk) appendStreamChunk(event.node_id, event.chunk)
                break

            case 'node_completed':
                if (event.node_id) {
                    updateNodeExecution(event.node_id, {
                        status: 'completed',
                        outputPreview: event.output_preview,
                        durationMs: event.duration_ms,
                        tokenUsage: event.token_usage,
                        streamingChunk: undefined,
                    })
                    updateExecutionMeta({
                        completedNodes: (useCanvasStore.getState().executionMeta.completedNodes ?? 0) + 1,
                    })
                }
                break

            case 'node_failed':
                if (event.node_id) {
                    updateNodeExecution(event.node_id, {
                        status: 'failed',
                        errorType: event.error_type,
                        errorMessage: event.error_message,
                    })
                }
                break

            case 'node_retrying':
                if (event.node_id) {
                    updateNodeExecution(event.node_id, {
                        status: 'retrying',
                        attempt: event.attempt,
                        maxAttempts: event.max_attempts,
                    })
                }
                break

            case 'node_skipped':
                if (event.node_id) updateNodeExecution(event.node_id, { status: 'skipped', reason: event.reason })
                break

            case 'approval_required':
                if (event.node_id) {
                    updateNodeExecution(event.node_id, { status: 'paused' })
                    setPendingApproval({
                        approvalId: event.approval_id ?? '',
                        nodeId: event.node_id,
                        context: event.context ?? '',
                        timeoutMinutes: event.timeout_minutes ?? 60,
                        createdAt: event.timestamp,
                    })
                }
                break

            case 'approval_resolved':
                if (event.node_id) {
                    updateNodeExecution(event.node_id, { status: 'running' })
                    setPendingApproval(null)
                }
                break

            case 'guardrail_triggered':
                if (event.node_id) {
                    updateNodeExecution(event.node_id, {
                        outputPreview: `⚠ Guardrail: ${event.check_type} — ${event.action_taken}`,
                    })
                }
                break

            case 'cost_update':
                updateExecutionMeta({
                    cumulativeTokens: event.cumulative_tokens ?? 0,
                    cumulativeCostUsd: event.cumulative_cost_usd ?? 0,
                    budgetPctUsed: event.budget_pct_used ?? 0,
                })
                break

            case 'execution_completed':
                setStatus('disconnected')
                stopExecution()
                onComplete?.()
                break

            case 'execution_failed':
                setStatus('error')
                stopExecution()
                if (event.error_message) onError?.(event.error_message)
                break

            case 'execution_cancelled':
                setStatus('disconnected')
                stopExecution()
                break

            default:
                break
        }
    }, [pushEvent, updateNodeExecution, appendStreamChunk, setPendingApproval, updateExecutionMeta, stopExecution, onComplete, onError])

    useEffect(() => {
        if (!executionId) {
            setStatus('idle')
            setEvents([])
            return
        }

        setStatus('connecting')
        setEvents([])

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const wsHost = window.location.host
        const wsUrl = `${wsProtocol}//${wsHost}/api/v1/ws/executions/${executionId}`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            setStatus('connected')
        }

        ws.onmessage = (msg) => {
            try {
                const event: ExecutionEvent = JSON.parse(msg.data)
                handleEvent(event)
            } catch (err) {
                console.error('[ExecutionStream] Invalid event:', msg.data, err)
            }
        }

        ws.onerror = () => {
            setStatus('error')
        }

        ws.onclose = () => {
            setStatus((s) => s === 'connected' ? 'disconnected' : s)
        }

        return () => {
            ws.close()
            wsRef.current = null
        }
    }, [executionId, handleEvent])

    const cancel = useCallback(() => {
        wsRef.current?.close()
    }, [])

    return { events, status, cancel }
}
