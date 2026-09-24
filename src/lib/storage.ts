import { supabase } from './supabase'
import { cached, invalidate } from './cache'
import { daysBetween, localDateString } from './week'
import type {
  AppSettings,
  EnglishLevel,
  GrammarTopic,
  HomeworkTask,
  DiscoveryPick,
  NotebookEntry,
  PracticeRow,
  Word,
} from './types'

// v2 is always cloud-backed (Supabase) — no local-only fallback like v1,
// since both users need sync from day one and offline was declared
// unnecessary in the requirements.

export const STREAK_UPDATED_EVENT = 'ingapp:streak-updated'

// Cuánto dura una lectura en memoria (ver cache.ts). Las escrituras la invalidan antes.
const READ_TTL = 15_000

/** Error de la base por un valor repetido (índice único). */
export function isDuplicateError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

// --- Palabras -------------------------------------------------------------

function mapWord(row: any): Word {
  return {
    id: row.id,
    term: row.term,
    translation: row.translation,
    example: row.example ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    interval: row.interval,
    repetitions: row.repetitions,
    easeFactor: Number(row.ease_factor),
    dueDate: row.due_date,
    lastReviewed: row.last_reviewed ?? undefined,
  }
}

function wordToRow(word: Word) {
  return {
    id: word.id,
    term: word.term,
    translation: word.translation,
    example: word.example ?? null,
    notes: word.notes ?? null,
    created_at: word.createdAt,
    interval: word.interval,
    repetitions: word.repetitions,
    ease_factor: word.easeFactor,
    due_date: word.dueDate,
    last_reviewed: word.lastReviewed ?? null,
  }
}

export async function getWords(): Promise<Word[]> {
  const words = await cached('words', READ_TTL, async () => {
    const { data, error } = await supabase.from('words').select('*').order('created_at')
    if (error) throw error
    return (data ?? []).map(mapWord)
  })
  return words.slice()
}

export async function saveWord(word: Word): Promise<void> {
  const { error } = await supabase.from('words').upsert(wordToRow(word))
  invalidate('words')
  if (error) throw error
}

export async function bulkAddWords(newWords: Word[]): Promise<void> {
  if (newWords.length === 0) return
  const { error } = await supabase.from('words').insert(newWords.map(wordToRow))
  invalidate('words')
  if (error) throw error
}

export async function deleteWord(id: string): Promise<void> {
  const { error } = await supabase.from('words').delete().eq('id', id)
  invalidate('words')
  if (error) throw error
}

// --- Gramática --------------------------------------------------------------

export async function getGrammarTopics(): Promise<GrammarTopic[]> {
  const topics = await cached('grammar', READ_TTL, async () => {
    const { data, error } = await supabase.from('grammar_topics').select('*').order('created_at')
    if (error) throw error
    return (data ?? []).map(
      (row: any): GrammarTopic => ({
        id: row.id,
        title: row.title,
        notes: row.notes ?? '',
        createdAt: row.created_at,
        lastReviewed: row.last_reviewed ?? undefined,
      }),
    )
  })
  return topics.slice()
}

export async function saveGrammarTopic(topic: GrammarTopic): Promise<void> {
  const { error } = await supabase.from('grammar_topics').upsert({
    id: topic.id,
    title: topic.title,
    notes: topic.notes || null,
    created_at: topic.createdAt,
    last_reviewed: topic.lastReviewed ?? null,
  })
  invalidate('grammar')
  if (error) throw error
}

export async function deleteGrammarTopic(id: string): Promise<void> {
  const { error } = await supabase.from('grammar_topics').delete().eq('id', id)
  invalidate('grammar')
  if (error) throw error
}

// --- Cuaderno ---------------------------------------------------------------

export async function getNotebookEntries(): Promise<NotebookEntry[]> {
  const entries = await cached('notebook', READ_TTL, async () => {
    const { data, error } = await supabase.from('notebook_entries').select('*').order('class_date', { ascending: false })
    if (error) throw error
    return (data ?? []).map(
      (row: any): NotebookEntry => ({
        id: row.id,
        classDate: row.class_date,
        rawText: row.raw_text,
        createdAt: row.created_at,
        vocabCount: row.vocab_count,
        taskCount: row.task_count ?? 0,
        grammarSaved: row.grammar_saved,
      }),
    )
  })
  return entries.slice()
}

