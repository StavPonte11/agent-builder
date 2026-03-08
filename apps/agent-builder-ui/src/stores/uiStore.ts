/**
 * uiStore — panel open/close, sidebar state, global notifications.
 */
import { create } from 'zustand'

export interface Toast {
    id: string
    type: 'success' | 'error' | 'info' | 'warning'
    message: string
    duration?: number
}

interface UIState {
    // Sidebar
    sidebarCollapsed: boolean
    toggleSidebar: () => void
    setSidebarCollapsed: (collapsed: boolean) => void

    // Builder panels
    configPanelOpen: boolean
    setConfigPanelOpen: (open: boolean) => void
    activePanelTab: 'config' | 'test' | 'guardrails' | 'meta' | 'nlgen'
    setActivePanelTab: (tab: UIState['activePanelTab']) => void

    // Toasts
    toasts: Toast[]
    addToast: (toast: Omit<Toast, 'id'>) => void
    removeToast: (id: string) => void

    // Global loading overlay
    isGlobalLoading: boolean
    setGlobalLoading: (loading: boolean) => void
}

let toastIdCounter = 0

export const useUIStore = create<UIState>((set) => ({
    sidebarCollapsed: false,
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    configPanelOpen: false,
    setConfigPanelOpen: (open) => set({ configPanelOpen: open }),
    activePanelTab: 'config',
    setActivePanelTab: (tab) => set({ activePanelTab: tab }),

    toasts: [],
    addToast: (toast) => {
        const id = String(++toastIdCounter)
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
        // Auto-remove after duration (default 4s)
        setTimeout(() => {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
        }, toast.duration ?? 4000)
    },
    removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    isGlobalLoading: false,
    setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),
}))
