import { useState } from 'react'
import { toast } from 'sonner'
import { Search, Loader2, FileText } from 'lucide-react'
import { ragApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { SearchResponse, SearchResult } from '@/types'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [author, setAuthor] = useState('')
  const [year, setYear] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await ragApi.search({
        query,
        author: author || undefined,
        year: year ? parseInt(year) : undefined,
        top_k: 10,
      })
      setResults(res.data)
    } catch {
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-xl font-semibold tracking-tight">Semantic Search</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Search across your papers using natural language</p>
      </div>

      <form onSubmit={handleSearch} className="border border-border rounded-lg bg-card p-5 mb-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Query</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              className="pl-9"
              placeholder="e.g. attention mechanism in transformer models"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Author filter</Label>
            <Input placeholder="Author name" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Year filter</Label>
            <Input placeholder="e.g. 2023" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={loading || !query.trim()} className="gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Search
        </Button>
      </form>

      {results && (
        <div>
          <p className="text-xs text-muted-foreground mb-4">
            {results.total} result{results.total !== 1 ? 's' : ''}
          </p>
          {results.results.length === 0 ? (
            <div className="border border-border rounded-lg p-12 text-center bg-card">
              <p className="text-sm text-muted-foreground">No results. Try a broader query.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.results.map((r: SearchResult, i) => (
                <div key={i} className="border border-border rounded-lg bg-card p-4 animate-fade-in">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={13} className="text-muted-foreground" />
                        <span className="text-sm font-medium">{r.paper_title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {r.authors && <span>{r.authors}</span>}
                        {r.year && <span>{r.year}</span>}
                        {r.page_number && <span>p. {r.page_number}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {(r.relevance_score * 100).toFixed(0)}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{r.chunk_content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
