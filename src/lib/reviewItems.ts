import type { ClassifiedLine } from './notesParser'

export type ReviewKind = 'vocab' | 'task' | 'grammar' | 'skip'

export interface ReviewItem {
  id: string
  kind: ReviewKind
  /** Línea de tus apuntes (tarea o gramática se editan acá). */
  text: string
  /** Vocabulario: inglés y español. */
  term: string
  meaning: string
  /** La app dio vuelta el orden porque el inglés venía a la derecha. */
  swapped?: boolean
  /** DeepL devolvió la misma palabra: probablemente ya era español. */
  sameWord?: boolean
}

export function toReviewItems(lines: ClassifiedLine[]): ReviewItem[] {
  return lines.map((l) => ({
    id: crypto.randomUUID(),
    kind: l.kind,
    text: l.text,
    term: l.term ?? '',
    meaning: l.meaning ?? '',
    swapped: l.swapped,
  }))
}
