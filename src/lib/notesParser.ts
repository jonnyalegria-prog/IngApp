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
const MAX_VOCAB_LINE_LENGTH = 70
const MAX_TERM_WORDS = 4
const MAX_TRANSLATION_WORDS = 6
// Frases completas con su traducción ("What do you do for a living? = ¿A qué te dedicas?"): más largas que una palabra.
const MAX_PHRASE_LINE_LENGTH = 140
const MAX_PHRASE_WORDS = 10
const MAX_PHRASE_MEANING_WORDS = 12

const TASK_KEYWORDS = /\b(practicar|aprender|estudiar|buscar|investigar|repasar|memorizar|tarea|tareas|deberes)\b/i
// "ver" only counts as a task when it LEADS the line (e.g. "Ver tal video").
// Mid-sentence it's usually just the verb "to see" inside a grammar example.
const TASK_LEADING_VER = /^ver\b/i
// "Tarea: escribir 5 frases" / "Deberes - repasar to be": la etiqueta ya dice que es una tarea.
const TASK_LABEL = /^(?:tareas?|deberes|homework)\s*[:\-–—]\s*/i

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

// --- Clasificación línea por línea ------------------------------------------
export type NoteKind = 'vocab' | 'task' | 'grammar'

export interface ClassifiedLine {
  kind: NoteKind
  /** La línea tal como venía en tus apuntes (sin viñeta). */
  text: string
  /** Solo vocabulario: la palabra en inglés y su significado en español ('' si falta). */
  term?: string
  meaning?: string
  /** Se dio vuelta sola porque el inglés venía a la derecha. */
  swapped?: boolean
}

// Etiquetas y títulos de apuntes ("Ejemplo: ...", "Regla: ...", "Vocabulario"): no son vocabulario.
const LABELS = new Set([
  'ejemplo', 'ejemplos', 'ej', 'regla', 'reglas', 'tip', 'tips', 'nota', 'notas', 'ojo', 'importante', 'recuerda',
  'recordar', 'uso', 'usos', 'estructura', 'forma', 'formas', 'pregunta', 'preguntas', 'negativo', 'afirmativo',
  'interrogativo', 'traducción', 'traduccion', 'significado', 'tema', 'temas', 'clase', 'vocabulario', 'gramática',
  'gramatica', 'verbos', 'ejercicio', 'ejercicios', 'repaso', 'resumen',
])

// Palabras muy comunes que delatan el idioma. Se dejan afuera las que existen en los dos (a, no, me, son, sin...).
const ES_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'del', 'al', 'que', 'se', 'es', 'está', 'están', 'por', 'para',
  'y', 'o', 'muy', 'como', 'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'más', 'pero', 'cuando', 'donde', 'porque', 'esto',
  'esta', 'este', 'eso', 'ese', 'hay', 'ser', 'estar', 'tiene', 'tienen', 'usa', 'usan', 'sirve', 'entre', 'sobre',
  'también', 'todo', 'todos', 'cada', 'hace', 'hacer', 'lo', 'le', 'les', 'nos', 'qué', 'cómo', 'de', 'en',
])
const EN_STOPWORDS = new Set([
  'the', 'an', 'of', 'to', 'is', 'are', 'was', 'were', 'be', 'been', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'my',
  'your', 'his', 'her', 'our', 'their', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that', 'these', 'those',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'not', "don't", "doesn't",
  "didn't", 'very', 'from', 'by', 'about', 'if', 'when', 'where', 'what', 'how', 'why', 'who', 'there', 'here', 'some',
  'any',
])
// Títulos de temas de gramática que, solos en una línea, no son una palabra para aprender.
const GRAMMAR_WORDS = new Set([
  'present', 'past', 'future', 'simple', 'perfect', 'continuous', 'conditional', 'passive', 'verb', 'verbs', 'noun',
  'adjective', 'adverb', 'tense', 'tenses', 'grammar', 'vocabulary', 'unit', 'lesson', 'homework', 'test', 'exam',
])

const HAS_LETTER = /[a-záéíóúüñ]/i

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[a-záéíóúüñ']+/g) ?? []
}

