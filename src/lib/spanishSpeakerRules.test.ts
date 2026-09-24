import { describe, expect, it } from 'vitest'
import { findSpanishSpeakerMistakes } from './spanishSpeakerRules'
import { toFeedback } from './grammarFeedback'
import type { GrammarMatch } from './languagetool'

const fix = (text: string) => findSpanishSpeakerMistakes(text).map((m) => m.suggestions[0])

describe('errores típicos de hispanohablantes', () => {
  it.each([
    ['I have 25 years.', ['I am 25 years old']],
    ['She has 30 years old.', ['She is 30 years old']],
    ['People is nice.', ['People are']],
    ['I very like pizza.', ['I really like']],
    ['I will to call you.', ['will call']],
    ['I have much friends.', ['many friends']],
    ['It depends of you.', ['depends on']],
    ['She is married with Tom.', ['married to']],
    ['Can you explain me this?', ['explain to me']],
    ['My brother have two dogs.', ['My brother has']],
    ['Yesterday I go to the doctor.', ['I went']],
    ['Last week I eat pasta and I watch a movie.', ['I ate', 'I watched']],
  ])('marca %s', (text, expected) => {
    expect(fix(text)).toEqual(expected)
  })

  it.each([
    'I am 25 years old.',
    'I have 3 years of experience.',
    'Did you go to the doctor yesterday?',
    'Does my brother have a car?',
    'I usually go to the gym, but yesterday I went to the park.',
    'I have had this phone since yesterday.',
    'Yesterday I went to the doctor.',
    'People are nice.',
    'My brother has two dogs.',
    'I really like pizza.',
    'I will call you tomorrow.',
    'We are beautiful.',
  ])('no marca la frase correcta: %s', (text) => {
    expect(findSpanishSpeakerMistakes(text)).toEqual([])
  })

  it('el verbo en pasado de verbos regulares e irregulares', () => {
    expect(fix('Yesterday she studies English.')).toEqual(['she studied'])
    expect(fix('Yesterday he plays football.')).toEqual(['he played'])
    expect(fix('Yesterday we have dinner.')).toEqual(['we had'])
  })
})

describe('toFeedback', () => {
  const lt = (over: Partial<GrammarMatch>): GrammarMatch => ({
    message: 'Original message',
    shortMessage: 'Short',
    offset: 0,
    length: 2,
    suggestions: ['We'],
    ruleId: 'UPPERCASE_SENTENCE_START',
    categoryId: 'CASING',
    ...over,
  })

  it('explica en español y deja la sugerencia en inglés', () => {
    const f = toFeedback('we are beautiful', lt({}), 0)
    expect(f.title).toBe('Falta una mayúscula')
    expect(f.explanation).toContain('«we»')
    expect(f.suggestions).toEqual(['We'])
    expect(f.originalMessage).toBeUndefined()
  })

  it('muestra el "don\'t" completo aunque LanguageTool marque solo "do"', () => {
    const f = toFeedback("She don't know", lt({ ruleId: 'HE_VERB_AGR', categoryId: 'GRAMMAR', offset: 4, length: 2, suggestions: ['does', 'did'] }), 0)
    expect(f.fragment).toBe("don't")
    expect(f.suggestions).toEqual(["doesn't", "didn't"])
  })

  it('con una regla desconocida cae en un texto por categoría y conserva el mensaje original', () => {
    const f = toFeedback('I has a dog', lt({ ruleId: 'OTRA_REGLA', categoryId: 'GRAMMAR', offset: 2, length: 3, suggestions: ['have'] }), 0)
    expect(f.title).toBe('Revisa la gramática')
    expect(f.originalMessage).toBe('Original message')
  })

  it('las sugerencias de estilo se marcan como opcionales', () => {
    const f = toFeedback('It is very good', lt({ ruleId: 'X', categoryId: 'STYLE', offset: 6, length: 4, suggestions: ['excellent'] }), 0)
    expect(f.optional).toBe(true)
  })

  it('recorta el contexto sin mostrar media palabra', () => {
    const text = 'This is a very long sentence that keeps going and going so we are beautiful and happy all day long'
    const f = toFeedback(text, lt({ offset: text.indexOf('we are'), length: 2 }), 0)
    expect(f.before.startsWith('…')).toBe(true)
    expect(f.after.endsWith('…')).toBe(true)
    expect(f.fragment).toBe('we')
  })
})
