import { describe, expect, it } from 'vitest'
import { accuracyByKind, answersToday, goalFraction, lastPracticedKind, missedItems, weakTopics } from './progress'
import type { PracticeRow } from './types'

function row(kind: string, correct: boolean, extra: Partial<PracticeRow> = {}): PracticeRow {
  return { kind, correct, createdAt: '2026-09-23T15:00:00.000Z', ...extra }
}

describe('progress', () => {
  it('cuenta las respuestas de hoy con hora local', () => {
    const rows = [
      row('vocab', true),
      row('vocab', false),
      row('vocab', true, { createdAt: '2026-09-22T15:00:00.000Z' }),
    ]
    expect(answersToday(rows, '2026-09-23')).toBe(2)
  })

  it('precisión por tipo, de más a menos practicado', () => {
    const rows = [row('dictation', true), row('vocab', true), row('vocab', false), row('vocab', true)]
    expect(accuracyByKind(rows)).toEqual([
      { key: 'vocab', total: 3, correct: 2, pct: 67 },
      { key: 'dictation', total: 1, correct: 1, pct: 100 },
    ])
  })

  it('temas a reforzar: con suficientes intentos y precisión baja', () => {
    const rows = [
      ...Array.from({ length: 4 }, (_, i) => row('grammar_mcq', i === 0, { topic: 'preposiciones' })),
      ...Array.from({ length: 4 }, () => row('grammar_mcq', true, { topic: 'artículos' })),
      row('grammar_mcq', false, { topic: 'can' }),
    ]
    expect(weakTopics(rows).map((t) => t.key)).toEqual(['preposiciones'])
  })

  it('último tipo practicado y errores sin repetir', () => {
    const rows = [
      row('vocab', false, { item: 'run' }),
      row('vocab', true, { item: 'run' }),
      row('dictation', false, { item: 'I am tired' }),
      row('vocab', false, { item: 'give up' }),
      row('vocab', true, { item: 'walk' }),
      row('vocab', false, { item: 'walk' }),
    ]
    expect(lastPracticedKind(rows)).toBe('vocab')
    // Cuenta la última respuesta de cada cosa: "run" se falló al final; "walk" se falló pero después se acertó.
    expect(missedItems(rows)).toEqual([
      { kind: 'vocab', item: 'run' },
      { kind: 'dictation', item: 'I am tired' },
      { kind: 'vocab', item: 'give up' },
    ])
  })

  it('la meta diaria se queda entre 0 y 1', () => {
    expect(goalFraction(5, 10)).toBe(0.5)
    expect(goalFraction(25, 10)).toBe(1)
  })
})
