/**
 * NodeConfigPanel — Right sidebar that opens when a node is selected.
 * Renders type-specific fields for all 14 node types.
 * Uses Monaco editor for prompt fields.
 */
import { useCallback, useMemo, useState } from 'react'
import { X, Plus, Trash2, ChevronDown, ExternalLink, PlayCircle, Sparkles, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from '@monaco-editor/react'
import { useCanvasStore } from '@/stores/canvasStore'
import type { MappingEntry, RouteEntry, BranchEntry } from '@/types/blueprint'
import { useQuery } from '@tanstack/react-query'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
    return Math.random().toString(36).slice(2, 9)
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1">
                <label className="block text-xs font-medium text-foreground">{label}</label>
                {hint && (
                    <span title={hint}>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </span>
                )}
            </div>
            {children}
        </div>
    )
}

function TextInput({
    value, onChange, placeholder, mono = false
}: {
    value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary ${mono ? 'font-mono' : ''}`}
        />
    )
}

function NumberInput({ value, onChange, min, max, step = 1 }: {
    value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
    return (
        <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
    )
}

function Select({ value, onChange, children }: {
    value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none rounded-md border border-border bg-background px-3 py-1.5 pr-8 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
            >
                {children}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    )
}

function Textarea({ value, onChange, placeholder, rows = 4 }: {
    value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
        />
    )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm text-foreground">{label}</span>
            <button
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted border border-border'}`}
            >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
            </button>
        </label>
    )
}

function Slider({ value, onChange, min = 0, max = 1, step = 0.1, label }: {
    value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label?: string
}) {
    return (
        <div className="flex items-center gap-3">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 h-1.5 accent-primary"
            />
            <span className="w-10 text-right font-mono text-xs text-muted-foreground">{value}</span>
        </div>
    )
}

function PromptEditor({ value, onChange, language = 'plaintext' }: {
    value: string; onChange: (v: string) => void; language?: string
}) {
    return (
        <div className="rounded-md overflow-hidden border border-border">
            <Editor
                height="160px"
                language={language}
                value={value}
                onChange={(v) => onChange(v ?? '')}
                theme="vs-dark"
                options={{
                    minimap: { enabled: false },
                    lineNumbers: 'off',
                    wordWrap: 'on',
                    fontSize: 12,
                    padding: { top: 8, bottom: 8 },
                    scrollBeyondLastLine: false,
                    overviewRulerLanes: 0,
                    folding: false,
                    renderLineHighlight: 'none',
                }}
            />
        </div>
    )
}

// ─── Mapping Table ────────────────────────────────────────────────────────────

