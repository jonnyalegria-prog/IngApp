export interface ParsedEntry {
  term: string
  translation: string
}

export interface ParseResult {
  vocab: ParsedEntry[]
  tasks: string[]
  grammar: string[]
}

// Turns pasted class notes into candidate vocabulary entries, homework-style
// tasks, and leftover grammar notes — zero AI calls, just heuristics.
const SEPARATOR = /\s*[-–—:=]\s*/
const MAX_VOCAB_LINE_LENGTH = 70
const MAX_TERM_WORDS = 4
const MAX_TRANSLATION_WORDS = 6

const TASK_KEYWORDS = /\b(practicar|aprender|estudiar|buscar|investigar|repasar|memorizar|tarea|tareas|deberes)\b/i
// "ver" only counts as a task when it LEADS the line (e.g. "Ver tal video").
// Mid-sentence it's usually just the verb "to see" inside a grammar example.
const TASK_LEADING_VER = /^ver\b/i

function isTaskLine(line: string): boolean {
  return TASK_KEYWORDS.test(line) || TASK_LEADING_VER.test(line)
}

const CLASS_DATE_MARKER = /clase\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function extractClassDate(raw: string, referenceYear = new Date().getFullYear()): string | null {
  const match = raw.match(CLASS_DATE_MARKER)
  if (!match) return null
  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  let year = match[3] ?? String(referenceYear)
  if (year.length === 2) year = `20${year}`
  return `${year}-${month}-${day}`
}

export function parseNotes(raw: string): ParseResult {
  const vocab: ParsedEntry[] = []
  const tasks: string[] = []
  const grammar: string[] = []

  const lines = raw
    .split('\n')
    .map((line) => line.replace(/^[\s*•\d.)-]+/, '').trim())
    .filter(Boolean)
    .filter((line) => !CLASS_DATE_MARKER.test(line))

  for (const line of lines) {
    if (line.length <= MAX_VOCAB_LINE_LENGTH) {
      const parenMatch = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
      if (
        parenMatch &&
        wordCount(parenMatch[1]) <= MAX_TERM_WORDS &&
        wordCount(parenMatch[2]) <= MAX_TRANSLATION_WORDS
      ) {
        vocab.push({ term: parenMatch[1].trim(), translation: parenMatch[2].trim() })
        continue
      }

      const parts = line.split(SEPARATOR).filter(Boolean)
      if (
        parts.length >= 2 &&
        wordCount(parts[0]) <= MAX_TERM_WORDS &&
        wordCount(parts.slice(1).join(' ')) <= MAX_TRANSLATION_WORDS
      ) {
        vocab.push({ term: parts[0].trim(), translation: parts.slice(1).join(' ').trim() })
        continue
      }
    }

    if (isTaskLine(line)) {
      tasks.push(line)
      continue
    }

    grammar.push(line)
  }

  return { vocab, tasks, grammar }
}
