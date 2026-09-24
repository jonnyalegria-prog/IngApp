import { useState } from 'react'
import * as storage from '../../lib/storage'
import { logPractice, markPracticed } from '../../lib/storage'
import { getAllGrammarExercises, getMcqTopics, topicLabel, type McqExercise } from '../../lib/exerciseBank'
import { generateClozeSet, type ClozeExercise } from '../../lib/cloze'
import { accuracyBy, missedItems } from '../../lib/progress'
import { shuffle } from '../../lib/shuffle'
import { useLoad } from '../../lib/useLoad'
import LoadError from '../../components/LoadError'
import type { PracticeRow } from '../../lib/types'

type Mode = { kind: 'menu' } | { kind: 'personal' } | { kind: 'topic'; topic: string } | { kind: 'mistakes' }

export default function GrammarPractice() {
  const [mode, setMode] = useState<Mode>({ kind: 'menu' })
  const load = useLoad(async () => {
    const [tasks, topics, mcq, mcqTopics, log] = await Promise.all([
      storage.getHomeworkTasks(),
      storage.getGrammarTopics(),
      getAllGrammarExercises(),
      getMcqTopics(),
      storage.getPracticeLog(30).catch((): PracticeRow[] => []),
    ])
    // Primero lo pendiente y lo más reciente; lo ya hecho o viejo va al final del repaso.
    const recency = (t: (typeof tasks)[number]) => t.classDate ?? t.createdAt.slice(0, 10)
    const orderedTasks = [...tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      return recency(b).localeCompare(recency(a))
    })
    const orderedTopics = [...topics].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const lines = [...orderedTasks.map((t) => t.text), ...orderedTopics.flatMap((t) => t.notes.split('\n'))]
    return { personal: generateClozeSet(lines), mcq, mcqTopics, log }
  })

  // Al volver al menú se recargan tus resultados, para que "Repasar mis errores" y los porcentajes estén al día.
  function exit() {
    load.reload()
    setMode({ kind: 'menu' })
  }

  if (load.error && !load.data) return <LoadError message={load.error} onRetry={load.reload} />
  if (!load.data) return <p className="text-slate-400">Cargando...</p>
  const { personal, mcq, mcqTopics, log } = load.data

  if (mode.kind === 'personal') return <PersonalClozeSession exercises={personal} onExit={exit} />

  if (mode.kind === 'topic') {
    const list = mcq.filter((ex) => ex.topic === mode.topic)
    return <McqSession title={topicLabel(mode.topic)} exercises={list} onExit={exit} />
  }

  // Lo que fallaste la última vez que lo viste, para repasarlo de nuevo.
  const missedPrompts = new Set(missedItems(log, 40).filter((m) => m.kind === 'grammar_mcq').map((m) => m.item))
  const mistakes = mcq.filter((ex) => missedPrompts.has(ex.prompt.slice(0, 200)))

  if (mode.kind === 'mistakes') {
    return <McqSession title="Mis errores" exercises={mistakes} onExit={exit} />
  }

  const byTopic = new Map(accuracyBy(log, (r) => (r.kind === 'grammar_mcq' ? r.topic : undefined)).map((a) => [a.key, a]))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400">Elige qué practicar.</p>
      {mistakes.length > 0 && (
        <button
          onClick={() => setMode({ kind: 'mistakes' })}
          className="rounded-2xl border border-rose-600/70 bg-rose-950/20 p-4 text-left font-medium text-white hover:border-rose-400"
        >
          Repasar mis errores ({mistakes.length})
          <div className="mt-1 text-xs font-normal text-rose-300">Lo que fallaste últimamente, para que ahora te salga</div>
        </button>
      )}
      {personal.length > 0 && (
        <button
          onClick={() => setMode({ kind: 'personal' })}
          className="rounded-2xl border border-violet-600 bg-violet-950/30 p-4 text-left font-medium text-white hover:border-violet-400"
        >
          Mis ejercicios ({personal.length})
          <div className="mt-1 text-xs font-normal text-violet-300">Generados de tus propias tareas y notas de gramática</div>
        </button>
      )}
      {mcqTopics.map(({ topic, count }) => {
        const acc = byTopic.get(topic)
        return (
          <button
            key={topic}
            onClick={() => setMode({ kind: 'topic', topic })}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left font-medium text-white hover:border-violet-500"
          >
            <span>{topicLabel(topic)}</span>
            <span className="shrink-0 text-xs font-normal text-slate-400">
              {count} ejercicios{acc ? ` · ${acc.pct}% bien` : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function PersonalClozeSession({ exercises, onExit }: { exercises: ClozeExercise[]; onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)

  const current = exercises[index]

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-3xl">🎉</div>
        <h1 className="text-xl font-semibold text-white">¡Listo!</h1>
        <button onClick={onExit} className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Volver
        </button>
      </div>
    )
  }

  const isCorrect = checked && input.trim().toLowerCase() === current.answer.toLowerCase()

  function check() {
    setChecked(true)
    markPracticed()
    logPractice({
      kind: 'grammar_cloze',
      topic: 'mis ejercicios',
      item: current.prompt,
      correct: input.trim().toLowerCase() === current.answer.toLowerCase(),
    })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">
        Mis ejercicios — {index + 1}/{exercises.length}
      </p>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="text-lg text-white">{current.prompt}</p>
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={checked}
        placeholder="Completa el espacio en blanco..."
        className="w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 disabled:opacity-70"
      />
      {!checked ? (
        <button
          onClick={check}
          disabled={!input.trim()}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Revisar
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className={`text-sm font-medium ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {isCorrect ? '¡Buena! 🎉' : `Pucha, era "${current.answer}"`}
          </p>
          <button
            onClick={() => {
              setChecked(false)
              setInput('')
              setIndex(index + 1)
            }}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

function McqSession({ title, exercises, onExit }: { title: string; exercises: McqExercise[]; onExit: () => void }) {
  // Ejercicios y alternativas en orden distinto cada vez, para que la respuesta no sea predecible.
  const [queue, setQueue] = useState(() => shuffle(exercises).map((ex) => ({ ...ex, options: shuffle(ex.options) })))
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [missed, setMissed] = useState<McqExercise[]>([])
  const [score, setScore] = useState(0)

  const current = queue[index]

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-3xl">🎉</div>
        <h1 className="text-xl font-semibold text-white">
          {score}/{queue.length} correctas
        </h1>
        {missed.length > 0 && (
          <button
            onClick={() => {
              setQueue(shuffle(missed).map((ex) => ({ ...ex, options: shuffle(ex.options) })))
              setIndex(0)
              setScore(0)
              setMissed([])
              setSelected(null)
            }}
            className="rounded-md bg-rose-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
          >
            Repetir las {missed.length} que fallé
          </button>
        )}
        <button onClick={onExit} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Elegir otro tema
        </button>
      </div>
    )
  }

  function choose(option: string) {
    if (selected) return
    setSelected(option)
    markPracticed()
    const correct = option === current.answer
    logPractice({ kind: 'grammar_mcq', topic: current.topic, item: current.prompt, correct })
    if (correct) setScore((s) => s + 1)
    else setMissed((m) => [...m, current])
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">
        {title} — {index + 1}/{queue.length}
      </p>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="text-lg text-white">{current.prompt}</p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-2">
        {current.options.map((option) => {
          const isCorrect = option === current.answer
          const isSelected = option === selected
          let style = 'border-slate-700 bg-slate-900 text-white hover:border-violet-500'
          if (selected) {
            if (isCorrect) style = 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
            else if (isSelected) style = 'border-red-600 bg-red-950/40 text-red-300'
            else style = 'border-slate-800 bg-slate-900 text-slate-400'
          }
          return (
            <button key={option} onClick={() => choose(option)} className={`rounded-md border p-3 text-left ${style}`}>
              {option}
            </button>
          )
        })}
      </div>
      {selected && <div className="w-full max-w-md rounded-md border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">{current.explanation}</div>}
      {selected && (
        <button
          onClick={() => {
            setSelected(null)
            setIndex(index + 1)
          }}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Siguiente
        </button>
      )}
    </div>
  )
}
