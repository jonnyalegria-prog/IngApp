import { supabase } from './supabase'
import { cached } from './cache'
import type { EnglishLevel } from './types'
import type { BankWord } from './units'

// El banco es igual para todos y casi no cambia: se guarda en memoria un buen rato.
const BANK_TTL = 10 * 60_000

export interface GrammarMcqContent {
  prompt: string
  options: string[]
  answer: string
  explanation: string
}

export interface McqExercise extends GrammarMcqContent {
  topic: string
}

export interface DictationContent {
  text: string
}

export interface WritingPromptContent {
  instruction: string
  example?: string
  /** 'traduccion' | 'completar' | 'libre' */
  topic?: string
}

export interface ReadingText {
  id: string
  level: EnglishLevel
  title: string
  body: string
}

export interface DialogueNode {
  id: string
  speaker: 'npc' | 'you'
  text: string
  options: { label: string; next: string }[]
}

export interface DialogueContent {
  scenario: string
  nodes: DialogueNode[]
}

export interface ListeningQuestion {
  q: string
  options: string[]
  answer: string
}

export interface ListeningContent {
  title: string
  text: string
  questions: ListeningQuestion[]
}

// --- Temas de gramática -----------------------------------------------------

// En el orden en que conviene aprenderlos.
export const TOPIC_LABELS: Record<string, string> = {
  pronombres: 'Pronombres (I, you, he...)',
  to_be: 'Verbo to be',
  articulos: 'Artículos (a, an, the)',
  plurales: 'Plurales',
  posesivos: 'Posesivos (my, your...)',
  presente_simple: 'Presente simple',
  preguntas: 'Hacer preguntas (do / does)',
  can: "Can / can't",
  there_is: 'There is / there are',
  preposiciones: 'Preposiciones (in, on, at)',
  pasado: 'Pasado simple',
  futuro: 'Futuro (will / going to)',
}

const TOPIC_ORDER = Object.keys(TOPIC_LABELS)

export function topicLabel(topic: string): string {
  if (TOPIC_LABELS[topic]) return TOPIC_LABELS[topic]
  const text = topic.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Todos los ejercicios de opción múltiple, con su tema. */
export function getAllGrammarExercises(): Promise<McqExercise[]> {
  return cached('bank:mcq', BANK_TTL, async () => {
    const { data, error } = await supabase.from('exercise_bank').select('topic, content').eq('kind', 'grammar_mcq')
    if (error) throw error
    return (data ?? []).map((row: any) => ({ ...(row.content as GrammarMcqContent), topic: row.topic as string }))
  })
}

export async function getGrammarExercises(topic: string): Promise<GrammarMcqContent[]> {
  return (await getAllGrammarExercises()).filter((ex) => ex.topic === topic)
}

/** Temas que tienen ejercicios, en orden de aprendizaje, con cuántos ejercicios trae cada uno. */
export async function getMcqTopics(): Promise<{ topic: string; count: number }[]> {
  const counts = new Map<string, number>()
  for (const ex of await getAllGrammarExercises()) counts.set(ex.topic, (counts.get(ex.topic) ?? 0) + 1)
  const rank = (t: string) => {
    const i = TOPIC_ORDER.indexOf(t)
    return i === -1 ? TOPIC_ORDER.length : i
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => rank(a.topic) - rank(b.topic) || a.topic.localeCompare(b.topic))
}

// --- Otros ejercicios -------------------------------------------------------

export function getDictationSentences(): Promise<DictationContent[]> {
  return cached('bank:dictation', BANK_TTL, async () => {
    const { data, error } = await supabase.from('exercise_bank').select('content').eq('kind', 'dictation')
    if (error) throw error
    return (data ?? []).map((row: any) => row.content as DictationContent)
  })
}

export function getWritingPrompts(): Promise<WritingPromptContent[]> {
  return cached('bank:writing', BANK_TTL, async () => {
    const { data, error } = await supabase.from('exercise_bank').select('topic, content').eq('kind', 'writing_prompt')
    if (error) throw error
    return (data ?? []).map((row: any) => ({ ...(row.content as WritingPromptContent), topic: row.topic as string }))
  })
}

export function getReadingTexts(): Promise<ReadingText[]> {
  return cached('bank:reading', BANK_TTL, async () => {
    const { data, error } = await supabase.from('reading_texts').select('id, level, title, body').order('created_at')
    if (error) throw error
    return (data ?? []) as ReadingText[]
  })
}

export function getDialogues(): Promise<DialogueContent[]> {
  return cached('bank:dialogue', BANK_TTL, async () => {
    const { data, error } = await supabase.from('exercise_bank').select('content').eq('kind', 'dialogue')
    if (error) throw error
    return (data ?? []).map((row: any) => row.content as DialogueContent)
  })
}

export function getListeningItems(): Promise<ListeningContent[]> {
  return cached('bank:listening', BANK_TTL, async () => {
    const { data, error } = await supabase.from('exercise_bank').select('content').eq('kind', 'listening')
    if (error) throw error
    return (data ?? []).map((row: any) => row.content as ListeningContent)
  })
}

// --- Banco de vocabulario (para la ruta de aprendizaje) ----------------------

export function getBankWords(): Promise<BankWord[]> {
  return cached('bank:vocab', BANK_TTL, async () => {
    const { data, error } = await supabase.from('vocab_bank').select('term, translation, example, note, level, theme').limit(2000)
    if (error) throw error
    return (data ?? []) as BankWord[]
  })
}
