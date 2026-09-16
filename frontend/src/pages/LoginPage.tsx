import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import type { AuthResponse } from '@/types'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login(form)
      const data: AuthResponse = res.data
      setAuth(data.user, data.access_token)
      toast.success(`Welcome back, ${data.user.username}`)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-7 h-7 rounded border border-border flex items-center justify-center">
            <FileText size={14} className="text-muted-foreground" />
          </div>
          <span className="font-semibold tracking-tight">PaperMind AI</span>
        </div>

        <div className="border border-border rounded-lg p-6 bg-card">
          <h1 className="text-base font-semibold mb-1">Sign in</h1>
          <p className="text-xs text-muted-foreground mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5">
            No account?{' '}
            <Link to="/register" className="text-foreground hover:underline underline-offset-4">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
