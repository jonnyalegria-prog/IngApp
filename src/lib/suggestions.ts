import { discoveryContent, type DiscoveryItem } from '../data/discoveryContent'
import type { EnglishLevel } from './types'
import { getWeekKey } from './week'

const LEVELS: EnglishLevel[] = ['principiante', 'intermedio', 'avanzado']

// Ideas for "this week": current level plus the next tier up, so they stay
// close to what the user is learning but lean slightly ahead. Deterministic
// by ISO week, so they rotate automatically every week.
export function getWeeklySuggestions(level: EnglishLevel, now = new Date()): DiscoveryItem[] {
  const idx = LEVELS.indexOf(level)
  const upperIdx = Math.min(idx + 1, LEVELS.length - 1)
  const allowedLevels = new Set([LEVELS[idx], LEVELS[upperIdx]])
  const pool = discoveryContent.filter((item) => allowedLevels.has(item.level))
  if (pool.length === 0) return []

  const week = Number(getWeekKey(now).split('-W')[1])
  const start = (week * 3) % pool.length
  const picked: DiscoveryItem[] = []
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    picked.push(pool[(start + i) % pool.length])
  }
  return picked
}