/** Positivo: suena a español. Negativo: suena a inglés. 0: no hay pistas claras. */
export function spanishScore(text: string): number {
  let score = /^\s*to\s+[a-z]/i.test(text) ? -3 : 0
  for (const w of wordsOf(text)) {
    if (/[áéíóúüñ]/.test(w)) score += 3
    if (ES_STOPWORDS.has(w)) score += 2
    if (EN_STOPWORDS.has(w)) score -= 2
    if (w.length >= 5 && /(ción|sión|dad|mente)$/.test(w)) score += 2
    if (w.length >= 6 && /(arse|erse|irse)$/.test(w)) score += 3
    if (w.length >= 5 && /(ar|ir)$/.test(w)) score += 1
    // -able / -ible no cuentan: existen igual en español (responsable, posible).
    if (w.length >= 5 && /(ing|ly|ness|ful|less|ment|tion)$/.test(w)) score -= 2
    if (/[kw]/.test(w)) score -= 1
    if (/th|sh|ck|wh|ough/.test(w)) score -= 1
  }
  return score
}

// Una oración con artículos y conectores es una explicación, no la traducción de una palabra.
function looksLikeSentence(text: string): boolean {
  const ws = wordsOf(text)
  return ws.length >= 4 && ws.filter((w) => ES_STOPWORDS.has(w) || EN_STOPWORDS.has(w)).length >= 2
}

