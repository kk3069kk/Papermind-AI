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

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ email: '', username: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.register(form)
      const data: AuthResponse = res.data
      setAuth(data.user, data.access_token)
      toast.success('Account created. Welcome!')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed')
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
          <h1 className="text-base font-semibold mb-1">Create account</h1>
          <p className="text-xs text-muted-foreground mb-6">Start your research workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="researcher42"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min. 8 characters"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-foreground hover:underline underline-offset-4">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
