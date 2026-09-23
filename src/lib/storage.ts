import { supabase } from './supabase'
import { daysBetween, localDateString } from './week'
import type { AppSettings, EnglishLevel, GrammarTopic, HomeworkTask, DiscoveryPick, NotebookEntry, Word } from './types'

// v2 is always cloud-backed (Supabase) — no local-only fallback like v1,
// since both users need sync from day one and offline was declared
// unnecessary in the requirements.

export const STREAK_UPDATED_EVENT = 'ingapp:streak-updated'

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
  const { data, error } = await supabase.from('words').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map(mapWord)
}

export async function saveWord(word: Word): Promise<void> {
  const { error } = await supabase.from('words').upsert(wordToRow(word))
  if (error) throw error
}

export async function bulkAddWords(newWords: Word[]): Promise<void> {
  if (newWords.length === 0) return
  const { error } = await supabase.from('words').insert(newWords.map(wordToRow))
  if (error) throw error
}

export async function deleteWord(id: string): Promise<void> {
  const { error } = await supabase.from('words').delete().eq('id', id)
  if (error) throw error
}

export async function getGrammarTopics(): Promise<GrammarTopic[]> {
  const { data, error } = await supabase.from('grammar_topics').select('*').order('created_at')
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    lastReviewed: row.last_reviewed ?? undefined,
  }))
}

export async function saveGrammarTopic(topic: GrammarTopic): Promise<void> {
  const { error } = await supabase.from('grammar_topics').upsert({
    id: topic.id,
    title: topic.title,
    notes: topic.notes || null,
    created_at: topic.createdAt,
    last_reviewed: topic.lastReviewed ?? null,
  })
  if (error) throw error
}

export async function deleteGrammarTopic(id: string): Promise<void> {
  const { error } = await supabase.from('grammar_topics').delete().eq('id', id)
  if (error) throw error
}

export async function getNotebookEntries(): Promise<NotebookEntry[]> {
  const { data, error } = await supabase.from('notebook_entries').select('*').order('class_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    classDate: row.class_date,
    rawText: row.raw_text,
    createdAt: row.created_at,
    vocabCount: row.vocab_count,
    taskCount: row.task_count ?? 0,
    grammarSaved: row.grammar_saved,
  }))
}

export async function saveNotebookEntry(entry: NotebookEntry): Promise<void> {
  const { error } = await supabase.from('notebook_entries').insert({
    id: entry.id,
    class_date: entry.classDate,
    raw_text: entry.rawText,
    created_at: entry.createdAt,
    vocab_count: entry.vocabCount,
    task_count: entry.taskCount,
    grammar_saved: entry.grammarSaved,
  })
  if (error) throw error
}

export async function getHomeworkTasks(): Promise<HomeworkTask[]> {
  const { data, error } = await supabase.from('homework_tasks').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    text: row.text,
    done: row.done,
    createdAt: row.created_at,
    classDate: row.class_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    exerciseTopic: row.exercise_topic ?? undefined,
  }))
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
  if (error) throw error
}

export async function deleteHomeworkTask(id: string): Promise<void> {
  const { error } = await supabase.from('homework_tasks').delete().eq('id', id)
  if (error) throw error
}

export async function getDiscoveryPicks(): Promise<DiscoveryPick[]> {
  const { data, error } = await supabase.from('discovery_picks').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    weekKey: row.week_key,
    text: row.text,
    source: row.source,
    createdAt: row.created_at,
  }))
}

export async function saveDiscoveryPick(pick: DiscoveryPick): Promise<void> {
  const { error } = await supabase.from('discovery_picks').insert({
    id: pick.id,
    week_key: pick.weekKey,
    text: pick.text,
    source: pick.source,
    created_at: pick.createdAt,
  })
  if (error) throw error
}

export async function deleteDiscoveryPick(id: string): Promise<void> {
  const { error } = await supabase.from('discovery_picks').delete().eq('id', id)
  if (error) throw error
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('No hay sesión activa')
  return data.user.id
}

export async function getSettings(): Promise<AppSettings> {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return { streak: 0, level: 'principiante' }
  const lastPracticeDate: string | undefined = data.last_practice_date ?? undefined
  // Si pasó más de un día sin practicar, la racha ya se cortó aunque la base
  // todavía guarde el número viejo (se reinicia recién en la próxima práctica).
  const streakAlive = lastPracticeDate !== undefined && daysBetween(lastPracticeDate, localDateString()) <= 1
  return {
    streak: streakAlive ? data.streak : 0,
    lastPracticeDate,
    level: (data.level ?? 'principiante') as EnglishLevel,
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const userId = await currentUserId()
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    streak: settings.streak,
    last_practice_date: settings.lastPracticeDate ?? null,
    level: settings.level,
  })
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
