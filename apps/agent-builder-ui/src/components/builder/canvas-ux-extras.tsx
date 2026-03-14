/**
 * CanvasKeyboardShortcuts — '?' modal overlay showing all canvas shortcuts.
 * StickyNoteNode — non-executing annotation node for canvas documentation.
 *
 * Requirement 6: n8n-style Canvas UX with rich visual affordances.
 */
import React, { memo, useState, useEffect, useCallback } from 'react'
import { NodeProps, Handle, Position } from '@xyflow/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X, StickyNote, PenLine } from 'lucide-react'

// ── Keyboard Shortcuts Modal ──────────────────────────────────────────────────

interface Shortcut {
    keys: string[]
    description: string
    category: string
}

const SHORTCUTS: Shortcut[] = [
    // Navigation
    { keys: ['Ctrl', 'Shift', 'F'], description: 'Fit canvas to screen', category: 'Navigation' },
    { keys: ['Ctrl', '0'], description: 'Reset zoom to 100%', category: 'Navigation' },
    { keys: ['Ctrl', '+'], description: 'Zoom in', category: 'Navigation' },
    { keys: ['Ctrl', '-'], description: 'Zoom out', category: 'Navigation' },
    { keys: ['Space', 'drag'], description: 'Pan canvas', category: 'Navigation' },
    // Selection
    { keys: ['Ctrl', 'A'], description: 'Select all nodes', category: 'Selection' },
    { keys: ['Escape'], description: 'Deselect / close panel', category: 'Selection' },
    { keys: ['Click', 'drag'], description: 'Box select multiple nodes', category: 'Selection' },
    // Editing
    { keys: ['Ctrl', 'Z'], description: 'Undo', category: 'Editing' },
    { keys: ['Ctrl', 'Y'], description: 'Redo', category: 'Editing' },
    { keys: ['Ctrl', 'C'], description: 'Copy selected nodes', category: 'Editing' },
    { keys: ['Ctrl', 'V'], description: 'Paste nodes', category: 'Editing' },
    { keys: ['Delete'], description: 'Delete selected nodes/edges', category: 'Editing' },
    { keys: ['Ctrl', 'D'], description: 'Duplicate selected node', category: 'Editing' },
    // Canvas
    { keys: ['Ctrl', 'S'], description: 'Save blueprint', category: 'Canvas' },
    { keys: ['Ctrl', 'Enter'], description: 'Execute blueprint', category: 'Canvas' },
    { keys: ['Ctrl', 'L'], description: 'Auto-layout (Dagre)', category: 'Canvas' },
    { keys: ['Ctrl', 'E'], description: 'Switch to Execute mode', category: 'Canvas' },
    { keys: ['?'], description: 'Show/hide this help', category: 'Canvas' },
    // Nodes
    { keys: ['Double-click', 'node'], description: 'Rename node inline', category: 'Nodes' },
    { keys: ['Right-click', 'node'], description: 'Context menu', category: 'Nodes' },
    { keys: ['T'], description: 'Add sticky note at cursor', category: 'Nodes' },
]

const CATEGORIES = ['Navigation', 'Selection', 'Editing', 'Canvas', 'Nodes']

function KeyChip({ k }: { k: string }) {
    return (
        <kbd className="inline-flex items-center rounded bg-muted border border-border px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {k}
        </kbd>
    )
}

export function CanvasKeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    // Close on '?' press or Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) onClose()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [open, onClose])

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="w-[680px] max-h-[80vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-border px-6 py-4">
                            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Keyboard className="h-4 w-4 text-primary" />
                                Keyboard Shortcuts
                            </h2>
                            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {CATEGORIES.map(cat => (
                                    <div key={cat}>
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                            {cat}
                                        </h3>
                                        <div className="space-y-2">
                                            {SHORTCUTS.filter(s => s.category === cat).map((s, i) => (
                                                <div key={i} className="flex items-center justify-between gap-4">
                                                    <span className="text-xs text-muted-foreground flex-1">{s.description}</span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {s.keys.map((k, j) => (
                                                            <span key={j} className="flex items-center">
                                                                {j > 0 && <span className="text-muted-foreground/50 text-[10px] mx-0.5">+</span>}
                                                                <KeyChip k={k} />
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="border-t border-border px-6 py-3">
                            <p className="text-[11px] text-muted-foreground">Press <KeyChip k="?" /> to toggle this overlay</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

/** Hook: attach the '?' hotkey to open/close the shortcuts modal */
export function useKeyboardShortcutsModal() {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            // Don't trigger inside inputs/textareas
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
            if (e.key === '?') setOpen(x => !x)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    return { open, onClose: useCallback(() => setOpen(false), []) }
}


// ── Sticky Note Node ──────────────────────────────────────────────────────────

interface StickyNoteData {
    text: string
    color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple'
}

const STICKY_COLORS = {
    yellow: 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700',
    blue: 'bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700',
    green: 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700',
    pink: 'bg-pink-50 border-pink-300 dark:bg-pink-900/20 dark:border-pink-700',
    purple: 'bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700',
}

/**
 * StickyNoteNode — a non-executing annotation card.
 * Draggable like any node, but has no handles (cannot be connected).
 * Double-click to edit text inline.
 * Color can be changed via right-click context menu (handled in BuilderPage).
 */
export function StickyNoteNode({ data, selected }: NodeProps<any>) {
    const [editing, setEditing] = useState(false)
    const [text, setText] = useState(data.text || 'Click to add a note…')
    const color = (data.color as keyof typeof STICKY_COLORS) ?? 'yellow'

    return (
        <div
            className={`relative min-w-[160px] max-w-[280px] min-h-[80px] rounded-xl border-2 p-3 shadow-sm
        ${STICKY_COLORS[color]}
        ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}
        cursor-default group`}
            onDoubleClick={() => setEditing(true)}
        >
            {/* Icon row */}
            <div className="flex items-center gap-1.5 mb-2">
                <StickyNote className="h-3 w-3 text-muted-foreground/60" />
                {!editing && (
                    <button
                        onClick={() => setEditing(true)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <PenLine className="h-3 w-3 text-muted-foreground/60 hover:text-foreground" />
                    </button>
                )}
            </div>

            {editing ? (
                <textarea
                    autoFocus
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onBlur={() => {
                        setEditing(false)
                        // data.text is updated via onBlur so the store picks it up
                        data.text = text
                    }}
                    className="w-full bg-transparent text-xs text-foreground resize-none focus:outline-none font-sans leading-relaxed"
                    rows={4}
                />
            ) : (
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                    {text || 'Double-click to edit…'}
                </p>
            )}

            {/* Tiny color picker dots shown on hover */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {(Object.keys(STICKY_COLORS) as StickyNoteData['color'][]).map(c => (
                    <button
                        key={c}
                        title={c}
                        className={`h-3 w-3 rounded-full border border-border ${c === 'yellow' ? 'bg-yellow-300' :
                                c === 'blue' ? 'bg-blue-300' :
                                    c === 'green' ? 'bg-green-300' :
                                        c === 'pink' ? 'bg-pink-300' : 'bg-purple-300'
                            }`}
                    />
                ))}
            </div>
        </div>
    )
}

export const STICKY_NOTE_NODE_DEFINITION = {
    id: 'sticky_note',
    type: 'sticky_note',
    icon: '📌',
    label: 'Sticky Note',
    description: 'Annotation — not executed',
    color: 'bg-yellow-50',
    defaultData: { text: '', color: 'yellow' },
}
