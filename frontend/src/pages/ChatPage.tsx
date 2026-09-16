import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, Plus, Trash2, Send, Loader2, FileText, Bot, User, X } from 'lucide-react'
import { chatApi, papersApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'
import type { Paper } from '@/types'
import { cn } from '@/lib/utils'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  created_at: string
}

interface Citation {
  paper_title: string
  page_number?: number
  relevance_score: number
  content: string
}

interface Session {
  id: string
  title: string
  paper_ids: number[] | null
  created_at: string
  message_count?: number
}

export function ChatPage() {
  const qc = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [selectedPapers, setSelectedPapers] = useState<number[]>([])
  const [messages, setMessages] = useState<Message[]>([])

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: async () => (await chatApi.listSessions()).data,
  })
  const sessions: Session[] = Array.isArray(sessionsData)
    ? sessionsData
    : sessionsData?.sessions || []

  const { data: papersData } = useQuery({
    queryKey: ['papers'],
    queryFn: async () => (await papersApi.list()).data,
  })
  const readyPapers: Paper[] = (papersData?.papers || []).filter((p: Paper) => p.status === 'ready')

  const { data: sessionData, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-session', activeSession],
    queryFn: async () => (await chatApi.getSession(activeSession!)).data,
    enabled: !!activeSession,
  })

  useEffect(() => {
    if (sessionData?.messages) {
      setMessages(sessionData.messages)
    }
  }, [sessionData])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createSession = async () => {
    try {
      const res = await chatApi.createSession({
        paper_ids: selectedPapers.length > 0 ? selectedPapers : undefined,
      })
      const newSession = res.data
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      setActiveSession(newSession.id)
      setMessages([])
      setShowNewSession(false)
      setSelectedPapers([])
    } catch {
      toast.error('Failed to create session')
    }
  }

  const deleteSession = useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      if (activeSession === id) {
        setActiveSession(null)
        setMessages([])
      }
    },
  })

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !activeSession || sending) return

    const question = input.trim()
    setInput('')
    setSending(true)

    const tempUser: Message = {
      id: Date.now(),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUser])

    try {
      const res = await chatApi.ask({ session_id: activeSession, question })
      const data = res.data

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      qc.invalidateQueries({ queryKey: ['chat-session', activeSession] })
    } catch {
      toast.error('Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== tempUser.id))
    } finally {
      setSending(false)
    }
  }

  const togglePaper = (id: number) =>
    setSelectedPapers((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={() => { setShowNewSession(true); setActiveSession(null); setMessages([]) }}
          >
            <Plus size={14} /> New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted/40 animate-pulse rounded-md" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No chats yet. Start a new one.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => { setActiveSession(s.id); setShowNewSession(false) }}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer text-sm transition-colors',
                  activeSession === s.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <MessageSquare size={13} className="shrink-0" />
                <span className="flex-1 truncate text-xs">{s.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession.mutate(s.id) }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {showNewSession ? (
          <div className="flex-1 flex items-start justify-center p-8">
            <div className="w-full max-w-md">
              <div className="mb-6">
                <h2 className="text-base font-semibold">New Chat</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Optionally scope to specific papers</p>
              </div>

              {readyPapers.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Papers (optional)</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {readyPapers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => togglePaper(p.id)}
                        className={cn(
                          'w-full text-left flex items-center gap-2.5 rounded-md border px-3 py-2 text-xs transition-colors',
                          selectedPapers.includes(p.id)
                            ? 'border-foreground/40 bg-accent text-foreground'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
                        )}
                      >
                        <FileText size={12} className="shrink-0" />
                        <span className="truncate flex-1">{p.title}</span>
                        {selectedPapers.includes(p.id) && (
                          <X size={11} className="shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedPapers.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">{selectedPapers.length} paper{selectedPapers.length !== 1 ? 's' : ''} selected</p>
                  )}
                </div>
              )}

              <Button onClick={createSession} className="w-full gap-2">
                <MessageSquare size={14} />
                {selectedPapers.length > 0 ? 'Start Chat with Selected Papers' : 'Start Chat (All Papers)'}
              </Button>
            </div>
          </div>
        ) : activeSession ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center mb-3">
                    <Bot size={18} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Ask anything about your papers</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}>
                    <div className={cn(
                      'w-7 h-7 rounded-full border flex items-center justify-center shrink-0',
                      msg.role === 'user' ? 'border-foreground/20 bg-foreground/5' : 'border-border bg-card'
                    )}>
                      {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </div>
                    <div className={cn('flex-1 min-w-0', msg.role === 'user' && 'flex flex-col items-end')}>
                      <div className={cn(
                        'rounded-lg px-4 py-3 text-sm max-w-[80%]',
                        msg.role === 'user'
                          ? 'bg-foreground text-background'
                          : 'bg-card border border-border'
                      )}>
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown className="prose prose-invert prose-sm max-w-none dark:prose-invert">
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>

                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 max-w-[80%] space-y-1.5">
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sources</p>
                          {msg.citations.map((c, i) => (
                            <div key={i} className="rounded-md border border-border p-2.5 bg-muted/20">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-medium text-foreground truncate flex-1">{c.paper_title}</span>
                                {c.page_number && (
                                  <Badge variant="outline" className="text-[10px] h-4 shrink-0">p.{c.page_number}</Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {(c.relevance_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{c.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center shrink-0">
                    <Bot size={13} />
                  </div>
                  <div className="bg-card border border-border rounded-lg px-4 py-3">
                    <Loader2 size={14} className="animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4">
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Ask about your papers..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={sending}
                />
                <Button type="submit" disabled={!input.trim() || sending} size="icon">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center mb-4">
              <MessageSquare size={20} className="text-muted-foreground" />
            </div>
            <h2 className="text-sm font-medium mb-1">Select or start a chat</h2>
            <p className="text-xs text-muted-foreground mb-4">Chat with your papers using AI</p>
            <Button size="sm" onClick={() => setShowNewSession(true)} className="gap-1.5">
              <Plus size={14} /> New Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
