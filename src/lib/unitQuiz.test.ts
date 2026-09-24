import { describe, expect, it } from 'vitest'
import { buildQuiz, isPassing, PASS_SCORE, scorePercent } from './unitQuiz'
import { findUnit, nextUnit, UNITS, wordsForUnit, type BankWord } from './units'

const words = Array.from({ length: 12 }, (_, i) => ({ term: `word${i}`, translation: `palabra${i}` }))

function seeded(seed = 7) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

describe('buildQuiz', () => {
  it('arma 10 preguntas con la respuesta entre las opciones', () => {
    const quiz = buildQuiz(words, { rng: seeded() })
    expect(quiz).toHaveLength(10)
    for (const q of quiz) {
      expect(q.options).toContain(q.answer)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.options.length).toBeLessThanOrEqual(4)
    }
  })

  it('no repite palabras', () => {
    const quiz = buildQuiz(words, { rng: seeded(3) })
    expect(new Set(quiz.map((q) => q.term)).size).toBe(quiz.length)
  })

  it('sin voz no hay preguntas de escuchar; con voz sí', () => {
    expect(buildQuiz(words, { audio: false, rng: seeded() }).some((q) => q.kind === 'listen')).toBe(false)
    const withAudio = buildQuiz(words, { audio: true, rng: seeded() })
    expect(withAudio.some((q) => q.kind === 'listen')).toBe(true)
    expect(withAudio.filter((q) => q.kind === 'listen').every((q) => q.speak === q.term)).toBe(true)
  })

  it('la pregunta de significado muestra el inglés y responde en español, y al revés', () => {
    const quiz = buildQuiz(words, { audio: false, rng: seeded(11) })
    const meaning = quiz.find((q) => q.kind === 'meaning')!
    expect(meaning.prompt).toBe(meaning.term)
    expect(meaning.answer).toBe(`palabra${meaning.term.replace('word', '')}`)
    const reverse = quiz.find((q) => q.kind === 'reverse')!
    expect(reverse.answer).toBe(reverse.term)
  })

  it('con pocas palabras usa las que hay y no repite opciones', () => {
    const few = [
      { term: 'a', translation: 'x' },
      { term: 'b', translation: 'x' },
      { term: 'c', translation: 'z' },
    ]
    const quiz = buildQuiz(few, { rng: seeded() })
    expect(quiz).toHaveLength(3)
    for (const q of quiz) expect(new Set(q.options).size).toBe(q.options.length)
  })
})

describe('puntaje', () => {
  it('70% aprueba', () => {
    expect(scorePercent(7, 10)).toBe(70)
    expect(isPassing(PASS_SCORE)).toBe(true)
    expect(isPassing(PASS_SCORE - 1)).toBe(false)
    expect(scorePercent(0, 0)).toBe(0)
  })
})

describe('unidades', () => {
  const bank: BankWord[] = [
    { term: 'two', translation: 'dos', example: '', note: null, level: 'principiante', theme: 'numeros' },
    { term: 'one', translation: 'uno', example: '', note: null, level: 'principiante', theme: 'numeros' },
    { term: 'zero', translation: 'cero', example: '', note: null, level: 'principiante', theme: 'numeros' },
    { term: 'red', translation: 'rojo', example: '', note: null, level: 'principiante', theme: 'colores' },
    { term: 'sin significado', translation: '', example: '', note: null, level: 'principiante', theme: 'numeros' },
  ]

  it('cada unidad tiene id único y al menos un tema', () => {
    expect(new Set(UNITS.map((u) => u.id)).size).toBe(UNITS.length)
    expect(UNITS.every((u) => u.themes.length > 0)).toBe(true)
  })

  it('las palabras de una unidad salen en su orden natural y sin las que no tienen significado', () => {
    const numeros = findUnit('numeros')!
    expect(wordsForUnit(numeros, bank).map((w) => w.term)).toEqual(['zero', 'one', 'two'])
  })

  it('la siguiente unidad es la primera sin completar', () => {
    expect(nextUnit(new Set())!.id).toBe(UNITS[0].id)
    expect(nextUnit(new Set([UNITS[0].id]))!.id).toBe(UNITS[1].id)
    expect(nextUnit(new Set(UNITS.map((u) => u.id)))).toBeUndefined()
  })
})
