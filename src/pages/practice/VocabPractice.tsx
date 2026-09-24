import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVocabStore } from '../../store/useVocabStore'
import { canSpeak, speak } from '../../lib/speech'
import { logPractice, markPracticed } from '../../lib/storage'
import { isNewWord } from '../../lib/srs'
import { buildReviewQueue, countWaiting, markNewIntroduced, newIntroducedToday, NEW_PER_DAY, SESSION_MAX } from '../../lib/session'
import { useToast } from '../../lib/toast'
import LoadError from '../../components/LoadError'

// Una tarjeta "extra" es una palabra que fallaste: vuelve a aparecer en la misma ronda, sin cambiar su fecha de repaso.
interface QueueItem {
  id: string
  retry: boolean
}

type Quality = 1 | 3 | 4 | 5

export default function VocabPractice() {
  const { words, loaded, error, load, review } = useVocabStore()
  const toast = useToast()
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [finished, setFinished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(0)
  const [summary, setSummary] = useState({ good: 0, again: 0 })

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  function startRound() {
    const newAllowed = Math.max(0, NEW_PER_DAY - newIntroducedToday())
    const ids = buildReviewQueue(words, newAllowed)
    setQueue(ids.map((id) => ({ id, retry: false })))
    setWaiting(countWaiting(words, ids))
    setSummary({ good: 0, again: 0 })
    setFinished(false)
    setFlipped(false)
  }

  // La primera ronda se arma apenas cargan las palabras.
  if (loaded && queue === null) startRound()

  if (error && !loaded) return <LoadError message={error} onRetry={() => void load()} />
  if (!loaded || queue === null) return <p className="text-slate-400">Cargando...</p>

  if (queue.length === 0 || finished) {
    const more = buildReviewQueue(words, Math.max(0, NEW_PER_DAY - newIntroducedToday())).length > 0
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-3xl">🎉</div>
        <h1 className="text-xl font-semibold text-white">{finished ? '¡Repaso completo!' : 'No hay nada para repasar ahora'}</h1>
        {finished && (
          <p className="text-slate-300">
            {summary.good} bien · {summary.again} para repetir mañana
          </p>
        )}
        <p className="text-slate-400">
          {finished
            ? 'Vuelve mañana para seguir con la racha. ¡Vas bacán!'
            : waiting > 0
              ? `Ya viste tus ${NEW_PER_DAY} palabras nuevas de hoy; el resto te espera mañana.`
              : 'Agrega vocabulario nuevo o vuelve más tarde.'}
        </p>
        {more && (
          <button onClick={startRound} className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            Otra ronda
          </button>
        )}
        <Link to="/vocabulario" className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700">
          Ir a vocabulario
        </Link>
      </div>
    )
  }

  const item = queue[0]
  const current = words.find((w) => w.id === item.id)
  if (!current) {
    // La palabra ya no existe (por ejemplo, se borró): se salta.
    setQueue(queue.slice(1))
    return null
  }

  async function answer(quality: Quality) {
    if (busy || !current) return
    setBusy(true)
    let rest = queue!.slice(1)
    if (!item.retry) {
      const wasNew = isNewWord(current)
      const result = await toast.run(() => review(current.id, quality), 'No pude guardar tu respuesta. Intenta de nuevo.')
      if (!result.ok) {
        setBusy(false)
        return
      }
      if (wasNew) markNewIntroduced(current.id)
      logPractice({ kind: 'vocab', item: current.term, correct: quality >= 3 })
      markPracticed()
      setSummary((s) => (quality >= 3 ? { ...s, good: s.good + 1 } : { ...s, again: s.again + 1 }))
    }
    // Lo fallado vuelve a aparecer después de unas tarjetas más.
    if (quality < 3) rest = [...rest.slice(0, 3), { id: item.id, retry: true }, ...rest.slice(3)]
    setFlipped(false)
    setBusy(false)
    if (rest.length === 0) setFinished(true)
    else setQueue(rest)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-slate-400">
        {queue.length} palabra(s) restantes
        {waiting > 0 && ` · ${waiting} más para otra ronda (máx. ${SESSION_MAX} por ronda)`}
      </p>

      <div
        onClick={() => setFlipped((f) => !f)}
        className="relative flex min-h-56 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center transition"
      >
        {item.retry && (
          <span className="absolute right-3 top-3 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] text-amber-300">Otra vez</span>
        )}
        <div className="text-2xl font-semibold text-white" lang="en" translate="no">
          {current.term}
        </div>
        {canSpeak() && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              speak(current.term)
            }}
            className="text-slate-400 hover:text-violet-400"
          >
            🔊 Escuchar
          </button>
        )}
        {flipped ? (
          <div className="mt-2 flex flex-col gap-1">
            <div className="text-lg text-violet-300">{current.translation}</div>
            {current.example && (
              <div className="text-sm italic text-slate-400" lang="en" translate="no">
                "{current.example}"
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Toca para ver el significado</p>
        )}
      </div>

      {flipped &&
        (item.retry ? (
          <div className="flex w-full max-w-md gap-2">
            <button
              onClick={() => void answer(1)}
              disabled={busy}
              className="flex-1 rounded-md bg-red-600/80 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              Otra vez
            </button>
            <button
              onClick={() => void answer(4)}
              disabled={busy}
              className="flex-1 rounded-md bg-emerald-600/80 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              La supe
            </button>
          </div>
        ) : (
          <div className="flex w-full max-w-md gap-2">
            <button
              onClick={() => void answer(1)}
              disabled={busy}
              className="flex-1 rounded-md bg-red-600/80 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              Otra vez
            </button>
            <button
              onClick={() => void answer(3)}
              disabled={busy}
              className="flex-1 rounded-md bg-amber-600/80 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              Difícil
            </button>
            <button
              onClick={() => void answer(4)}
              disabled={busy}
              className="flex-1 rounded-md bg-sky-600/80 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              Bien
            </button>
            <button
              onClick={() => void answer(5)}
              disabled={busy}
              className="flex-1 rounded-md bg-emerald-600/80 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              Fácil
            </button>
          </div>
        ))}
    </div>
  )
}
