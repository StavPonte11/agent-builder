import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
    LayoutDashboard, Workflow, Play, CheckCircle, BarChart3,
    FileText, Zap, Wrench, Settings, LogOut, Globe, Bell,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { toggleLanguage } from '@/i18n/config'
import { cn } from '@/lib/utils'

const navItems = [
    { key: 'dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { key: 'blueprints', icon: Workflow, href: '/blueprints' },
    { key: 'executions', icon: Play, href: '/executions' },
    { key: 'approvals', icon: CheckCircle, href: '/approvals' },
    { key: 'analytics', icon: BarChart3, href: '/analytics' },
    { key: 'templates', icon: FileText, href: '/templates' },
    { key: 'skills', icon: Zap, href: '/skills' },
    { key: 'tools', icon: Wrench, href: '/tools' },
] as const

export default function PlatformLayout() {
    const { t, i18n } = useTranslation()
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()

    function handleLogout() {
        logout()
        navigate('/login')
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* ------------------------------------------------------------------ */}
            {/* Sidebar                                                              */}
            {/* ------------------------------------------------------------------ */}
            <aside className="w-[220px] flex-shrink-0 border-e border-border bg-surface flex flex-col">
                {/* Logo */}
                <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
                    <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                        <Workflow className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-heading text-sm font-semibold text-foreground tracking-tight">
                        Agent Builder
                    </span>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                    {navItems.map(({ key, icon: Icon, href }) => (
                        <NavLink
                            key={key}
                            to={href}
                            className={({ isActive }) => cn(
                                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                                isActive
                                    ? 'bg-primary/10 text-primary font-medium'
                                    : 'text-muted-foreground hover:bg-border hover:text-foreground',
                            )}
                        >
                            <Icon className="h-4 w-4 flex-shrink-0" />
                            {t(`nav.${key}`)}
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom actions */}
                <div className="border-t border-border px-2 py-3 space-y-0.5">
                    <NavLink
                        to="/settings"
                        className={({ isActive }) => cn(
                            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                            isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-border hover:text-foreground',
                        )}
                    >
                        <Settings className="h-4 w-4" />
                        {t('nav.settings')}
                    </NavLink>

                    <button
                        onClick={() => toggleLanguage()}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-border hover:text-foreground transition-colors"
                    >
                        <Globe className="h-4 w-4" />
                        {i18n.language === 'en' ? 'עברית' : 'English'}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        {t('auth.logout')}
                    </button>
                </div>

                {/* User badge */}
                {user && (
                    <div className="border-t border-border px-4 py-3">
                        <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                    </div>
                )}
            </aside>

            {/* ------------------------------------------------------------------ */}
            {/* Main content area                                                   */}
            {/* ------------------------------------------------------------------ */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top header */}
                <header className="flex h-14 items-center justify-end gap-2 border-b border-border px-4 bg-surface/60 backdrop-blur-sm flex-shrink-0">
                    <button className="relative h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-border hover:text-foreground transition-colors">
                        <Bell className="h-4 w-4" />
                    </button>
                </header>

                {/* Page outlet with animation */}
                <main className="flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="h-full"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}
