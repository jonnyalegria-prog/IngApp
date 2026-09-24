import { useCallback, useEffect, useRef, useState } from 'react'
import { LOAD_ERROR } from './errors'
import { REFRESH_EVENT } from './refresh'

interface LoadState<T> {
  data: T | null
  error: string | null
}

export interface Loaded<T> {
  data: T | null
  /** Mensaje amable si la carga falló y todavía no hay datos. */
  error: string | null
  loading: boolean
  /** Vuelve a cargar (botón "Reintentar"). */
  reload: () => void
  /** Cambia los datos en pantalla sin ir a buscarlos (por ejemplo, tras agregar o borrar algo). */
  setData: (next: T | ((prev: T | null) => T)) => void
}

/**
 * Carga datos al abrir la pantalla, con estado de error y reintento. También vuelve a cargar cuando
 * regresas a la app después de un rato (ver refresh.ts).
 */
export function useLoad<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): Loaded<T> {
  const [state, setState] = useState<LoadState<T>>({ data: null, error: null })
  const [tick, setTick] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    const onRefresh = () => setRefreshTick((n) => n + 1)
    window.addEventListener(REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(REFRESH_EVENT, onRefresh)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetcherRef.current()
      .then((data) => {
        if (!cancelled) setState({ data, error: null })
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ data: prev.data, error: LOAD_ERROR }))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, refreshTick, ...deps])

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
    setTick((n) => n + 1)
  }, [])

  const setData = useCallback((next: T | ((prev: T | null) => T)) => {
    setState((prev) => ({
      data: typeof next === 'function' ? (next as (p: T | null) => T)(prev.data) : next,
      error: prev.error,
    }))
  }, [])

  return { data: state.data, error: state.error, loading: state.data === null && state.error === null, reload, setData }
}
