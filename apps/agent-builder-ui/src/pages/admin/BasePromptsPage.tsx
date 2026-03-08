/**
 * BasePromptsPage — Admin CRUD for base prompts with version history,
 * Monaco editor, dependency warnings, and cascade deactivation protection.
 * Full E9.1 implementation.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from '@monaco-editor/react'
import { format } from 'date-fns'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'
import {
    AlertTriangle, ChevronDown, Edit3, GitBranch, History,
    Plus, Save, Trash2, XCircle
} from 'lucide-react'

interface BasePromptVersion {
    id: string
    content: string
    version_number: number
    created_at: string
    created_by_email: string
}

interface BasePrompt {
    id: string
    name: string
    description?: string
    content: string
    version_number: number
    is_active: boolean
    created_at: string
    updated_at: string
    dependent_blueprints_count: number
    dependent_blueprint_names: string[]
    versions: BasePromptVersion[]
}

interface DeactivationWarningProps {
    prompt: BasePrompt
    onConfirm: () => void
    onCancel: () => void
}

function DeactivationWarning({ prompt, onConfirm, onCancel }: DeactivationWarningProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-[500px] rounded-2xl border border-red-500/30 bg-card shadow-2xl p-6"
            >
                <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Deactivate Base Prompt?</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            This will suspend <strong className="text-foreground">{prompt.dependent_blueprints_count} blueprint{prompt.dependent_blueprints_count > 1 ? 's' : ''}</strong> that depend on it:
                        </p>
                    </div>
                </div>
                <ul className="space-y-1 mb-5 max-h-40 overflow-y-auto">
                    {prompt.dependent_blueprint_names.map(name => (
                        <li key={name} className="flex items-center gap-2 text-sm text-foreground">
                            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            {name}
                        </li>
                    ))}
                </ul>
                <div className="flex gap-3">
                    <button
                        onClick={onConfirm}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                        Deactivate & Suspend {prompt.dependent_blueprints_count} Blueprint{prompt.dependent_blueprints_count > 1 ? 's' : ''}
                    </button>
                    <button
                        onClick={onCancel}
                        className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-accent"
                    >
                        Cancel
                    </button>
                </div>
            </motion.div>
        </div>
    )
}

function PromptCard({ prompt }: { prompt: BasePrompt }) {
    const [editing, setEditing] = useState(false)
    const [editorContent, setEditorContent] = useState(prompt.content)
    const [showVersions, setShowVersions] = useState(false)
    const [compareVersions, setCompareVersions] = useState<[string, string] | null>(null)
    const [showDeactivateWarning, setShowDeactivateWarning] = useState(false)
    const qc = useQueryClient()

    const save = useMutation({
        mutationFn: () =>
            fetch(`/api/v1/base-prompts/${prompt.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editorContent }),
            }).then(r => r.json()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['base-prompts'] })
            setEditing(false)
        },
    })

    const deactivate = useMutation({
        mutationFn: () =>
            fetch(`/api/v1/base-prompts/${prompt.id}/deactivate`, { method: 'POST' }).then(r => r.json()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['base-prompts'] })
            setShowDeactivateWarning(false)
        },
    })

    const getVersionContent = (vid: string) =>
        prompt.versions.find(v => v.id === vid)?.content ?? ''

    return (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{prompt.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                ${prompt.is_active ? 'bg-green-500/10 text-green-700' : 'bg-muted text-muted-foreground'}`}
                            >
                                {prompt.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">v{prompt.version_number}</span>
                        </div>
                        {prompt.description && <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {prompt.dependent_blueprints_count > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <GitBranch className="h-3.5 w-3.5" />
                            Used in {prompt.dependent_blueprints_count} blueprints
                        </span>
                    )}
                    <button
                        onClick={() => setShowVersions(v => !v)}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-accent"
                    >
                        <History className="h-3.5 w-3.5" />
                        History ({prompt.versions?.length ?? 0})
                        <ChevronDown className={`h-3 w-3 transition-transform ${showVersions ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                        onClick={() => setEditing(e => !e)}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary hover:bg-primary/20"
                    >
                        <Edit3 className="h-3.5 w-3.5" />
                        {editing ? 'Cancel' : 'Edit'}
                    </button>
                    {prompt.is_active && (
                        <button
                            onClick={() => {
                                if (prompt.dependent_blueprints_count > 0) setShowDeactivateWarning(true)
                                else deactivate.mutate()
                            }}
                            className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/10"
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Deactivate
                        </button>
                    )}
                </div>
            </div>

            {/* Editor or preview */}
            <div className="p-5">
                {editing ? (
                    <div className="space-y-3">
                        <div className="rounded-xl overflow-hidden border border-border h-56">
                            <Editor
                                defaultValue={prompt.content}
                                language="markdown"
                                theme="vs-dark"
                                value={editorContent}
                                onChange={v => setEditorContent(v ?? '')}
                                options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', wordWrap: 'on' }}
                            />
                        </div>
                        <button
                            onClick={() => save.mutate()}
                            disabled={save.isPending}
                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {save.isPending ? 'Saving…' : 'Save & Version'}
                        </button>
                        <p className="text-[11px] text-muted-foreground">
                            Saving will create a new version and trigger re-testing of all {prompt.dependent_blueprints_count} dependent blueprints.
                        </p>
                    </div>
                ) : (
                    <pre className="whitespace-pre-wrap text-xs font-mono text-foreground max-h-32 overflow-y-auto text-ellipsis">
                        {prompt.content}
                    </pre>
                )}
            </div>

            {/* Version history */}
            <AnimatePresence>
                {showVersions && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-border"
                    >
                        <div className="p-4 space-y-2">
                            {prompt.versions?.map(v => (
                                <div key={v.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                                    <div>
                                        <span className="text-xs font-semibold text-foreground">v{v.version_number}</span>
                                        <span className="text-[10px] text-muted-foreground ml-2">{format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}</span>
                                        <span className="text-[10px] text-muted-foreground ml-2">by {v.created_by_email}</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!compareVersions) {
                                                setCompareVersions([v.id, v.id])
                                            } else if (compareVersions[0] === compareVersions[1]) {
                                                setCompareVersions([compareVersions[0], v.id])
                                            } else {
                                                setCompareVersions(null)
                                            }
                                        }}
                                        className="text-[11px] text-primary underline"
                                    >
                                        Compare
                                    </button>
                                </div>
                            ))}

                            {compareVersions && compareVersions[0] !== compareVersions[1] && (
                                <div className="rounded-xl overflow-hidden border border-border">
                                    <ReactDiffViewer
                                        oldValue={getVersionContent(compareVersions[0])}
                                        newValue={getVersionContent(compareVersions[1])}
                                        compareMethod={DiffMethod.WORDS}
                                        splitView={false}
                                        useDarkTheme
                                        styles={{ contentText: { fontSize: '11px', fontFamily: 'monospace' } }}
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showDeactivateWarning && (
                <DeactivationWarning
                    prompt={prompt}
                    onConfirm={() => deactivate.mutate()}
                    onCancel={() => setShowDeactivateWarning(false)}
                />
            )}
        </div>
    )
}

