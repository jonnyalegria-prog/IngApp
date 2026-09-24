import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useVocabStore } from '../store/useVocabStore'
import { classifyNotes, extractClassDate, type ClassifiedLine } from '../lib/notesParser'
import * as storage from '../lib/storage'
import { localDateString } from '../lib/week'
import { planClassSave, textKey } from '../lib/classSave'
import { friendlyError } from '../lib/errors'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../lib/toast'
import NotesReview from '../components/NotesReview'
import LoadError from '../components/LoadError'
import type { ReviewItem } from '../lib/reviewItems'
import type { HomeworkTask, NotebookEntry } from '../lib/types'

function today() {
  return localDateString()
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface SaveSummary {
  vocabCount: number
  vocabSkipped: number
  taskCount: number
  grammarAdded: number
  withoutMeaning: number
}

interface ReviewState {
  lines: ClassifiedLine[]
  date: string
  text: string
  /** Clase guardada que se está editando (sus apuntes se reemplazan al guardar). */
  editingId?: string
  taskKeys: Set<string>
}

function sortEntries(list: NotebookEntry[]): NotebookEntry[] {
  return [...list].sort((a, b) => (a.classDate < b.classDate ? 1 : a.classDate > b.classDate ? -1 : 0))
}

export default function Notebook() {
  const toast = useToast()
  const { loaded, load: loadWords, hasTerm, addWords } = useVocabStore()
  const load = useLoad(() => storage.getNotebookEntries())
  const entries = load.data ?? []
  const [classDate, setClassDate] = useState(today())
  const [dateAutoDetected, setDateAutoDetected] = useState(false)
  const [dateManual, setDateManual] = useState(false)
  const [rawText, setRawText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastResult, setLastResult] = useState<SaveSummary | null>(null)
  const [openEntry, setOpenEntry] = useState<string | null>(null)
  // Paso intermedio: cómo separó la app tus apuntes, antes de guardar nada.
  const [review, setReview] = useState<ReviewState | null>(null)
  const [nothingFound, setNothingFound] = useState(false)

  // El vocabulario se carga acá para poder avisar qué palabras ya tienes.
  useEffect(() => {
    if (!loaded) void loadWords()
  }, [loaded, loadWords])

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

  async function handleReview(e: React.FormEvent) {
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

    // Para marcar lo que ya tienes hace falta saber qué palabras y tareas existen.
    if (!useVocabStore.getState().loaded) await loadWords()
    if (!useVocabStore.getState().loaded) {
      toast.error('No pude revisar tu vocabulario. Revisa tu conexión e intenta de nuevo.')
      return
    }
    let existingTasks: HomeworkTask[] = []
    try {
      existingTasks = await storage.getHomeworkTasks()
    } catch {
      // Sin las tareas solo no se marcan las repetidas acá; al guardar se vuelven a comparar.
    }
    setReview({
      lines,
      date,
      text: rawText,
      editingId: editingId ?? undefined,
      taskKeys: new Set(existingTasks.filter((t) => t.classDate === date).map((t) => textKey(t.text))),
    })
  }

  async function handleSave(items: ReviewItem[]) {
    if (!review) return
    setSaving(true)
    try {
      const [tasks, topics, saved] = await Promise.all([
        storage.getHomeworkTasks(),
        storage.getGrammarTopics(),
        storage.getNotebookEntries(),
      ])
      const entry = review.editingId
        ? saved.find((e) => e.id === review.editingId)
        : saved.find((e) => e.classDate === review.date)
      const plan = planClassSave({
        date: review.date,
        dateLabel: formatDate(review.date),
        rawText: review.text,
        items,
        hasTerm,
        tasks,
        topics,
        entry,
        replaceRaw: !!review.editingId,
        now: new Date().toISOString(),
        newId: () => crypto.randomUUID(),
      })

      if (plan.vocab.length > 0) await addWords(plan.vocab)
      await Promise.all(
        plan.tasks.map((text) => {
          const task: HomeworkTask = {
            id: crypto.randomUUID(),
            text,
            done: false,
            createdAt: new Date().toISOString(),
            classDate: review.date,
          }
          return storage.saveHomeworkTask(task)
        }),
      )
      if (plan.topic) await storage.saveGrammarTopic(plan.topic)
      await storage.saveNotebookEntry(plan.entry)

      load.setData((prev) => sortEntries([plan.entry, ...(prev ?? []).filter((e) => e.id !== plan.entry.id)]))
      setLastResult({
        vocabCount: plan.vocab.length,
        vocabSkipped: plan.vocabSkipped,
        taskCount: plan.tasks.length,
        grammarAdded: plan.grammarAdded,
        withoutMeaning: plan.vocabWithoutMeaning,
      })
      setRawText('')
      setClassDate(today())
      setDateAutoDetected(false)
      setDateManual(false)
      setEditingId(null)
      setReview(null)
    } catch (err) {
      toast.error(
        `${friendlyError(err, 'No pude guardar la clase.')} Puedes intentar de nuevo: lo que ya se guardó no se repite.`,
      )
    } finally {
      setSaving(false)
    }
  }

  // Vuelve a poner una clase guardada en el cuadro de texto, para corregirla o agregarle cosas.
  function editEntry(entry: NotebookEntry) {
    setRawText(entry.rawText)
    setClassDate(entry.classDate)
    setDateManual(true)
    setDateAutoDetected(false)
    setEditingId(entry.id)
    setLastResult(null)
    setNothingFound(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditing() {
    setEditingId(null)
    setRawText('')
    setClassDate(today())
    setDateManual(false)
    setDateAutoDetected(false)
  }

  if (review) {
    return (
      <NotesReview
        lines={review.lines}
        dateLabel={formatDate(review.date)}
        saving={saving}
        hasTerm={hasTerm}
        taskKeys={review.taskKeys}
        onBack={() => setReview(null)}
        onSave={handleSave}
      />
    )
  }

  const editingEntry = editingId ? entries.find((e) => e.id === editingId) : undefined

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">
        Pega tus apuntes tal cual los tomas en clase. La app separa solita el vocabulario nuevo, las tareas de la semana
        (van a la pestaña Tareas) y manda el resto a Gramática; antes de guardar te muestra cómo quedó para que lo
        revises. Si escribes algo como "Clase 13/09", "Domingo 13/09" o "13 de septiembre" (día y mes, en una línea),
        también detecta la fecha solita.
      </p>

      <form onSubmit={(e) => void handleReview(e)} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        {editingEntry && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-md border border-violet-700/40 bg-violet-950/20 p-3 text-sm text-violet-200">
            <span>
              Estás editando la clase del {formatDate(editingEntry.classDate)}. Al guardar, lo que ya tienes no se repite.
            </span>
            <button type="button" onClick={cancelEditing} className="shrink-0 text-violet-300 underline">
              Cancelar
            </button>
          </div>
        )}
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
            'run - correr\nto give up: rendirse\nWhat do you do for a living? = ¿A qué te dedicas?\nPresent perfect se usa para experiencias sin decir cuándo pasaron\nPracticar diferencia entre yet y already'
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

        {lastResult && <SavedMessage result={lastResult} />}
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-white">Clases anteriores ({entries.length})</h2>
        {load.error && !load.data && <LoadError message={load.error} onRetry={load.reload} />}
        {load.loading && <p className="text-sm text-slate-400">Cargando...</p>}
        {load.data && entries.length === 0 && <p className="text-sm text-slate-400">Aún no has guardado ninguna clase.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <button
              onClick={() => setOpenEntry(openEntry === entry.id ? null : entry.id)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={openEntry === entry.id}
            >
              <span className="font-medium text-white">{formatDate(entry.classDate)}</span>
              <span className="text-xs text-slate-400">
                {entry.vocabCount} palabra(s)
                {entry.taskCount > 0 && ` · ${entry.taskCount} tarea(s)`}
                {entry.grammarSaved && ' · gramática'}
              </span>
            </button>
            {openEntry === entry.id && (
              <div className="mt-2">
                <p className="whitespace-pre-wrap text-sm text-slate-400">{entry.rawText}</p>
                <button
                  onClick={() => editEntry(entry)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  <Pencil size={13} /> Editar y volver a revisar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SavedMessage({ result }: { result: SaveSummary }) {
  const parts: string[] = []
  if (result.vocabCount > 0) parts.push(`${result.vocabCount} palabra(s) nueva(s)`)
  if (result.taskCount > 0) parts.push(`${result.taskCount} tarea(s)`)
  if (result.grammarAdded > 0) parts.push('notas de gramática')
  const saved = parts.length > 0 ? `Guardé ${parts.join(', ')}.` : 'No había nada nuevo que guardar.'
  return (
    <p className="mt-3 text-sm text-emerald-400">
      ¡Listo! {saved}
      {result.vocabSkipped > 0 &&
        ` ${result.vocabSkipped} ya ${result.vocabSkipped === 1 ? 'la tenías' : 'las tenías'}.`}
      {result.withoutMeaning > 0 &&
        ` (${result.withoutMeaning} sin significado no se ${result.withoutMeaning === 1 ? 'guardó' : 'guardaron'})`}
    </p>
  )
}
