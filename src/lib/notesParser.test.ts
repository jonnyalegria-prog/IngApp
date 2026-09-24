import { describe, expect, it } from 'vitest'
import { classifyNotes, extractClassDate, looksReversed, pairFromLine, parseNotes, spanishScore } from './notesParser'

// Resultado resumido de una sola línea: V = vocabulario con significado, L = vocabulario sin significado,
// T = tarea, G = gramática.
function kind(line: string): string {
  const r = classifyNotes(line)[0]
  if (!r) return '(vacío)'
  if (r.kind === 'vocab') return r.meaning ? 'V' : 'L'
  return r.kind === 'task' ? 'T' : 'G'
}

describe('extractClassDate', () => {
  const T = '2026-09-23'
  it.each([
    ['Clase 13/09', '2026-09-13'],
    ['clase 13-9-2026', '2026-09-13'],
    ['clase 13/9/26', '2026-09-13'],
    ['CLASE 3/10/2025', '2025-10-03'],
    ['Clase del 13/09', '2026-09-13'],
    ['clase: 13/09', '2026-09-13'],
    ['clase 13.09', '2026-09-13'],
    ['Clase del domingo 13/09', '2026-09-13'],
    ['Domingo 13/09', '2026-09-13'],
    ['Dom. 13/09', '2026-09-13'],
    ['mié 16/09', '2026-09-16'],
    ['13 de septiembre', '2026-09-13'],
    ['Domingo 13 de septiembre', '2026-09-13'],
    ['clase 13 de setiembre de 2026', '2026-09-13'],
    ['26/07/2026', '2026-07-26'],
  ])('reconoce %s', (text, expected) => {
    expect(extractClassDate(text, T)).toBe(expected)
  })

  it.each(['clase 31/02', 'clase 09/13', 'Domingo 45/13', 'clase 0/5', 'clase 13/09/202', 'Mi cumpleaños es el 13 de septiembre', '3.5', 'clases 3/4'])(
    'ignora %s',
    (text) => {
      expect(extractClassDate(text, T)).toBeNull()
    },
  )

  it('sin año usa el año anterior si quedaría en el futuro', () => {
    expect(extractClassDate('Clase 28/12', '2026-01-05')).toBe('2025-12-28')
    expect(extractClassDate('Clase 04/01', '2026-01-05')).toBe('2026-01-04')
  })

  it('usa la primera fecha del texto', () => {
    expect(extractClassDate('run - correr\nDomingo 20/09\nClase 13/09', T)).toBe('2026-09-20')
  })
})

describe('classifyNotes: vocabulario', () => {
  it.each([
    'run - correr',
    'to give up: rendirse',
    'beautiful (hermoso)',
    '1. apple = manzana',
    '* Monday – lunes',
    'árbol - tree',
    'hermoso (beautiful)',
    'el gato - the cat',
    'mother-in-law - suegra',
    'well-known - conocido',
    'e-mail: correo',
    '2nd - segundo',
    'run → correr',
  ])('%s es vocabulario', (line) => {
    expect(kind(line)).toBe('V')
  })

  it('pone el inglés primero y avisa que dio vuelta la pareja', () => {
    const [a, b] = classifyNotes('árbol - tree\nrun - correr')
    expect(a).toMatchObject({ term: 'tree', meaning: 'árbol', swapped: true })
    expect(b).toMatchObject({ term: 'run', meaning: 'correr', swapped: false })
  })

  it('no corta guiones dentro de una palabra ni horas', () => {
    expect(classifyNotes('mother-in-law - suegra')[0]).toMatchObject({ term: 'mother-in-law', meaning: 'suegra' })
    expect(classifyNotes('at 5:30 - a las 5:30')[0]).toMatchObject({ term: 'at 5:30' })
  })

  it('pairFromLine separa y ordena una pareja', () => {
    expect(pairFromLine('árbol - tree')).toMatchObject({ term: 'tree', meaning: 'árbol' })
    expect(pairFromLine('sin separador')).toBeNull()
  })
})

describe('classifyNotes: lo que NO es vocabulario', () => {
  it.each([
    'Present perfect - se usa para experiencias',
    'Ejemplo: I go to school every day',
    'Regla: usa did',
    'Nota: siempre con verbo en pasado',
    'I go - I went',
    'el gato - el perro',
    'Para decir los días de la semana se usa on',
    '-ed para verbos regulares',
    'Se usa el pasado simple para acciones terminadas',
  ])('%s va a Gramática', (line) => {
    expect(kind(line)).toBe('G')
  })

  it.each(['numeros', 'colores', 'familia', 'comida', 'clima', 'responsable', 'posible', 'Vocabularios', 'Vocabulario', 'Present perfect', 'run', 'give up'])(
    'la palabra sola "%s" no se toma por vocabulario en inglés',
    (line) => {
      expect(kind(line)).toBe('G')
    },
  )

  it.each(['to give up', 'beautiful', 'whats your name', 'learning'])('"%s" sí es inglés sin significado', (line) => {
    expect(kind(line)).toBe('L')
  })
})

