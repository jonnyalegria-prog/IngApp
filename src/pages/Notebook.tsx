import { useEffect, useState } from 'react'
import { useVocabStore } from '../store/useVocabStore'
import { extractClassDate, parseNotes } from '../lib/notesParser'
import * as storage from '../lib/storage'
import { localDateString } from '../lib/week'
import type { GrammarTopic, HomeworkTask, NotebookEntry } from '../lib/types'

function today() {
  return localDateString()
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Notebook() {
  const { addWords } = useVocabStore()
  const [classDate, setClassDate] = useState(today())
  const [dateAutoDetected, setDateAutoDetected] = useState(false)
  const [dateManual, setDateManual] = useState(false)
  const [rawText, setRawText] = useState('')
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [lastResult, setLastResult] = useState<{ vocabCount: number; taskCount: number; grammarSaved: boolean } | null>(
    null,
  )
  const [openEntry, setOpenEntry] = useState<string | null>(null)

  useEffect(() => {
    storage.getNotebookEntries().then(setEntries)
  }, [])

  // Se detecta al escribir o pegar (no al salir del cuadro: en iPhone tocar un botón puede no contar como salir).
  // Si vos elegís la fecha a mano, esa manda.
  function handleNotesChange(text: string) {
    setRawText(text)
    if (dateManual) return
    const detected = extractClassDate(text)
    if (detected) {
      setClassDate(detected)
      setDateAutoDetected(true)
    } else if (dateAutoDetected) {
      setClassDate(today())
      setDateAutoDetected(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!rawText.trim()) return
    setSaving(true)
    try {
      // Red de seguridad: se vuelve a mirar el texto al guardar, salvo que hayas elegido la fecha a mano.
      const finalDate = (dateManual ? classDate : (extractClassDate(rawText) ?? classDate)) || today()
      const { vocab, tasks, grammar } = parseNotes(rawText)
      const validVocab = vocab.filter((v) => v.translation.trim())

      if (validVocab.length > 0) {
        await addWords(validVocab)
      }

      for (const taskText of tasks) {
        const task: HomeworkTask = {
          id: crypto.randomUUID(),
          text: taskText,
          done: false,
          createdAt: new Date().toISOString(),
          classDate: finalDate,
        }
        await storage.saveHomeworkTask(task)
      }

      if (grammar.length > 0) {
        const topic: GrammarTopic = {
          id: crypto.randomUUID(),
          title: `Clase del ${formatDate(finalDate)}`,
          notes: grammar.join('\n'),
          createdAt: new Date().toISOString(),
        }
        await storage.saveGrammarTopic(topic)
      }

      const entry: NotebookEntry = {
        id: crypto.randomUUID(),
        classDate: finalDate,
        rawText,
        createdAt: new Date().toISOString(),
        vocabCount: validVocab.length,
        taskCount: tasks.length,
        grammarSaved: grammar.length > 0,
      }
      await storage.saveNotebookEntry(entry)
      setEntries([entry, ...entries])
      setLastResult({ vocabCount: validVocab.length, taskCount: tasks.length, grammarSaved: grammar.length > 0 })
      setRawText('')
      setClassDate(today())
      setDateAutoDetected(false)
      setDateManual(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">
        Pegá tus apuntes tal cual los tomás en clase. Al guardar, la app separa sola el vocabulario nuevo, las
        tareas para la semana (a la pestaña de Tareas) y manda el resto a Gramática. Si escribís algo como
        "Clase 13/09", "Domingo 13/09" o "13 de septiembre" (día y mes, en una línea), detecta la fecha sola.
      </p>

      <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <label className="mb-1 block text-sm text-slate-400">
          Fecha de la clase {dateAutoDetected && <span className="text-emerald-400">(detectada del texto)</span>}
        </label>
        <input
          type="date"
          value={classDate}
          onChange={(e) => {
            setClassDate(e.target.value)
            setDateAutoDetected(false)
            setDateManual(true)
          }}
          className="mb-3 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
        />
        <textarea
          value={rawText}
          onChange={(e) => handleNotesChange(e.target.value)}
          rows={8}
          placeholder={
            'run - correr\nto give up: rendirse\nPresent perfect se usa para experiencias sin decir cuándo pasaron\nPracticar diferencia entre yet y already'
          }
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={saving || !rawText.trim()}
          className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar clase'}
        </button>

        {lastResult && (
          <p className="mt-3 text-sm text-emerald-400">
            Guardado: {lastResult.vocabCount} palabra(s)
            {lastResult.taskCount > 0 && `, ${lastResult.taskCount} tarea(s)`}
            {lastResult.grammarSaved ? ' y notas de gramática agregadas.' : '.'}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-white">Clases anteriores ({entries.length})</h2>
        {entries.length === 0 && <p className="text-sm text-slate-400">Todavía no guardaste ninguna clase.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <button
              onClick={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-medium text-white">{formatDate(entry.classDate)}</span>
              <span className="text-xs text-slate-500">
                {entry.vocabCount} palabra(s)
                {entry.taskCount > 0 && ` · ${entry.taskCount} tarea(s)`}
                {entry.grammarSaved && ' · gramática'}
              </span>
            </button>
            {openEntry === entry.id && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{entry.rawText}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
