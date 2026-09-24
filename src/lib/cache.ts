// Caché en memoria de lecturas: varias pantallas piden lo mismo en pocos segundos (Inicio, barra
// superior, Tareas...). Las peticiones iguales comparten un solo pedido a la base, y cualquier
// escritura invalida las lecturas de su tabla.

interface Entry {
  at: number
  promise: Promise<unknown>
}

const entries = new Map<string, Entry>()

export function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = entries.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.promise as Promise<T>
  const promise = fetcher().catch((err) => {
    entries.delete(key)
    throw err
  })
  entries.set(key, { at: Date.now(), promise })
  return promise
}

/** Borra las lecturas guardadas cuyo nombre empieza con `prefix`. */
export function invalidate(prefix: string): void {
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key)
}

export function invalidateAll(): void {
  entries.clear()
}
