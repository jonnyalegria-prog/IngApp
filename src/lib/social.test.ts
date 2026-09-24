import { describe, expect, it, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: {} }))

import { challengeState, inviteErrorMessage, newToken, WEEKLY_GOAL, type PartnerOverview } from './social'

const stats = (answersWeek: number) => ({ streak: 1, practicedToday: true, answersWeek, wordsTotal: 10 })
const overview = (me: number, partner: number): PartnerOverview => ({ partnerName: 'Coni', me: stats(me), partner: stats(partner) })

describe('social', () => {
  it('el token tiene 32 caracteres seguros para una dirección y no se repite', () => {
    const a = newToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(newToken()).not.toBe(a)
  })

  it('el reto se cumple cuando los dos llegan a la meta de la semana', () => {
    expect(challengeState(overview(20, 10))).toMatchObject({ meFraction: 0.4, partnerFraction: 0.2, bothDone: false })
    expect(challengeState(overview(WEEKLY_GOAL, 10))).toMatchObject({ meDone: true, partnerDone: false, bothDone: false })
    expect(challengeState(overview(80, WEEKLY_GOAL))).toMatchObject({ meFraction: 1, bothDone: true })
  })

  it('los errores de la invitación salen en español amable', () => {
    expect(inviteErrorMessage({ message: 'invalid_code' })).toContain('no existe')
    expect(inviteErrorMessage({ message: 'own_code' })).toContain('tu propio código')
    expect(inviteErrorMessage({ message: 'algo raro' })).toContain('No pude')
  })
})
