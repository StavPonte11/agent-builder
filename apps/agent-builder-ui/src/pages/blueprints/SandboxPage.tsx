import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ExecutionMonitor } from '@/components/executions/execution-monitor'
import { SandboxChat } from '@/components/executions/sandbox-chat'
import { SandboxSidebar } from '@/components/executions/sandbox-sidebar'

export default function SandboxPage() {
    const { id } = useParams()

    // In a real app we'd trigger a test execution and get a real execution_id.
    // For now we use the ID from the URL or a stub.
    const executionId = id || 'test-execution-id'

    return (
        <div className="flex h-screen w-full flex-col bg-background">
            {/* Header */}
            <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-card px-4">
                <div className="flex items-center gap-4">
                    <Link
                        to={`/blueprints/${id}`}
                        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Builder
                    </Link>
                    <div className="h-4 w-px bg-border" />
                    <h2 className="text-sm font-semibold text-foreground">Sandbox Testing</h2>
                    <span className="rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground font-mono">Blueprint: {id}</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-1 overflow-hidden bg-muted/10 p-4 gap-4">
                {/* Left column: Monitor & Timeline */}
                <div className="flex w-1/3 flex-col">
                    <ExecutionMonitor executionId={executionId} />
                </div>

                {/* Center column: Interactive UI Chat */}
                <div className="flex flex-1 flex-col">
                    <SandboxChat />
                </div>

                {/* Right column: Config sidebar */}
                <div className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-border shadow-sm">
                    <SandboxSidebar />
                </div>
            </main>
        </div>
    )
}
