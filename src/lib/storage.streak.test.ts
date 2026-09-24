import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// user_settings en memoria, con la misma forma de respuesta que supabase-js
const state = vi.hoisted(() => ({ row: null as null | Record<string, unknown>, upserts: 0, failAuth: false }))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: async () => (state.failAuth ? Promise.reject(new Error('offline')) : { data: { user: { id: 'u1' } } }),
      getSession: async () =>
        state.failAuth ? Promise.reject(new Error('offline')) : { data: { session: { user: { id: 'u1' } } } },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row, error: null }) }) }),
      upsert: async (r: Record<string, unknown>) => {
        state.upserts++
        state.row = { ...r }
        return { error: null }
      },
    }),
  },
}))

import { getSettings, markPracticed, registerPracticeToday, resetPracticeMemo } from './storage'
import { invalidateAll } from './cache'

const at = (iso: string) => vi.setSystemTime(new Date(iso))
const tick = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  state.row = null
  state.upserts = 0
  state.failAuth = false
  resetPracticeMemo()
  invalidateAll()
  vi.stubGlobal('window', { dispatchEvent: () => true })
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('racha', () => {
  it('cuenta el día en hora de Chile: practicar el domingo de noche es domingo', async () => {
    at('2026-09-21T01:30:00Z') // domingo 20/9, 22:30 en Santiago
    const s = await registerPracticeToday()
    expect(s.streak).toBe(1)
    expect(s.lastPracticeDate).toBe('2026-09-20')
  })

  it('sube al practicar el día siguiente y no cambia el mismo día', async () => {
    at('2026-09-21T01:30:00Z')
    await registerPracticeToday()
    at('2026-09-21T02:10:00Z')
    expect((await registerPracticeToday()).streak).toBe(1)
    expect(state.upserts).toBe(1)
    at('2026-09-21T23:00:00Z') // lunes 21, 20:00
    expect((await registerPracticeToday()).streak).toBe(2)
  })

  it('muestra 0 si faltaste un día y vuelve a 1 al practicar', async () => {
    at('2026-09-21T23:00:00Z') // lunes 21
    await registerPracticeToday()
    at('2026-09-23T13:00:00Z') // miércoles 23 (faltó el martes)
    expect((await getSettings()).streak).toBe(0)
    expect((await registerPracticeToday()).streak).toBe(1)
  })

  it('el nivel por defecto es principiante', async () => {
    expect((await getSettings()).level).toBe('principiante')
  })
})

describe('markPracticed', () => {
  it('varios intentos seguidos escriben una sola vez en la base', async () => {
    at('2026-09-21T15:00:00Z')
    for (let i = 0; i < 6; i++) markPracticed()
    await tick()
    await tick()
    expect(state.upserts).toBe(1)
    markPracticed()
    await tick()
    expect(state.upserts).toBe(1)
  })

  it('si falla (sin conexión) reintenta en el siguiente intento', async () => {
    at('2026-09-23T15:00:00Z')
    state.failAuth = true
    markPracticed()
    await tick()
    await tick()
    expect(state.upserts).toBe(0)
    state.failAuth = false
    markPracticed()
    await tick()
    await tick()
    expect(state.upserts).toBe(1)
  })

  it('cambiar de cuenta reinicia el "ya practiqué hoy"', async () => {
    at('2026-09-23T15:00:00Z')
    markPracticed()
    await tick()
    await tick()
    resetPracticeMemo()
    state.row = null
    markPracticed()
    await tick()
    await tick()
    expect(state.upserts).toBe(2)
  })
})
