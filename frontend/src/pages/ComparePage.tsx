import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { GitCompare, Loader2 } from 'lucide-react'
import { papersApi, ragApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import ReactMarkdown from 'react-markdown'
import type { Paper, CompareResponse } from '@/types'

const sections = [
  { key: 'methodology', label: 'Methodology' },
  { key: 'datasets', label: 'Datasets' },
  { key: 'performance', label: 'Performance Metrics' },
  { key: 'conclusions', label: 'Conclusions' },
  { key: 'overall_comparison', label: 'Overall Comparison' },
] as const

export function ComparePage() {
  const [paper1, setPaper1] = useState<string>('')
  const [paper2, setPaper2] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResponse | null>(null)

  const { data } = useQuery({
    queryKey: ['papers'],
    queryFn: async () => (await papersApi.list()).data,
  })
  const papers: Paper[] = (data?.papers || []).filter((p: Paper) => p.status === 'ready')

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paper1 || !paper2) return toast.error('Select two papers')
    if (paper1 === paper2) return toast.error('Select two different papers')
    setLoading(true)
    setResult(null)
    try {
      const res = await ragApi.compare(Number(paper1), Number(paper2))
      setResult(res.data)
    } catch {
      toast.error('Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-xl font-semibold tracking-tight">Compare Papers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Compare two papers side by side with AI analysis</p>
      </div>

      <form onSubmit={handleCompare} className="border border-border rounded-lg bg-card p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label>Paper A</Label>
            <Select value={paper1} onChange={(e) => setPaper1(e.target.value)}>
              <option value="">Select paper...</option>
              {papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Paper B</Label>
            <Select value={paper2} onChange={(e) => setPaper2(e.target.value)}>
              <option value="">Select paper...</option>
              {papers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
        </div>
        <Button type="submit" disabled={loading || !paper1 || !paper2} className="gap-2">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <GitCompare size={14} />}
          Compare
        </Button>
      </form>

      {result && (
        <div className="space-y-3 animate-fade-in">
          {/* Header */}
          <div className="border border-border rounded-lg bg-card p-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium truncate flex-1">{result.paper_1_title}</span>
              <span className="text-muted-foreground text-xs shrink-0">vs</span>
              <span className="font-medium truncate flex-1 text-right">{result.paper_2_title}</span>
            </div>
          </div>

          {sections.map(({ key, label }) => {
            const content = result[key as keyof CompareResponse] as string
            return (
              <div key={key} className="border border-border rounded-lg bg-card p-5">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</h3>
                <ReactMarkdown className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                  {content || 'Not available in the provided context.'}
                </ReactMarkdown>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
