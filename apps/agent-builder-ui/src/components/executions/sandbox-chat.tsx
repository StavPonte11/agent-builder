import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ChatMessage {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
}

export function SandboxChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { id: '1', role: 'system', content: 'Sandbox initialized. This chat is connected to TestRun-9X4A. Send a message to invoke the blueprint trigger.', timestamp: new Date().toISOString() }
    ])
    const [input, setInput] = useState('')
    const [isTyping, setIsTyping] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (!input.trim()) return

        const newMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toISOString()
        }
        setMessages(prev => [...prev, newMsg])
        setInput('')
        setIsTyping(true)

        // STUB: Connect to execution mutation / webhooks
        setTimeout(() => {
            setIsTyping(false)
            setMessages(prev => [
                ...prev,
                { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Echo from Blueprint: ' + newMsg.content, timestamp: new Date().toISOString() }
            ])
        }, 1500)
    }

    return (
        <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Sandbox Chat</h3>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase">Active Session</span>
                </div>
                <button
                    onClick={() => setMessages([{ id: '1', role: 'system', content: 'Sandbox reset.', timestamp: new Date().toISOString() }])}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Reset session"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={msg.id}
                        className={cn(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                            msg.role === 'user' ? "bg-primary text-primary-foreground ml-auto rounded-tr-sm" :
                                msg.role === 'system' ? "bg-muted text-muted-foreground mx-auto text-xs flex justify-center max-w-full italic" :
                                    "bg-muted/50 border border-border text-foreground mr-auto rounded-tl-sm"
                        )}
                    >
                        {msg.role === 'assistant' && <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Agent</div>}
                        {msg.role === 'user' && <div className="text-[10px] uppercase font-bold text-primary-foreground/70 mb-1 flex items-center justify-end">You <User className="h-3 w-3 ml-1" /></div>}
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </motion.div>
                ))}
                {isTyping && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[85%] rounded-2xl bg-muted/50 border border-border px-4 py-3 mr-auto rounded-tl-sm w-16">
                        <div className="flex justify-center gap-1">
                            <div className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </motion.div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 bg-muted/10">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend() }}
                    className="relative flex items-center"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Send a test message..."
                        className="w-full rounded-full border border-border bg-background py-2.5 pl-4 pr-12 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                        disabled={isTyping}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isTyping}
                        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 disabled:bg-muted disabled:text-muted-foreground disabled:hover:scale-100"
                    >
                        <Send className="h-3.5 w-3.5" />
                    </button>
                </form>
            </div>
        </div>
    )
}
