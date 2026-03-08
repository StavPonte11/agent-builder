import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
            <div className="flex max-w-md flex-col items-center rounded-2xl border border-destructive/20 bg-destructive/10 p-8 shadow-sm">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>

                <h2 className="mb-2 text-xl font-bold text-foreground">Something went wrong</h2>
                <p className="mb-6 text-sm text-muted-foreground break-words text-center">
                    {error instanceof Error ? error.message : 'An unexpected error occurred in the component tree.'}
                </p>

                <button
                    onClick={resetErrorBoundary}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    <RefreshCcw className="h-4 w-4" />
                    Try Again
                </button>
            </div>
        </div>
    )
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
    return (
        <ReactErrorBoundary FallbackComponent={ErrorFallback}>
            {children}
        </ReactErrorBoundary>
    )
}
