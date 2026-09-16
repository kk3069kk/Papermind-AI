import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowRight, FileText, MessageSquare, GitCompare, Search, Sparkles, Shield } from 'lucide-react'

const features = [
  {
    icon: MessageSquare,
    title: 'Citation-aware answers',
    desc: 'Every response is grounded in your papers with exact page references.',
  },
  {
    icon: FileText,
    title: 'Structured summaries',
    desc: 'Contributions, methodology, results, and limitations — automatically.',
  },
  {
    icon: GitCompare,
    title: 'Paper comparison',
    desc: 'Compare two papers across methodology, datasets, and performance.',
  },
  {
    icon: Search,
    title: 'Semantic search',
    desc: 'Find relevant passages across your entire library with natural language.',
  },
  {
    icon: Sparkles,
    title: 'Related work',
    desc: 'Discover similar papers using embedding-based similarity.',
  },
  {
    icon: Shield,
    title: 'Private by default',
    desc: 'Your papers and queries are scoped to your account only.',
  },
]

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-foreground/10 border border-border flex items-center justify-center">
              <FileText size={13} className="text-foreground/70" />
            </div>
            <span className="text-sm font-semibold tracking-tight">PaperMind AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1 text-xs text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Hybrid RAG · FAISS · Citation grounding
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-foreground leading-[1.1] mb-6">
            Research intelligence,<br />
            <span className="text-muted-foreground">grounded in your papers.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Upload PDFs, ask questions, and get answers with exact citations.
            Summarize, compare, and explore your research corpus with AI.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button size="lg" asChild className="gap-2">
              <Link to="/register">
                Start for free <ArrowRight size={15} />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y divide-border sm:divide-x sm:divide-y-0 lg:divide-x lg:[&>*:nth-child(n+4)]:border-t lg:[&>*:nth-child(n+4)]:border-border">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-6 group hover:bg-accent/50 transition-colors">
                  <div className="w-8 h-8 rounded-md border border-border flex items-center justify-center mb-4 group-hover:border-foreground/20 transition-colors">
                    <Icon size={15} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-1.5">{title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>PaperMind AI</span>
          <span>Express · React · FAISS · Gemini Embeddings</span>
        </div>
      </footer>
    </div>
  )
}