/** Crea la clase o, si ya existía (mismo id), la actualiza. */
export async function saveNotebookEntry(entry: NotebookEntry): Promise<void> {
  const { error } = await supabase.from('notebook_entries').upsert({
    id: entry.id,
    class_date: entry.classDate,
    raw_text: entry.rawText,
    created_at: entry.createdAt,
    vocab_count: entry.vocabCount,
    task_count: entry.taskCount,
    grammar_saved: entry.grammarSaved,
  })
  invalidate('notebook')
  if (error) throw error
}

// --- Tareas -----------------------------------------------------------------

export async function getHomeworkTasks(): Promise<HomeworkTask[]> {
  const tasks = await cached('tasks', READ_TTL, async () => {
    const { data, error } = await supabase.from('homework_tasks').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(
      (row: any): HomeworkTask => ({
        id: row.id,
        text: row.text,
        done: row.done,
        createdAt: row.created_at,
        classDate: row.class_date ?? undefined,
        completedAt: row.completed_at ?? undefined,
        exerciseTopic: row.exercise_topic ?? undefined,
      }),
    )
  })
  return tasks.slice()
}

export async function saveHomeworkTask(task: HomeworkTask): Promise<void> {
  const { error } = await supabase.from('homework_tasks').upsert({
    id: task.id,
    text: task.text,
    done: task.done,
    created_at: task.createdAt,
    class_date: task.classDate ?? null,
    completed_at: task.completedAt ?? null,
    exercise_topic: task.exerciseTopic ?? null,
  })
  invalidate('tasks')
  if (error) throw error
}

export async function deleteHomeworkTask(id: string): Promise<void> {
  const { error } = await supabase.from('homework_tasks').delete().eq('id', id)
  invalidate('tasks')
  if (error) throw error
}

// --- Mis 3 cosas ------------------------------------------------------------

export async function getDiscoveryPicks(): Promise<DiscoveryPick[]> {
  const picks = await cached('picks', READ_TTL, async () => {
    const { data, error } = await supabase.from('discovery_picks').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(
      (row: any): DiscoveryPick => ({
        id: row.id,
        weekKey: row.week_key,
        text: row.text,
        source: row.source,
        createdAt: row.created_at,
      }),
    )
  })
  return picks.slice()
}

export async function saveDiscoveryPick(pick: DiscoveryPick): Promise<void> {
  const { error } = await supabase.from('discovery_picks').upsert({
    id: pick.id,
    week_key: pick.weekKey,
    text: pick.text,
    source: pick.source,
    created_at: pick.createdAt,
  })
  invalidate('picks')
  if (error) throw error
}

export async function deleteDiscoveryPick(id: string): Promise<void> {
  const { error } = await supabase.from('discovery_picks').delete().eq('id', id)
  invalidate('picks')
  if (error) throw error
}

// --- Ajustes y racha --------------------------------------------------------

// La sesión se lee del almacenamiento local (sin pedir nada a la red, salvo que haya que renovarla).
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('No hay sesión activa')
  return id
}

export async function getSettings(): Promise<AppSettings> {
  return cached('settings', 30_000, async () => {
    const userId = await currentUserId()
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
    if (error) throw error
    if (!data) return { streak: 0, level: 'principiante' as EnglishLevel }
    const lastPracticeDate: string | undefined = data.last_practice_date ?? undefined
    // Si pasó más de un día sin practicar, la racha ya se cortó aunque la base
    // todavía guarde el número viejo (se reinicia recién en la próxima práctica).
    const streakAlive = lastPracticeDate !== undefined && daysBetween(lastPracticeDate, localDateString()) <= 1
    return {
      streak: streakAlive ? data.streak : 0,
      lastPracticeDate,
      level: (data.level ?? 'principiante') as EnglishLevel,
    }
  })
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    streak: settings.streak,
    last_practice_date: settings.lastPracticeDate ?? null,
    level: settings.level,
  })
  invalidate('settings')
  if (error) throw error
}

export async function registerPracticeToday(): Promise<AppSettings> {
  const settings = await getSettings()
  const today = localDateString()
  if (settings.lastPracticeDate === today) return settings

  const wasYesterday = settings.lastPracticeDate !== undefined && daysBetween(settings.lastPracticeDate, today) === 1

  const updated: AppSettings = {
    ...settings,
    streak: wasYesterday ? settings.streak + 1 : 1,
    lastPracticeDate: today,
  }
  await saveSettings(updated)
  // Avisa a la barra superior para que la llama se actualice sin recargar.
  window.dispatchEvent(new Event(STREAK_UPDATED_EVENT))
  return updated
}

