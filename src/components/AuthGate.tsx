import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthChange, signIn, signOut, signUp } from '../lib/auth'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    getSession().then(setSession)
    return onAuthChange(setSession)
  }, [])

  if (session === 'loading') return <div className="p-8 text-center text-slate-400">Cargando...</div>
  if (!session) return <LoginForm />

  return (
    <>
      {children}
      <button
        onClick={() => signOut()}
        className="fixed right-3 top-3 z-20 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700"
      >
        Cerrar sesión
      </button>
    </>
  )
}

function LoginForm() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signIn') {
        await signIn(email, password)
      } else {
        await signUp(email, password)
        setInfo('Cuenta creada. Revisá tu email si Supabase pide confirmación, o iniciá sesión directamente.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-1 text-xl font-semibold text-violet-400">IngApp</h1>
        <p className="mb-4 text-sm text-slate-400">
          {mode === 'signIn' ? 'Iniciá sesión para sincronizar tu progreso.' : 'Creá tu cuenta para empezar.'}
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mb-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          className="mb-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {info && <p className="mb-3 text-sm text-emerald-400">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {mode === 'signIn' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-300"
        >
          {mode === 'signIn' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </div>
  )
}
