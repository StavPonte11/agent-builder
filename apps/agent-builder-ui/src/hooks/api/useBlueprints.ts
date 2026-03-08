/**
 * TanStack Query hooks for Blueprint resources.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

const BLUEPRINTS_KEY = 'blueprints'

export function useBlueprints(statusFilter?: string) {
    return useQuery({
        queryKey: [BLUEPRINTS_KEY, statusFilter],
        queryFn: async () => {
            const params = statusFilter ? { query: { status: statusFilter as never } } : {}
            const { data, error } = await (apiClient as any).GET('/api/v1/blueprints/', params)
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useBlueprint(id: string | undefined) {
    return useQuery({
        queryKey: [BLUEPRINTS_KEY, id],
        enabled: !!id,
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET('/api/v1/blueprints/{blueprint_id}', {
                params: { path: { blueprint_id: id } },
            })
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useCreateBlueprint() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const { data, error } = await (apiClient as any).POST('/api/v1/blueprints/', { body })
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: [BLUEPRINTS_KEY] }),
    })
}

export function useUpdateBlueprint(id: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const { data, error } = await (apiClient as any).PUT('/api/v1/blueprints/{blueprint_id}', {
                params: { path: { blueprint_id: id } },
                body,
            })
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: [BLUEPRINTS_KEY] })
            qc.invalidateQueries({ queryKey: [BLUEPRINTS_KEY, id] })
        },
    })
}

export function useDeleteBlueprint() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (id: string) => {
            await (apiClient as any).DELETE('/api/v1/blueprints/{blueprint_id}', {
                params: { path: { blueprint_id: id } },
            })
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: [BLUEPRINTS_KEY] }),
    })
}

export function useValidateBlueprint(id: string) {
    return useQuery({
        queryKey: [BLUEPRINTS_KEY, id, 'validate'],
        enabled: false,
        queryFn: async () => {
            const { data, error } = await (apiClient as any).POST(
                '/api/v1/blueprints/{blueprint_id}/validate',
                { params: { path: { blueprint_id: id } } }
            )
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useBlueprintCostEstimate(id: string) {
    return useQuery({
        queryKey: [BLUEPRINTS_KEY, id, 'estimate'],
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET(
                '/api/v1/blueprints/{blueprint_id}/estimate',
                { params: { path: { blueprint_id: id } } }
            )
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useBlueprintVersions(id: string) {
    return useQuery({
        queryKey: [BLUEPRINTS_KEY, id, 'versions'],
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET(
                '/api/v1/blueprints/{blueprint_id}/versions',
                { params: { path: { blueprint_id: id } } }
            )
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}
