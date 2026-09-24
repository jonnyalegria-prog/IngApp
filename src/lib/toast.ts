import { createContext, useContext } from 'react'

export interface ToastOptions {
  kind?: 'info' | 'error' | 'success'
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

export type RunResult<T> = { ok: true; value: T } | { ok: false }

export interface ToastApi {
  show: (message: string, options?: ToastOptions) => void
  error: (message: string) => void
  /** Aviso con botón "Deshacer" durante unos segundos. */
  undo: (message: string, onUndo: () => void | Promise<void>) => void
  /** Ejecuta la acción; si falla, avisa con un mensaje amable y devuelve { ok: false }. */
  run: <T>(action: () => Promise<T>, errorMessage?: string) => Promise<RunResult<T>>
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast debe usarse dentro de ToastProvider')
  return api
}
