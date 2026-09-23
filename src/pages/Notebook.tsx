import { useEffect, useState } from 'react'
import { useVocabStore } from '../store/useVocabStore'
import { classifyNotes, extractClassDate, type ClassifiedLine } from '../lib/notesParser'
import * as storage from '../lib/storage'
import { localDateString } from '../lib/week'
import NotesReview, { type ReviewItem } from '../components/NotesReview'
import type { GrammarTopic, HomeworkTask, NotebookEntry } from '../lib/types'

function today() {
  return localDateString()
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface SaveSummary {
  vocabCount: number
  taskCount: number
  grammarSaved: boolean
  withoutMeaning: number
}

export default function Notebook() {
  const { addWords } = useVocabStore()
  const [classDate, setClassDate] = useState(today())
  const [dateAutoDetected, setDateAutoDetected] = useState(false)
  const [dateManual, setDateManual] = useState(false)
  const [rawText, setRawText] = useState('')
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [lastResult, setLastResult] = useState<SaveSummary | null>(null)
  const [openEntry, setOpenEntry] = useState<string | null>(null)
  // Paso intermedio: cómo separó la app tus apuntes, antes de guardar nada.
  const [review, setReview] = useState<{ lines: ClassifiedLine[]; date: string } | null>(null)
  const [nothingFound, setNothingFound] = useState(false)

  useEffect(() => {
    storage.getNotebookEntries().then(setEntries)
  }, [])

  // Se detecta al escribir o pegar (no al salir del cuadro: en iPhone tocar un botón puede no contar como salir).
  // Si eliges la fecha a mano, esa manda.
  function handleNotesChange(text: string) {
    setRawText(text)
    setNothingFound(false)
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

  function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!rawText.trim()) return
    // Red de seguridad: se vuelve a mirar el texto, salvo que hayas elegido la fecha a mano.
    const date = (dateManual ? classDate : (extractClassDate(rawText) ?? classDate)) || today()
    const lines = classifyNotes(rawText)
    if (lines.length === 0) {
      setNothingFound(true)
      return
    }
    setNothingFound(false)
    setLastResult(null)
    setReview({ lines, date })
  }

  async function handleSave(items: ReviewItem[]) {
    if (!review) return
    setSaving(true)
    try {
      const finalDate = review.date
      const vocab = items
        .filter((it) => it.kind === 'vocab' && it.term.trim() && it.meaning.trim())
        .map((it) => ({ term: it.term.trim(), translation: it.meaning.trim() }))
      const withoutMeaning = items.filter((it) => it.kind === 'vocab' && !(it.term.trim() && it.meaning.trim())).length
      const tasks = items.filter((it) => it.kind === 'task' && it.text.trim()).map((it) => it.text.trim())
      const grammar = items.filter((it) => it.kind === 'grammar' && it.text.trim()).map((it) => it.text.trim())

      if (vocab.length > 0) {
        await addWords(vocab)
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
        vocabCount: vocab.length,
        taskCount: tasks.length,
        grammarSaved: grammar.length > 0,
      }
      await storage.saveNotebookEntry(entry)
      setEntries([entry, ...entries])
      setLastResult({ vocabCount: vocab.length, taskCount: tasks.length, grammarSaved: grammar.length > 0, withoutMeaning })
      setRawText('')
      setClassDate(today())
      setDateAutoDetected(false)
      setDateManual(false)
      setReview(null)
    } finally {
      setSaving(false)
    }
  }

  if (review) {
    return (
      <NotesReview
        lines={review.lines}
        dateLabel={formatDate(review.date)}
        saving={saving}
        onBack={() => setReview(null)}
        onSave={handleSave}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">
        Pega tus apuntes tal cual los tomas en clase. La app separa solita el vocabulario nuevo, las tareas de la semana
        (van a la pestaña Tareas) y manda el resto a Gramática; antes de guardar te muestra cómo quedó para que lo
        revises. Si escribes algo como "Clase 13/09", "Domingo 13/09" o "13 de septiembre" (día y mes, en una línea),
        también detecta la fecha solita.
      </p>

      <form onSubmit={handleReview} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
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
          disabled={!rawText.trim()}
          className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Revisar y guardar
        </button>

        {nothingFound && (
          <p className="mt-3 text-sm text-amber-400">
            No encontré nada para guardar en ese texto. Pega tus apuntes de la clase (una idea por línea).
          </p>
        )}

        {lastResult && (
          <p className="mt-3 text-sm text-emerald-400">
            ¡Listo! Guardé {lastResult.vocabCount} palabra(s)
            {lastResult.taskCount > 0 && `, ${lastResult.taskCount} tarea(s)`}
            {lastResult.grammarSaved ? ' y las notas de gramática.' : '.'}
            {lastResult.withoutMeaning > 0 &&
              ` (${lastResult.withoutMeaning} sin significado no se ${lastResult.withoutMeaning === 1 ? 'guardó' : 'guardaron'})`}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-white">Clases anteriores ({entries.length})</h2>
        {entries.length === 0 && <p className="text-sm text-slate-400">Aún no has guardado ninguna clase.</p>}
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
