// Comparación de dictados y de pronunciación: sin mayúsculas ni puntuación, palabra por palabra.

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.,!?;:"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface WordCheck {
  word: string
  ok: boolean
}

/** Palabras de la frase correcta, marcando cuáles no aparecieron en lo que escribiste (o dijiste). */
export function checkWords(expected: string, typed: string): WordCheck[] {
  const expectedWords = expected.trim().split(/\s+/).filter(Boolean)
  const remaining = normalizeText(typed).split(' ').filter(Boolean)
  return expectedWords.map((word) => {
    const key = normalizeText(word)
    const at = remaining.indexOf(key)
    if (at === -1) return { word, ok: false }
    remaining.splice(at, 1)
    return { word, ok: true }
  })
}

/** Qué tan parecido es lo que dijiste a la frase (0 a 1), según las palabras que coinciden. */
export function similarity(expected: string, spoken: string): number {
  const words = checkWords(expected, spoken)
  if (words.length === 0) return 0
  return words.filter((w) => w.ok).length / words.length
}

export function isCorrectDictation(expected: string, typed: string): boolean {
  return normalizeText(expected) === normalizeText(typed)
}
