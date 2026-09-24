import { afterEach, describe, expect, it, vi } from 'vitest'
import { daysBetween, getWeekKey, localDateString } from './week'

afterEach(() => vi.useRealTimers())

describe('getWeekKey', () => {
  it('las semanas van de lunes a domingo: el domingo de clase cierra la semana', () => {
    expect(getWeekKey(new Date('2026-09-23T12:00:00'))).toBe('2026-W39') // miércoles
    expect(getWeekKey(new Date('2026-09-27T12:00:00'))).toBe('2026-W39') // domingo
    expect(getWeekKey(new Date('2026-09-28T12:00:00'))).toBe('2026-W40') // lunes
  })

  it('maneja el cambio de año', () => {
    expect(getWeekKey(new Date('2026-12-31T12:00:00'))).toBe('2026-W53')
    expect(getWeekKey(new Date('2027-01-01T12:00:00'))).toBe('2026-W53')
    expect(getWeekKey(new Date('2027-01-04T12:00:00'))).toBe('2027-W01')
  })
})

describe('localDateString', () => {
  it('usa la fecha local (Chile), no la de UTC', () => {
    // 22:30 del domingo 20/9 en Santiago (UTC-3 en septiembre) ya es lunes en UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T01:30:00Z'))
    expect(localDateString()).toBe('2026-09-20')
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-21')
  })
})

describe('daysBetween', () => {
  it('cuenta días de calendario', () => {
    expect(daysBetween('2026-09-20', '2026-09-21')).toBe(1)
    expect(daysBetween('2026-09-20', '2026-09-27')).toBe(7)
    expect(daysBetween('2026-09-21', '2026-09-20')).toBe(-1)
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })
})
