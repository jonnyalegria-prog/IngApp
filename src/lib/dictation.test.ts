import { describe, expect, it } from 'vitest'
import { checkWords, isCorrectDictation, normalizeText, similarity } from './dictation'

describe('dictation', () => {
  it('normaliza mayúsculas, puntuación y apóstrofes', () => {
    expect(normalizeText('  What’s your NAME? ')).toBe("what's your name")
  })

  it('acepta la frase aunque cambien mayúsculas y puntuación', () => {
    expect(isCorrectDictation("I'm tired.", "i'm tired")).toBe(true)
    expect(isCorrectDictation('I am tired', 'I was tired')).toBe(false)
  })

  it('marca las palabras que faltaron', () => {
    expect(checkWords('She goes to school', 'she go to school')).toEqual([
      { word: 'She', ok: true },
      { word: 'goes', ok: false },
      { word: 'to', ok: true },
      { word: 'school', ok: true },
    ])
  })

  it('una palabra repetida solo cuenta las veces que la escribiste', () => {
    expect(checkWords('no no no', 'no no').map((w) => w.ok)).toEqual([true, true, false])
  })

  it('el parecido va de 0 a 1', () => {
    expect(similarity('good morning', 'good morning')).toBe(1)
    expect(similarity('good morning', 'good')).toBe(0.5)
    expect(similarity('', 'x')).toBe(0)
  })
})
