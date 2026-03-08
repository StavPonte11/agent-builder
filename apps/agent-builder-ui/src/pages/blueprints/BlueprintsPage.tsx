import { Link } from 'react-router-dom'
import { FileText, Plus, Search } from 'lucide-react'

export default function BlueprintsPage() {
    return (
        <div className="flex h-full flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Blueprints</h1>
                    <p className="text-sm text-muted-foreground">Build, test, and publish your AI workflows</p>
                </div>
                <Link
                    to="/blueprints/new"
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
                >
                    <Plus className="h-4 w-4" />
                    New Blueprint
                </Link>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    placeholder="Search blueprints..."
                    className="w-full rounded-lg border border-input bg-muted py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
            </div>

            {/* Empty State */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="h-8 w-8" />
                </div>
                <div>
                    <p className="font-semibold text-foreground">No blueprints yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create your first AI workflow or agent blueprint</p>
                </div>
                <Link
                    to="/blueprints/new"
                    className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
                >
                    Create Blueprint
                </Link>
            </div>
        </div>
    )
}
