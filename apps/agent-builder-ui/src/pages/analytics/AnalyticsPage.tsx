export default function AnalyticsPage() {
    return (
        <div className="flex h-full flex-col gap-6 p-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
                <p className="text-sm text-muted-foreground">Usage metrics, cost breakdown, and execution insights</p>
            </div>
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">Charts and analytics coming in Phase 7</p>
            </div>
        </div>
    )
}
