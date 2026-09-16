import { useQuery } from '@tanstack/react-query'
import { FileText, Database, MessageSquare, Clock } from 'lucide-react'
import { papersApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { DashboardStats } from '@/types'

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="border border-border rounded-lg p-5 bg-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value.toLocaleString()}</p>
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: async () => (await papersApi.dashboard()).data,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-7 w-32 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-52 bg-muted animate-pulse rounded mb-8" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    )
  }

  const stats = data!
  return (
    <div className="p-8">
      <div className="mb-7">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your research workspace</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={FileText} label="Papers" value={stats.total_papers} />
        <StatCard icon={Database} label="Embeddings" value={stats.total_chunks} />
        <StatCard icon={MessageSquare} label="Queries" value={stats.total_queries} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg bg-card p-5">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Paper Status</h2>
          {Object.entries(stats.papers_by_status).length === 0 ? (
            <p className="text-sm text-muted-foreground">No papers yet.</p>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.papers_by_status).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{status}</span>
                  <Badge variant={status === 'ready' ? 'success' : status === 'processing' ? 'warning' : 'destructive'}>
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border rounded-lg bg-card p-5">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Recent Queries</h2>
          {stats.recent_queries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No queries yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recent_queries.slice(0, 6).map((q) => (
                <div key={q.id} className="flex items-start gap-3">
                  <Clock size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{q.query}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(q.created_at)} · {q.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