let practicedDay: string | null = null

// Cualquier práctica cuenta para la racha (repaso, gramática, dictado, pronunciación,
// conversación, lectura, escritura). Se llama en cada intento; solo el primero del día
// llega a la base.
export function markPracticed(): void {
  const today = localDateString()
  if (practicedDay === today) return
  practicedDay = today
  registerPracticeToday().catch(() => {
    practicedDay = null
  })
}

// Al cambiar de cuenta en el mismo navegador, el "ya practiqué hoy" no debe pasar de una a otra.
export function resetPracticeMemo(): void {
  practicedDay = null
}

// --- Registro de práctica ---------------------------------------------------
// Cada respuesta queda anotada para mostrar progreso, temas a reforzar y la meta diaria.
// Se juntan unos segundos y se mandan de una vez.

export interface PracticeEntry {
  /** vocab, grammar_mcq, grammar_cloze, dictation, dialogue, unit_quiz, listening, pronunciation */
  kind: string
  topic?: string
  item?: string
  correct: boolean
}

interface PendingEntry extends PracticeEntry {
  createdAt: string
}

const FLUSH_DELAY_MS = 2500
const MAX_PENDING = 300
let pending: PendingEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

export function logPractice(entry: PracticeEntry): void {
  pending.push({ ...entry, createdAt: new Date().toISOString() })
  if (!flushTimer) flushTimer = setTimeout(() => void flushPracticeLog(), FLUSH_DELAY_MS)
}

export async function flushPracticeLog(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (pending.length === 0) return
  const batch = pending
  pending = []
  try {
    const { error } = await supabase.from('practice_log').insert(
      batch.map((b) => ({
        kind: b.kind,
        topic: b.topic ?? null,
        item: b.item ? b.item.slice(0, 200) : null,
        correct: b.correct,
        created_at: b.createdAt,
      })),
    )
    if (error) throw error
    invalidate('log')
  } catch {
    // Sin conexión: se vuelve a intentar con la próxima tanda (con un tope para no crecer sin fin).
    pending = [...batch, ...pending].slice(-MAX_PENDING)
  }
}

/** Respuestas de práctica de los últimos `days` días, las más nuevas primero. */
export async function getPracticeLog(days = 30): Promise<PracticeRow[]> {
  await flushPracticeLog()
  const rows = await cached(`log:${days}`, 30_000, async () => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('practice_log')
      .select('kind, topic, item, correct, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(3000)
    if (error) throw error
    return (data ?? []).map(
      (r: any): PracticeRow => ({
        kind: r.kind,
        topic: r.topic ?? undefined,
        item: r.item ?? undefined,
        correct: r.correct,
        createdAt: r.created_at,
      }),
    )
  })
  return rows.slice()
}

// --- Ruta de aprendizaje ----------------------------------------------------

export interface UnitProgress {
  unitId: string
  bestScore: number
  attempts: number
  completedAt?: string
}

export async function getUnitProgress(): Promise<UnitProgress[]> {
  const rows = await cached('units', READ_TTL, async () => {
    const { data, error } = await supabase.from('unit_progress').select('unit_id, best_score, attempts, completed_at')
    if (error) throw error
    return (data ?? []).map(
      (r: any): UnitProgress => ({
        unitId: r.unit_id,
        bestScore: r.best_score,
        attempts: r.attempts,
        completedAt: r.completed_at ?? undefined,
      }),
    )
  })
  return rows.slice()
}

/** Anota el resultado de una mini-prueba: se guarda el mejor puntaje y la primera vez que se aprobó. */
export async function saveUnitResult(unitId: string, score: number, passing: boolean): Promise<UnitProgress> {
  const previous = (await getUnitProgress()).find((p) => p.unitId === unitId)
  const next: UnitProgress = {
    unitId,
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    attempts: (previous?.attempts ?? 0) + 1,
    completedAt: previous?.completedAt ?? (passing ? new Date().toISOString() : undefined),
  }
  const { error } = await supabase.from('unit_progress').upsert({
    unit_id: next.unitId,
    best_score: next.bestScore,
    attempts: next.attempts,
    completed_at: next.completedAt ?? null,
    updated_at: new Date().toISOString(),
  })
  invalidate('units')
  if (error) throw error
  return next
}