function isLabel(text: string): boolean {
  const t = text.toLowerCase().replace(/[:.\s]+$/, '')
  // También en plural: "Vocabularios", "Ejemplos".
  return LABELS.has(t) || LABELS.has(t.replace(/s$/, ''))
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Separadores de "palabra - significado". El guion solo separa si tiene espacios alrededor:
// así "mother-in-law - suegra" y "e-mail: correo" no se cortan por la mitad. Los dos puntos
// tampoco separan una hora ("5:30").
const PAIR_SEPARATOR = /\s+[-–—=]\s+|\s*(?:→|->|=>)\s*|\s*:\s+|\s*=\s*/

function splitPair(line: string): { left: string; right: string; sep: string } | null {
  const paren = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (paren && paren[1].trim()) {
    // "What do you do? = (¿A qué te dedicas?)": el signo antes del paréntesis también es separador.
    const left = paren[1].replace(/\s*(?:=>|->|[=→:–—-])\s*$/, '').trim()
    const explicit = left !== paren[1].trim()
    return left ? { left, right: paren[2].trim(), sep: explicit ? '=' : '()' } : null
  }
  const m = PAIR_SEPARATOR.exec(line)
  if (!m || m.index === 0) return null
  const left = line.slice(0, m.index).trim()
  const right = line.slice(m.index + m[0].length).trim()
  return left && right ? { left, right, sep: m[0].trim() } : null
}

// El inglés va primero. Si la izquierda suena claramente más a español que la derecha, se da vuelta.
function orient(left: string, right: string): { term: string; meaning: string; swapped: boolean } {
  return spanishScore(left) - spanishScore(right) >= 2
    ? { term: right, meaning: left, swapped: true }
    : { term: left, meaning: right, swapped: false }
}

/**
 * ¿Una palabra guardada está al revés (el español arriba y el inglés como significado)? Solo dice que sí cuando el
 * significado suena claramente a inglés, para no confundirse con palabras que se escriben igual en los dos idiomas.
 */
export function looksReversed(term: string, translation: string): boolean {
  const meaningScore = spanishScore(translation)
  return meaningScore <= -1 && spanishScore(term) - meaningScore >= 2
}

/** Para pasar una línea a vocabulario a mano: separa y ordena "palabra - significado". */
export function pairFromLine(line: string): { term: string; meaning: string; swapped: boolean } | null {
  const pair = splitPair(line)
  return pair ? orient(pair.left, pair.right) : null
}

function toVocab(line: string): ClassifiedLine | null {
  if (line.length > MAX_VOCAB_LINE_LENGTH) return null
  const pair = splitPair(line)
  if (!pair) return null
  // "Ejemplo: I go to school", "Regla: usa did": una etiqueta seguida de una explicación.
  if (isLabel(pair.left) && (wordCount(pair.right) >= 2 || spanishScore(pair.right) >= 1)) return null

  const { term, meaning, swapped } = orient(pair.left, pair.right)
  if (wordCount(term) > MAX_TERM_WORDS || wordCount(meaning) > MAX_TRANSLATION_WORDS) return null
  if (!HAS_LETTER.test(term) || !HAS_LETTER.test(meaning)) return null
  if (looksLikeSentence(term) || looksLikeSentence(meaning)) return null
  const termScore = spanishScore(term)
  const meaningScore = spanishScore(meaning)
  if (termScore <= -2 && meaningScore <= -2) return null // los dos lados suenan a inglés: no es una traducción
  if (termScore >= 1 && meaningScore >= 1) return null // los dos lados suenan a español: tampoco
  return { kind: 'vocab', text: line, term, meaning, swapped }
}

// Una frase entera con su traducción ("How are you? = ¿Cómo estás?"). Solo con "=" o flecha (los dos puntos,
// el guion y los paréntesis suelen ser una explicación) y solo si un lado suena claramente a inglés y el
// otro tiene pistas claras de español.
function toPhrasePair(line: string): ClassifiedLine | null {
  if (line.length > MAX_PHRASE_LINE_LENGTH) return null
  const pair = splitPair(line)
  if (!pair || !['=', '→', '->', '=>'].includes(pair.sep)) return null
  if (isLabel(pair.left)) return null
  const { term, meaning, swapped } = orient(pair.left, pair.right)
  if (wordCount(term) > MAX_PHRASE_WORDS || wordCount(meaning) > MAX_PHRASE_MEANING_WORDS) return null
  if (!HAS_LETTER.test(term) || !HAS_LETTER.test(meaning)) return null
  if (spanishScore(term) > -2 || spanishScore(meaning) < 1) return null
  return { kind: 'vocab', text: line, term, meaning, swapped }
}

// Una palabra o expresión en inglés sola en su línea ("to give up", "beautiful"): vocabulario a la espera
// de su significado. Solo si hay pistas claras de que es inglés: una palabra suelta sin acento ("colores",
// "familia") se ve igual en los dos idiomas y, si se tratara como inglés, apuntes en español quedarían llenos
// de "palabras" falsas. Sin pistas, la línea va a Gramática (y desde la vista previa se puede mover).
function toLoneWord(line: string): ClassifiedLine | null {
  if (line.length > 30 || !/^[A-Za-z][A-Za-z' -]*$/.test(line)) return null
  const ws = line.split(/\s+/)
  if (ws.length > 3 || isLabel(line)) return null
  if (ws.some((w) => GRAMMAR_WORDS.has(w.toLowerCase()))) return null
  if (spanishScore(line) > -1) return null
  // "Present perfect" (con mayúscula) parece el título de un tema.
  if (ws.length > 1 && !/^to\s+[a-z]/i.test(line) && line !== line.toLowerCase()) return null
  return { kind: 'vocab', text: line, term: line, meaning: '' }
}

function stripBullet(line: string): string {
  let out = line.trim()
  // Solo viñetas y numeración de lista ("* ", "- ", "1. ", "2) "): así "2nd - segundo" y "-ed" quedan intactos.
  for (let i = 0; i < 2; i++) {
    out = out.replace(/^(?:[*•·]+|[-–—]+(?=\s)|\d{1,2}[.)](?=\s))\s*/, '').trim()
  }
  return out
}

function classifyLine(line: string): ClassifiedLine {
  const label = line.match(TASK_LABEL)
  if (label && line.length > label[0].length) return { kind: 'task', text: capitalize(line.slice(label[0].length).trim()) }
  const vocab = toVocab(line) ?? toPhrasePair(line)
  if (vocab) return vocab
  if (isTaskLine(line)) return { kind: 'task', text: line }
  return toLoneWord(line) ?? { kind: 'grammar', text: line }
}

/** Separa tus apuntes en vocabulario, tareas y gramática, una línea a la vez. */
export function classifyNotes(raw: string): ClassifiedLine[] {
  const out: ClassifiedLine[] = []
  for (const original of raw.split('\n')) {
    // La línea de la fecha se descarta antes de limpiar viñetas, que también borran números iniciales.
    if (isClassDateLine(original)) continue
    const line = stripBullet(original)
    if (line) out.push(classifyLine(line))
  }
  return out
}

/** Versión agrupada: solo el vocabulario que ya tiene significado. */
export function parseNotes(raw: string): ParseResult {
  const lines = classifyNotes(raw)
  return {
    vocab: lines.flatMap((l) => (l.kind === 'vocab' && l.term && l.meaning ? [{ term: l.term, translation: l.meaning }] : [])),
    tasks: lines.filter((l) => l.kind === 'task').map((l) => l.text),
    grammar: lines.filter((l) => l.kind === 'grammar').map((l) => l.text),
  }
}
