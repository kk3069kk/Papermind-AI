import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Upload, Search, GitCompare, LogOut, Sun, Moon, MessageSquare } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/papers', label: 'Papers', icon: FileText },
  { href: '/papers/upload', label: 'Upload', icon: Upload },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/compare', label: 'Compare', icon: GitCompare },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-52 shrink-0 min-h-screen border-r border-border flex flex-col bg-card">
      <div className="px-4 h-14 flex items-center gap-2 border-b border-border">
        <div className="w-5 h-5 rounded border border-border flex items-center justify-center">
          <FileText size={11} className="text-muted-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-tight">PaperMind AI</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors',
                active
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon size={14} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 py-3 border-t border-border space-y-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors w-full"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>

        <div className="px-3 py-1.5">
          <p className="text-xs text-foreground truncate">{user?.username}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
