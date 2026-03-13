import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'


import { queryClient } from '@/lib/query-client'
import i18n from '@/i18n'
import App from './App'
import { ErrorBoundary } from '@/components/layout/error-boundary'
import { ThemeProvider } from '@/components/theme-provider'
import './index.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
    throw new Error('Failed to find root element')
}

createRoot(rootElement).render(
    <StrictMode>
        <ErrorBoundary>
            <I18nextProvider i18n={i18n}>
                <QueryClientProvider client={queryClient}>
                    <BrowserRouter>
                        <ThemeProvider defaultTheme="dark" storageKey="agent-builder-theme">
                            <App />
                        </ThemeProvider>
                    </BrowserRouter>
                </QueryClientProvider>
            </I18nextProvider>
        </ErrorBoundary>
    </StrictMode>,
)
