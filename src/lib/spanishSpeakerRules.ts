import type { GrammarMatch } from './languagetool'

// Errores muy típicos de quienes hablan español que LanguageTool no marca
// ("I have 25 years", "People is", "Yesterday I go"). Son reglas simples y
// conservadoras: ante la duda, no marcan nada.

interface Built {
  replacement: string
  title: string
  text: string
}

interface Rule {
  id: string
  pattern: RegExp
  build: (m: RegExpExecArray, text: string) => Built | null
}

// Palabra que aparece justo antes: si es un auxiliar, el verbo que sigue va en base
// ("Does my brother have...?", "Did you go yesterday?") y no es un error.
const AUXILIARS = new Set([
  'do', 'does', 'did', "don't", "doesn't", "didn't", 'will', "won't", 'would', 'can', "can't", 'could',
  'should', 'must', 'might', 'may', 'to', 'not',
])

function previousWord(text: string, index: number): string {
  const m = text.slice(Math.max(0, index - 20), index).match(/([A-Za-z’']+)\s*$/)
  return m ? m[1].toLowerCase().replace(/’/g, "'") : ''
}

const BE_FOR: Record<string, string> = { i: 'am', you: 'are', we: 'are', they: 'are', he: 'is', she: 'is' }

const THIRD_PERSON_FIX: Record<string, string> = {
  have: 'has',
  do: 'does',
  "don't": "doesn't",
  go: 'goes',
  are: 'is',
}

const RULES: Rule[] = [
  {
    id: 'ES_AGE_HAVE',
    // "I have 25 years" (sin "of experience" ni nada más después)
    pattern: /\b(I|you|we|they|he|she)\s+(?:have|has)\s+(\d{1,3})\s+years?(?:\s+old)?(?=\s*(?:[.,!?;:\n]|$))/gi,
    build: (m) => ({
      replacement: `${m[1]} ${BE_FOR[m[1].toLowerCase()]} ${m[2]} years old`,
      title: 'La edad se dice con «to be»',
      text: 'En inglés la edad se dice con «to be» (ser), no con «have» (tener): «I am 25 years old».',
    }),
  },
  {
    id: 'ES_PEOPLE_IS',
    pattern: /\bpeople\s+is\b/gi,
    build: (m) => ({
      replacement: m[0].slice(0, -2) + 'are',
      title: '«People» es plural',
      text: '«People» (gente) es plural en inglés, así que va con «are»: «People are nice».',
    }),
  },
  {
    id: 'ES_VERY_VERB',
    pattern: /\b(I|you|we|they|he|she)\s+very\s+(like|love|want|need|enjoy|hate)(s?)\b/gi,
    build: (m) => ({
      replacement: `${m[1]} really ${m[2]}${m[3]}`,
      title: '«Very» no va antes del verbo',
      text: 'Para reforzar un verbo se usa «really» antes (I really like it) o «very much» al final (I like it very much).',
    }),
  },
  {
    id: 'ES_WILL_TO',
    pattern: /\b(will|would)\s+to\s+([a-z]+)\b/gi,
    build: (m) => ({
      replacement: `${m[1]} ${m[2]}`,
      title: 'Sin «to» después de «will»',
      text: 'Después de will y would el verbo va solo: «I will call you», no «I will to call you».',
    }),
  },
  {
    id: 'ES_MUCH_COUNT',
    pattern:
      /\bmuch\s+(people|friends|things|books|cars|dogs|cats|words|students|children|kids|animals|movies|songs|questions|problems|days|years|times|places)\b/gi,
    build: (m) => ({
      replacement: `many ${m[1]}`,
      title: '«Many» para lo que se cuenta',
      text: 'Con cosas que se pueden contar (people, friends, books) se usa «many». «Much» es para lo que no se cuenta: much water, much time.',
    }),
  },
  {
    id: 'ES_DEPEND_OF',
    pattern: /\bdepends?\s+of\b/gi,
    build: (m) => ({
      replacement: m[0].replace(/of$/i, 'on'),
      title: 'Es «depend on»',
      text: 'Con «depend» se usa «on»: «It depends on the weather», no «depends of».',
    }),
  },
  {
    id: 'ES_MARRIED_WITH',
    pattern: /\bmarried\s+with\b/gi,
    build: (m) => ({
      replacement: m[0].replace(/with$/i, 'to'),
      title: 'Es «married to»',
      text: 'En inglés se dice «married to» (casado con): «She is married to Tom».',
    }),
  },
  {
    id: 'ES_EXPLAIN_ME',
    pattern: /\bexplain\s+me\b/gi,
    build: (m) => ({
      replacement: m[0].replace(/\s+me$/i, ' to me'),
      title: 'Es «explain to me»',
      text: 'Con «explain» hace falta «to» antes de la persona: «Can you explain to me…?». También puedes decir «tell me».',
    }),
  },
  {
    id: 'ES_THIRD_PERSON',
    pattern:
      /\b((?:my|your|his|her|our|their|the)\s+(?:brother|sister|mother|father|friend|dad|mom|teacher|boss|wife|husband|son|daughter|dog|cat|girlfriend|boyfriend|partner|neighbor|cousin|uncle|aunt|grandfather|grandmother))\s+(have|do|don't|go|are)\b/gi,
    build: (m, text) => {
      if (AUXILIARS.has(previousWord(text, m.index))) return null
      const fixed = THIRD_PERSON_FIX[m[2].toLowerCase()]
      return {
        replacement: `${m[1]} ${fixed}`,
        title: 'El verbo tiene que combinar con el sujeto',
        text: 'Con una sola persona o cosa (my brother = he) el verbo cambia: have → has, do → does, go → goes, are → is.',
      }
    },
  },
]

// --- Verbo en presente con una marca de pasado ("Yesterday I go...") --------
const IRREGULAR_PAST: Record<string, string> = {
  go: 'went', goes: 'went', eat: 'ate', eats: 'ate', see: 'saw', sees: 'saw', come: 'came', comes: 'came',
  buy: 'bought', buys: 'bought', do: 'did', does: 'did', make: 'made', makes: 'made', have: 'had', has: 'had',
  get: 'got', gets: 'got', take: 'took', takes: 'took', give: 'gave', gives: 'gave', write: 'wrote', writes: 'wrote',
  drink: 'drank', drinks: 'drank', meet: 'met', meets: 'met', run: 'ran', runs: 'ran', sleep: 'slept', sleeps: 'slept',
  speak: 'spoke', speaks: 'spoke', say: 'said', says: 'said', leave: 'left', leaves: 'left', find: 'found', finds: 'found',
  feel: 'felt', feels: 'felt', think: 'thought', thinks: 'thought', know: 'knew', knows: 'knew', bring: 'brought',
  brings: 'brought', send: 'sent', sends: 'sent', pay: 'paid', pays: 'paid', wake: 'woke', wakes: 'woke', sit: 'sat',
  sits: 'sat', stand: 'stood', stands: 'stood', win: 'won', wins: 'won', lose: 'lost', loses: 'lost',
  forget: 'forgot', forgets: 'forgot',
}

const REGULAR_VERBS = [
  'play', 'visit', 'work', 'watch', 'cook', 'clean', 'call', 'study', 'talk', 'walk', 'travel', 'arrive', 'start',
  'finish', 'help', 'use', 'order', 'remember', 'want', 'like', 'need', 'live', 'love', 'wash', 'open', 'close',
  'listen', 'learn', 'ask', 'answer', 'move', 'stay', 'wait',
]

function toBase(verb: string): string {
  const v = verb.toLowerCase()
  if (REGULAR_VERBS.includes(v)) return v
  if (v.endsWith('ies')) return v.slice(0, -3) + 'y'
  if (/(ches|shes|xes|sses|zzes)$/.test(v)) return v.slice(0, -2)
  return v.endsWith('s') ? v.slice(0, -1) : v
}

function regularPast(base: string): string {
  if (base.endsWith('e')) return base + 'd'
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ied'
  return base + 'ed'
}

function toPast(verb: string): { past: string; regular: boolean } {
  const irregular = IRREGULAR_PAST[verb.toLowerCase()]
  return irregular ? { past: irregular, regular: false } : { past: regularPast(toBase(verb)), regular: true }
}

const PAST_MARKER =
  /\b(yesterday|last\s+(?:night|week|weekend|month|year|summer|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|(?:\d+|a|an|two|three|four|five|few)\s+(?:days?|weeks?|months?|years?)\s+ago)\b/i
// Si la oración habla de costumbres o de "desde ayer", el presente puede estar bien.
const HABIT_OR_SINCE = /\b(since|every|usually|always|often|sometimes|never)\b/i

// Tercera persona: watch → watches, study → studies, play → plays.
function thirdPerson(verb: string): string {
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return verb + 'es'
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + 'ies'
  return verb + 's'
}

const ALL_PAST_VERBS = [...Object.keys(IRREGULAR_PAST), ...REGULAR_VERBS, ...REGULAR_VERBS.map(thirdPerson)]
const SUBJECT_VERB = new RegExp(`\\b(I|you|we|they|he|she|it)\\s+(${ALL_PAST_VERBS.join('|')})\\b`, 'gi')

function findPastMarkerMistakes(text: string): GrammarMatch[] {
  const out: GrammarMatch[] = []
  const sentences = text.matchAll(/[^.!?\n]+[.!?]*/g)
  for (const sentence of sentences) {
    const body = sentence[0]
    const start = sentence.index ?? 0
    const marker = body.match(PAST_MARKER)
    if (!marker || HABIT_OR_SINCE.test(body)) continue

    SUBJECT_VERB.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = SUBJECT_VERB.exec(body)) !== null) {
      const offset = start + m.index
      if (AUXILIARS.has(previousWord(text, offset))) continue
      const { past, regular } = toPast(m[2])
      out.push({
        message: '',
        shortMessage: '',
        offset,
        length: m[0].length,
        suggestions: [`${m[1]} ${past}`],
        ruleId: 'ES_PAST_MARKER',
        categoryId: 'ES_SPEAKER',
        friendly: {
          title: 'Acá el verbo va en pasado',
          text:
            `Con «${marker[0].toLowerCase()}» hablas del pasado, así que el verbo va en pasado: «${m[2]}» → «${past}». ` +
            (regular
              ? 'Los verbos regulares terminan en -ed (played).'
              : 'Es un verbo irregular: hay que memorizar su forma de pasado.'),
        },
      })
    }
  }
  return out
}

export function findSpanishSpeakerMistakes(text: string): GrammarMatch[] {
  const out: GrammarMatch[] = []
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = rule.pattern.exec(text)) !== null) {
      const built = rule.build(m, text)
      if (!built) continue
      out.push({
        message: '',
        shortMessage: '',
        offset: m.index,
        length: m[0].length,
        suggestions: [built.replacement],
        ruleId: rule.id,
        categoryId: 'ES_SPEAKER',
        friendly: { title: built.title, text: built.text },
      })
    }
  }
  out.push(...findPastMarkerMistakes(text))
  return out
}
