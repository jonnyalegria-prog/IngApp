import { useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import type { GrammarTopic } from '../lib/types'

export default function Grammar() {
  const [topics, setTopics] = useState<GrammarTopic[]>([])
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    storage.getGrammarTopics().then((t) => setTopics(t.reverse()))
  }, [])

  async function addTopic(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const topic: GrammarTopic = {
      id: crypto.randomUUID(),
      title: title.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    }
    await storage.saveGrammarTopic(topic)
    setTopics([topic, ...topics])
    setTitle('')
    setNotes('')
  }

  async function markReviewed(topic: GrammarTopic) {
    const updated = { ...topic, lastReviewed: new Date().toISOString() }
    await storage.saveGrammarTopic(updated)
    setTopics(topics.map((t) => (t.id === topic.id ? updated : t)))
  }

  async function remove(id: string) {
    await storage.deleteGrammarTopic(id)
    setTopics(topics.filter((t) => t.id !== id))
  }

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
              <button onClick={() => remove(topic.id)} className="text-slate-500 hover:text-red-400">
                ✕
              </button>
            </div>
            {topic.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{topic.notes}</p>}
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
              {topic.lastReviewed ? (
                <span>Repasado el {new Date(topic.lastReviewed).toLocaleDateString('es-CL')}</span>
              ) : (
                <span>Sin repasar aún</span>
              )}
              <button onClick={() => markReviewed(topic)} className="text-violet-400 hover:underline">
                Marcar como repasado
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
