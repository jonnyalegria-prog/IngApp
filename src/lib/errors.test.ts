import { describe, expect, it } from 'vitest'
import { friendlyError } from './errors'

describe('friendlyError', () => {
  it('sin internet', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toContain('No hay conexión')
    expect(friendlyError(new Error('Load failed'))).toContain('No hay conexión')
  })

  it('sesión vencida', () => {
    expect(friendlyError({ message: 'JWT expired' })).toContain('sesión venció')
    expect(friendlyError(new Error('No hay sesión activa'))).toContain('sesión venció')
  })

  it('valor repetido y permisos', () => {
    expect(friendlyError({ code: '23505' })).toBe('Eso ya existe.')
    expect(friendlyError({ code: '42501' })).toContain('permiso')
  })

  it('cualquier otra cosa: mensaje genérico o el que se indique', () => {
    expect(friendlyError(new Error('boom'))).toContain('algo salió mal')
    expect(friendlyError(new Error('boom'), 'No se pudo guardar')).toBe('No se pudo guardar')
    expect(friendlyError(null)).toContain('algo salió mal')
  })
})
