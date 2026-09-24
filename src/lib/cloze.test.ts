import { describe, expect, it } from 'vitest'
import { generateCloze, generateClozeSet } from './cloze'

describe('generateCloze', () => {
  it('tapa la primera palabra de gramática de una oración en inglés', () => {
    expect(generateCloze('I will call you tomorrow')).toMatchObject({ prompt: 'I ___ call you tomorrow', answer: 'will' })
    expect(generateCloze('She is my sister')).toMatchObject({ prompt: 'She ___ my sister', answer: 'is' })
    expect(generateCloze('I have been to Chile')).toMatchObject({ answer: 'have been' })
    expect(generateCloze('go to')).toBeNull() // demasiado corta
  })

  it('prefiere la expresión más larga ("going to" antes que "to")', () => {
    expect(generateCloze('I am going to study tonight')?.answer).toBe('going to')
    expect(generateCloze('We are going to travel')?.prompt).toBe('We are ___ travel')
  })

  it.each([
    'APRENDER DURANTE EL TIEMPO',
    'practicar la th y la r',
    'siempre decir pronombres al hablar',
    'en ingles tu eres la edad ( i am)',
    'Practicar diferencia entre yet y already',
    'Present perfect se usa para experiencias sin decir cuándo pasaron',
  ])('ignora la línea en español: %s', (line) => {
    expect(generateCloze(line)).toBeNull()
  })

  it('quita la traducción en español del enunciado', () => {
    const c = generateCloze('what do you do for a living? = (a que te dedicas?)')
    expect(c?.prompt).toBe('what ___ you do for a living?')
    expect(c?.prompt).not.toContain('dedicas')
  })

  it('no toca una pareja inglés - inglés', () => {
    expect(generateCloze('I have been to Chile - he estado en Chile')?.prompt).toBe('I ___ to Chile')
  })
})

describe('generateClozeSet', () => {
  it('no repite enunciados y respeta el orden', () => {
    const set = generateClozeSet(['I will call you tomorrow', 'I will call you tomorrow', 'She is my sister', 'Practicar to be'])
    expect(set.map((c) => c.answer)).toEqual(['will', 'is'])
  })
})
