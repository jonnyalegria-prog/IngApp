import { useEffect, useRef, useState } from 'react'
import { Flame, Languages, LogOut, User } from 'lucide-react'
import { getSession, signOut } from '../lib/auth'
import { getSettings, STREAK_UPDATED_EVENT } from '../lib/storage'
import { errorMessage, fetchTranslateStatus, translateOne, TranslateError } from '../lib/translate'
import { useToast } from '../lib/toast'

export default function TopBar() {
  const toast = useToast()
  const [streak, setStreak] = useState(0)
  const [email, setEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const refresh = () => {
      getSettings()
        .then((s) => setStreak(s.streak))
        .catch(() => {})
    }
    refresh()
    window.addEventListener(STREAK_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, refresh)
  }, [])

  useEffect(() => {
    getSession()
      .then((s) => setEmail(s?.user.email ?? null))
      .catch(() => {})
  }, [])

  // Prueba de punta a punta: sesión, clave de DeepL, cupo y una traducción real de 19 caracteres.
  async function testTranslation() {
    setMenuOpen(false)
    toast.show('Probando la traducción...')
    try {
      const status = await fetchTranslateStatus()
      const sample = 'Hello, how are you?'
      const result = await translateOne(sample, { from: 'en', to: 'es' })
      const usage =
        'used' in status.deepl
          ? ` Uso de DeepL este mes: ${status.deepl.used.toLocaleString('es-CL')} de ${status.deepl.limit.toLocaleString('es-CL')} caracteres.`
          : ` (${status.deepl.error})`
      toast.show(`Funciona ✅ «${sample}» → «${result}».${usage}`, { kind: 'success', durationMs: 12000 })
    } catch (err) {
      const stage = err instanceof TranslateError && err.stage ? ` [${err.stage}]` : ''
      console.error('Prueba de traducción falló', err)
      toast.error(`La traducción no funcionó${stage}: ${errorMessage(err)}`)
    }
  }

  // Cierra el menú al tocar fuera de él.
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
      <span className="text-lg font-semibold text-violet-400">IngApp</span>
      <div className="flex items-center gap-3">
        <span
          className="flex items-center gap-1 text-sm font-semibold text-amber-400"
          title="Días seguidos practicando"
          aria-label={`Racha: ${streak} ${streak === 1 ? 'día' : 'días'}`}
        >
          <Flame size={18} fill="currentColor" />
          {streak}
        </span>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Mi cuenta"
            aria-expanded={menuOpen}
            className="rounded-full bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
          >
            <User size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-lg">
              {email && <p className="truncate px-2 py-1 text-xs text-slate-400">{email}</p>}
              <button
                type="button"
                onClick={() => void testTranslation()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                <Languages size={16} className="text-slate-400" />
                Probar la traducción
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                <LogOut size={16} className="text-slate-400" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
