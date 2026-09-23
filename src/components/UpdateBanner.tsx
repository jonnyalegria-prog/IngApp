import { useEffect, useState } from 'react'
import { applyServiceWorkerUpdate, UPDATE_AVAILABLE_EVENT } from '../lib/pwa'

// Aviso cuando se publicó una versión nueva de la app.
export default function UpdateBanner() {
  const [available, setAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const show = () => setAvailable(true)
    window.addEventListener(UPDATE_AVAILABLE_EVENT, show)
    return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, show)
  }, [])

  if (!available) return null

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-2xl px-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-violet-600 bg-slate-900 p-3 shadow-lg">
        <span className="text-sm text-slate-200">¡Hay una versión nueva de IngApp!</span>
        <button
          type="button"
          disabled={updating}
          onClick={() => {
            setUpdating(true)
            applyServiceWorkerUpdate()
          }}
          className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {updating ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  )
}
