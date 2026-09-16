import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Trash2, MessageSquare, Loader2, Search, Plus } from 'lucide-react'
import { papersApi, ragApi } from '@/lib/api'
import { formatBytes, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'
import type { Paper } from '@/types'

export function PapersPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<any>(null)
  const [asking, setAsking] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['papers'],
    queryFn: async () => (await papersApi.list()).data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => papersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['papers'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Paper deleted')
      setSelectedId(null)
      setAnswer(null)
    },
  })

  const papers: Paper[] = data?.papers || []
  const filtered = papers.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.authors || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || !selectedId) return
    setAsking(true)
    setAnswer(null)
    try {
      const res = await ragApi.ask({ question, paper_ids: [selectedId] })
      setAnswer(res.data)
    } catch {
      toast.error('Failed to get answer')
    } finally {
      setAsking(false)
    }
  }

  const statusVariant = (s: string) =>
    s === 'ready' ? 'success' : s === 'processing' ? 'warning' : 'destructive'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Papers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{papers.length} paper{papers.length !== 1 ? 's' : ''} in your library</p>
        </div>
        <Button size="sm" onClick={() => navigate('/papers/upload')} className="gap-1.5">
          <Plus size={14} /> Upload
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
        <Input className="pl-9" placeholder="Search by title or author..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-card border border-border animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-border rounded-lg p-16 text-center bg-card">
          <FileText size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No papers found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/papers/upload')}>
            Upload your first paper
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((paper) => (
            <div key={paper.id} className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={statusVariant(paper.status)}>{paper.status}</Badge>
                    {paper.year && <span className="text-[11px] text-muted-foreground">{paper.year}</span>}
                  </div>
                  <h3 className="text-sm font-medium truncate">{paper.title}</h3>
                  {paper.authors && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{paper.authors}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span>{paper.page_count} pages</span>
                    <span>{paper.chunk_count} chunks</span>
                    <span>{formatBytes(paper.file_size)}</span>
                    <span>{formatDate(paper.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {paper.status === 'ready' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-xs"
                      onClick={() => {
                        setSelectedId(selectedId === paper.id ? null : paper.id)
                        setAnswer(null)
                      }}
                    >
                      <MessageSquare size={12} />
                      Ask
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => { if (confirm('Delete this paper?')) deleteMutation.mutate(paper.id) }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              {/* Inline QA panel */}
              {selectedId === paper.id && (
                <div className="border-t border-border p-4 bg-background/40">
                  <form onSubmit={handleAsk} className="flex gap-2 mb-4">
                    <Input
                      className="flex-1 h-8 text-xs"
                      placeholder="Ask anything about this paper..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={asking} className="h-8 gap-1.5">
                      {asking && <Loader2 size={12} className="animate-spin" />}
                      Ask
                    </Button>
                  </form>

                  {answer && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="rounded-md bg-card border border-border p-4">
                        <ReactMarkdown className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                          {answer.answer}
                        </ReactMarkdown>
                      </div>
                      {answer.citations?.length > 0 && (
                        <div>
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Sources</p>
                          <div className="space-y-1.5">
                            {answer.citations.map((c: any, i: number) => (
                              <div key={i} className="rounded-md border border-border p-3 bg-muted/30">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[11px] font-medium text-foreground">{c.paper_title}</span>
                                  {c.page_number && (
                                    <Badge variant="outline" className="text-[10px] h-4">p.{c.page_number}</Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground ml-auto">
                                    {(c.relevance_score * 100).toFixed(0)}% match
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-3">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
