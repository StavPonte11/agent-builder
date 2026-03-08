import { Save, Undo, Redo, Play, CloudUpload } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useCanvasStore } from '@/stores/canvasStore'
import { serializeBlueprint } from '@/lib/blueprint-serializer'

export function BuilderToolbar() {
    const { id } = useParams()
    const { undo, redo, past, future, nodes, edges } = useCanvasStore()

    const canUndo = past.length > 0
    const canRedo = future.length > 0

    const handleSave = () => {
        const payload = serializeBlueprint(nodes, edges)
        console.log("Saving blueprint payload:", payload)
        // STUB: Connect to useBlueprints mutation
    }

    const handlePublish = () => {
        // STUB: Publish modal flow
        console.log("Publishing blueprint")
    }

    return (
        <div className="flex h-12 w-full items-center justify-between border-b border-border bg-card px-4">
            {/* Left section: Breadcrumb/Title */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Blueprint {id ?? 'New'}</span>
                <span className="rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">Draft</span>
            </div>

            {/* Middle section: Undo/Redo & Actions */}
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 p-1">
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="rounded p-1.5 text-foreground transition-colors hover:bg-background disabled:opacity-50"
                    title="Undo"
                >
                    <Undo className="h-4 w-4" />
                </button>
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="rounded p-1.5 text-foreground transition-colors hover:bg-background disabled:opacity-50"
                    title="Redo"
                >
                    <Redo className="h-4 w-4" />
                </button>
                <div className="mx-1 h-4 w-px bg-border gap-2" />
                <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 rounded p-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background"
                >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                </button>
            </div>

            {/* Right section: Test & Publish */}
            <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent">
                    <Play className="h-3.5 w-3.5 text-green-500" />
                    <span>Test Run</span>
                </button>
                <button
                    onClick={handlePublish}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    <CloudUpload className="h-3.5 w-3.5" />
                    <span>Publish</span>
                </button>
            </div>
        </div>
    )
}
