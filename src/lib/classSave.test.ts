import { describe, expect, it } from 'vitest'
import { classifyNotes } from './notesParser'
import { toReviewItems } from './reviewItems'
import { findDuplicates, mergeNotes, mergeRawText, planClassSave, textKey } from './classSave'
import type { GrammarTopic, HomeworkTask } from './types'

const RAW = `tú = you
practicar la th y la r
whats your name
what do you do for a living? = (a que te dedicas?)
la g es marcada al pronunciar`

let n = 0
const newId = () => `id-${++n}`
const NOW = '2026-09-23T12:00:00.000Z'

function plan(overrides: Partial<Parameters<typeof planClassSave>[0]> = {}) {
  const items = toReviewItems(classifyNotes(RAW))
  // "whats your name" no trae significado: se completa a mano en la vista previa.
  for (const it of items) if (it.kind === 'vocab' && !it.meaning) it.meaning = '¿cómo te llamas?'
  return planClassSave({
    date: '2026-07-26',
    dateLabel: '26 de julio de 2026',
    rawText: RAW,
    items,
    hasTerm: () => false,
    tasks: [],
    topics: [],
    replaceRaw: false,
    now: NOW,
    newId,
    ...overrides,
  })
}

describe('planClassSave', () => {
  it('una clase nueva guarda todo', () => {
    const p = plan()
    expect(p.vocab.map((v) => v.term)).toEqual(['you', 'whats your name', 'what do you do for a living?'])
    expect(p.tasks).toEqual(['practicar la th y la r'])
    expect(p.topic?.title).toBe('Clase del 26 de julio de 2026')
    expect(p.topic?.notes).toBe('la g es marcada al pronunciar')
    expect(p.entry).toMatchObject({ classDate: '2026-07-26', vocabCount: 3, taskCount: 1, grammarSaved: true })
  })

  it('guardar lo mismo por segunda vez no duplica nada y conserva el mismo registro', () => {
    const first = plan()
    const have = new Set(first.vocab.map((v) => v.term.toLowerCase()))
    const tasks: HomeworkTask[] = first.tasks.map((text, i) => ({
      id: `t${i}`,
      text,
      done: false,
      createdAt: NOW,
      classDate: '2026-07-26',
    }))
    const second = plan({
      hasTerm: (t) => have.has(t.trim().toLowerCase()),
      tasks,
      topics: [first.topic as GrammarTopic],
      entry: first.entry,
    })
    expect(second.vocab).toEqual([])
    expect(second.vocabSkipped).toBe(3)
    expect(second.tasks).toEqual([])
    expect(second.tasksSkipped).toBe(1)
    expect(second.topic).toBeNull()
    expect(second.entry).toEqual(first.entry)
  })

  it('al reprocesar una clase solo se agrega lo nuevo y se suman los contadores', () => {
    const first = plan()
    const more = `${RAW}\nto give up = rendirse\nla h no se pronuncia`
    const items = toReviewItems(classifyNotes(more))
    for (const it of items) if (it.kind === 'vocab' && !it.meaning) it.meaning = '¿cómo te llamas?'
    const have = new Set(first.vocab.map((v) => v.term.toLowerCase()))
    const second = planClassSave({
      date: '2026-07-26',
      dateLabel: '26 de julio de 2026',
      rawText: more,
      items,
      hasTerm: (t) => have.has(t.trim().toLowerCase()),
      tasks: [{ id: 't', text: 'practicar la th y la r', done: false, createdAt: NOW, classDate: '2026-07-26' }],
      topics: [first.topic as GrammarTopic],
      entry: first.entry,
      replaceRaw: true,
      now: NOW,
      newId,
    })
    expect(second.vocab).toEqual([{ term: 'to give up', translation: 'rendirse' }])
    expect(second.topic?.notes).toBe('la g es marcada al pronunciar\nla h no se pronuncia')
    expect(second.topic?.id).toBe(first.topic?.id)
    expect(second.entry.id).toBe(first.entry.id)
    expect(second.entry.vocabCount).toBe(4)
    expect(second.entry.rawText).toBe(more)
  })

  it('las palabras repetidas dentro del mismo texto se guardan una sola vez', () => {
    const items = toReviewItems(classifyNotes('tú = you\nustedes = you\nrun - correr'))
    const p = plan({ items })
    expect(p.vocab.map((v) => v.term)).toEqual(['you', 'run'])
    expect(p.vocabSkipped).toBe(1)
  })

  it('las palabras sin significado no se guardan y se cuentan aparte', () => {
    const items = toReviewItems(classifyNotes('to give up\nrun - correr'))
    const p = plan({ items })
    expect(p.vocab).toEqual([{ term: 'run', translation: 'correr' }])
    expect(p.vocabWithoutMeaning).toBe(1)
  })
})

describe('helpers', () => {
  it('textKey ignora mayúsculas, espacios y puntuación final', () => {
    expect(textKey('  Practicar   la TH. ')).toBe('practicar la th')
    expect(textKey('¿Cómo estás?')).toBe('¿cómo estás')
  })

  it('findDuplicates marca lo que ya existe y lo repetido', () => {
    const items = toReviewItems(classifyNotes('run - correr\nrun - correr\nsee - ver algo\npracticar la th'))
    const dup = findDuplicates(items, (t) => t.toLowerCase() === 'see', new Set(['practicar la th']))
    expect(items.filter((it) => dup.has(it.id)).map((it) => it.text)).toEqual(['run - correr', 'see - ver algo', 'practicar la th'])
  })

  it('mergeNotes solo agrega líneas nuevas', () => {
    expect(mergeNotes('a\nb', ['B.', 'c', 'c'])).toEqual({ notes: 'a\nb\nc', added: 1 })
  })

  it('mergeRawText no repite apuntes ya guardados', () => {
    expect(mergeRawText('a\nb', 'a\nb')).toBe('a\nb')
    expect(mergeRawText('a', 'a\nb')).toBe('a\nb')
    expect(mergeRawText('a\nb', 'a')).toBe('a\nb')
    expect(mergeRawText('a', 'c')).toBe('a\nc')
  })
})
