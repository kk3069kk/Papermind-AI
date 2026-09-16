import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Sidebar } from '@/components/layout/Sidebar'

export function DashboardLayout() {
  const token = useAuthStore((s) => s.token)
  const hydrated = useAuthStore((s) => s._hydrated)
  const navigate = useNavigate()

  useEffect(() => {
    if (hydrated && !token) navigate('/login')
  }, [hydrated, token, navigate])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    )
  }

  if (!token) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