function MappingTable({
    label, entries, onChange, paramPlaceholder = 'param', exprPlaceholder = '{{state.field}}'
}: {
    label: string
    entries: MappingEntry[]
    onChange: (entries: MappingEntry[]) => void
    paramPlaceholder?: string
    exprPlaceholder?: string
}) {
    const safeEntries = Array.isArray(entries) ? entries : []

    const add = () => onChange([...safeEntries, { id: uid(), param: '', expression: '' }])
    const remove = (id: string) => onChange(safeEntries.filter((e) => e.id !== id))
    const update = (id: string, field: 'param' | 'expression', val: string) =>
        onChange(safeEntries.map((e) => (e.id === id ? { ...e, [field]: val } : e)))

    return (
        <Field label={label}>
            <div className="space-y-1">
                {safeEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-1.5">
                        <input
                            value={entry.param}
                            onChange={(e) => update(entry.id, 'param', e.target.value)}
                            placeholder={paramPlaceholder}
                            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                        />
                        <span className="text-xs text-muted-foreground">→</span>
                        <input
                            value={entry.expression}
                            onChange={(e) => update(entry.id, 'expression', e.target.value)}
                            placeholder={exprPlaceholder}
                            className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                        />
                        <button onClick={() => remove(entry.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={add}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" /> Add mapping
                </button>
            </div>
        </Field>
    )
}

// ─── Common Fields (on every node) ───────────────────────────────────────────

function CommonFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, data: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)

    return (
        <div className="space-y-4">
            <Field label="Label">
                <TextInput value={d.label ?? ''} onChange={(v) => up({ label: v })} placeholder="Node name" />
            </Field>

            <Field label="Description" hint="Shown as tooltip on canvas">
                <Textarea value={d.description ?? ''} onChange={(v) => up({ description: v })} placeholder="What does this node do?" rows={2} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Timeout (s)">
                    <NumberInput value={d.timeout ?? 30} onChange={(v) => up({ timeout: v })} min={1} max={3600} />
                </Field>
                <Field label="Max Retries">
                    <NumberInput value={d.retry_max_attempts ?? 2} onChange={(v) => up({ retry_max_attempts: v })} min={0} max={10} />
                </Field>
            </div>

            <Field label="Retry Backoff">
                <Select value={d.retry_backoff ?? 'exponential'} onChange={(v) => up({ retry_backoff: v })}>
                    <option value="linear">Linear</option>
                    <option value="exponential">Exponential</option>
                </Select>
            </Field>

            <MappingTable
                label="Input Mapping"
                entries={d.input_mapping ?? []}
                onChange={(v) => up({ input_mapping: v })}
                paramPlaceholder="param"
                exprPlaceholder="{{state.field}}"
            />

            <MappingTable
                label="Output Mapping"
                entries={d.output_mapping ?? []}
                onChange={(v) => up({ output_mapping: v })}
                paramPlaceholder="state field"
                exprPlaceholder="output.value"
            />

            <Field label="Notes">
                <Textarea value={d.notes ?? ''} onChange={(v) => up({ notes: v })} placeholder="Documentation — not executed" rows={2} />
            </Field>
        </div>
    )
}

// ─── LLM Node Fields ─────────────────────────────────────────────────────────

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string; context: string }[]> = {
    openai: [
        { value: 'gpt-4o', label: 'GPT-4o', context: '128k ctx' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini', context: '128k ctx' },
        { value: 'o1', label: 'o1', context: '128k ctx' },
        { value: 'o3-mini', label: 'o3-mini', context: '200k ctx' },
    ],
    anthropic: [
        { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', context: '200k ctx' },
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', context: '200k ctx' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', context: '200k ctx' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', context: '200k ctx' },
    ],
    google: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', context: '1M ctx' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', context: '2M ctx' },
    ],
    local: [
        { value: 'ollama', label: 'Local (Ollama)', context: '32k ctx' },
        { value: 'vllm', label: 'Local (vLLM)', context: '32k ctx' },
    ],
}

function LLMFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, data: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    const provider = d.provider ?? 'openai'
    const models = MODELS_BY_PROVIDER[provider] ?? []

    const [improveLoading, setImproveLoading] = useState(false)
    const [testLoading, setTestLoading] = useState(false)
    const [testResult, setTestResult] = useState<string | null>(null)

    const handleTestPrompt = async () => {
        setTestLoading(true)
        try {
            const res = await fetch(`/api/v1/blueprints/test-node`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ node_type: 'llm', node_data: d }),
            })
            const data = await res.json()
            setTestResult(JSON.stringify(data, null, 2))
        } finally {
            setTestLoading(false)
        }
    }

    const handleImprovePrompt = async () => {
        setImproveLoading(true)
        try {
            const res = await fetch(`/api/v1/blueprints/improve-prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system_prompt: d.system_prompt, user_prompt: d.user_prompt }),
            })
            const data = await res.json()
            if (data.improved_system_prompt) up({ system_prompt: data.improved_system_prompt })
        } finally {
            setImproveLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <Field label="Provider">
                <Select value={provider} onChange={(v) => up({ provider: v, model: undefined })}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="local">Local Fallback</option>
                    <option value="custom">Custom Endpoint</option>
                </Select>
            </Field>

            <Field label="Model">
                <Select value={d.model ?? models[0]?.value ?? ''} onChange={(v) => up({ model: v })}>
                    {models.map((m) => (
                        <option key={m.value} value={m.value}>{m.label} — {m.context}</option>
                    ))}
                </Select>
            </Field>

            <Field label="System Prompt" hint="Jinja2 templating: {{ state.field }}">
                <PromptEditor value={d.system_prompt ?? ''} onChange={(v) => up({ system_prompt: v })} />
            </Field>

            <Field label="User Prompt Template" hint="Jinja2 templating">
                <PromptEditor value={d.user_prompt ?? ''} onChange={(v) => up({ user_prompt: v })} />
            </Field>

            <Field label="Output Schema (JSON)" hint="When set, enforces structured output. Runtime retries on schema fail.">
                <div className="rounded-md overflow-hidden border border-border">
                    <Editor
                        height="100px"
                        language="json"
                        value={d.output_schema ?? '{}'}
                        onChange={(v) => up({ output_schema: v ?? '{}' })}
                        theme="vs-dark"
                        options={{ minimap: { enabled: false }, lineNumbers: 'off', fontSize: 11, padding: { top: 4 } }}
                    />
                </div>
            </Field>

            <Field label={`Temperature: ${d.temperature ?? 0.7}`}>
                <Slider value={d.temperature ?? 0.7} onChange={(v) => up({ temperature: v })} min={0} max={2} step={0.1} />
            </Field>

            <Field label={`Max Tokens: ${d.max_tokens ?? 2048}`}>
                <Slider value={d.max_tokens ?? 2048} onChange={(v) => up({ max_tokens: v })} min={64} max={8192} step={64} />
            </Field>

            <Toggle checked={d.streaming ?? false} onChange={(v) => up({ streaming: v })} label="Streaming" />

            <Toggle checked={d.enable_memory as boolean ?? false} onChange={(v) => up({ enable_memory: v })} label="Enable Persistence (Memory)" />

            <Field label="Tools (MCP)" hint="Connect external tools visually">
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground text-center">
                    <p>To bind tools to this model, drag a <strong>Tool</strong> node onto the canvas and connect its output to the <strong className="text-foreground">Tools handle</strong> at the bottom of this node.</p>
                </div>
            </Field>

            <div className="flex gap-2">
                <button
                    onClick={handleTestPrompt}
                    disabled={testLoading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                >
                    <PlayCircle className="h-3.5 w-3.5 text-green-500" />
                    {testLoading ? 'Testing…' : 'Test Prompt'}
                </button>
                <button
                    onClick={handleImprovePrompt}
                    disabled={improveLoading}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                >
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    {improveLoading ? 'Improving…' : 'Improve (AI)'}
                </button>
            </div>

            {testResult && (
                <div className="rounded-md border border-border bg-muted/50 p-2">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Test Result</p>
                    <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{testResult}</pre>
                </div>
            )}
        </div>
    )
}

// ─── Tool Node Fields ─────────────────────────────────────────────────────────

function ToolFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)

    const { data: tools = [] } = useQuery<{ tool_id: string; name: string; health_status?: string; capabilities: { name: string; description: string }[] }[]>({
        queryKey: ['tools'],
        queryFn: () => fetch('/api/v1/tools').then((r) => r.json()),
    })

    const selectedTool = tools.find((t) => t.tool_id === d.tool_id)
    const [testResult, setTestResult] = useState<string | null>(null)
    const [testLoading, setTestLoading] = useState(false)

    const handleTest = async () => {
        setTestLoading(true)
        try {
            const res = await fetch(`/api/v1/tools/${d.tool_id}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ capability: d.capability, input: {} }),
            })
            const result = await res.json()
            setTestResult(JSON.stringify(result, null, 2))
        } finally {
            setTestLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            <Field label="Tool">
                <Select value={d.tool_id ?? ''} onChange={(v) => up({ tool_id: v, capability: undefined })}>
                    <option value="">— Select tool —</option>
                    {tools.map((t) => (
                        <option key={t.tool_id} value={t.tool_id}>{t.name}</option>
                    ))}
                </Select>
            </Field>

            {selectedTool && (
                <Field label="Capability">
                    <Select value={d.capability ?? ''} onChange={(v) => up({ capability: v })}>
                        <option value="">— Select capability —</option>
                        {(selectedTool.capabilities || []).map((c) => (
                            <option key={c.name} value={c.name}>{c.name} — {c.description}</option>
                        ))}
                    </Select>
                </Field>
            )}

            <button
                onClick={handleTest}
                disabled={!d.tool_id || !d.capability || testLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
            >
                <PlayCircle className="h-3.5 w-3.5 text-green-500" />
                {testLoading ? 'Testing…' : 'Test Capability'}
            </button>

            {testResult && (
                <div className="rounded-md border border-border bg-muted/50 p-2">
                    <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">{testResult}</pre>
                </div>
            )}
        </div>
    )
}

