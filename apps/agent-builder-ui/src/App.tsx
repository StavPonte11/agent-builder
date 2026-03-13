import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const PlatformLayout = lazy(() => import('@/layouts/PlatformLayout'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const BlueprintsPage = lazy(() => import('@/pages/blueprints/BlueprintsPage'))
const BuilderPage = lazy(() => import('@/pages/blueprints/BuilderPage'))
const VersionsPage = lazy(() => import('@/pages/blueprints/VersionsPage').then(m => ({ default: m.VersionsPage })))
const BlueprintTestsPage = lazy(() => import('@/pages/blueprints/BlueprintTestsPage').then(m => ({ default: m.BlueprintTestsPage })))
const ExecutionsPage = lazy(() => import('@/pages/executions/ExecutionsPage'))
const ApprovalsPage = lazy(() => import('@/pages/approvals/ApprovalsPage'))
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const TemplatesPage = lazy(() => import('@/pages/templates/TemplatesPage'))
const SkillsPage = lazy(() => import('@/pages/skills/SkillsPage'))
const ToolsPage = lazy(() => import('@/pages/tools/ToolsPage').then(m => ({ default: m.ToolsPage })))
const BasePromptsPage = lazy(() => import('@/pages/admin/BasePromptsPage').then(m => ({ default: m.BasePromptsPage })))
const DependencyGraphPage = lazy(() => import('@/pages/admin/DependencyGraphPage').then(m => ({ default: m.DependencyGraphPage })))
const AuditLogPage = lazy(() => import('@/pages/audit/AuditLogPage').then(m => ({ default: m.AuditLogPage })))
const SandboxPage = lazy(() => import('@/pages/sandbox/SandboxPage').then(m => ({ default: m.SandboxPage })))
const MonitoringPage = lazy(() => import('@/pages/monitoring/MonitoringPage').then(m => ({ default: m.MonitoringPage })))
const PulsePage = lazy(() => import('@/pages/monitoring/PulsePage'))
const EvaluationPage = lazy(() => import('@/pages/evaluation/EvaluationPage').then(m => ({ default: m.EvaluationPage })))

/** Guard: redirects to login if not authenticated */
function PrivateRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

/** Guard: redirects to dashboard if already authenticated */
function PublicRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

const LoadingFallback = () => (
    <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
)

export default function App() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <Routes>
                {/* Public routes (auth) */}
                <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

                {/* Platform routes (authenticated) */}
                <Route
                    path="/"
                    element={<PrivateRoute><PlatformLayout /></PrivateRoute>}
                >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="blueprints" element={<BlueprintsPage />} />
                    <Route path="blueprints/:id" element={<BuilderPage />} />
                    <Route path="blueprints/:id/versions" element={<VersionsPage />} />
                    <Route path="blueprints/:id/tests" element={<BlueprintTestsPage />} />
                    <Route path="executions" element={<ExecutionsPage />} />
                    <Route path="approvals" element={<ApprovalsPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="templates" element={<TemplatesPage />} />
                    <Route path="skills" element={<SkillsPage />} />
                    <Route path="tools" element={<ToolsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="admin/base-prompts" element={<BasePromptsPage />} />
                    <Route path="admin/dependency-graph" element={<DependencyGraphPage />} />
                    <Route path="admin/audit-log" element={<AuditLogPage />} />
                    <Route path="blueprints/:id/sandbox" element={<SandboxPage />} />
                    <Route path="blueprints/:id/evaluation" element={<EvaluationPage />} />
                    <Route path="monitoring" element={<MonitoringPage />} />
                    <Route path="pulse" element={<PulsePage />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Suspense>
    )
}
