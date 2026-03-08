import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch, Plus, Search, GitCommit, CheckCircle2 } from 'lucide-react'


export default function VersionsPage() {
    const [search, setSearch] = useState('')

    const versions = [
        { id: 'v2', blueprintName: 'Customer Onboarding Agent', tag: 'v2.0.1', status: 'Live', date: '2026-03-08T10:15:00Z', tests: '24/24 Passed' },
        { id: 'v1', blueprintName: 'Customer Onboarding Agent', tag: 'v1.0.0', status: 'Archived', date: '2026-03-01T14:20:00Z', tests: '20/22 Passed' },
        { id: 'v3', blueprintName: 'Financial Planner AI', tag: 'v1.4.2', status: 'Live', date: '2026-03-05T09:00:00Z', tests: '45/45 Passed' },
    ]

    return (
        <>
            <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Versions & Testing</h1>
                        <p className="text-sm text-muted-foreground">Manage deployments and test runs for all your blueprints.</p>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm">
                        <Plus className="h-4 w-4" />
                        New Test Suite
                    </button>
                </div>

                <div className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search versions..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                    />
                </div>

                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Blueprint</th>
                                    <th className="px-4 py-3 font-medium">Version Tag</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Test Coverage</th>
                                    <th className="px-4 py-3 font-medium text-right">Published</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {versions.map((v) => (
                                    <tr key={v.id} className="transition-colors hover:bg-muted/10 group">
                                        <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                                            <Link to={`/blueprints/${v.id}`} className="hover:underline">{v.blueprintName}</Link>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">
                                            <span className="rounded bg-accent px-1.5 py-0.5 border border-border/50 flex items-center gap-1 w-max">
                                                <GitCommit className="h-3 w-3" />
                                                {v.tag}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${v.status === 'Live' ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                                                {v.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                {v.status === 'Live' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-amber-500" />}
                                                {v.tests}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                            {new Date(v.date).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}