describe('classifyNotes: tareas', () => {
  it.each(['Practicar to be', 'Ver el video de present perfect', 'Estudiar los verbos irregulares', 'Estudiar: los verbos irregulares'])(
    '%s es tarea',
    (line) => {
      expect(kind(line)).toBe('T')
    },
  )

  it('quita la etiqueta "Tarea:"', () => {
    expect(classifyNotes('Tarea: escribir 5 frases')[0]).toMatchObject({ kind: 'task', text: 'Escribir 5 frases' })
    expect(classifyNotes('Deberes - repasar to be')[0]).toMatchObject({ kind: 'task', text: 'Repasar to be' })
  })
})

describe('apuntes reales del 26/07', () => {
  const raw = `26/07/2026

tú = you
ustedes = you
siempre decir pronombres al hablar
no asumir pronunciaciones
la g es marcada al pronunciar
en ingles tu eres la edad ( i am)
practicar la th y la r
whats your name
what do you do for a living? = (a que te dedicas?)

APRENDER DURANTE EL TIEMPO
Vocabularios
numeros
colores
familia
partes de la casa
dias de la semana
meses
estaciones del año
ropa
partes del cuerpo
animales
numeros ordinales hasta el 10
profesiones
lugares de la ciudad
medios de transporte
50 verbos mas usados
adjetivos basicos con sus antonimos
clima
sentimientos
conectores basicos
comida`

  it('detecta la fecha y no deja la línea de la fecha en las notas', () => {
    expect(extractClassDate(raw, '2026-09-23')).toBe('2026-07-26')
    expect(classifyNotes(raw).some((l) => l.text.includes('26/07/2026'))).toBe(false)
  })

  it('ninguna palabra en español queda como vocabulario', () => {
    const vocab = classifyNotes(raw).filter((l) => l.kind === 'vocab')
    expect(vocab.map((l) => l.term)).toEqual(['you', 'you', 'whats your name', 'what do you do for a living?'])
  })

  it('"tú = you" se guarda con el inglés primero', () => {
    const vocab = classifyNotes(raw).filter((l) => l.kind === 'vocab' && l.meaning)
    expect(vocab.map((l) => `${l.term}=${l.meaning}`)).toEqual(['you=tú', 'you=ustedes', 'what do you do for a living?=a que te dedicas?'])
  })

  it('"50 verbos mas usados" conserva el 50', () => {
    expect(classifyNotes(raw).some((l) => l.text === '50 verbos mas usados')).toBe(true)
  })

  it('parseNotes agrupa lo que tiene significado', () => {
    const parsed = parseNotes(raw)
    expect(parsed.vocab).toHaveLength(3)
    expect(parsed.tasks).toEqual(['practicar la th y la r', 'APRENDER DURANTE EL TIEMPO'])
  })
})

describe('spanishScore', () => {
  it('positivo si suena a español, negativo si suena a inglés', () => {
    expect(spanishScore('árbol')).toBeGreaterThan(0)
    expect(spanishScore('el gato')).toBeGreaterThan(0)
    expect(spanishScore('to give up')).toBeLessThan(0)
    expect(spanishScore('the cat')).toBeLessThan(0)
    expect(spanishScore('run')).toBe(0)
  })
})

describe('classifyNotes: frases completas', () => {
  const one = (line: string) => classifyNotes(line)[0]

  it('una frase con su traducción y "=" es vocabulario (frase útil)', () => {
    const l = one('What do you do for a living? = ¿A qué te dedicas?')
    expect(l.kind).toBe('vocab')
    expect(l.term).toBe('What do you do for a living?')
    expect(l.meaning).toBe('¿A qué te dedicas?')
  })

  it('si el español viene primero, la da vuelta', () => {
    const l = one('¿De dónde eres? -> Where are you from?')
    expect(l.kind).toBe('vocab')
    expect(l.term).toBe('Where are you from?')
    expect(l.swapped).toBe(true)
  })

  it('una explicación con guion o dos puntos sigue yendo a Gramática', () => {
    expect(one('I go to school every day - se usa para rutinas de todos los días').kind).toBe('grammar')
    expect(one('Present simple: se usa para hábitos y cosas que siempre pasan').kind).toBe('grammar')
  })

  it('un lado sin pistas de español no cuenta como traducción', () => {
    expect(one('She goes to school every morning = presente simple').kind).toBe('grammar')
  })
})

describe('looksReversed', () => {
  it('detecta las palabras que quedaron con el español arriba', () => {
    expect(looksReversed('ustedes', 'you')).toBe(true)
    expect(looksReversed('tú', 'you')).toBe(true)
    expect(looksReversed('rendirse', 'to give up')).toBe(true)
  })

  it('no marca las que están bien ni las que se escriben igual en los dos idiomas', () => {
    expect(looksReversed('you', 'tú')).toBe(false)
    expect(looksReversed('to give up', 'rendirse')).toBe(false)
    expect(looksReversed('family', 'familia')).toBe(false)
    expect(looksReversed('hotel', 'hotel')).toBe(false)
    expect(looksReversed('run', 'correr')).toBe(false)
  })

  it('las palabras del banco no salen marcadas', () => {
    const pairs: [string, string][] = [
      ['red', 'rojo'], ['mother', 'madre, mamá'], ['weekend', 'fin de semana'], ['What do you do for a living?', '¿A qué te dedicas?'],
      ['to look', 'mirar'], ['busy', 'ocupado'], ['sensible', 'sensato'], ['information', 'información'], ['library', 'biblioteca'],
    ]
    for (const [term, translation] of pairs) expect(looksReversed(term, translation), `${term} = ${translation}`).toBe(false)
  })
})
