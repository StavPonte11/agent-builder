import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
    prefix: '',
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
        extend: {
            colors: {
                // ----------------------------------------------------------------
                // Design system — all map to CSS variables defined in index.css
                // ----------------------------------------------------------------
                background: 'hsl(var(--background))',
                surface: 'hsl(var(--surface))',
                card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
                border: 'hsl(var(--border))',
                'border-strong': 'hsl(var(--border-strong))',

                // Accent colors
                primary: {
                    DEFAULT: 'hsl(var(--accent-primary))',
                    foreground: 'hsl(var(--accent-primary-foreground))',
                },
                success: 'hsl(var(--accent-success))',
                warning: 'hsl(var(--accent-warning))',
                danger: 'hsl(var(--accent-danger))',
                purple: 'hsl(var(--accent-purple))',
                cyan: 'hsl(var(--accent-cyan))',
                orange: 'hsl(var(--accent-orange))',

                // Text
                foreground: 'hsl(var(--text-primary))',
                muted: {
                    DEFAULT: 'hsl(var(--text-secondary))',
                    foreground: 'hsl(var(--text-dim))',
                },

                // shadcn/ui compatibility aliases
                input: 'hsl(var(--border))',
                ring: 'hsl(var(--accent-primary))',
                destructive: {
                    DEFAULT: 'hsl(var(--accent-danger))',
                    foreground: '#ffffff',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--surface))',
                    foreground: 'hsl(var(--text-primary))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--border-strong))',
                    foreground: 'hsl(var(--text-primary))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--text-primary))',
                },

                // Node type colors
                'node-llm': 'hsl(var(--node-llm))',
                'node-tool': 'hsl(var(--node-tool))',
                'node-condition': 'hsl(var(--node-condition))',
                'node-memory': 'hsl(var(--node-memory))',
                'node-approval': 'hsl(var(--node-approval))',
                'node-trigger': 'hsl(var(--node-trigger))',
                'node-output': 'hsl(var(--node-output))',
            },

            fontFamily: {
                display: ['"DM Serif Display"', 'serif'],
                heading: ['"Bricolage Grotesque Variable"', 'sans-serif'],
                sans: ['"Geist Variable"', 'system-ui', 'sans-serif'],
                mono: ['"DM Mono"', 'monospace'],
            },

            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },

            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' },
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' },
                },
                'glow-pulse': {
                    '0%, 100%': { opacity: '1', boxShadow: '0 0 8px 2px var(--glow-color)' },
                    '50%': { opacity: '0.6', boxShadow: '0 0 20px 6px var(--glow-color)' },
                },
                'node-running': {
                    '0%, 100%': { boxShadow: '0 0 0 2px var(--glow-color)' },
                    '50%': { boxShadow: '0 0 0 6px var(--glow-color), 0 0 20px var(--glow-color)' },
                },
                'slide-in-top': {
                    from: { transform: 'translateY(-16px)', opacity: '0' },
                    to: { transform: 'translateY(0)', opacity: '1' },
                },
                'slide-in-right': {
                    from: { transform: 'translateX(16px)', opacity: '0' },
                    to: { transform: 'translateX(0)', opacity: '1' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                'flow-edge': {
                    to: { strokeDashoffset: '-20' },
                },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                'node-running': 'node-running 1.5s ease-in-out infinite',
                'slide-in-top': 'slide-in-top 0.15s ease-out',
                'slide-in-right': 'slide-in-right 0.15s ease-out',
                'fade-in': 'fade-in 0.15s ease-out',
                'flow-edge': 'flow-edge 1s linear infinite',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
}

export default config
