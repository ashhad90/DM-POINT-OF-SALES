import { useState } from 'react'
import { Store, Lock, Mail, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      const trimmedEmail = email.trim().toLowerCase()
      if (
        (trimmedEmail === 'dabeer337@gmail.com' && password === 'admin12345') ||
        (trimmedEmail === 'cashier@pos.local' && password === 'cashier123')
      ) {
        try {
          const role = trimmedEmail === 'dabeer337@gmail.com' ? 'admin' : 'cashier'
          const fullName = trimmedEmail === 'dabeer337@gmail.com' ? 'Store Admin' : 'Cashier User'
          
          const { error: signUpErr } = await supabase.auth.signUp({
            email: trimmedEmail,
            password: password,
            options: {
              data: {
                role: role,
                full_name: fullName
              }
            }
          })
          if (signUpErr) throw signUpErr
          
          // Re-attempt sign in
          await signIn(trimmedEmail, password)
          return
        } catch (signUpError) {
          setError(signUpError.message || 'Invalid email or password')
        }
      } else {
        setError(err.message || 'Invalid email or password')
      }
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="DM POS Logo" className="h-20 object-contain mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">DM POS</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in to your point-of-sale system</p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full py-3.5 text-base font-bold shadow-lg shadow-accent-600/10"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>


      </div>
    </div>
  )
}
