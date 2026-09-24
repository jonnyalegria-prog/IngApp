import type { GrammarTopic, HomeworkTask, NotebookEntry } from './types'
import type { ReviewItem } from './reviewItems'

/** Clave para comparar palabras: sin espacios de más y sin distinguir mayúsculas. */
export function termKey(term: string): string {
  return term.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Clave para comparar líneas de texto (tareas, notas): además ignora la puntuación del final. */
export function textKey(text: string): string {
  return termKey(text).replace(/[\s.!?¿¡,;:]+$/, '')
}

/**
 * Qué líneas de la vista previa ya existen (o están repetidas dentro del mismo texto): esas no se vuelven
 * a guardar. Así guardar dos veces la misma clase, o reprocesarla, no duplica nada.
 */
export function findDuplicates(items: ReviewItem[], hasTerm: (term: string) => boolean, taskKeys: Set<string>): Set<string> {
  const dup = new Set<string>()
  const seenTerms = new Set<string>()
  const seenTasks = new Set<string>()
  for (const it of items) {
    if (it.kind === 'vocab' && it.term.trim()) {
      const key = termKey(it.term)
      if (hasTerm(it.term) || seenTerms.has(key)) dup.add(it.id)
      else seenTerms.add(key)
    } else if (it.kind === 'task' && it.text.trim()) {
      const key = textKey(it.text)
      if (taskKeys.has(key) || seenTasks.has(key)) dup.add(it.id)
      else seenTasks.add(key)
    }
  }
  return dup
}

export function classTitle(dateLabel: string): string {
  return `Clase del ${dateLabel}`
}

/** Agrega a las notas de un tema las líneas que todavía no tiene. */
export function mergeNotes(existing: string, incoming: string[]): { notes: string; added: number } {
  const seen = new Set(existing.split('\n').map(textKey).filter(Boolean))
  const fresh: string[] = []
  for (const line of incoming) {
    const key = textKey(line)
    if (!key || seen.has(key)) continue
    seen.add(key)
    fresh.push(line.trim())
  }
  return { notes: [existing.trim(), ...fresh].filter(Boolean).join('\n'), added: fresh.length }
}

/** Une los apuntes de una clase que ya estaba guardada con los que llegan ahora. */
export function mergeRawText(saved: string, incoming: string): string {
  const a = saved.trim()
  const b = incoming.trim()
  if (!a) return b
  if (!b || a === b || a.includes(b)) return a
  if (b.includes(a)) return b
  return `${a}\n${b}`
}

export interface ClassSaveInput {
  date: string
  dateLabel: string
  rawText: string
  items: ReviewItem[]
  hasTerm: (term: string) => boolean
  tasks: HomeworkTask[]
  topics: GrammarTopic[]
  /** La clase ya guardada que se está editando o que tiene la misma fecha. */
  entry?: NotebookEntry
  /** Se está editando esa clase: sus apuntes se reemplazan en vez de sumarse. */
  replaceRaw: boolean
  now: string
  newId: () => string
}

export interface ClassSavePlan {
  vocab: { term: string; translation: string }[]
  vocabSkipped: number
  vocabWithoutMeaning: number
  tasks: string[]
  tasksSkipped: number
  /** Tema de gramática para crear o actualizar (null si no hay nada nuevo). */
  topic: GrammarTopic | null
  grammarAdded: number
  entry: NotebookEntry
}

/** Decide qué se guarda de una clase, sin tocar la base de datos. Guardar dos veces lo mismo no cambia nada. */
export function planClassSave(input: ClassSaveInput): ClassSavePlan {
  const { date, items, entry } = input
  const taskKeys = new Set(input.tasks.filter((t) => t.classDate === date).map((t) => textKey(t.text)))
  const dup = findDuplicates(items, input.hasTerm, taskKeys)

  const vocabItems = items.filter((it) => it.kind === 'vocab' && it.term.trim())
  const vocab = vocabItems
    .filter((it) => it.meaning.trim() && !dup.has(it.id))
    .map((it) => ({ term: it.term.trim(), translation: it.meaning.trim() }))
  const vocabSkipped = vocabItems.filter((it) => it.meaning.trim() && dup.has(it.id)).length
  const vocabWithoutMeaning = items.filter(
    (it) => it.kind === 'vocab' && !dup.has(it.id) && !(it.term.trim() && it.meaning.trim()),
  ).length

  const taskItems = items.filter((it) => it.kind === 'task' && it.text.trim())
  const tasks = taskItems.filter((it) => !dup.has(it.id)).map((it) => it.text.trim())
  const tasksSkipped = taskItems.length - tasks.length

  const grammarLines = items.filter((it) => it.kind === 'grammar' && it.text.trim()).map((it) => it.text.trim())
  const title = classTitle(input.dateLabel)
  const existingTopic = input.topics.find((t) => t.title === title)
  let topic: GrammarTopic | null = null
  let grammarAdded = 0
  if (grammarLines.length > 0) {
    if (existingTopic) {
      const merged = mergeNotes(existingTopic.notes, grammarLines)
      grammarAdded = merged.added
      if (merged.added > 0) topic = { ...existingTopic, notes: merged.notes }
    } else {
      const merged = mergeNotes('', grammarLines)
      grammarAdded = merged.added
      topic = { id: input.newId(), title, notes: merged.notes, createdAt: input.now }
    }
  }

  const rawText = entry && !input.replaceRaw ? mergeRawText(entry.rawText, input.rawText) : input.rawText.trim()
  const savedEntry: NotebookEntry = entry
    ? {
        ...entry,
        classDate: date,
        rawText,
        vocabCount: entry.vocabCount + vocab.length,
        taskCount: entry.taskCount + tasks.length,
        grammarSaved: entry.grammarSaved || grammarAdded > 0,
      }
    : {
        id: input.newId(),
        classDate: date,
        rawText,
        createdAt: input.now,
        vocabCount: vocab.length,
        taskCount: tasks.length,
        grammarSaved: grammarAdded > 0,
      }

  return { vocab, vocabSkipped, vocabWithoutMeaning, tasks, tasksSkipped, topic, grammarAdded, entry: savedEntry }
}
