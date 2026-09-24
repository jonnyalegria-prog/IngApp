import { useState } from 'react'
import * as storage from '../lib/storage'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../lib/toast'
import LoadError from '../components/LoadError'
import type { GrammarTopic } from '../lib/types'

export default function Grammar() {
  const toast = useToast()
  const load = useLoad(async () => (await storage.getGrammarTopics()).reverse())
  const topics = load.data ?? []
  const setTopics = (next: GrammarTopic[] | ((prev: GrammarTopic[]) => GrammarTopic[])) =>
    load.setData((prev) => (typeof next === 'function' ? next(prev ?? []) : next))
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  async function addTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const topic: GrammarTopic = {
      id: crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    }
    const result = await toast.run(() => storage.saveGrammarTopic(topic), 'No pude guardar el tema.')
    if (!result.ok) return
    setTopics((prev) => [topic, ...prev])
    setTitle('')
    setNotes('')
  }

  async function markReviewed(topic: GrammarTopic) {
    const updated = { ...topic, lastReviewed: new Date().toISOString() }
    const result = await toast.run(() => storage.saveGrammarTopic(updated), 'No pude guardar el repaso.')
    if (result.ok) setTopics((prev) => prev.map((t) => (t.id === topic.id ? updated : t)))
  }

  async function remove(topic: GrammarTopic) {
    const result = await toast.run(() => storage.deleteGrammarTopic(topic.id), 'No pude borrar el tema.')
    if (!result.ok) return
    setTopics((prev) => prev.filter((t) => t.id !== topic.id))
    toast.undo('Tema eliminado', async () => {
      const restored = await toast.run(() => storage.saveGrammarTopic(topic), 'No pude recuperar el tema.')
      if (restored.ok) setTopics((prev) => [topic, ...prev])
    })
  }

  if (load.error && !load.data) return <LoadError message={load.error} onRetry={load.reload} />
  if (load.loading) return <p className="text-slate-400">Cargando...</p>

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">Anota los temas que ves en tus clases particulares para no perderlos de vista.</p>

      <form onSubmit={addTopic} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tema (ej. Present Perfect vs Simple Past)"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notas, ejemplos, dudas de la clase..."
          className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <button type="submit" className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Guardar tema
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {topics.length === 0 && <p className="text-sm text-slate-400">Aún no has registrado temas de gramática.</p>}
        {topics.map((topic) => (
          <div key={topic.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-white">{topic.title}</h3>
              <button onClick={() => void remove(topic)} className="text-slate-400 hover:text-red-400" aria-label="Borrar tema">
                ✕
              </button>
            </div>
            {topic.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{topic.notes}</p>}
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
              {topic.lastReviewed ? (
                <span>Repasado el {new Date(topic.lastReviewed).toLocaleDateString('es-CL')}</span>
              ) : (
                <span>Sin repasar aún</span>
              )}
              <button onClick={() => void markReviewed(topic)} className="text-violet-400 hover:underline">
                Marcar como repasado
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
