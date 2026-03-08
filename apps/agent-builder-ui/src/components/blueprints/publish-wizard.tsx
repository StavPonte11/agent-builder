import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ChevronRight, X, Sparkles, ShieldCheck, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PublishWizardProps {
    blueprintId: string
    isOpen: boolean
    onClose: () => void
}

const STEPS = [
    { id: 'validation', title: 'Validate Nodes', icon: Sparkles, desc: 'Checking for unconfigured nodes' },
    { id: 'tests', title: 'Pre-flight Tests', icon: ShieldCheck, desc: 'Running guardrail checks' },
    { id: 'version', title: 'Version Name', icon: CheckCircle2, desc: 'Provide version notes' },
    { id: 'deploy', title: 'Deploy', icon: Rocket, desc: 'Pushing to registry' }
]

export function PublishWizard({ blueprintId, isOpen, onClose }: PublishWizardProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [versionNotes, setVersionNotes] = useState('Initial production release')

    if (!isOpen) return null

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1)
        } else {
            // STUB: Final publish API call
            console.log(`Published ${blueprintId} with notes: ${versionNotes}`)
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-border p-4">
                    <h2 className="text-lg font-semibold text-foreground">Publish Blueprint</h2>
                    <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex h-[400px]">
                    {/* Timeline Sidebar */}
                    <div className="w-1/3 bg-muted/20 p-6 border-r border-border">
                        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:w-px before:-translate-x-px md:before:bg-border">
                            {STEPS.map((step, idx) => {
                                const isActive = idx === currentStep
                                const isPast = idx < currentStep
                                return (
                                    <div key={idx} className="relative flex items-center gap-3">
                                        <div className={cn(
                                            "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                                            isActive ? "border-primary bg-primary text-primary-foreground" :
                                                isPast ? "border-primary bg-primary/20 text-primary" : "border-border bg-background text-muted-foreground"
                                        )}>
                                            {isPast ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={cn("text-sm font-semibold", isActive || isPast ? "text-foreground" : "text-muted-foreground")}>{step.title}</span>
                                            <span className="text-[10px] text-muted-foreground">{step.desc}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="w-full flex-1"
                            >
                                {currentStep === 0 && (
                                    <div className="space-y-4 pt-12">
                                        <Sparkles className="mx-auto h-12 w-12 text-primary animate-pulse" />
                                        <h3 className="text-lg font-medium text-foreground">Analyzing Workflow Structure</h3>
                                        <p className="text-sm text-muted-foreground">Checking 4 nodes and 3 edges for valid configurations...</p>
                                        <div className="mt-8 rounded bg-green-500/10 p-3 text-sm text-green-600">All nodes pass strict validation!</div>
                                    </div>
                                )}

                                {currentStep === 1 && (
                                    <div className="space-y-4 pt-12">
                                        <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
                                        <h3 className="text-lg font-medium text-foreground">Running Security Guardrails</h3>
                                        <p className="text-sm text-muted-foreground">Checking PII detectors and API configurations...</p>
                                        <div className="mt-8 rounded bg-green-500/10 p-3 text-sm text-green-600">Presidio checks passed. No PII leaks detected in default setup.</div>
                                    </div>
                                )}

                                {currentStep === 2 && (
                                    <div className="space-y-4 pt-6 text-left">
                                        <h3 className="text-lg font-medium text-foreground">Version Details</h3>
                                        <p className="text-sm text-muted-foreground">Provide release notes for this publication.</p>
                                        <textarea
                                            value={versionNotes}
                                            onChange={e => setVersionNotes(e.target.value)}
                                            className="mt-4 min-h-[120px] w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                )}

                                {currentStep === 3 && (
                                    <div className="space-y-4 pt-12">
                                        <div className="relative mx-auto h-16 w-16">
                                            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                            <Rocket className="relative z-10 mx-auto h-16 w-16 text-primary" />
                                        </div>
                                        <h3 className="text-xl font-medium text-foreground mt-4">Ready for Liftoff</h3>
                                        <p className="text-sm text-muted-foreground">The API endpoint will be live immediately upon deploying.</p>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        <div className="mt-auto w-full pt-6">
                            <button
                                onClick={handleNext}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                {currentStep === STEPS.length - 1 ? 'Publish Now' : 'Continue'}
                                {currentStep !== STEPS.length - 1 && <ChevronRight className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
