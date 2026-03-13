/**
 * SettingsPage — Full organization settings, user profile, API keys,
 * notification preferences, and theme/appearance controls.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
    User, Key, Bell, Palette, Shield, Building, Save, Eye, EyeOff,
    Check, AlertTriangle, Moon, Sun, Monitor, Globe, Mail, Slack,
    ChevronRight, Cpu, Zap
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
    id: string
    email: string
    full_name: string
    role: string
    created_at: string
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, desc, icon: Icon, children }: {
    title: string
    desc: string
    icon: React.ElementType
    children: React.ReactNode
}) {
    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/20">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
            </div>
            <div className="p-6">{children}</div>
        </div>
    )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="mb-4">
            <label className="block text-xs font-medium text-foreground mb-1.5">{label}</label>
            {children}
            {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${props.className || ''}`}
        />
    )
}

// ─── API Keys Section ─────────────────────────────────────────────────────────

function ApiKeysSection() {
    const [show, setShow] = useState<Record<string, boolean>>({})
    const [saved, setSaved] = useState<Record<string, boolean>>({})
    const [keys, setKeys] = useState<Record<string, string>>({
        GOOGLE_API_KEY: '',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
    })

    const handleSave = (keyName: string) => {
        setSaved(s => ({ ...s, [keyName]: true }))
        setTimeout(() => setSaved(s => ({ ...s, [keyName]: false })), 2000)
    }

    const keyDefs = [
        { key: 'GOOGLE_API_KEY', label: 'Google Gemini API Key', icon: Zap, color: 'text-blue-500', hint: 'Used for Gemini 2.0 Flash and 1.5 Pro. Get from console.cloud.google.com' },
        { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', icon: Cpu, color: 'text-green-500', hint: 'Used for GPT-4o and o1. Get from platform.openai.com' },
        { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', icon: Shield, color: 'text-purple-500', hint: 'Used for Claude 3.7 Sonnet. Get from console.anthropic.com' },
    ]

    return (
        <div className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                    API keys are stored in your <code className="font-mono bg-amber-500/10 px-1 rounded">.env</code> file on the server. Restart the backend after changing them.
                </p>
            </div>
            {keyDefs.map(({ key, label, icon: Icon, color, hint }) => (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                    <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type={show[key] ? 'text' : 'password'}
                                    placeholder={`Enter ${key}...`}
                                    value={keys[key]}
                                    onChange={e => setKeys(k => ({ ...k, [key]: e.target.value }))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 pr-8 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <button
                                    onClick={() => setShow(s => ({ ...s, [key]: !s[key] }))}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {show[key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            <button
                                onClick={() => handleSave(key)}
                                className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                {saved[key] ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                                {saved[key] ? 'Saved' : 'Save'}
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsSection() {
    const [prefs, setPrefs] = useState({
        execution_complete: true,
        execution_failed: true,
        approval_required: true,
        cost_threshold: false,
        weekly_digest: false,
    })

    const toggle = (key: keyof typeof prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }))

    const items = [
        { key: 'execution_complete' as const, label: 'Execution Complete', desc: 'Notify when a workflow finishes successfully', icon: Check },
        { key: 'execution_failed' as const, label: 'Execution Failed', desc: 'Alert when a workflow encounters errors', icon: AlertTriangle },
        { key: 'approval_required' as const, label: 'Approval Required', desc: 'Notify when a workflow is paused for human review', icon: User },
        { key: 'cost_threshold' as const, label: 'Cost Threshold Alerts', desc: 'Alert when daily LLM costs exceed $5.00', icon: Shield },
        { key: 'weekly_digest' as const, label: 'Weekly Digest', desc: 'Summary email of all workflow activity each Monday', icon: Mail },
    ]

    return (
        <div className="space-y-3">
            {items.map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3">
                    <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium text-foreground">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => toggle(key)}
                        className={`relative h-5 w-9 rounded-full transition-colors ${prefs[key] ? 'bg-primary' : 'bg-muted'}`}
                    >
                        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${prefs[key] ? 'translate-x-4' : ''}`} />
                    </button>
                </div>
            ))}
        </div>
    )
}

// ─── Appearance ───────────────────────────────────────────────────────────────

function AppearanceSection() {
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark')
    const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

    const themes = [
        { id: 'light' as const, label: 'Light', icon: Sun },
        { id: 'dark' as const, label: 'Dark', icon: Moon },
        { id: 'system' as const, label: 'System', icon: Monitor },
    ]

    return (
        <div className="space-y-4">
            <Field label="Color Theme">
                <div className="flex gap-2">
                    {themes.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTheme(id)}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors ${theme === id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                            <Icon className="h-4 w-4" />
                            {label}
                        </button>
                    ))}
                </div>
            </Field>
            <Field label="UI Density">
                <div className="flex gap-2">
                    {(['comfortable', 'compact'] as const).map(d => (
                        <button
                            key={d}
                            onClick={() => setDensity(d)}
                            className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${density === d ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}
                        >
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                    ))}
                </div>
            </Field>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'organization', label: 'Organization', icon: Building },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
    const [tab, setTab] = useState<TabId>('profile')

    const { data: user } = useQuery<UserProfile>({
        queryKey: ['me'],
        queryFn: () => fetch('/api/v1/users/me').then(r => r.json()),
    })

    const [profileForm, setProfileForm] = useState({ full_name: '', email: '' })
    const [saved, setSaved] = useState(false)

    const save = () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <h1 className="text-xl font-bold text-foreground">Settings</h1>
                    <p className="text-sm text-muted-foreground">Manage your account, integrations, and preferences</p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6 flex gap-6">
                {/* Sidebar Nav */}
                <aside className="w-48 shrink-0">
                    <nav className="space-y-0.5">
                        {TABS.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors text-left ${tab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                {label}
                                {tab === id && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Content */}
                <div className="flex-1 space-y-4">
                    {tab === 'profile' && (
                        <Section title="Profile" desc="Your personal account information" icon={User}>
                            <Field label="Full Name">
                                <Input
                                    value={profileForm.full_name || user?.full_name || ''}
                                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                                    placeholder="Jane Smith"
                                />
                            </Field>
                            <Field label="Email Address" hint="Used for login and notifications">
                                <Input
                                    type="email"
                                    value={profileForm.email || user?.email || ''}
                                    onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                                    placeholder="jane@example.com"
                                />
                            </Field>
                            <Field label="Role">
                                <Input value={user?.role || 'admin'} disabled />
                            </Field>
                            <Field label="Member Since">
                                <Input value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} disabled />
                            </Field>
                            <button
                                onClick={save}
                                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
                            >
                                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                {saved ? 'Saved!' : 'Save Changes'}
                            </button>
                        </Section>
                    )}

                    {tab === 'api-keys' && (
                        <Section title="API Keys" desc="LLM provider credentials for workflow execution" icon={Key}>
                            <ApiKeysSection />
                        </Section>
                    )}

                    {tab === 'notifications' && (
                        <Section title="Notifications" desc="Configure when and how you receive alerts" icon={Bell}>
                            <NotificationsSection />
                        </Section>
                    )}

                    {tab === 'appearance' && (
                        <Section title="Appearance" desc="Customize the look and feel of the interface" icon={Palette}>
                            <AppearanceSection />
                        </Section>
                    )}

                    {tab === 'organization' && (
                        <Section title="Organization" desc="Workspace and team configuration" icon={Building}>
                            <Field label="Organization Name">
                                <Input defaultValue="My Organization" />
                            </Field>
                            <Field label="Locale / Timezone">
                                <select className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                                    <option>UTC (Coordinated Universal Time)</option>
                                    <option>America/New_York (EST)</option>
                                    <option>Europe/London (GMT)</option>
                                    <option>Asia/Jerusalem (IST)</option>
                                </select>
                            </Field>
                            <Field label="Slack Webhook URL" hint="Receive execution alerts in your Slack workspace">
                                <Input placeholder="https://hooks.slack.com/services/..." type="url" />
                            </Field>
                            <button
                                onClick={save}
                                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
                            >
                                {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                {saved ? 'Saved!' : 'Save Changes'}
                            </button>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    )
}
