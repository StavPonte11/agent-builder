import { useState, useMemo } from 'react'

import { Search, Filter, Server, Eye, FileJson } from 'lucide-react'
import {
    createColumnHelper,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    SortingState,
} from '@tanstack/react-table'

type ExecutionRecord = {
    id: string
    blueprintName: string
    status: 'completed' | 'failed' | 'running'
    duration: number
    cost: number
    date: string
}

const columnHelper = createColumnHelper<ExecutionRecord>()

const MOCK_DATA: ExecutionRecord[] = [
    { id: 'exec_0102', blueprintName: 'Customer Onboarding Agent', status: 'completed', duration: 1.2, cost: 0.005, date: '2026-03-08T10:15:00Z' },
    { id: 'exec_0103', blueprintName: 'Sales CRM Sync', status: 'failed', duration: 4.5, cost: 0.012, date: '2026-03-08T11:20:00Z' },
    { id: 'exec_0104', blueprintName: 'Customer Onboarding Agent', status: 'running', duration: 0.5, cost: 0.001, date: '2026-03-08T11:45:00Z' },
    { id: 'exec_0105', blueprintName: 'Financial Planner AI', status: 'completed', duration: 12.0, cost: 0.150, date: '2026-03-07T09:12:00Z' },
]

export default function ExecutionsPage() {
    const [sorting, setSorting] = useState<SortingState>([])
    const [search, setSearch] = useState('')

    const columns = useMemo(() => [
        columnHelper.accessor('id', {
            header: 'ID',
            cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
        columnHelper.accessor('blueprintName', {
            header: 'Blueprint',
            cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        columnHelper.accessor('status', {
            header: 'Status',
            cell: (info) => {
                const val = info.getValue()
                const color = val === 'completed' ? 'text-green-500 bg-green-500/10' :
                    val === 'failed' ? 'text-destructive bg-destructive/10' :
                        'text-blue-500 bg-blue-500/10'
                return <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${color}`}>{val}</span>
            },
        }),
        columnHelper.accessor('duration', {
            header: 'Duration',
            cell: (info) => <span className="text-muted-foreground">{info.getValue()}s</span>,
        }),
        columnHelper.accessor('cost', {
            header: 'Cost ($)',
            cell: (info) => <span className="text-muted-foreground">${info.getValue().toFixed(3)}</span>,
        }),
        columnHelper.accessor('date', {
            header: 'Date',
            cell: (info) => <span className="text-muted-foreground">{new Date(info.getValue()).toLocaleString()}</span>,
        }),
        columnHelper.display({
            id: 'actions',
            cell: () => (
                <div className="flex gap-2">
                    <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="View Trace"><Eye className="h-4 w-4" /></button>
                    <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="View JSON"><FileJson className="h-4 w-4" /></button>
                </div>
            )
        })
    ], [])

    const table = useReactTable({
        data: MOCK_DATA,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    return (
        <>
            <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Executions Log</h1>
                        <p className="text-sm text-muted-foreground">View historic runs, monitor durations, and debug failures.</p>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-sm">
                        <Server className="h-4 w-4" />
                        Connect Cluster
                    </button>
                </div>

                <div className="flex w-full items-center gap-4 border-b border-border pb-4">
                    <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search execution IDs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                        <Filter className="h-4 w-4" />
                        Filters
                    </button>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-muted/20 text-xs uppercase text-muted-foreground">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} className="px-4 py-3 font-medium cursor-pointer hover:text-foreground transition-colors" onClick={header.column.getToggleSortingHandler()}>
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-border">
                            {table.getRowModel().rows.map(row => (
                                <tr key={row.id} className="transition-colors hover:bg-muted/10">
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-4 py-3">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {table.getRowModel().rows.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">No executions found.</div>
                    )}
                </div>
            </div>
        </>
    )
}
