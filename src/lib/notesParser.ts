import { daysBetween, localDateString } from './week'

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

// --- Fecha de la clase -----------------------------------------------------
// Una línea cuenta como fecha de clase si:
//  · tiene la palabra "clase" seguida de una fecha ("Clase 13/09", "clase del 13-9-26",
//    "Clase: domingo 13 de septiembre"), o
//  · es solo una fecha, como encabezado ("Domingo 13/09", "13 de septiembre").
// El orden es día/mes. Las fechas que no existen (31/02, mes 13) se ignoran.
const MONTHS: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
  julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9,
  octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12,
}
const MONTH_NAMES = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|')
const WEEKDAY = 'lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|lun|mar|mi[eé]|jue|vie|s[aá]b|dom'
// `\b` no sirve tras una letra con tilde ("mié"), por eso el lookahead.
const WEEKDAY_PREFIX = `(?:(?:${WEEKDAY})(?![a-záéíóúñ])\\.?,?\\s+)?`

// Grupos: 1-3 = día/mes/año numérico, 4-6 = día/mes/año con el mes escrito.
function dateSource(numericSeparators: string): string {
  return (
    `(?:(\\d{1,2})[${numericSeparators}](\\d{1,2})(?:[${numericSeparators}](\\d{2,4}))?` +
    `|(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_NAMES})\\b\\.?(?:\\s+(?:de\\s+|del\\s+)?(\\d{2,4}))?)`
  )
}

const CLASS_MARKER_LINE = new RegExp(
  `\\bclase\\s*:?\\s*(?:del\\s+|de\\s+el\\s+|el\\s+)?${WEEKDAY_PREFIX}${dateSource('/.\\-')}`,
  'i',
)
// Como encabezado suelto solo se acepta "/" o "-" para no confundir decimales o fracciones.
const HEADER_LINE = new RegExp(`^[*•\\-–\\s]*${WEEKDAY_PREFIX}${dateSource('/\\-')}\\s*[.:]?\\s*$`, 'i')

interface DateParts {
  day: number
  month: number
  year?: number
}

function matchDateLine(line: string): DateParts | null {
  const m = line.match(CLASS_MARKER_LINE) ?? line.match(HEADER_LINE)
  if (!m) return null
  const numeric = m[1] !== undefined
  const day = Number(numeric ? m[1] : m[4])
  const month = numeric ? Number(m[2]) : MONTHS[m[5].toLowerCase()]
  const rawYear = numeric ? m[3] : m[6]
  let year: number | undefined
  if (rawYear !== undefined) {
    if (rawYear.length === 3) return null
    year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)
  }
  // Sin año se prueba con uno bisiesto para no descartar el 29/02 antes de tiempo.
  return isRealDate(year ?? 2000, month, day) ? { day, month, year } : null
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isClassDateLine(line: string): boolean {
  return matchDateLine(line) !== null
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// Devuelve la fecha (YYYY-MM-DD) de la primera línea que la indique, o null.
// Sin año se usa el actual; si así quedaría en el futuro, la clase ya pasó: es del año anterior.
export function extractClassDate(raw: string, today = localDateString()): string | null {
  for (const line of raw.split('\n')) {
    const parts = matchDateLine(line)
    if (!parts) continue
    if (parts.year !== undefined) return toIso(parts.year, parts.month, parts.day)

    const thisYear = Number(today.slice(0, 4))
    if (!isRealDate(thisYear, parts.month, parts.day)) continue
    const candidate = toIso(thisYear, parts.month, parts.day)
    if (daysBetween(today, candidate) <= 1) return candidate
    if (isRealDate(thisYear - 1, parts.month, parts.day)) return toIso(thisYear - 1, parts.month, parts.day)
  }
  return null
}

export function parseNotes(raw: string): ParseResult {
  const vocab: ParsedEntry[] = []
  const tasks: string[] = []
  const grammar: string[] = []

  // La línea de la fecha se descarta antes de limpiar viñetas, que también borran números iniciales ("13 de septiembre").
  const lines = raw
    .split('\n')
    .filter((line) => !isClassDateLine(line))
    .map((line) => line.replace(/^[\s*•\d.)-]+/, '').trim())
    .filter(Boolean)

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
