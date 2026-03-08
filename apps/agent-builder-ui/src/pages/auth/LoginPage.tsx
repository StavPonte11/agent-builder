import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Workflow, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const schema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { setTokens, setUser } = useAuthStore()
    const [showPassword, setShowPassword] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
    } = useForm<FormData>({ resolver: zodResolver(schema) })

    const loginMutation = useMutation({
        mutationFn: async (data: FormData) => {
            const { data: res, error } = await apiClient.POST('/api/v1/auth/login', { body: data })
            if (error) throw new Error((error as { detail?: string }).detail ?? 'Login failed')
            return res
        },
        onSuccess(data) {
            if (!data) return
            setTokens(data.access_token, data.refresh_token)
            setUser({
                id: data.user.id,
                email: data.user.email,
                role: data.user.role,
                org_id: data.user.org_id,
            })
            void navigate('/dashboard')
        },
        onError(err: Error) {
            setError('root', { message: err.message })
        },
    })

    return (
        <div className="min-h-screen bg-background flex">
            {/* Left panel — decorative */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface border-r border-border items-center justify-center p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/10 via-transparent to-accent-purple/10" />
                <div className="relative text-center">
                    <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                        <Workflow className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="font-display text-4xl text-foreground mb-3">Agent Builder</h1>
                    <p className="text-muted-foreground max-w-sm leading-relaxed">
                        Visually compose, test, publish, and monitor AI-powered workflows at enterprise scale.
                    </p>
                    <div className="mt-10 grid grid-cols-3 gap-4 text-center">
                        {[
                            { label: 'Node Types', value: '10' },
                            { label: 'Integrations', value: '∞' },
                            { label: 'Uptime', value: '99.9%' },
                        ].map(({ label, value }) => (
                            <div key={label} className="rounded-lg border border-border bg-card/50 p-3">
                                <div className="text-2xl font-heading font-semibold text-primary">{value}</div>
                                <div className="text-xs text-muted-foreground">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel — login form */}
            <div className="flex flex-1 items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-md"
                >
                    <div className="mb-8">
                        <h2 className="font-heading text-2xl font-semibold text-foreground">{t('auth.login')}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Don't have an account?{' '}
                            <a href="/register" className="text-primary hover:underline">
                                {t('auth.register')}
                            </a>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                {t('auth.email')}
                            </label>
                            <input
                                type="email"
                                autoComplete="email"
                                {...register('email')}
                                className={cn(
                                    'w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
                                    'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors',
                                    errors.email ? 'border-danger' : 'border-border',
                                )}
                                placeholder="you@company.com"
                            />
                            {errors.email && (
                                <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                {t('auth.password')}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    {...register('password')}
                                    className={cn(
                                        'w-full rounded-md border bg-surface px-3 py-2 pe-10 text-sm text-foreground placeholder:text-muted-foreground',
                                        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors',
                                        errors.password ? 'border-danger' : 'border-border',
                                    )}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((p) => !p)}
                                    className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Root error */}
                        {errors.root && (
                            <div className="rounded-md bg-danger/10 border border-danger/20 px-3 py-2 text-sm text-danger">
                                {errors.root.message}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loginMutation.isPending}
                            className={cn(
                                'w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white',
                                'hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50',
                                'transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                                loginMutation.isPending && 'animate-pulse',
                            )}
                        >
                            {loginMutation.isPending ? 'Signing in...' : t('auth.login')}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    )
}
