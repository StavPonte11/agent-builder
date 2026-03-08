import { useEffect, useRef, useState } from 'react'

export interface ExecutionEvent {
    type: 'node_start' | 'node_finish' | 'node_error' | 'execution_start' | 'execution_finish'
    node_id?: string
    data?: any
    error?: string
    timestamp: string
}

export function useExecutionStream(executionId: string | null) {
    const [events, setEvents] = useState<ExecutionEvent[]>([])
    const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle')
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        if (!executionId) {
            if (wsRef.current) {
                wsRef.current.close()
            }
            return
        }

        setStatus('connecting')

        // In dev, assuming Vite proxy or direct to 8000
        // VITE_API_BASE_URL is likely http://localhost:8000/api/v1
        const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('http', 'ws') || 'ws://localhost:8000/api/v1'
        const wsUrl = `${baseUrl}/ws/executions/${executionId}/stream`

        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            setStatus('connected')
        }

        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data) as ExecutionEvent
                setEvents((prev) => [...prev, parsed])
            } catch (err) {
                console.error('Failed to parse WS message', err)
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
        }

        ws.onclose = () => {
            setStatus('disconnected')
        }

        return () => {
            ws.close()
        }
    }, [executionId])

    return { events, status }
}
