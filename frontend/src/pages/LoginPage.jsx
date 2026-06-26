import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanFace, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-4 shadow-elevated">
            <ScanFace size={28} className="text-white" />
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">Smart Attendance</h1>
          <p className="text-slate-400 text-sm mt-1">Proxy Detection System</p>
        </div>

        <div className="bg-ink-800 rounded-2xl p-7 shadow-elevated">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-ink-700 border border-ink-700 text-white placeholder-slate-500 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                placeholder="you@institution.edu"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-ink-700 border border-ink-700 text-white placeholder-slate-500 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-absent bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dim disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Faculty and Admin access only. Contact your administrator for credentials.
        </p>
      </div>
    </div>
  )
}
