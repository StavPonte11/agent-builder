/**
 * AuditLogPage — Immutable audit event log with filtering, search, and CSV export.
 * Admin only. Covers E9.2 spec.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Filter, Search } from 'lucide-react'
import { format } from 'date-fns'

interface AuditEvent {
    id: string
    actor_email: string
    resource_type: string
    resource_id: string
    event_type: string
    created_at: string
    note?: string
    before_state?: unknown
    after_state?: unknown
}

type SortField = 'created_at' | 'actor_email' | 'resource_type' | 'event_type'

const EVENT_COLORS: Record<string, string> = {
    created: 'bg-green-500/10 text-green-700 dark:text-green-400',
    updated: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    deleted: 'bg-red-500/10 text-red-700 dark:text-red-400',
    published: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    archived: 'bg-muted text-muted-foreground',
    state_patched: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    auto_pause: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
}

function EventBadge({ type }: { type: string }) {
    const className = EVENT_COLORS[type] ?? 'bg-muted text-muted-foreground'
    return (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${className}`}>
            {type.replace('_', ' ')}
        </span>
    )
}

function JsonPreview({ data }: { data: unknown }) {
    const [open, setOpen] = useState(false)
    if (!data) return <span className="text-muted-foreground italic text-xs">—</span>
    return (
        <div>
            <button onClick={() => setOpen(o => !o)} className="text-[11px] underline text-primary">
                {open ? 'Hide' : 'View JSON'}
            </button>
            {open && (
                <pre className="mt-1 max-h-32 overflow-y-auto rounded bg-muted/30 p-2 text-[10px] font-mono text-foreground">
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}
        </div>
    )
}

export function AuditLogPage() {
    const [search, setSearch] = useState('')
    const [resourceType, setResourceType] = useState('all')
    const [eventType, setEventType] = useState('all')
    const [page, setPage] = useState(1)
    const pageSize = 25

    const { data, isLoading } = useQuery<{ events: AuditEvent[]; total: number }>({
        queryKey: ['audit-log', { search, resourceType, eventType, page }],
        queryFn: () => {
            const params = new URLSearchParams({
                page: String(page),
                page_size: String(pageSize),
                ...(search ? { q: search } : {}),
                ...(resourceType !== 'all' ? { resource_type: resourceType } : {}),
                ...(eventType !== 'all' ? { event_type: eventType } : {}),
            })
            return fetch(`/api/v1/admin/audit-log?${params}`).then(r => r.json())
        },
    })

    const events = data?.events ?? []
    const total = data?.total ?? 0
    const totalPages = Math.ceil(total / pageSize)

    const exportCSV = async () => {
        const params = new URLSearchParams({
            ...(search ? { q: search } : {}),
            ...(resourceType !== 'all' ? { resource_type: resourceType } : {}),
        })
        const res = await fetch(`/api/v1/admin/audit-log/export?${params}`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
                        <p className="text-sm text-muted-foreground">Immutable record of all platform events</p>
                    </div>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-3 py-2 rounded-xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-64"
                        />
                    </div>

                    <select
                        value={resourceType}
                        onChange={e => { setResourceType(e.target.value); setPage(1) }}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        <option value="all">All Resources</option>
                        <option value="blueprint">Blueprint</option>
                        <option value="execution">Execution</option>
                        <option value="tool">Tool</option>
                        <option value="user">User</option>
                        <option value="base_prompt">Base Prompt</option>
                    </select>

                    <select
                        value={eventType}
                        onChange={e => { setEventType(e.target.value); setPage(1) }}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        <option value="all">All Events</option>
                        <option value="created">Created</option>
                        <option value="updated">Updated</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                        <option value="deleted">Deleted</option>
                        <option value="state_patched">State Patched</option>
                        <option value="auto_pause">Auto Pause</option>
                    </select>

                    <span className="text-sm text-muted-foreground ml-auto">{total.toLocaleString()} events</span>
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    {['Time', 'Actor', 'Resource', 'Event', 'Details', 'Before', 'After'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
                                ) : events.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No events found</td></tr>
                                ) : events.map(ev => (
                                    <tr key={ev.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                                            {format(new Date(ev.created_at), 'MMM d, HH:mm:ss')}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-foreground">{ev.actor_email}</td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{ev.resource_type}</span>
                                                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{ev.resource_id.slice(0, 8)}…</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><EventBadge type={ev.event_type} /></td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{ev.note || '—'}</td>
                                        <td className="px-4 py-3"><JsonPreview data={ev.before_state} /></td>
                                        <td className="px-4 py-3"><JsonPreview data={ev.after_state} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-border px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                            Page {page} of {totalPages} · {total.toLocaleString()} total events
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-accent transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
