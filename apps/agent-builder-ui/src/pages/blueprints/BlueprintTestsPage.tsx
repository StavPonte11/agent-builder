/**
 * TestRunnerPage — Unit/Integration/Regression test suite for blueprints.
 * Full E7.3 implementation.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
    CheckCircle, ExternalLink, Loader2, Play, Plus, RotateCcw, XCircle, AlertTriangle
} from 'lucide-react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'

type TestType = 'unit' | 'integration' | 'regression'
type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error'

interface TestCase {
    id: string
    name: string
    type: TestType
    node_id?: string
    input: unknown
    expected_output?: unknown
    expected_contains?: Record<string, unknown>
    judge_rubric?: string
    langfuse_dataset_id?: string
    // populated after run
    status?: TestStatus
    actual_output?: unknown
    duration_ms?: number
    error?: string
    judge_score?: number
    judge_reasoning?: string
    langfuse_trace_url?: string
}

function StatusIcon({ status }: { status?: TestStatus }) {
    if (!status || status === 'pending') return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
    if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    if (status === 'passed') return <CheckCircle className="h-4 w-4 text-green-500" />
    if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />
    return <AlertTriangle className="h-4 w-4 text-amber-500" />
}

function TestRow({ test }: { test: TestCase }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className={`rounded-xl border transition-colors
      ${test.status === 'passed' ? 'border-green-500/20 bg-green-500/5' :
                test.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                    'border-border bg-card'}`}
        >
            <div
                className="flex cursor-pointer items-center gap-3 p-3"
                onClick={() => setExpanded(e => !e)}
            >
                <StatusIcon status={test.status} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{test.name}</p>
                    {test.node_id && <p className="text-[10px] font-mono text-muted-foreground">Node: {test.node_id}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {test.judge_score !== undefined && (
                        <span className={`text-xs font-semibold ${test.judge_score >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                            {(test.judge_score * 100).toFixed(0)}%
                        </span>
                    )}
                    {test.duration_ms !== undefined && (
                        <span className="text-[11px] font-mono text-muted-foreground">{test.duration_ms}ms</span>
                    )}
                    {test.langfuse_trace_url && (
                        <a href={test.langfuse_trace_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </a>
                    )}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-border p-3 space-y-3">
                    {test.error && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 font-mono text-xs text-red-600">
                            {test.error}
                        </div>
                    )}
                    {test.judge_reasoning && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Judge Reasoning</p>
                            <p className="text-xs text-foreground italic">{test.judge_reasoning}</p>
                        </div>
                    )}
                    {test.actual_output !== undefined && test.expected_output !== undefined && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Expected vs Actual</p>
                            <div className="rounded-xl overflow-hidden border border-border text-xs">
                                <ReactDiffViewer
                                    oldValue={JSON.stringify(test.expected_output, null, 2)}
                                    newValue={JSON.stringify(test.actual_output, null, 2)}
                                    compareMethod={DiffMethod.WORDS}
                                    splitView
                                    useDarkTheme
                                    styles={{ contentText: { fontSize: '10px', fontFamily: 'monospace' } }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export function BlueprintTestsPage() {
    const { id: blueprintId } = useParams<{ id: string }>()
    const [activeTab, setActiveTab] = useState<TestType>('unit')

    const { data: tests = [], refetch } = useQuery<TestCase[]>({
        queryKey: ['blueprint-tests', blueprintId, activeTab],
        queryFn: () => fetch(`/api/v1/blueprints/${blueprintId}/tests?type=${activeTab}`).then(r => r.json()),
        enabled: !!blueprintId,
    })

    const runAll = useMutation<TestCase[]>({
        mutationFn: () =>
            fetch(`/api/v1/blueprints/${blueprintId}/tests/run?type=${activeTab}`, { method: 'POST' })
                .then(r => r.json()),
        onSuccess: () => refetch(),
    })

    const runFailed = useMutation<TestCase[]>({
        mutationFn: () =>
            fetch(`/api/v1/blueprints/${blueprintId}/tests/run-failed?type=${activeTab}`, { method: 'POST' })
                .then(r => r.json()),
        onSuccess: () => refetch(),
    })

    const passed = tests.filter(t => t.status === 'passed').length
    const failed = tests.filter(t => t.status === 'failed').length
    const running = tests.some(t => t.status === 'running')

    const tabs: TestType[] = ['unit', 'integration', 'regression']

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border bg-card/80 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-foreground">Test Suite</h1>
                    <div className="flex gap-3">
                        {failed > 0 && (
                            <button
                                onClick={() => runFailed.mutate()}
                                disabled={running}
                                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
                            >
                                <RotateCcw className="h-3.5 w-3.5" /> Re-run failed ({failed})
                            </button>
                        )}
                        <button
                            onClick={() => runAll.mutate()}
                            disabled={running}
                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            Run All
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
                {/* Tabs */}
                <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors
                ${activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Stats */}
                {tests.length > 0 && (
                    <div className="flex items-center gap-4">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${tests.length > 0 ? (passed / tests.length) * 100 : 0}%` }}
                            />
                        </div>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {passed}/{tests.length} passed
                            {failed > 0 && <span className="text-red-600 font-medium ml-2">· {failed} failed</span>}
                        </span>
                    </div>
                )}

                {/* Test list */}
                {tests.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <TestTubeSvg />
                        <p className="mt-3 text-sm font-medium">No {activeTab} tests yet</p>
                        <p className="text-xs mt-1">Tests created in this section run automatically during the publish wizard</p>
                        <button className="mt-4 flex items-center gap-2 mx-auto rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent">
                            <Plus className="h-4 w-4" /> Add Test
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {tests.map(t => <TestRow key={t.id} test={t} />)}
                    </div>
                )}
            </div>
        </div>
    )
}

function TestTubeSvg() {
    return (
        <svg className="mx-auto h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
    )
}
