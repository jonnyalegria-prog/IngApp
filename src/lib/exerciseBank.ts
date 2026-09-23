import { supabase } from './supabase'
import type { EnglishLevel } from './types'

export interface GrammarMcqContent {
  prompt: string
  options: string[]
  answer: string
  explanation: string
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

export async function getGrammarExercises(topic: string): Promise<GrammarMcqContent[]> {
  const { data, error } = await supabase.from('exercise_bank').select('content').eq('kind', 'grammar_mcq').eq('topic', topic)
  if (error) throw error
  return (data ?? []).map((row: any) => row.content as GrammarMcqContent)
}

export async function getDictationSentences(): Promise<DictationContent[]> {
  const { data, error } = await supabase.from('exercise_bank').select('content').eq('kind', 'dictation')
  if (error) throw error
  return (data ?? []).map((row: any) => row.content as DictationContent)
}

export async function getWritingPrompts(): Promise<WritingPromptContent[]> {
  const { data, error } = await supabase.from('exercise_bank').select('topic, content').eq('kind', 'writing_prompt')
  if (error) throw error
  return (data ?? []).map((row: any) => ({ ...(row.content as WritingPromptContent), topic: row.topic as string }))
}

export async function getReadingTexts(): Promise<ReadingText[]> {
  const { data, error } = await supabase.from('reading_texts').select('id, level, title, body').order('created_at')
  if (error) throw error
  return (data ?? []) as ReadingText[]
}

export async function getDialogues(): Promise<DialogueContent[]> {
  const { data, error } = await supabase.from('exercise_bank').select('content').eq('kind', 'dialogue')
  if (error) throw error
  return (data ?? []).map((row: any) => row.content as DialogueContent)
}
