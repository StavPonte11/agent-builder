/**
 * TanStack Query hooks for Execution resources.
 */
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

const EXECUTIONS_KEY = 'executions'

export function useExecutions(blueprintId?: string) {
    return useQuery({
        queryKey: [EXECUTIONS_KEY, blueprintId],
        queryFn: async () => {
            const params = blueprintId ? { query: { blueprint_id: blueprintId as never } } : {}
            const { data, error } = await (apiClient as any).GET('/api/v1/executions/', params)
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useExecution(id: string | undefined) {
    return useQuery({
        queryKey: [EXECUTIONS_KEY, id],
        enabled: !!id,
        refetchInterval: (query) => {
            const status = (query.state.data as any)?.status
            return status === 'running' ? 2000 : false
        },
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET('/api/v1/executions/{execution_id}', {
                params: { path: { execution_id: id } },
            })
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}
