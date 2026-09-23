import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVocabStore } from '../../store/useVocabStore'
import { canSpeak, speak } from '../../lib/speech'
import { markPracticed } from '../../lib/storage'

export default function VocabPractice() {
  const { words, loaded, load, review, dueWords } = useVocabStore()
  const [queue, setQueue] = useState<string[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  useEffect(() => {
    if (loaded && queue === null) {
      setQueue(dueWords().map((w) => w.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const current = useMemo(() => words.find((w) => w.id === queue?.[0]), [words, queue])

  if (!loaded || queue === null) {
    return <p className="text-slate-400">Cargando...</p>
  }

  if (queue.length === 0 || finished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-3xl">🎉</div>
        <h1 className="text-xl font-semibold text-white">{finished ? '¡Repaso completo!' : 'No hay nada para repasar ahora'}</h1>
        <p className="text-slate-400">
          {finished ? 'Volvé mañana para seguir con la racha.' : 'Agregá vocabulario nuevo o volvé más tarde.'}
        </p>
        <Link to="/vocabulario" className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Ir a vocabulario
        </Link>
      </div>
    )
  }

  async function answer(quality: 1 | 3 | 5) {
    if (!current || !queue) return
    await review(current.id, quality)
    markPracticed()
    const rest = queue.slice(1)
    setFlipped(false)
    if (rest.length === 0) {
      setFinished(true)
    } else {
      setQueue(rest)
    }
  }

  if (!current) return null

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-slate-400">{queue.length} palabra(s) restantes</p>

      <div
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-56 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center transition"
      >
        <div className="text-2xl font-semibold text-white">{current.term}</div>
        {canSpeak() && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              speak(current.term)
            }}
            className="text-slate-500 hover:text-violet-400"
          >
            🔊 Escuchar
          </button>
        )}
        {flipped ? (
          <div className="mt-2 flex flex-col gap-1">
            <div className="text-lg text-violet-300">{current.translation}</div>
            {current.example && <div className="text-sm italic text-slate-400">"{current.example}"</div>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Tocá para ver el significado</p>
        )}
      </div>

      {flipped && (
        <div className="flex w-full max-w-md gap-2">
          <button onClick={() => answer(1)} className="flex-1 rounded-md bg-red-600/80 py-2 text-sm font-medium text-white hover:bg-red-600">
            Otra vez
          </button>
          <button onClick={() => answer(3)} className="flex-1 rounded-md bg-amber-600/80 py-2 text-sm font-medium text-white hover:bg-amber-600">
            Difícil
          </button>
          <button onClick={() => answer(5)} className="flex-1 rounded-md bg-emerald-600/80 py-2 text-sm font-medium text-white hover:bg-emerald-600">
            Fácil
          </button>
        </div>
      )}
    </div>
  )
}
