import { useState } from 'react'
import { errorMessage, translateOne, type Lang } from '../lib/translate'

interface Props {
  text: string
  context?: string
  from?: Lang
  to?: Lang
  /** true solo para contenido del banco; el texto escrito por el usuario no se guarda en el caché compartido. */
  cache?: boolean
  label?: string
}

/** Botón 🌐 que muestra la traducción de DeepL debajo del texto. */
export default function TranslateLine({
  text,
  context,
  from = 'en',
  to = 'es',
  cache = true,
  label = 'Ver en español',
}: Props) {
  // El resultado se guarda junto con el texto que lo originó: si el texto cambia, deja de valer solo
  // (sin necesidad de reiniciar el estado desde un efecto).
  const key = JSON.stringify([text, context ?? '', from, to])
  const [run, setRun] = useState<{ key: string; status: 'loading' | 'done' | 'error'; value: string } | null>(null)
  const current = run && run.key === key ? run : null

  async function handleClick() {
    setRun({ key, status: 'loading', value: '' })
    try {
      setRun({ key, status: 'done', value: await translateOne(text, { from, to, cache, context }) })
    } catch (err) {
      setRun({ key, status: 'error', value: errorMessage(err) })
    }
  }

  if (current?.status === 'done') return <p className="mt-1 text-xs italic text-sky-300">{current.value}</p>

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={current?.status === 'loading'}
        className="text-xs text-slate-400 hover:text-violet-400 disabled:opacity-60"
      >
        🌐 {current?.status === 'loading' ? 'Traduciendo...' : label}
      </button>
      {current?.status === 'error' && <p className="text-xs text-red-400">{current.value}</p>}
    </div>
  )
}
