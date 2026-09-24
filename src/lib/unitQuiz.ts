import { shuffle } from './shuffle'

/** Puntaje mínimo (en %) para dar la unidad por completada. */
export const PASS_SCORE = 70
export const QUIZ_LENGTH = 10

export interface QuizWord {
  term: string
  translation: string
}

export type QuestionKind = 'meaning' | 'reverse' | 'listen'

export interface QuizQuestion {
  kind: QuestionKind
  /** La palabra que se está preguntando (para registrar el acierto). */
  term: string
  prompt: string
  options: string[]
  answer: string
  /** Texto que se lee en voz alta (preguntas de escuchar). */
  speak?: string
}

const KINDS_WITH_AUDIO: QuestionKind[] = ['meaning', 'reverse', 'listen']
const KINDS_WITHOUT_AUDIO: QuestionKind[] = ['meaning', 'reverse']

// Las traducciones pueden traer varias opciones ("café, marrón"): para no dar la respuesta por el largo o por
// repetirse, se comparan tal cual y se descartan opciones idénticas.
function distractors(pool: string[], answer: string, count: number, rng: () => number): string[] {
  const unique = [...new Set(pool)].filter((o) => o !== answer)
  const mixed = shuffle(unique, rng)
  return mixed.slice(0, count)
}

/** Arma una mini-prueba con palabras de la unidad: significado, al revés y (si hay voz) escuchar. */
export function buildQuiz(words: QuizWord[], opts: { count?: number; audio?: boolean; rng?: () => number } = {}): QuizQuestion[] {
  const rng = opts.rng ?? Math.random
  const count = Math.min(opts.count ?? QUIZ_LENGTH, words.length)
  const kinds = opts.audio ? KINDS_WITH_AUDIO : KINDS_WITHOUT_AUDIO
  const picked = shuffle(words, rng).slice(0, count)

  return picked.map((w, i): QuizQuestion => {
    const kind = kinds[i % kinds.length]
    const others = words.filter((o) => o.term !== w.term)
    if (kind === 'meaning') {
      const options = shuffle([w.translation, ...distractors(others.map((o) => o.translation), w.translation, 3, rng)], rng)
      return { kind, term: w.term, prompt: w.term, options, answer: w.translation }
    }
    const options = shuffle([w.term, ...distractors(others.map((o) => o.term), w.term, 3, rng)], rng)
    if (kind === 'reverse') return { kind, term: w.term, prompt: w.translation, options, answer: w.term }
    return { kind, term: w.term, prompt: '', options, answer: w.term, speak: w.term }
  })
}

/** Porcentaje (0 a 100) de respuestas buenas. */
export function scorePercent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100)
}

export function isPassing(score: number): boolean {
  return score >= PASS_SCORE
}
