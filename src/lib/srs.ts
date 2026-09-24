import type { Word } from './types'

// Simplified SM-2 spaced repetition algorithm.
// quality: 1 = "otra vez" (fallé), 3 = "difícil", 4 = "bien", 5 = "fácil"
export type ReviewQuality = 1 | 3 | 4 | 5

export function reviewWord(word: Word, quality: ReviewQuality): Word {
  const now = new Date()
  let { interval, repetitions, easeFactor } = word

  if (quality < 3) {
    repetitions = 0
    interval = 1
  } else {
    if (repetitions === 0) interval = 1
    else if (repetitions === 1) interval = 6
    else interval = Math.round(interval * easeFactor)
    repetitions += 1
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + interval)

  return {
    ...word,
    interval,
    repetitions,
    easeFactor,
    dueDate: dueDate.toISOString(),
    lastReviewed: now.toISOString(),
  }
}

export function isDue(word: Word): boolean {
  return new Date(word.dueDate).getTime() <= Date.now()
}

/** Una palabra "nueva" es la que todavía nunca se repasó. */
export function isNewWord(word: Word): boolean {
  return !word.lastReviewed
}

export function newWordSrsState() {
  return {
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    dueDate: new Date().toISOString(),
  }
}
