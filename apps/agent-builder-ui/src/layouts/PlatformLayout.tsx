import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    Workflow,
    Activity,
    CheckSquare,
    BarChart3,
    MessageSquare,
    Zap,
    Wrench,
    Settings,
    LogOut,
    Menu,
    X,
    User,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { Toaster } from 'sonner'
import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '@/components/theme-toggle'

const NAVIGATION = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Blueprints', href: '/blueprints', icon: Workflow },
    { name: 'Executions', href: '/executions', icon: Activity },
    { name: 'Approvals', href: '/approvals', icon: CheckSquare },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Templates', href: '/templates', icon: MessageSquare },
    { name: 'Skills', href: '/skills', icon: Zap },
    { name: 'Tools', href: '/tools', icon: Wrench },
    { name: 'Settings', href: '/settings', icon: Settings },
]

export default function PlatformLayout() {
    const { user, logout } = useAuthStore()
    const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUIStore()
    const location = useLocation()
    const { t, i18n } = useTranslation()

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">
            {/* Mobile Backdrop */}
            <AnimatePresence>
                {!sidebarCollapsed && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                        onClick={() => setSidebarCollapsed(true)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={{ x: -300 }}
                animate={{ x: sidebarCollapsed ? -300 : 0, width: sidebarCollapsed ? 0 : 256 }}
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card shadow-xl lg:static lg:translate-x-0',
                    sidebarCollapsed ? 'lg:w-[72px]' : 'w-64'
                )}
                transition={{ duration: 0.3, ease: 'anticipate' }}
            >
                <div className="flex h-16 items-center px-4 justify-between">
                    <div className={cn("flex items-center gap-2", sidebarCollapsed ? "lg:hidden" : "")}>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Workflow className="h-5 w-5" />
                        </div>
                        <span className="font-semibold text-foreground">Agent Builder</span>
                    </div>
                    {/* Mobile close button */}
                    <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    {/* Desktop collapse button */}
                    <button
                        onClick={toggleSidebar}
                        className="hidden rounded-lg p-2 text-muted-foreground hover:bg-muted lg:block"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto p-4">
                    {NAVIGATION.map((item) => {
                        const isActive = location.pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                                title={sidebarCollapsed ? item.name : undefined}
                            >
                                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                                <span className={cn("truncate", sidebarCollapsed ? "hidden" : "block")}>
                                    {item.name}
                                </span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="border-t border-border p-4">
                    <div className={cn("flex items-center gap-3", sidebarCollapsed && "justify-center")}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-foreground">
                            <User className="h-4 w-4" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex flex-1 flex-col overflow-hidden">
                                <span className="truncate text-sm font-medium text-foreground">
                                    {user?.email ?? 'User'}
                                </span>
                                <span className="truncate text-xs text-muted-foreground uppercase">
                                    {user?.role ?? 'Role'}
                                </span>
                            </div>
                        )}
                        {!sidebarCollapsed && (
                            <button
                                onClick={logout}
                                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Logout"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    {sidebarCollapsed && (
                        <button
                            onClick={logout}
                            className="mt-4 flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Logout"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex flex-1 flex-col min-w-0">
                <header className="flex h-16 items-center border-b border-border bg-background px-4 lg:px-8">
                    <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="mr-4 rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex-1" />
                    {/* Header actions */}
                    <div className="flex items-center gap-2">
                        <select
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                            value={i18n.language}
                            className="bg-transparent text-sm border-none outline-none text-muted-foreground cursor-pointer"
                        >
                            <option value="en">English</option>
                            <option value="he">עברית</option>
                        </select>
                        <ThemeToggle />
                    </div>
                </header>

                <div className="flex-1 overflow-auto bg-muted/30">
                    <Outlet />
                </div>
            </main>

            <Toaster position="bottom-right" theme="system" richColors />
        </div>
    )
}
