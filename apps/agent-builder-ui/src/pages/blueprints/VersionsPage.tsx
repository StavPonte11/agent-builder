/**
 * VersionsPage — Blueprint version history with side-by-side diff and rollback.
 * Full E7.2 implementation.
 */
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { format } from 'date-fns'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer'
import { RotateCcw, GitCompare, Clock, User, CheckCircle, Archive } from 'lucide-react'
import { PublishWizard } from '@/components/publish/PublishWizard'

interface BlueprintVersion {
    id: string
    version_number: number
    status: 'published' | 'archived'
    release_notes?: string
    created_at: string
    created_by_email: string
    definition: unknown
}

export function VersionsPage() {
    const { id: blueprintId } = useParams<{ id: string }>()
    const [selected, setSelected] = useState<[string, string] | null>(null)
    const [showPublish, setShowPublish] = useState(false)

    const { data: versions = [], refetch } = useQuery<BlueprintVersion[]>({
        queryKey: ['blueprint-versions', blueprintId],
        queryFn: () => fetch(`/api/v1/blueprints/${blueprintId}/versions`).then(r => r.json()),
        enabled: !!blueprintId,
    })

    const rollback = useMutation({
        mutationFn: (versionId: string) =>
            fetch(`/api/v1/blueprints/${blueprintId}/rollback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version_id: versionId }),
            }).then(r => r.json()),
        onSuccess: () => {
            refetch()
            setShowPublish(true)
        },
    })

    const getDefString = (vId: string) => {
        const v = versions.find(v => v.id === vId)
        return v ? JSON.stringify(v.definition, null, 2) : ''
    }

    const [diffA, diffB] = selected ?? [null, null]
    const showDiff = diffA && diffB && diffA !== diffB

    const handleSelect = (vId: string) => {
        if (!selected || selected[0] === selected[1]) {
            if (!selected) setSelected([vId, vId])
            else setSelected([selected[0], vId])
        } else {
            setSelected([vId, vId])
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b border-border bg-card/80 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Version History</h1>
                        <p className="text-sm text-muted-foreground">{versions.length} versions</p>
                    </div>
                    {selected && selected[0] !== selected[1] && (
                        <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">
                            Clear comparison
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
                {!showDiff && versions.length >= 2 && (
                    <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border p-3 text-sm text-muted-foreground">
                        <GitCompare className="h-4 w-4" />
                        Select two versions to compare them side-by-side
                    </div>
                )}

                <div className="space-y-3">
                    {versions.map((v, i) => {
                        const isSelectedA = selected?.[0] === v.id
                        const isSelectedB = selected?.[1] === v.id
                        const isSelected = isSelectedA || isSelectedB

                        return (
                            <div
                                key={v.id}
                                className={`rounded-2xl border transition-all cursor-pointer
                  ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                                onClick={() => handleSelect(v.id)}
                            >
                                <div className="flex items-start gap-4 p-4">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold
                    ${v.status === 'published' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}
                                    >
                                        v{v.version_number}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {v.status === 'published' && (
                                                <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-600">
                                                    <CheckCircle className="h-3 w-3" /> Published
                                                </span>
                                            )}
                                            {v.status === 'archived' && (
                                                <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                                    <Archive className="h-3 w-3" /> Archived
                                                </span>
                                            )}
                                            {i === 0 && <span className="text-[10px] text-primary font-semibold">Latest</span>}
                                        </div>
                                        <p className="text-sm text-foreground mt-1">{v.release_notes || 'No release notes'}</p>
                                        <div className="flex items-center gap-4 mt-1.5 text-[11px] text-muted-foreground">
                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(v.created_at), 'MMM d, yyyy HH:mm')}</span>
                                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{v.created_by_email}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {isSelected && (
                                            <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                                                {isSelectedA && selected?.[0] !== selected?.[1] ? 'A' : isSelectedB ? 'B' : ''}
                                            </span>
                                        )}
                                        {v.status === 'archived' && (
                                            <button
                                                onClick={e => { e.stopPropagation(); rollback.mutate(v.id) }}
                                                disabled={rollback.isPending}
                                                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs hover:bg-accent transition-colors"
                                            >
                                                <RotateCcw className="h-3 w-3" /> Rollback
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {showDiff && diffA && diffB && (
                    <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <GitCompare className="h-4 w-4" /> Version Diff
                            <span className="text-muted-foreground font-normal text-xs">
                                v{versions.find(v => v.id === diffA)?.version_number} → v{versions.find(v => v.id === diffB)?.version_number}
                            </span>
                        </h3>
                        <div className="rounded-2xl overflow-hidden border border-border">
                            <ReactDiffViewer
                                oldValue={getDefString(diffA)}
                                newValue={getDefString(diffB)}
                                compareMethod={DiffMethod.WORDS}
                                splitView
                                useDarkTheme
                                styles={{ contentText: { fontSize: '11px', fontFamily: 'monospace' } }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {showPublish && blueprintId && (
                <PublishWizard blueprintId={blueprintId} onClose={() => setShowPublish(false)} />
            )}
        </div>
    )
}
