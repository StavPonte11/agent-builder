import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import apiClient from '@/lib/api.ts'

interface AuthState {
    accessToken: string | null
    refreshToken: string | null
    user: {
        id: string
        email: string
        role: 'admin' | 'builder' | 'viewer'
        org_id: string
    } | null
    isAuthenticated: boolean

    // Actions
    setTokens: (access: string, refresh: string) => void
    setUser: (user: AuthState['user']) => void
    logout: () => void
    refreshTokens: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,

            setTokens(access, refresh) {
                set({ accessToken: access, refreshToken: refresh, isAuthenticated: true })
            },

            setUser(user) {
                set({ user })
            },

            logout() {
                set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false })
            },

            async refreshTokens(): Promise<boolean> {
                const { refreshToken } = get()
                if (!refreshToken) return false
                try {
                    const { data, error } = await apiClient.POST('/api/v1/auth/refresh', {
                        body: { refresh_token: refreshToken },
                    })
                    if (error || !data) return false
                    set({ accessToken: data.access_token, isAuthenticated: true })
                    return true
                } catch {
                    return false
                }
            },
        }),
        {
            name: 'agent-builder-auth',
            // Only persist tokens — not ephemeral state
            partialize: (s) => ({
                accessToken: s.accessToken,
                refreshToken: s.refreshToken,
                user: s.user,
                isAuthenticated: s.isAuthenticated,
            }),
        },
    ),
)
