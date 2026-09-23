import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSession, onAuthChange, signIn, signUp } from '../lib/auth'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading')

  useEffect(() => {
    getSession().then(setSession)
    return onAuthChange(setSession)
  }, [])

  if (session === 'loading') return <div className="p-8 text-center text-slate-400">Cargando...</div>
  if (!session) return <LoginForm />

  return <>{children}</>
}

// Supabase responde en inglés; se traduce lo más común a un mensaje claro y amable.
function friendlyAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : ''
  if (message.includes('invalid login credentials')) return 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.'
  if (message.includes('email not confirmed')) return 'Falta confirmar tu correo. Revisa tu bandeja de entrada (y el spam).'
  if (message.includes('already registered')) return 'Ese correo ya tiene una cuenta. Prueba iniciando sesión.'
  if (message.includes('at least 6 characters') || message.includes('weak password'))
    return 'La contraseña es muy corta: usa al menos 6 caracteres.'
  if (message.includes('signups not allowed') || message.includes('signup is disabled') || message.includes('signups are disabled'))
    return 'Por ahora no se pueden crear cuentas nuevas.'
  if (message.includes('rate limit') || message.includes('too many')) return 'Hubo muchos intentos seguidos. Espera un ratito y vuelve a probar.'
  if (message.includes('invalid email') || message.includes('unable to validate email')) return 'Ese correo no parece válido. Revísalo, por favor.'
  if (message.includes('failed to fetch') || message.includes('network')) return 'No pude conectarme. Revisa tu internet e intenta de nuevo.'
  return 'Pucha, algo salió mal. Intenta de nuevo en un ratito.'
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
        setInfo('¡Listo, tu cuenta quedó creada! Si te llega un correo para confirmarla, ábrelo primero; si no, ya puedes iniciar sesión.')
      }
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="mb-1 text-xl font-semibold text-violet-400">IngApp</h1>
        <p className="mb-4 text-sm text-slate-400">
          {mode === 'signIn' ? 'Inicia sesión para guardar tu progreso.' : 'Crea tu cuenta para partir.'}
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
          {mode === 'signIn' ? '¿No tienes cuenta? Crea una' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  )
}
