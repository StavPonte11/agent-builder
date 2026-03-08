/**
 * PublishWizard — 4-step blueprint publish pipeline: Validate > Diff > Tests > Approval
 * Full E7.1 implementation.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQuery } from '@tanstack/react-query'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'
import {
    AlertTriangle, CheckCircle, ChevronRight, Loader2, Play, RotateCcw,
    Shield, TestTube, XCircle, Info, Lock
} from 'lucide-react'

interface ValidationResult {
    errors: Array<{ code: string; message: string; node_id?: string }>
    warnings: Array<{ code: string; message: string; node_id?: string }>
}

interface DiffResult {
    added_nodes: string[]
    removed_nodes: string[]
    changed_nodes: Array<{ id: string; label: string; fields: string[] }>
    changed_prompts: Array<{ node_id: string; before: string; after: string }>
}

interface TestResult {
    id: string
    name: string
    type: 'unit' | 'integration' | 'regression'
    status: 'pending' | 'running' | 'passed' | 'failed'
    error?: string
    duration_ms?: number
}

type Step = 'validate' | 'diff' | 'tests' | 'approval'
const STEPS: Step[] = ['validate', 'diff', 'tests', 'approval']

const STEP_LABELS: Record<Step, string> = {
    validate: 'Validate',
    diff: 'What Changed',
    tests: 'Test Suite',
    approval: 'Admin Approval',
}

const STEP_ICONS: Record<Step, React.ElementType> = {
    validate: Shield,
    diff: Info,
    tests: TestTube,
    approval: Lock,
}

interface PublishWizardProps {
    blueprintId: string
    onClose: () => void
}

function StepNav({ current, passed }: { current: Step; passed: Set<Step> }) {
    return (
        <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
                const Icon = STEP_ICONS[step]
                const isCurrent = current === step
                const isDone = passed.has(step)
                return (
                    <div key={step} className="flex items-center">
                        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors
              ${isCurrent ? 'bg-primary text-primary-foreground' :
                                isDone ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                        >
                            {isDone ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                            {STEP_LABELS[step]}
                        </div>
                        {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
                    </div>
                )
            })}
        </div>
    )
}

// ── Step 1: Validate ──────────────────────────────────────────────────────────

function ValidateStep({
    blueprintId, onPassed
}: { blueprintId: string; onPassed: () => void }) {
    const { data, isLoading, refetch } = useQuery<ValidationResult>({
        queryKey: ['validate', blueprintId],
        queryFn: () =>
            fetch(`/api/v1/blueprints/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blueprint_id: blueprintId }),
            }).then(r => r.json()),
    })

    const canProceed = data && data.errors.length === 0

    return (
        <div className="space-y-4">
            {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validating…</div>}
            {data && (
                <>
                    {data.errors.length === 0 && data.warnings.length === 0 && (
                        <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/30 p-4 text-green-700 dark:text-green-400">
                            <CheckCircle className="h-5 w-5" /> Blueprint is valid — no errors or warnings
                        </div>
                    )}
                    {data.errors.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold text-red-600 mb-2">{data.errors.length} Error{data.errors.length > 1 ? 's' : ''}</p>
                            {data.errors.map((e, i) => (
                                <div key={i} className="flex gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 mb-2">
                                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-mono text-muted-foreground">{e.code}</p>
                                        <p className="text-sm text-foreground">{e.message}</p>
                                        {e.node_id && <p className="text-[11px] font-mono text-muted-foreground">Node: {e.node_id}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {data.warnings.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold text-amber-600 mb-2">{data.warnings.length} Warning{data.warnings.length > 1 ? 's' : ''}</p>
                            {data.warnings.map((w, i) => (
                                <div key={i} className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-foreground">{w.message}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
            <div className="flex gap-3 pt-2">
                <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
                    <RotateCcw className="h-4 w-4" /> Re-validate
                </button>
                <button
                    disabled={!canProceed}
                    onClick={onPassed}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                    Proceed <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

// ── Step 2: Diff ──────────────────────────────────────────────────────────────

function DiffStep({ blueprintId, onPassed }: { blueprintId: string; onPassed: () => void }) {
    const { data, isLoading } = useQuery<DiffResult>({
        queryKey: ['diff', blueprintId],
        queryFn: () => fetch(`/api/v1/blueprints/${blueprintId}/diff`).then(r => r.json()),
    })

    return (
        <div className="space-y-4">
            {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Computing diff…</div>}
            {data && (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-center">
                            <p className="text-2xl font-bold text-green-600">{data.added_nodes.length}</p>
                            <p className="text-xs text-muted-foreground">Added</p>
                        </div>
                        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-center">
                            <p className="text-2xl font-bold text-red-600">{data.removed_nodes.length}</p>
                            <p className="text-xs text-muted-foreground">Removed</p>
                        </div>
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                            <p className="text-2xl font-bold text-amber-600">{data.changed_nodes.length}</p>
                            <p className="text-xs text-muted-foreground">Modified</p>
                        </div>
                    </div>

                    {data.changed_prompts.length > 0 && (
                        <div>
                            <p className="text-sm font-semibold text-foreground mb-2">Prompt Changes</p>
                            <div className="space-y-4">
                                {data.changed_prompts.map(p => (
                                    <div key={p.node_id}>
                                        <p className="text-xs font-mono text-muted-foreground mb-1">Node: {p.node_id}</p>
                                        <div className="rounded-xl overflow-hidden border border-border text-xs">
                                            <ReactDiffViewer
                                                oldValue={p.before}
                                                newValue={p.after}
                                                compareMethod={DiffMethod.WORDS}
                                                splitView={false}
                                                useDarkTheme={true}
                                                styles={{ contentText: { fontSize: '11px', fontFamily: 'monospace' } }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.added_nodes.length === 0 && data.removed_nodes.length === 0 &&
                        data.changed_nodes.length === 0 && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Info className="h-4 w-4" /> No structural changes — only metadata updated.
                            </div>
                        )}
                </>
            )}
            <button
                onClick={onPassed}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
                Proceed to Tests <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    )
}

// ── Step 3: Tests ─────────────────────────────────────────────────────────────

function TestsStep({ blueprintId, onPassed }: { blueprintId: string; onPassed: () => void }) {
    const [tests, setTests] = useState<TestResult[]>([])
    const [running, setRunning] = useState(false)

    const run = async () => {
        setRunning(true)
        const res = await fetch(`/api/v1/blueprints/${blueprintId}/tests/run`, { method: 'POST' })
        const data = await res.json()
        setTests(data.tests ?? [])
        setRunning(false)
    }

    const allPassed = tests.length > 0 && tests.every(t => t.status === 'passed')
    const failedTests = tests.filter(t => t.status === 'failed')

    return (
        <div className="space-y-4">
            <div className="flex gap-3">
                <button
                    onClick={run}
                    disabled={running}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {running ? 'Running…' : 'Run All Tests'}
                </button>
                {failedTests.length > 0 && (
                    <button
                        onClick={run}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                    >
                        <RotateCcw className="h-4 w-4" /> Re-run failed ({failedTests.length})
                    </button>
                )}
            </div>

            {tests.length > 0 && (
                <div className="space-y-2">
                    {tests.map(t => (
                        <div key={t.id} className={`flex items-center gap-3 rounded-xl border p-3
              ${t.status === 'passed' ? 'border-green-500/20 bg-green-500/5' :
                                t.status === 'failed' ? 'border-red-500/20 bg-red-500/5' :
                                    'border-border bg-muted/20'}`}
                        >
                            {t.status === 'running' ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> :
                                t.status === 'passed' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                                    t.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> :
                                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{t.name}</p>
                                {t.error && <p className="text-xs text-red-600 mt-0.5 font-mono">{t.error}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground capitalize">{t.type}</span>
                                {t.duration_ms !== undefined && (
                                    <span className="text-[11px] text-muted-foreground font-mono">{t.duration_ms}ms</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {tests.length > 0 && !allPassed && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-700">
                    <XCircle className="h-4 w-4" /> All tests must pass before publishing.
                </div>
            )}

            <button
                disabled={!allPassed}
                onClick={onPassed}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
                Proceed to Approval <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    )
}

// ── Step 4: Approval ──────────────────────────────────────────────────────────

function ApprovalStep({ blueprintId, onClose }: { blueprintId: string; onClose: () => void }) {
    const [notes, setNotes] = useState('')
    const navigate = useNavigate()

    const publish = useMutation({
        mutationFn: () =>
            fetch(`/api/v1/blueprints/${blueprintId}/publish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ release_notes: notes }),
            }).then(r => r.json()),
        onSuccess: () => {
            navigate(`/blueprints/${blueprintId}`)
            onClose()
        },
    })

    const requestChanges = useMutation({
        mutationFn: () =>
            fetch(`/api/v1/blueprints/${blueprintId}/request-changes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            }).then(r => r.json()),
        onSuccess: onClose,
    })

    return (
        <div className="space-y-4">
            <div className="rounded-xl bg-muted/30 border border-border p-4">
                <p className="text-sm font-medium text-foreground mb-1">Release Notes (optional)</p>
                <p className="text-xs text-muted-foreground mb-2">Describe what changed in this version</p>
                <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. Added email notification step, improved LLM prompt for better accuracy..."
                />
            </div>

            <div className="flex gap-3">
                <button
                    onClick={() => publish.mutate()}
                    disabled={publish.isPending}
                    className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                    {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Publish
                </button>
                <button
                    onClick={() => requestChanges.mutate()}
                    disabled={requestChanges.isPending}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
                >
                    <RotateCcw className="h-4 w-4" /> Request Changes
                </button>
            </div>
        </div>
    )
}

// ── Main Wizard Dialog ─────────────────────────────────────────────────────────

export function PublishWizard({ blueprintId, onClose }: PublishWizardProps) {
    const [step, setStep] = useState<Step>('validate')
    const [passed, setPassed] = useState<Set<Step>>(new Set())

    const advance = (from: Step) => {
        setPassed(prev => new Set([...prev, from]))
        const idx = STEPS.indexOf(from)
        if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-[700px] max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border p-5">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Publish Blueprint</h2>
                        <p className="text-sm text-muted-foreground">Complete all steps to publish to production</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
                </div>

                {/* Step nav */}
                <div className="border-b border-border px-5 py-3 bg-muted/20">
                    <StepNav current={step} passed={passed} />
                </div>

                {/* Step content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <AnimatePresence mode="wait">
                        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                            {step === 'validate' && <ValidateStep blueprintId={blueprintId} onPassed={() => advance('validate')} />}
                            {step === 'diff' && <DiffStep blueprintId={blueprintId} onPassed={() => advance('diff')} />}
                            {step === 'tests' && <TestsStep blueprintId={blueprintId} onPassed={() => advance('tests')} />}
                            {step === 'approval' && <ApprovalStep blueprintId={blueprintId} onClose={onClose} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}
