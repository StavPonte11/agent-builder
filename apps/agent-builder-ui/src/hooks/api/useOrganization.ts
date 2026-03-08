/**
 * TanStack Query hooks for Organization and User resources.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'

// ---- Organization ----

export function useMyOrganization() {
    return useQuery({
        queryKey: ['organizations', 'me'],
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET('/api/v1/organizations/me')
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useUpdateMyOrganization() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (body: Record<string, unknown>) => {
            const { data, error } = await (apiClient as any).PUT('/api/v1/organizations/me', { body })
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['organizations', 'me'] }),
    })
}

// ---- Users ----

export function useMe() {
    return useQuery({
        queryKey: ['users', 'me'],
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET('/api/v1/users/me')
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}

export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const { data, error } = await (apiClient as any).GET('/api/v1/users/')
            if (error) throw new Error(JSON.stringify(error))
            return data
        },
    })
}
