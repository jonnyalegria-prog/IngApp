export interface ClozeExercise {
  prompt: string
  answer: string
  source: string
}

// Common grammar target words worth blanking out — covers the tenses/forms
// this user's classes focus on (to be, future, past) plus general markers.
// Longer phrases checked first so "going to" wins over a bare "to".
const CLOZE_TARGETS = [
  'going to',
  'used to',
  'have been',
  'has been',
  'am',
  'is',
  'are',
  'was',
  'were',
  'will',
  'did',
  'does',
  'do',
  'have',
  'has',
  'had',
  'yet',
  'already',
  'since',
  'for',
]

// Builds a fill-in-the-blank exercise from a sentence by blanking the first
// grammar target word/phrase found in it. Zero cost, zero AI — a simple
// heuristic so every task or grammar note with an example sentence can turn
// into practice, not just a checkbox.
export function generateCloze(sentence: string): ClozeExercise | null {
  const clean = sentence.trim()
  if (clean.length < 8 || clean.length > 140) return null

  const lower = clean.toLowerCase()
  for (const target of CLOZE_TARGETS) {
    const pattern = new RegExp(`\\b${target.replace(' ', '\\s+')}\\b`, 'i')
    const match = lower.match(pattern)
    if (match && match.index !== undefined) {
      const start = match.index
      const end = start + match[0].length
      const answer = clean.slice(start, end)
      const prompt = `${clean.slice(0, start)}___${clean.slice(end)}`
      return { prompt, answer, source: clean }
    }
  }
  return null
}

// Scans several lines of free text (task lists, grammar notes) and returns
// every cloze exercise it can build, de-duplicated by prompt.
export function generateClozeSet(lines: string[]): ClozeExercise[] {
  const seen = new Set<string>()
  const results: ClozeExercise[] = []
  for (const line of lines) {
    const cloze = generateCloze(line)
    if (cloze && !seen.has(cloze.prompt)) {
      seen.add(cloze.prompt)
      results.push(cloze)
    }
  }
  return results
}
