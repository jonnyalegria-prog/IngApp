import { localDateString } from './week'
import type { PracticeRow } from './types'

/** Respuestas por día que cuentan como "meta cumplida". */
export const DAILY_GOAL = 10

export const KIND_LABELS: Record<string, string> = {
  vocab: 'Vocabulario',
  grammar_mcq: 'Gramática',
  grammar_cloze: 'Mis ejercicios',
  dictation: 'Dictado',
  dialogue: 'Conversación',
  listening: 'Comprensión auditiva',
  pronunciation: 'Pronunciación',
  unit_quiz: 'Ruta de aprendizaje',
  reading: 'Lectura',
  writing: 'Escritura',
}

// Sirven para la meta diaria, pero no tienen "acierto" o "error": no cuentan en la precisión.
const UNSCORED_KINDS = new Set(['reading', 'writing', 'dialogue'])

/** A qué pestaña de Practicar lleva cada tipo de práctica. */
export const KIND_TAB: Record<string, string> = {
  vocab: 'vocabulario',
  grammar_mcq: 'gramatica',
  grammar_cloze: 'gramatica',
  dictation: 'dictado',
  dialogue: 'conversacion',
  listening: 'escucha',
  pronunciation: 'pronunciacion',
  unit_quiz: 'ruta',
  reading: 'lectura',
}

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

/** Respuestas anotadas en el día (hora local). */
export function answersToday(rows: PracticeRow[], today = localDateString()): number {
  return rows.filter((r) => localDateString(new Date(r.createdAt)) === today).length
}

export interface Accuracy {
  key: string
  total: number
  correct: number
  pct: number
}

export function accuracyBy(rows: PracticeRow[], keyOf: (r: PracticeRow) => string | undefined): Accuracy[] {
  const map = new Map<string, { total: number; correct: number }>()
  for (const r of rows) {
    const key = keyOf(r)
    if (!key) continue
    const acc = map.get(key) ?? { total: 0, correct: 0 }
    acc.total++
    if (r.correct) acc.correct++
    map.set(key, acc)
  }
  return [...map.entries()].map(([key, a]) => ({ key, ...a, pct: Math.round((a.correct / a.total) * 100) }))
}

/** Precisión por tipo de práctica, de la más practicada a la menos. */
export function accuracyByKind(rows: PracticeRow[]): Accuracy[] {
  return accuracyBy(rows, (r) => (UNSCORED_KINDS.has(r.kind) ? undefined : r.kind)).sort((a, b) => b.total - a.total)
}

/** Temas con pocas respuestas buenas (con al menos `minAttempts` intentos), del más flojo al menos flojo. */
export function weakTopics(rows: PracticeRow[], minAttempts = 3, limit = 3): (Accuracy & { kind: string })[] {
  // El mismo nombre de tema puede venir de prácticas distintas: se separan por tipo.
  return accuracyBy(rows, (r) => (UNSCORED_KINDS.has(r.kind) || !r.topic ? undefined : `${r.kind}|${r.topic}`))
    .map((a) => {
      const [kind, ...topic] = a.key.split('|')
      return { ...a, kind, key: topic.join('|') }
    })
    .filter((a) => a.total >= minAttempts && a.pct < 75)
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, limit)
}

/** El último tipo de práctica que hiciste (las filas vienen de la más nueva a la más vieja). */
export function lastPracticedKind(rows: PracticeRow[]): string | null {
  return rows[0]?.kind ?? null
}

/** Palabras o frases que fallaste en su última respuesta, sin repetir (para "Repasar mis errores"). */
export function missedItems(rows: PracticeRow[], limit = 20): { kind: string; item: string }[] {
  const seen = new Set<string>()
  const out: { kind: string; item: string }[] = []
  for (const r of rows) {
    if (!r.item || UNSCORED_KINDS.has(r.kind)) continue
    const key = `${r.kind}:${r.item.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!r.correct) out.push({ kind: r.kind, item: r.item })
    if (out.length >= limit) break
  }
  return out
}

/** Proporción de la meta diaria (0 a 1). */
export function goalFraction(count: number, goal = DAILY_GOAL): number {
  return Math.max(0, Math.min(1, count / goal))
}