// ─── Condition Node Fields ────────────────────────────────────────────────────

function ConditionFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    const [testInput, setTestInput] = useState('{}')
    const [testResult, setTestResult] = useState<string | null>(null)

    const handleTest = () => {
        try {
            setTestResult(`Expression: ${d.expression}\nTest state: ${testInput}\n\n(Backend evaluation coming soon)`)
        } catch {
            setTestResult('Error evaluating expression')
        }
    }

    return (
        <div className="space-y-4">
            <Field label="Expression (Jinja2)" hint="Must evaluate to true/false. e.g., {{ state.score }} >= 0.8">
                <TextInput value={d.expression ?? ''} onChange={(v) => up({ expression: v })} placeholder="{{ state.score }} >= 0.8" mono />
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="True Path Label">
                    <TextInput value={d.true_label ?? 'true'} onChange={(v) => up({ true_label: v })} />
                </Field>
                <Field label="False Path Label">
                    <TextInput value={d.false_label ?? 'false'} onChange={(v) => up({ false_label: v })} />
                </Field>
            </div>

            <Field label="Test State (JSON)">
                <Textarea value={testInput} onChange={setTestInput} rows={3} placeholder='{"score": 0.9}' />
            </Field>
            <button
                onClick={handleTest}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
                <PlayCircle className="h-3.5 w-3.5 text-green-500" />
                Evaluate Expression
            </button>
            {testResult && (
                <div className="rounded-md bg-muted p-2">
                    <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">{testResult}</pre>
                </div>
            )}
        </div>
    )
}

// ─── Router Node Fields ───────────────────────────────────────────────────────

function RouterFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    const routes: RouteEntry[] = d.routes ?? []

    const addRoute = () => up({ routes: [...routes, { id: uid(), name: '', description: '' }] })
    const removeRoute = (id: string) => up({ routes: routes.filter((r) => r.id !== id) })
    const updateRoute = (id: string, field: keyof RouteEntry, val: string) =>
        up({ routes: routes.map((r) => (r.id === id ? { ...r, [field]: val } : r)) })

    return (
        <div className="space-y-4">
            <Field label="Routing Prompt" hint="Tell the LLM how to choose between routes">
                <Textarea value={d.routing_prompt ?? ''} onChange={(v) => up({ routing_prompt: v })} rows={3} />
            </Field>

            <Field label="Routes">
                <div className="space-y-2">
                    {routes.map((route, i) => (
                        <div key={route.id} className="rounded-md border border-border bg-muted/30 p-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                                <input
                                    value={route.name}
                                    onChange={(e) => updateRoute(route.id, 'name', e.target.value)}
                                    placeholder="route_name"
                                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs font-mono outline-none focus:border-primary"
                                />
                                <button onClick={() => removeRoute(route.id)} className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <input
                                value={route.description}
                                onChange={(e) => updateRoute(route.id, 'description', e.target.value)}
                                placeholder="When to choose this route (LLM reads this)"
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                            />
                        </div>
                    ))}
                    <button onClick={addRoute} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <Plus className="h-3.5 w-3.5" /> Add route
                    </button>
                </div>
            </Field>

            <Field label="Fallback Route">
                <Select value={d.fallback_route ?? ''} onChange={(v) => up({ fallback_route: v })}>
                    <option value="">— None —</option>
                    {routes.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </Select>
            </Field>

            <Field label={`Confidence Threshold: ${d.confidence_threshold ?? 0.5}`}>
                <Slider value={d.confidence_threshold ?? 0.5} onChange={(v) => up({ confidence_threshold: v })} min={0} max={1} step={0.05} />
            </Field>
        </div>
    )
}

