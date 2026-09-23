import { useEffect, useState } from 'react'
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
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setState('idle')
    setValue('')
    setError('')
  }, [text, context, from, to])

  async function handleClick() {
    setState('loading')
    try {
      setValue(await translateOne(text, { from, to, cache, context }))
      setState('done')
    } catch (err) {
      setError(errorMessage(err))
      setState('error')
    }
  }

  if (state === 'done') return <p className="mt-1 text-xs italic text-sky-300">{value}</p>

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'loading'}
        className="text-xs text-slate-500 hover:text-violet-400 disabled:opacity-60"
      >
        🌐 {state === 'loading' ? 'Traduciendo...' : label}
      </button>
      {state === 'error' && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
