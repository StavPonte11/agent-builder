import { X, Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface JsonViewModalProps {
    open: boolean
    onClose: () => void
    data: any
}

export function JsonViewModal({ open, onClose, data }: JsonViewModalProps) {
    const [copied, setCopied] = useState(false)

    if (!open) return null

    const jsonString = JSON.stringify(data, null, 2)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(jsonString)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy', err)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground tracking-tight">Blueprint JSON</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Raw definition of your current workflow</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'Copied' : 'Copy JSON'}
                        </button>
                        <div className="h-6 w-px bg-border mx-1" />
                        <button
                            onClick={onClose}
                            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body / Code View */}
                <div className="flex-1 overflow-auto bg-[#0d1117] p-5">
                    <pre className="font-mono text-[13px] leading-relaxed text-[#c9d1d9]">
                        <code>{jsonString}</code>
                    </pre>
                </div>

                {/* Footer */}
                <div className="border-t border-border bg-surface px-5 py-3 flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-mono">
                        {Object.keys(data?.nodes || {}).length} nodes, {Object.keys(data?.edges || {}).length} edges
                    </span>
                    <button
                        onClick={onClose}
                        className="rounded-md bg-muted px-4 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted/80"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    )
}
