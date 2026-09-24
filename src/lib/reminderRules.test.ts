import { describe, expect, it } from 'vitest'
import { decideReminders, localParts, type ReminderPrefs, type UserSnapshot } from '../../supabase/functions/send-reminders/reminderRules'

const TZ = 'America/Santiago'
const prefs: ReminderPrefs = { enabled: true, hour: 19, classEve: true, classWeekday: 0, lastDailySent: null, lastEveSent: null }
const snap: UserSnapshot = { dueWords: 5, pendingTasks: 2, practicedToday: false, streak: 0 }

// Miércoles 23/09/2026 a las 19:30 en Chile (UTC-3 en septiembre).
const wednesday7pm = new Date('2026-09-23T22:30:00Z')
// Sábado 26/09/2026 a las 19:30: la víspera de una clase en domingo.
const saturday7pm = new Date('2026-09-26T22:30:00Z')

describe('localParts', () => {
  it('convierte a la hora y el día de Chile', () => {
    expect(localParts(wednesday7pm, TZ)).toEqual({ date: '2026-09-23', hour: 19, weekday: 3 })
    // 01:30 UTC del jueves sigue siendo miércoles 22:30 en Chile.
    expect(localParts(new Date('2026-09-24T01:30:00Z'), TZ)).toEqual({ date: '2026-09-23', hour: 22, weekday: 3 })
  })

  it('la medianoche es hora 0, no 24', () => {
    expect(localParts(new Date('2026-09-24T03:05:00Z'), TZ).hour).toBe(0)
  })
})

describe('decideReminders: aviso diario', () => {
  it('avisa las palabras pendientes a la hora elegida', () => {
    const [r] = decideReminders(wednesday7pm, TZ, prefs, snap)
    expect(r.kind).toBe('daily')
    expect(r.title).toBe('📚 Te esperan 5 palabras')
    expect(r.url).toBe('/practicar?tab=vocabulario')
  })

  it('con racha larga avisa que no la pierdas', () => {
    const [r] = decideReminders(wednesday7pm, TZ, prefs, { ...snap, streak: 6, dueWords: 1 })
    expect(r.title).toBe('🔥 No pierdas tu racha de 6 días')
    expect(r.body).toContain('Te espera 1 palabra')
  })

  it('no avisa si ya practicaste hoy, si está desactivado o si ya se mandó', () => {
    expect(decideReminders(wednesday7pm, TZ, prefs, { ...snap, practicedToday: true })).toEqual([])
    expect(decideReminders(wednesday7pm, TZ, { ...prefs, enabled: false }, snap)).toEqual([])
    expect(decideReminders(wednesday7pm, TZ, { ...prefs, lastDailySent: '2026-09-23' }, snap)).toEqual([])
  })

  it('no avisa si no hay nada que repasar y no hay racha', () => {
    expect(decideReminders(wednesday7pm, TZ, prefs, { ...snap, dueWords: 0 })).toEqual([])
  })

  it('solo dentro de la ventana: antes de la hora no, y hasta 2 horas después sí (por si falló una ejecución)', () => {
    expect(decideReminders(new Date('2026-09-23T21:30:00Z'), TZ, prefs, snap)).toEqual([]) // 18:30
    expect(decideReminders(new Date('2026-09-24T00:30:00Z'), TZ, prefs, snap)).toHaveLength(1) // 21:30
    expect(decideReminders(new Date('2026-09-24T01:30:00Z'), TZ, prefs, snap)).toEqual([]) // 22:30
  })
})

describe('decideReminders: víspera de la clase', () => {
  it('el sábado avisa las tareas que faltan si la clase es el domingo', () => {
    const reminders = decideReminders(saturday7pm, TZ, prefs, { ...snap, dueWords: 0, pendingTasks: 3 })
    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({ kind: 'eve', title: '📝 Mañana es tu clase', tag: 'eve' })
    expect(reminders[0].body).toBe('Te faltan 3 tareas. ¡Todavía alcanzas a hacerlas!')
  })

  it('en singular', () => {
    const [r] = decideReminders(saturday7pm, TZ, prefs, { ...snap, dueWords: 0, pendingTasks: 1 })
    expect(r.body).toBe('Te falta 1 tarea. ¡Todavía alcanzas a hacerla!')
  })

  it('otro día, sin tareas, desactivado o ya enviado: nada', () => {
    expect(decideReminders(wednesday7pm, TZ, prefs, { ...snap, dueWords: 0 })).toEqual([])
    expect(decideReminders(saturday7pm, TZ, prefs, { ...snap, dueWords: 0, pendingTasks: 0 })).toEqual([])
    expect(decideReminders(saturday7pm, TZ, { ...prefs, classEve: false }, { ...snap, dueWords: 0 })).toEqual([])
    expect(decideReminders(saturday7pm, TZ, { ...prefs, lastEveSent: '2026-09-26' }, { ...snap, dueWords: 0 })).toEqual([])
  })

  it('con otro día de clase la víspera cambia (clase el lunes: avisa el domingo)', () => {
    const sunday7pm = new Date('2026-09-27T22:30:00Z')
    const reminders = decideReminders(sunday7pm, TZ, { ...prefs, classWeekday: 1 }, { ...snap, dueWords: 0 })
    expect(reminders.map((r) => r.kind)).toEqual(['eve'])
  })

  it('puede mandar los dos avisos a la vez', () => {
    expect(decideReminders(saturday7pm, TZ, prefs, snap).map((r) => r.kind)).toEqual(['daily', 'eve'])
  })
})
