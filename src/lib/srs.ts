import type { Word } from './types'

// Simplified SM-2 spaced repetition algorithm.
// quality: 1 = "again", 3 = "hard", 5 = "easy"
export function reviewWord(word: Word, quality: 1 | 3 | 5): Word {
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

export function newWordSrsState() {
  return {
    interval: 0,
    repetitions: 0,
    easeFactor: 2.5,
    dueDate: new Date().toISOString(),
  }
}