export function BasePromptsPage() {
    const [showCreate, setShowCreate] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [newContent, setNewContent] = useState('')
    const qc = useQueryClient()

    const { data: prompts = [], isLoading } = useQuery<BasePrompt[]>({
        queryKey: ['base-prompts'],
        queryFn: () => fetch('/api/v1/base-prompts').then(r => r.json()),
    })

    const create = useMutation({
        mutationFn: () =>
            fetch('/api/v1/base-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, description: newDesc, content: newContent }),
            }).then(r => r.json()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['base-prompts'] })
            setShowCreate(false)
            setNewName('')
            setNewContent('')
        },
    })

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border bg-card/80 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Base Prompts</h1>
                        <p className="text-sm text-muted-foreground">Shared system prompt templates for blueprints</p>
                    </div>
                    <button
                        onClick={() => setShowCreate(s => !s)}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> New Base Prompt
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">
                <AnimatePresence>
                    {showCreate && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3"
                        >
                            <h3 className="font-semibold text-foreground">New Base Prompt</h3>
                            <input
                                placeholder="Name"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <input
                                placeholder="Description (optional)"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <div className="rounded-xl overflow-hidden border border-border h-48">
                                <Editor
                                    language="markdown"
                                    theme="vs-dark"
                                    value={newContent}
                                    onChange={v => setNewContent(v ?? '')}
                                    options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                                />
                            </div>
                            <button
                                onClick={() => create.mutate()}
                                disabled={!newName || !newContent || create.isPending}
                                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                            >
                                {create.isPending ? 'Creating…' : 'Create Base Prompt'}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">Loading…</div>
                ) : prompts.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                        <p className="text-sm font-medium">No base prompts yet</p>
                        <p className="text-xs mt-1">Create reusable system prompts shared across blueprints</p>
                    </div>
                ) : (
                    prompts.map(p => <PromptCard key={p.id} prompt={p} />)
                )}
            </div>
        </div>
    )
}