// ─── Approval Node Fields ─────────────────────────────────────────────────────

function ApprovalFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    return (
        <div className="space-y-4">
            <Field label="Approver Role">
                <Select value={d.approver_role ?? 'admin'} onChange={(v) => up({ approver_role: v })}>
                    <option value="admin">Admin</option>
                    <option value="builder">Builder</option>
                    <option value="custom">Custom…</option>
                </Select>
            </Field>
            <Field label="Context Template (Jinja2)" hint="What the approver sees when reviewing">
                <PromptEditor value={d.context_template ?? ''} onChange={(v) => up({ context_template: v })} />
            </Field>
            <Field label="Timeout (minutes)">
                <NumberInput value={d.timeout_minutes ?? 60} onChange={(v) => up({ timeout_minutes: v })} min={1} />
            </Field>
            <Field label="On Timeout">
                <Select value={d.timeout_action ?? 'reject'} onChange={(v) => up({ timeout_action: v })}>
                    <option value="approve">Auto-approve</option>
                    <option value="reject">Auto-reject</option>
                    <option value="escalate">Escalate</option>
                </Select>
            </Field>
            {d.timeout_action === 'escalate' && (
                <Field label="Escalation Path (role)">
                    <TextInput value={d.escalation_path ?? ''} onChange={(v) => up({ escalation_path: v })} placeholder="admin" />
                </Field>
            )}
        </div>
    )
}

// ─── Sub-Blueprint Node Fields ─────────────────────────────────────────────────

function SubBlueprintFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)

    const { data: blueprints = [] } = useQuery<{ id: string; name: string; version: string }[]>({
        queryKey: ['blueprints', 'sub_blueprint'],
        queryFn: () => fetch('/api/v1/blueprints?type=sub_blueprint&status=published').then((r) => r.json()),
    })

    return (
        <div className="space-y-4">
            <Field label="Blueprint">
                <Select value={d.blueprint_id ?? ''} onChange={(v) => up({ blueprint_id: v })}>
                    <option value="">— Select blueprint —</option>
                    {blueprints.map((b) => <option key={b.id} value={b.id}>{b.name} (v{b.version})</option>)}
                </Select>
            </Field>

            <Field label="Version">
                <Select value={d.version ?? 'latest'} onChange={(v) => up({ version: v })}>
                    <option value="latest">Always Latest ⚠</option>
                    {blueprints.filter((b) => b.id === d.blueprint_id).map((b) => (
                        <option key={b.version} value={b.version}>v{b.version} (pinned)</option>
                    ))}
                </Select>
            </Field>

            {d.version === 'latest' && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠ "Always latest" may break determinism. Pin to a specific version for production.
                </p>
            )}

            {d.blueprint_id && (
                <a
                    href={`/blueprints/${d.blueprint_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                    <ExternalLink className="h-3.5 w-3.5" /> Open blueprint in new tab
                </a>
            )}
        </div>
    )
}

// ─── Parallel Fork Fields ─────────────────────────────────────────────────────

function ParallelForkFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    const branches: BranchEntry[] = d.branches ?? []

    const addBranch = () => up({ branches: [...branches, { id: uid(), name: `Branch ${branches.length + 1}`, node_ids: [] }] })
    const removeBranch = (id: string) => up({ branches: branches.filter((b) => b.id !== id) })
    const updateBranch = (id: string, name: string) =>
        up({ branches: branches.map((b) => (b.id === id ? { ...b, name } : b)) })

    return (
        <div className="space-y-4">
            <Field label="Branches">
                <div className="space-y-2">
                    {branches.map((br) => (
                        <div key={br.id} className="flex items-center gap-2">
                            <input
                                value={br.name}
                                onChange={(e) => updateBranch(br.id, e.target.value)}
                                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                            />
                            <button onClick={() => removeBranch(br.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                    <button onClick={addBranch} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Plus className="h-3.5 w-3.5" /> Add branch
                    </button>
                </div>
            </Field>

            <Field label="Merge Strategy">
                <Select value={d.merge_strategy ?? 'union'} onChange={(v) => up({ merge_strategy: v })}>
                    <option value="union">Union (merge all, last-write wins)</option>
                    <option value="first_wins">First wins</option>
                    <option value="custom_expression">Custom expression</option>
                </Select>
            </Field>

            {d.merge_strategy === 'custom_expression' && (
                <Field label="Merge Expression (Jinja2)">
                    <TextInput value={d.merge_expression ?? ''} onChange={(v) => up({ merge_expression: v })} placeholder="Reduces branch_results[] to one value" />
                </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
                <Field label="Max Parallelism">
                    <NumberInput value={d.max_parallelism ?? 0} onChange={(v) => up({ max_parallelism: v })} min={0} />
                </Field>
                <Field label="Timeout (min)">
                    <NumberInput value={d.timeout_minutes ?? 30} onChange={(v) => up({ timeout_minutes: v })} min={1} />
                </Field>
            </div>

            <Field label="On Branch Failure">
                <Select value={d.on_branch_failure ?? 'continue_others'} onChange={(v) => up({ on_branch_failure: v })}>
                    <option value="continue_others">Continue other branches</option>
                    <option value="cancel_all">Cancel all branches</option>
                </Select>
            </Field>
        </div>
    )
}

// ─── Loop Node Fields ─────────────────────────────────────────────────────────

function LoopFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    return (
        <div className="space-y-4">
            <Field label="Iterate Over (Jinja2 expression)" hint="Must evaluate to an array">
                <TextInput value={d.iterate_over ?? ''} onChange={(v) => up({ iterate_over: v })} placeholder="{{ state.items }}" mono />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Item Variable">
                    <TextInput value={d.item_variable_name ?? 'item'} onChange={(v) => up({ item_variable_name: v })} mono />
                </Field>
                <Field label="Output Variable">
                    <TextInput value={d.output_variable_name ?? 'results'} onChange={(v) => up({ output_variable_name: v })} mono />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Parallelism" hint="1 = sequential">
                    <NumberInput value={d.parallelism ?? 1} onChange={(v) => up({ parallelism: v })} min={1} max={50} />
                </Field>
                <Field label="Max Iterations">
                    <NumberInput value={d.max_iterations ?? 100} onChange={(v) => up({ max_iterations: Math.min(v, 1000) })} min={1} max={1000} />
                </Field>
            </div>
        </div>
    )
}

// ─── LLM Judge Fields ─────────────────────────────────────────────────────────

function LLMJudgeFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    return (
        <div className="space-y-4">
            <Field label="Target Field" hint="State field containing the output to evaluate">
                <TextInput value={d.target_field ?? ''} onChange={(v) => up({ target_field: v })} placeholder="state.summary" mono />
            </Field>
            <Field label="Rubric" hint="Plain-language evaluation instructions for the judge LLM">
                <Textarea value={d.rubric ?? ''} onChange={(v) => up({ rubric: v })} rows={4} placeholder="Evaluate whether the output is accurate, complete, and professional..." />
            </Field>
            <Field label="Judge Model">
                <Select value={d.judge_model ?? 'gpt-4o'} onChange={(v) => up({ judge_model: v })}>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                </Select>
            </Field>
            <Field label={`Score Threshold: ${d.score_threshold ?? 0.7}`}>
                <Slider value={d.score_threshold ?? 0.7} onChange={(v) => up({ score_threshold: v })} min={0} max={1} step={0.05} />
            </Field>
            <Field label="Max Attempts">
                <NumberInput value={d.max_attempts ?? 3} onChange={(v) => up({ max_attempts: v })} min={1} max={10} />
            </Field>
            {(d.max_attempts ?? 3) >= 3 && (
                <p className="text-[11px] text-muted-foreground">When max attempts are exhausted with score below threshold, the fail edge is taken with <code>is_final: true</code>.</p>
            )}
        </div>
    )
}

// ─── Memory Node Fields ───────────────────────────────────────────────────────

function MemoryReadFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    return (
        <div className="space-y-4">
            <Field label="Backend">
                <Select value={d.backend ?? 'redis'} onChange={(v) => up({ backend: v })}>
                    <option value="redis">Redis</option>
                    <option value="postgres">PostgreSQL</option>
                </Select>
            </Field>
            <Field label="Key (Jinja2)" hint="Can be dynamic: {{ state.user_id }}">
                <TextInput value={d.key ?? ''} onChange={(v) => up({ key: v })} placeholder="{{ state.user_id }}" mono />
            </Field>
            <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠ Returns null when key is missing. Ensure downstream nodes handle null gracefully.</p>
        </div>
    )
}

function MemoryWriteFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    return (
        <div className="space-y-4">
            <Field label="Backend">
                <Select value={d.backend ?? 'redis'} onChange={(v) => up({ backend: v })}>
                    <option value="redis">Redis</option>
                    <option value="postgres">PostgreSQL</option>
                </Select>
            </Field>
            <Field label="Key (Jinja2)">
                <TextInput value={d.key ?? ''} onChange={(v) => up({ key: v })} placeholder="{{ state.user_id }}" mono />
            </Field>
            <Field label="TTL (seconds)" hint="0 = no expiry">
                <NumberInput value={d.ttl ?? 0} onChange={(v) => up({ ttl: v })} min={0} />
            </Field>
        </div>
    )
}

// ─── Code Node Fields ─────────────────────────────────────────────────────────

function CodeFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)
    return (
        <div className="space-y-4">
            <Field label="Python Code" hint="Runs in RestrictedPython sandbox. No file I/O or network.">
                <div className="rounded-md overflow-hidden border border-border">
                    <Editor
                        height="220px"
                        language="python"
                        value={d.code ?? '# state is available as input\n# return a dict to update state\ndef execute(state):\n    return state'}
                        onChange={(v) => up({ code: v ?? '' })}
                        theme="vs-dark"
                        options={{ minimap: { enabled: false }, fontSize: 12, padding: { top: 8 } }}
                    />
                </div>
            </Field>
            <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Allowed imports</p>
                <p className="text-[10px] font-mono text-muted-foreground">json, math, datetime, re, itertools, functools</p>
            </div>
        </div>
    )
}

// ─── Supervisor Node Fields ───────────────────────────────────────────────────

function SupervisorFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
    const d = node.data
    const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)

    return (
        <div className="space-y-4">
            <Field label="System Routing Prompt" hint="Instructions for the Supervisor LLM to route tasks.">
                <PromptEditor
                    language="markdown"
                    value={d.system_prompt ?? 'You are a supervisor agent. Route tasks to the appropriate worker. Return {"next": "worker_name"} or {"next": "FINISH"}.'}
                    onChange={(v) => up({ system_prompt: v })}
                />
            </Field>

            <Field label="Worker Nodes / Tools" hint="Comma-separated list of Sub-Blueprints or Agent nodes this supervisor can delegate to.">
                <TextInput
                    value={d.worker_nodes ?? ''}
                    onChange={(v) => up({ worker_nodes: v })}
                    placeholder="e.g. ResearchAgent, WriterAgent"
                />
            </Field>

            <div className="rounded-md border border-border bg-muted/30 p-3 mt-4">
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-primary" /> Swarm Mechanics
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                    The supervisor invokes its LLM and outputs a <code>{`{ "next": "<worker>" }`}</code> JSON schema.
                    Execution loops dynamically until the supervisor outputs <code>FINISH</code>.
                </p>
            </div>
        </div>
    )
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="my-4 flex items-center gap-2">
            <div className="flex-1 border-t border-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
            <div className="flex-1 border-t border-border" />
        </div>
    )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function NodeConfigPanel() {
    const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
    const nodes = useCanvasStore((s) => s.nodes)
    const updateNodeData = useCanvasStore((s) => s.updateNodeData)
    const selectNode = useCanvasStore((s) => s.selectNode)
    const canvasMode = useCanvasStore((s) => s.canvasMode)

    const selectedNode = useMemo(
        () => nodes.find((n) => n.id === selectedNodeId),
        [nodes, selectedNodeId]
    )

    // Don't show config panel in execute mode
    if (canvasMode === 'execute') return null

    // ─── Trigger Node Fields ────────────────────────────────────────────────────────
    function TriggerFields({ node, updateNodeData }: { node: any; updateNodeData: (id: string, d: Record<string, unknown>) => void }) {
        const d = node.data
        const up = (data: Record<string, unknown>) => updateNodeData(node.id, data)

        return (
            <div className="space-y-4">
                <Field label="Trigger Type">
                    <Select value={d.trigger_type ?? 'manual'} onChange={(v) => up({ trigger_type: v })}>
                        <option value="manual">Manual / API</option>
                        <option value="webhook">Webhook</option>
                        <option value="schedule">Schedule (Cron)</option>
                    </Select>
                </Field>

                {d.trigger_type === 'webhook' && (
                    <>
                        <Field label="Webhook Secret" hint="Optional. If set, callers must provide this in the X-Webhook-Secret header.">
                            <TextInput
                                value={d.webhook_secret ?? ''}
                                onChange={(v) => up({ webhook_secret: v })}
                                placeholder="Leave blank for public webhook"
                            />
                        </Field>
                        <div className="rounded-md border border-border bg-muted/30 p-2">
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Webhook URL</p>
                            <p className="text-[10px] font-mono text-foreground break-all">
                                POST /api/v1/webhooks/&lt;trigger_id_generated_on_publish&gt;
                            </p>
                        </div>
                    </>
                )}

                {d.trigger_type === 'schedule' && (
                    <Field label="Cron Expression" hint="Standard cron format: * * * * * (min hour dom mon dow)">
                        <TextInput
                            value={d.cron_expression ?? '0 0 * * *'}
                            onChange={(v) => up({ cron_expression: v })}
                            placeholder="0 0 * * *"
                            mono
                        />
                    </Field>
                )}
            </div>
        )
    }

    const renderTypeFields = (node: any) => {
        const props = { node, updateNodeData }
        switch (node.type) {
            case 'trigger': return <TriggerFields {...props} />
            case 'llm': return <LLMFields {...props} />
            case 'tool': return <ToolFields {...props} />
            case 'condition': return <ConditionFields {...props} />
            case 'router': return <RouterFields {...props} />
            case 'approval': return <ApprovalFields {...props} />
            case 'sub_blueprint': return <SubBlueprintFields {...props} />
            case 'parallel_fork': return <ParallelForkFields {...props} />
            case 'loop': return <LoopFields {...props} />
            case 'llm_judge': return <LLMJudgeFields {...props} />
            case 'memory_read': return <MemoryReadFields {...props} />
            case 'memory_write': return <MemoryWriteFields {...props} />
            case 'code': return <CodeFields {...props} />
            case 'supervisor': return <SupervisorFields {...props} />
            default: return null
        }
    }

    return (
        <AnimatePresence>
            {selectedNode && (
                <motion.aside
                    initial={{ x: 320, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 320, opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                    className="absolute bottom-4 right-4 top-4 z-10 flex w-80 flex-col rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-md"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                                {selectedNode.type}
                            </div>
                            <h3 className="text-sm font-semibold text-foreground">Configure</h3>
                        </div>
                        <button
                            onClick={() => selectNode(null)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Close panel"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <CommonFields node={selectedNode} updateNodeData={updateNodeData} />

                        {renderTypeFields(selectedNode) && (
                            <>
                                <SectionDivider label={`${selectedNode.type} Settings`} />
                                {renderTypeFields(selectedNode)}
                            </>
                        )}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    )
}
