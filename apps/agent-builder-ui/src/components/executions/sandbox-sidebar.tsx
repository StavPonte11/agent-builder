import { Activity, Database, AlertCircle } from 'lucide-react'

export function SandboxSidebar() {
    return (
        <div className="flex h-full w-full flex-col border-l border-border bg-card">
            <div className="border-b border-border px-4 py-3 bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground">Sandbox Config</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Environment Config */}
                <div>
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        <Database className="h-3.5 w-3.5" />
                        Environment Setup
                    </h4>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-foreground block mb-1">Simulated User ID</label>
                            <input type="text" defaultValue="user_12345" className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-foreground block mb-1">Initial State variables</label>
                            <textarea placeholder='{"role": "admin"}' className="w-full text-xs font-mono resize-y rounded border border-border bg-background px-2.5 py-1.5 outline-none focus:border-primary min-h-[80px]" />
                        </div>
                    </div>
                </div>

                {/* Global Limits */}
                <div>
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Execution Limits
                    </h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground font-medium">Max Depth</span>
                            <input type="number" defaultValue="15" className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-center outline-none" />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground font-medium">Timeout (sec)</span>
                            <input type="number" defaultValue="60" className="w-16 rounded border border-border bg-background px-2 py-1 text-xs text-center outline-none" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
