import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus, Search, MoreVertical, Edit2, Play, Trash2, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

export default function BlueprintsPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const { data: blueprints, isLoading, error } = useQuery({
        queryKey: ['blueprints'],
        queryFn: async () => {
            const { data, error } = await apiClient.GET('/api/v1/blueprints', {})
            if (error) throw new Error('Failed to fetch blueprints')
            return data
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await apiClient.DELETE('/api/v1/blueprints/{blueprint_id}', {
                params: { path: { blueprint_id: id as any } }
            })
            if (error) throw new Error('Failed to delete blueprint')
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['blueprints'] })
        }
    })

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

            {/* List/Grid View */}
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : error ? (
                <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
                    <p>Error loading blueprints. Please try again.</p>
                </div>
            ) : blueprints && blueprints.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {blueprints.map((bp: any) => (
                        <div key={bp.id} className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-border/80 hover:shadow-md">
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <h3 className="font-semibold text-foreground line-clamp-1">{bp.name}</h3>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                        bp.status === 'published' ? 'bg-green-500/10 text-green-500' :
                                        bp.status === 'draft' ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-blue-500/10 text-blue-500'
                                    }`}>
                                        {bp.status || 'draft'}
                                    </span>
                                </div>
                                <p className="mb-4 text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                    {bp.description || 'No description provided.'}
                                </p>
                            </div>
                            
                            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>
                                        {bp.updated_at ? formatDistanceToNow(new Date(bp.updated_at), { addSuffix: true }) : 'Unknown'}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button 
                                        onClick={() => navigate(`/blueprints/${bp.id}`)}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title="Edit Builder"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button 
                                        onClick={() => navigate(`/blueprints/${bp.id}/sandbox`)}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        title="Run Sandbox"
                                    >
                                        <Play className="h-4 w-4" />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this blueprint?')) {
                                                deleteMutation.mutate(bp.id)
                                            }
                                        }}
                                        className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
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
            )}
        </div>
    )
}
