import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import * as storage from '../lib/storage'
import { generateCloze } from '../lib/cloze'
import { daysBetween, localDateString } from '../lib/week'
import type { HomeworkTask, NotebookEntry } from '../lib/types'

const NO_CLASS = 'sin-clase'

function formatClassDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

// Una tarea agregada a mano se asigna a la clase de los últimos 6 días (la de esta semana);
// pasado ese plazo se considera de una clase nueva y se usa la fecha de hoy.
function defaultClassDate(entries: NotebookEntry[], today: string): string {
  const latest = entries[0]?.classDate
  if (latest) {
    const diff = daysBetween(latest, today)
    if (diff >= 0 && diff <= 6) return latest
  }
  return today
}

interface Group {
  key: string
  classDate?: string
  tasks: HomeworkTask[]
  pending: number
}

function groupByClass(tasks: HomeworkTask[]): Group[] {
  const map = new Map<string, Group>()
  for (const task of tasks) {
    const key = task.classDate ?? NO_CLASS
    const group = map.get(key) ?? { key, classDate: task.classDate, tasks: [], pending: 0 }
    group.tasks.push(task)
    if (!task.done) group.pending++
    map.set(key, group)
  }
  // Clases más recientes primero; las tareas sin clase, al final.
  return [...map.values()].sort((a, b) => {
    if (!a.classDate) return 1
    if (!b.classDate) return -1
    return a.classDate < b.classDate ? 1 : -1
  })
}

export default function Tasks() {
  const [tasks, setTasks] = useState<HomeworkTask[]>([])
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [text, setText] = useState('')
  const [chosenDate, setChosenDate] = useState<string | null>(null)
  // Al abrir, las clases con todo hecho quedan plegadas; las nuevas nacen abiertas.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([storage.getHomeworkTasks(), storage.getNotebookEntries()]).then(([loaded, loadedEntries]) => {
      setTasks(loaded)
      setEntries(loadedEntries)
      setCollapsed(new Set(groupByClass(loaded).filter((g) => g.pending === 0).map((g) => g.key)))
    })
  }, [])

  const today = localDateString()
  const classDate = chosenDate ?? defaultClassDate(entries, today)

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const task: HomeworkTask = {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      createdAt: new Date().toISOString(),
      classDate,
    }
    await storage.saveHomeworkTask(task)
    setTasks([task, ...tasks])
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.delete(classDate)
      return next
    })
    setText('')
  }

  async function toggleDone(task: HomeworkTask) {
    const done = !task.done
    const updated: HomeworkTask = { ...task, done, completedAt: done ? new Date().toISOString() : undefined }
    await storage.saveHomeworkTask(updated)
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)))
  }

  async function remove(id: string) {
    await storage.deleteHomeworkTask(id)
    setTasks(tasks.filter((t) => t.id !== id))
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groups = useMemo(() => groupByClass(tasks), [tasks])
  const pending = tasks.filter((t) => !t.done)
  const pendingWithExercise = pending.filter((t) => generateCloze(t.text))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">
        Lo que te deja la profesora cada clase, ordenado por clase para ir tildando durante la semana.
      </p>

      <form onSubmit={addTask} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej: I will call you tomorrow"
            className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
          />
          <button type="submit" className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            Agregar
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          De la clase del
          <input
            type="date"
            value={classDate}
            max={today}
            onChange={(e) => e.target.value && setChosenDate(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
          />
        </label>
      </form>

      {pendingWithExercise.length > 0 && (
        <div className="rounded-2xl border border-violet-700/40 bg-violet-950/20 p-4 text-sm text-violet-200">
          {pendingWithExercise.length} de tus tareas tienen un ejercicio automático listo — probalos en{' '}
          <Link to="/practicar?tab=gramatica" className="underline">
            Practicar → Gramática
          </Link>
          .
        </div>
      )}

      {tasks.length === 0 && (
        <p className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
          Todavía no tenés tareas. Se cargan solas cuando guardás las notas de una clase en el Cuaderno, o agregalas acá.
        </p>
      )}

      {groups.map((group) => {
        const open = !collapsed.has(group.key)
        const done = group.tasks.length - group.pending
        return (
          <div key={group.key}>
            <button
              onClick={() => toggleGroup(group.key)}
              className="mb-2 flex w-full items-center gap-2 text-left"
              aria-expanded={open}
            >
              {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
              <h2 className="flex-1 font-medium text-white">
                {group.classDate ? `Clase del ${formatClassDate(group.classDate)}` : 'Sin clase asignada'}
              </h2>
              <span className={`text-xs ${group.pending === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {group.pending === 0 ? `✓ ${done}/${group.tasks.length}` : `${done}/${group.tasks.length} hechas`}
              </span>
            </button>
            {open && (
              <div className="flex flex-col divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleDone} onRemove={remove} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  onRemove,
}: {
  task: HomeworkTask
  onToggle: (task: HomeworkTask) => void
  onRemove: (id: string) => void
}) {
  const hasExercise = !!generateCloze(task.text)
  return (
    <div className="flex items-center gap-3 p-3">
      <input type="checkbox" checked={task.done} onChange={() => onToggle(task)} className="h-4 w-4 accent-violet-600" />
      <span className={`flex-1 text-sm ${task.done ? 'text-slate-500 line-through' : 'text-white'}`}>{task.text}</span>
      {hasExercise && !task.done && <span className="text-xs text-violet-400">✏️ ejercicio</span>}
      <button onClick={() => onRemove(task.id)} className="text-slate-500 hover:text-red-400">
        ✕
      </button>
    </div>
  )
}
