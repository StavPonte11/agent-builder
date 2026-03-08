import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MetricCard } from '@/components/ui/metric-card'
import { Activity } from 'lucide-react'
import '@testing-library/jest-dom'

describe('MetricCard', () => {
    it('renders the title and value correctly', () => {
        render(
            <MetricCard
                label="Total Executions"
                value="1,234"
                icon={Activity}
            />
        )

        expect(screen.getByText('Total Executions')).toBeInTheDocument()
        expect(screen.getByText('1,234')).toBeInTheDocument()
    })

    it('renders positive trend correctly', () => {
        render(
            <MetricCard
                label="Active Jobs"
                value="42"
                icon={Activity}
                trend={{ value: 12.5, label: "vs last week" }}
            />
        )

        const trendElement = screen.getByText('↑ 12.5% vs last week')
        expect(trendElement).toBeInTheDocument()
        expect(trendElement.className).toContain('text-green-400')
    })
})
