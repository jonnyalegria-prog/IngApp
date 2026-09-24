import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cached, invalidate, invalidateAll } from './cache'

beforeEach(() => {
  invalidateAll()
  vi.useRealTimers()
})

describe('cached', () => {
  it('pedidos iguales seguidos comparten una sola lectura', async () => {
    const fetcher = vi.fn(async () => [1, 2, 3])
    const [a, b] = await Promise.all([cached('k', 1000, fetcher), cached('k', 1000, fetcher)])
    expect(a).toBe(b)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('vuelve a leer cuando pasó el tiempo', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(async () => 'x')
    await cached('k', 1000, fetcher)
    vi.setSystemTime(Date.now() + 1500)
    await cached('k', 1000, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('invalidate borra por prefijo y deja el resto', async () => {
    const tasks = vi.fn(async () => 't')
    const words = vi.fn(async () => 'w')
    await cached('tasks:all', 1000, tasks)
    await cached('words:all', 1000, words)
    invalidate('tasks')
    await cached('tasks:all', 1000, tasks)
    await cached('words:all', 1000, words)
    expect(tasks).toHaveBeenCalledTimes(2)
    expect(words).toHaveBeenCalledTimes(1)
  })

  it('si la lectura falla no se guarda el error', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('sin internet')).mockResolvedValueOnce('ok')
    await expect(cached('k', 1000, fetcher)).rejects.toThrow('sin internet')
    await expect(cached('k', 1000, fetcher)).resolves.toBe('ok')
  })
})
