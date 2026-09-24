import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { friendlyError } from '../lib/errors'
import { ToastContext, type ToastApi, type ToastOptions } from '../lib/toast'

interface ToastItem extends ToastOptions {
  id: number
  message: string
}

const DEFAULT_MS = 4000
const UNDO_MS = 6000
const ERROR_MS = 6000

// Avisos breves abajo de la pantalla: errores, confirmaciones y "Deshacer".
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const lastGlobalError = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-2), { id, message, ...options }])
      const ms = options.durationMs ?? (options.onAction ? UNDO_MS : options.kind === 'error' ? ERROR_MS : DEFAULT_MS)
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (message) => show(message, { kind: 'error' }),
      undo: (message, onUndo) => show(message, { actionLabel: 'Deshacer', onAction: () => void onUndo() }),
      run: async (action, errorMessage) => {
        try {
          return { ok: true, value: await action() }
        } catch (err) {
          show(friendlyError(err, errorMessage), { kind: 'error' })
          return { ok: false }
        }
      },
    }),
    [show],
  )

  // Red de seguridad: un error que nadie atrapó no debe pasar en silencio.
  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault()
      if (Date.now() - lastGlobalError.current < 3000) return
      lastGlobalError.current = Date.now()
      show(friendlyError(event.reason), { kind: 'error' })
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto flex w-full max-w-2xl flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm shadow-lg ${
              t.kind === 'error'
                ? 'border-red-700 bg-red-950 text-red-100'
                : t.kind === 'success'
                  ? 'border-emerald-700 bg-emerald-950 text-emerald-100'
                  : 'border-slate-700 bg-slate-900 text-slate-100'
            }`}
          >
            <span>{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.()
                  dismiss(t.id)
                }}
                className="shrink-0 rounded-md bg-violet-600 px-3 py-1 text-sm font-medium text-white hover:bg-violet-500"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
