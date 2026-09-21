import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as storage from '../lib/storage'
import { generateCloze } from '../lib/cloze'
import type { HomeworkTask } from '../lib/types'

export default function Tasks() {
  const [tasks, setTasks] = useState<HomeworkTask[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    storage.getHomeworkTasks().then(setTasks)
  }, [])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const task: HomeworkTask = {
      id: crypto.randomUUID(),
      text: text.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    }
    await storage.saveHomeworkTask(task)
    setTasks([task, ...tasks])
    setText('')
  }

  async function toggleDone(task: HomeworkTask) {
    const updated = { ...task, done: !task.done }
    await storage.saveHomeworkTask(updated)
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)))
  }

  async function remove(id: string) {
    await storage.deleteHomeworkTask(id)
    setTasks(tasks.filter((t) => t.id !== id))
  }

  const pending = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const pendingWithExercise = pending.filter((t) => generateCloze(t.text))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">Lo que te deja la profesora cada clase, para ir tildando durante la semana.</p>

      <form onSubmit={addTask} className="flex gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej: I will call you tomorrow"
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <button type="submit" className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Agregar
        </button>
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

      <div>
        <h2 className="mb-2 font-medium text-white">Pendientes ({pending.length})</h2>
        <div className="flex flex-col divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
          {pending.length === 0 && <p className="p-4 text-sm text-slate-400">No tenés tareas pendientes. 🎉</p>}
          {pending.map((task) => (
            <TaskRow key={task.id} task={task} onToggle={toggleDone} onRemove={remove} />
          ))}
        </div>
      </div>

      {done.length > 0 && (
        <div>
          <h2 className="mb-2 font-medium text-white">Completadas ({done.length})</h2>
          <div className="flex flex-col divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
            {done.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggleDone} onRemove={remove} />
            ))}
          </div>
        </div>
      )}
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
