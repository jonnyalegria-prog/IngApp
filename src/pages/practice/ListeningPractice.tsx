import { useState } from 'react'
import { getListeningItems, type ListeningContent } from '../../lib/exerciseBank'
import { canSpeak, speak, speakSlow } from '../../lib/speech'
import { logPractice, markPracticed } from '../../lib/storage'
import { shuffle } from '../../lib/shuffle'
import { useLoad } from '../../lib/useLoad'
import LoadError from '../../components/LoadError'
import TranslateLine from '../../components/TranslateLine'

export default function ListeningPractice() {
  const load = useLoad(getListeningItems)
  const [active, setActive] = useState<ListeningContent | null>(null)

  if (!canSpeak()) {
    return <p className="text-slate-400">Tu navegador no soporta lectura de voz, así que esta práctica no está disponible acá.</p>
  }
  if (load.error && !load.data) return <LoadError message={load.error} onRetry={load.reload} />
  if (!load.data) return <p className="text-slate-400">Cargando...</p>

  if (active) return <Session item={active} onExit={() => setActive(null)} />

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400">Escucha el audio (las veces que quieras) y responde las preguntas. El texto aparece al final.</p>
      {load.data.length === 0 && <p className="text-sm text-slate-400">Aún no hay audios cargados.</p>}
      {load.data.map((item) => (
        <button
          key={item.title}
          onClick={() => setActive(item)}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left font-medium text-white hover:border-violet-500"
        >
          🎧 {item.title}
          <div className="mt-1 text-xs font-normal text-slate-400">{item.questions.length} preguntas</div>
        </button>
      ))}
    </div>
  )
}

function Session({ item, onExit }: { item: ListeningContent; onExit: () => void }) {
  const [questions] = useState(() => item.questions.map((q) => ({ ...q, options: shuffle(q.options) })))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)

  const current = questions[index]
  const done = index >= questions.length

  function choose(option: string) {
    if (selected) return
    setSelected(option)
    markPracticed()
    const correct = option === current.answer
    logPractice({ kind: 'listening', topic: item.title.slice(0, 60), item: current.q, correct })
    if (correct) setScore((s) => s + 1)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">🎧 {item.title}</p>
      <div className="flex gap-3">
        <button
          onClick={() => speak(item.text)}
          className="rounded-2xl border border-violet-600 bg-violet-950/30 px-6 py-4 text-2xl hover:bg-violet-950/50"
          aria-label="Escuchar el audio"
        >
          🔊
        </button>
        <button
          onClick={() => speakSlow(item.text)}
          className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-sm text-slate-200 hover:bg-slate-800"
        >
          🐢 Más lento
        </button>
      </div>

      {!done && current && (
        <>
          <p className="text-xs text-slate-400">
            Pregunta {index + 1} de {questions.length}
          </p>
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center text-white">{current.q}</div>
          <div className="flex w-full max-w-md flex-col gap-2">
            {current.options.map((option) => {
              const right = option === current.answer
              let style = 'border-slate-700 bg-slate-900 text-white hover:border-violet-500'
              if (selected) {
                if (right) style = 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                else if (option === selected) style = 'border-red-600 bg-red-950/40 text-red-300'
                else style = 'border-slate-800 bg-slate-900 text-slate-400'
              }
              return (
                <button key={option} onClick={() => choose(option)} className={`rounded-md border p-3 text-left ${style}`}>
                  {option}
                </button>
              )
            })}
          </div>
          {selected && (
            <button
              onClick={() => {
                setSelected(null)
                setIndex(index + 1)
              }}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              {index + 1 >= questions.length ? 'Ver el texto' : 'Siguiente'}
            </button>
          )}
        </>
      )}

      {done && (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="text-3xl">{score === questions.length ? '🎉' : '🎧'}</div>
          <h2 className="text-lg font-semibold text-white">
            {score}/{questions.length} correctas
          </h2>
          <p className="text-sm text-slate-300" lang="en" translate="no">
            {item.text}
          </p>
          <TranslateLine text={item.text} label="Ver en español" />
          <button onClick={onExit} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            Elegir otro audio
          </button>
        </div>
      )}
    </div>
  )
}
