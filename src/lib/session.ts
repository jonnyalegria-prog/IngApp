import { isDue, isNewWord } from './srs'
import { localDateString } from './week'
import type { Word } from './types'

/** Palabras nuevas que se presentan por día, para no juntar 30 pendientes de golpe. */
export const NEW_PER_DAY = 10
/** Tamaño máximo de una ronda de repaso. */
export const SESSION_MAX = 20

/** Repaso inteligente: lo que fallaste hace poco y lo que más te cuesta (factor de facilidad bajo) va primero. */
function hardness(word: Word): number {
  if (word.repetitions === 0) return 0
  return word.easeFactor < 2.2 ? 1 : 2
}

/**
 * Arma la ronda de repaso: primero lo que ya conocías y venció (lo que más te cuesta y lo más atrasado antes),
 * y un cupo de palabras nuevas (`newAllowed`).
 */
export function buildReviewQueue(words: Word[], newAllowed: number, max = SESSION_MAX): string[] {
  const due = words.filter(isDue)
  const learned = due
    .filter((w) => !isNewWord(w))
    .sort((a, b) => hardness(a) - hardness(b) || a.dueDate.localeCompare(b.dueDate))
  const fresh = due
    .filter(isNewWord)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, Math.max(0, newAllowed))

  // Las conocidas dejan lugar a las nuevas, pero al menos la mitad de la ronda es de repaso.
  const learnedSlots = Math.max(max - fresh.length, Math.ceil(max / 2))
  return [...learned.slice(0, learnedSlots), ...fresh].slice(0, max).map((w) => w.id)
}

/** Cuántas palabras vencidas quedan fuera de una ronda (por el cupo de nuevas o el tamaño máximo). */
export function countWaiting(words: Word[], queue: string[]): number {
  const inQueue = new Set(queue)
  return words.filter((w) => isDue(w) && !inQueue.has(w.id)).length
}

// --- Palabras nuevas presentadas hoy (por dispositivo) -------------------------------------------

const NEW_KEY = 'ingapp:new-today'

interface NewToday {
  date: string
  ids: string[]
}

function readNewToday(): NewToday {
  try {
    const raw = globalThis.localStorage?.getItem(NEW_KEY)
    const parsed = raw ? (JSON.parse(raw) as NewToday) : null
    if (parsed && parsed.date === localDateString() && Array.isArray(parsed.ids)) return parsed
  } catch {
    // sin almacenamiento o dato dañado: se empieza de cero
  }
  return { date: localDateString(), ids: [] }
}

export function newIntroducedToday(): number {
  return readNewToday().ids.length
}

export function markNewIntroduced(id: string): void {
  const state = readNewToday()
  if (state.ids.includes(id)) return
  state.ids.push(id)
  try {
    globalThis.localStorage?.setItem(NEW_KEY, JSON.stringify(state))
  } catch {
    // modo privado: el tope diario queda solo en esta ronda
  }
}

export function clearNewToday(): void {
  try {
    globalThis.localStorage?.removeItem(NEW_KEY)
  } catch {
    // nada que hacer
  }
}
