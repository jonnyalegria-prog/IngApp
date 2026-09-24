import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDue, isNewWord, newWordSrsState, reviewWord } from './srs'
import { buildReviewQueue, clearNewToday, countWaiting, markNewIntroduced, newIntroducedToday, NEW_PER_DAY } from './session'
import type { Word } from './types'

const fresh = (id = 'w', over: Partial<Word> = {}): Word => ({
  id,
  term: id,
  translation: id,
  createdAt: '2026-09-01T00:00:00Z',
  ...newWordSrsState(),
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-23T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('repaso espaciado (SM-2)', () => {
  it('contestando "Fácil" cada vez, los intervalos crecen: 1, 6, 16, 45 días', () => {
    let w = fresh()
    const intervals: number[] = []
    for (let i = 0; i < 4; i++) {
      w = reviewWord(w, 5)
      intervals.push(w.interval)
    }
    expect(intervals).toEqual([1, 6, 16, 45])
  })

  it('"Bien" (4) no cambia la facilidad; "Difícil" (3) la baja; "Fácil" (5) la sube', () => {
    expect(reviewWord(fresh(), 4).easeFactor).toBeCloseTo(2.5)
    expect(reviewWord(fresh(), 3).easeFactor).toBeCloseTo(2.36)
    expect(reviewWord(fresh(), 5).easeFactor).toBeCloseTo(2.6)
  })

  it('fallar ("Otra vez") reinicia: vuelve mañana y las repeticiones a 0', () => {
    const learned = reviewWord(reviewWord(fresh(), 5), 5)
    const failed = reviewWord(learned, 1)
    expect(failed.repetitions).toBe(0)
    expect(failed.interval).toBe(1)
    expect(isDue(failed)).toBe(false)
  })

  it('la facilidad nunca baja de 1,3', () => {
    let w = fresh()
    for (let i = 0; i < 20; i++) w = reviewWord(w, 1)
    expect(w.easeFactor).toBeCloseTo(1.3)
  })

  it('una palabra nueva vence al tiro y ya no es "nueva" después de repasarla', () => {
    const w = fresh()
    expect(isDue(w)).toBe(true)
    expect(isNewWord(w)).toBe(true)
    expect(isNewWord(reviewWord(w, 4))).toBe(false)
  })
})

describe('ronda de repaso', () => {
  const learned = (id: string, dueDaysAgo: number, over: Partial<Word> = {}) =>
    fresh(id, {
      lastReviewed: '2026-09-10T00:00:00Z',
      repetitions: 2,
      interval: 6,
      dueDate: new Date(Date.now() - dueDaysAgo * 86_400_000).toISOString(),
      ...over,
    })

  it('primero lo más atrasado, después las nuevas más antiguas', () => {
    const words = [learned('a', 1), learned('b', 5), fresh('n1', { createdAt: '2026-09-02T00:00:00Z' }), fresh('n0', { createdAt: '2026-09-01T00:00:00Z' })]
    expect(buildReviewQueue(words, 10)).toEqual(['b', 'a', 'n0', 'n1'])
  })

  it('repaso inteligente: lo que fallaste y lo que más te cuesta va antes que lo demás', () => {
    const words = [
      learned('facil', 9),
      learned('dificil', 2, { easeFactor: 1.5 }),
      learned('fallada', 1, { repetitions: 0, interval: 1 }),
    ]
    expect(buildReviewQueue(words, 0)).toEqual(['fallada', 'dificil', 'facil'])
  })

  it('respeta el cupo de nuevas', () => {
    const words = Array.from({ length: 30 }, (_, i) => fresh(`n${i}`, { createdAt: `2026-09-01T00:${String(i).padStart(2, '0')}:00Z` }))
    expect(buildReviewQueue(words, NEW_PER_DAY)).toHaveLength(NEW_PER_DAY)
    expect(buildReviewQueue(words, 0)).toHaveLength(0)
  })

  it('una ronda no pasa del máximo y deja al menos la mitad para repaso', () => {
    const words = [
      ...Array.from({ length: 25 }, (_, i) => learned(`l${i}`, i + 1)),
      ...Array.from({ length: 10 }, (_, i) => fresh(`n${i}`)),
    ]
    const queue = buildReviewQueue(words, 10, 20)
    expect(queue).toHaveLength(20)
    expect(queue.filter((id) => id.startsWith('l'))).toHaveLength(10)
    expect(queue.filter((id) => id.startsWith('n'))).toHaveLength(10)
  })

  it('no incluye lo que todavía no vence', () => {
    const later = fresh('later', { lastReviewed: '2026-09-20T00:00:00Z', dueDate: new Date(Date.now() + 86_400_000).toISOString() })
    expect(buildReviewQueue([later], 10)).toEqual([])
  })

  it('cuenta las que quedan esperando', () => {
    const words = Array.from({ length: 30 }, (_, i) => fresh(`n${i}`))
    const queue = buildReviewQueue(words, 10)
    expect(countWaiting(words, queue)).toBe(20)
  })
})

describe('palabras nuevas de hoy', () => {
  const store: Record<string, string> = {}
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('cuenta las nuevas presentadas hoy, sin repetir, y se reinicia al día siguiente', () => {
    clearNewToday()
    expect(newIntroducedToday()).toBe(0)
    markNewIntroduced('a')
    markNewIntroduced('a')
    markNewIntroduced('b')
    expect(newIntroducedToday()).toBe(2)
    vi.setSystemTime(new Date('2026-09-24T15:00:00Z'))
    expect(newIntroducedToday()).toBe(0)
  })
})
