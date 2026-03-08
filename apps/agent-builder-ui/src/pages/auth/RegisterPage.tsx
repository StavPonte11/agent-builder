import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function RegisterPage() {
    const navigate = useNavigate()
    const setTokens = useAuthStore((s) => s.setTokens)
    const setUser = useAuthStore((s) => s.setUser)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const orgName = form.get('org_name') as string
        const email = form.get('email') as string
        const password = form.get('password') as string

        const baseUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? ''
        const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ org_name: orgName, email, password }),
        })
        if (!res.ok) return
        const data = await res.json()
        setTokens(data.access_token, data.refresh_token)
        setUser(data.user)
        navigate('/dashboard')
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
                <h1 className="mb-2 text-2xl font-bold text-foreground">Create your account</h1>
                <p className="mb-6 text-sm text-muted-foreground">Start building AI agents today.</p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Organization name</label>
                        <input
                            name="org_name"
                            required
                            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Acme Corp"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                        <input
                            name="email"
                            type="email"
                            required
                            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="you@company.com"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Password</label>
                        <input
                            name="password"
                            type="password"
                            required
                            minLength={8}
                            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        className="mt-2 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
                    >
                        Create account
                    </button>
                </form>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                    Already have an account?{' '}
                    <a href="/login" className="text-primary hover:underline">Sign in</a>
                </p>
            </div>
        </div>
    )
}
