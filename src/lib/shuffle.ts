// Fisher-Yates: devuelve una copia mezclada de la lista. `rng` permite fijar el azar en las pruebas.
export function shuffle<T>(list: T[], rng: () => number = Math.random): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
