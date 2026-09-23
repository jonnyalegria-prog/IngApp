import { useEffect, useState } from 'react'
import * as storage from '../../lib/storage'
import { markPracticed } from '../../lib/storage'
import { getGrammarExercises, type GrammarMcqContent } from '../../lib/exerciseBank'
import { generateClozeSet, type ClozeExercise } from '../../lib/cloze'
import { shuffle } from '../../lib/shuffle'

const TOPIC_LABELS: Record<string, string> = {
  to_be: 'Verbo to be',
  futuro: 'Futuro (will / going to)',
  pasado: 'Pasado simple',
}

export default function GrammarPractice() {
  const [mode, setMode] = useState<'menu' | 'personal' | string>('menu')
  const [personalCloze, setPersonalCloze] = useState<ClozeExercise[]>([])

  useEffect(() => {
    async function loadPersonal() {
      const [tasks, topics] = await Promise.all([storage.getHomeworkTasks(), storage.getGrammarTopics()])
      // Primero lo pendiente y lo más reciente; lo ya hecho o viejo va al final del repaso.
      const recency = (t: (typeof tasks)[number]) => t.classDate ?? t.createdAt.slice(0, 10)
      const orderedTasks = [...tasks].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1
        return recency(b).localeCompare(recency(a))
      })
      const orderedTopics = [...topics].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const lines = [...orderedTasks.map((t) => t.text), ...orderedTopics.flatMap((t) => t.notes.split('\n'))]
      setPersonalCloze(generateClozeSet(lines))
    }
    loadPersonal()
  }, [])

  if (mode === 'menu') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-slate-400">Elige qué practicar.</p>
        {personalCloze.length > 0 && (
          <button
            onClick={() => setMode('personal')}
            className="rounded-2xl border border-violet-600 bg-violet-950/30 p-4 text-left font-medium text-white hover:border-violet-400"
          >
            Mis ejercicios ({personalCloze.length})
            <div className="mt-1 text-xs font-normal text-violet-300">
              Generados de tus propias tareas y notas de gramática
            </div>
          </button>
        )}
        {(Object.keys(TOPIC_LABELS) as (keyof typeof TOPIC_LABELS)[]).map((t) => (
          <button
            key={t}
            onClick={() => setMode(t)}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left font-medium text-white hover:border-violet-500"
          >
            {TOPIC_LABELS[t]}
          </button>
        ))}
      </div>
    )
  }

  if (mode === 'personal') {
    return <PersonalClozeSession exercises={personalCloze} onExit={() => setMode('menu')} />
  }

  return <TopicMcqSession topic={mode} onExit={() => setMode('menu')} />
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
          onClick={() => {
            setChecked(true)
            markPracticed()
          }}
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

function TopicMcqSession({ topic, onExit }: { topic: string; onExit: () => void }) {
  const [exercises, setExercises] = useState<GrammarMcqContent[] | null>(null)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)

  useEffect(() => {
    // Ejercicios y alternativas en orden distinto cada vez, para que la respuesta no sea predecible.
    getGrammarExercises(topic).then((list) => setExercises(shuffle(list).map((ex) => ({ ...ex, options: shuffle(ex.options) }))))
  }, [topic])

  if (!exercises) return <p className="text-slate-400">Cargando...</p>

  const current = exercises[index]

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-3xl">🎉</div>
        <h1 className="text-xl font-semibold text-white">
          {score}/{exercises.length} correctas
        </h1>
        <button onClick={onExit} className="mt-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Elegir otro tema
        </button>
      </div>
    )
  }

  function choose(option: string) {
    if (selected) return
    setSelected(option)
    markPracticed()
    if (option === current.answer) setScore((s) => s + 1)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">
        {TOPIC_LABELS[topic]} — {index + 1}/{exercises.length}
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
