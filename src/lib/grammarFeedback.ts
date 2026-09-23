import { checkGrammar, type GrammarMatch } from './languagetool'
import { findSpanishSpeakerMistakes } from './spanishSpeakerRules'

// Convierte lo que devuelven LanguageTool y las reglas propias en algo que se entienda:
// qué escribiste, qué está mal (en español, tono cercano) y cómo se dice en inglés.

export interface Feedback {
  key: string
  /** Texto de alrededor, para ubicar el error dentro de lo que escribiste. */
  before: string
  fragment: string
  after: string
  title: string
  explanation: string
  /** Siempre en inglés. */
  suggestions: string[]
  /** Mensaje original de LanguageTool: solo se muestra si no hay una explicación propia. */
  originalMessage?: string
  /** Sugerencia de estilo: se entiende igual, no es un error. */
  optional?: boolean
}

export interface ReviewResult {
  items: Feedback[]
  /** LanguageTool no respondió: solo se aplicaron las reglas propias. */
  checkerOffline: boolean
}

type Explain = (ctx: { fragment: string; suggestion?: string }) => { title: string; text: string }

const EXPLANATIONS: Record<string, Explain> = {
  UPPERCASE_SENTENCE_START: ({ fragment, suggestion }) => ({
    title: 'Falta una mayúscula',
    text: `Toda oración empieza con letra mayúscula, y acá empezaste con «${fragment}».${suggestion ? ` Se escribe «${suggestion}».` : ''}`,
  }),
  I_LOWERCASE: () => ({
    title: '«I» siempre va en mayúscula',
    text: 'En inglés «yo» se escribe «I», siempre con mayúscula, aunque esté en el medio de la oración.',
  }),
  HE_VERB_AGR: () => ({
    title: 'El verbo tiene que combinar con la persona',
    text: 'Con he / she / it (él, ella, eso) el verbo cambia: have → has, do → does, go → goes. Con I, you, we y they queda igual.',
  }),
  EN_CONTRACTION_SPELLING: ({ fragment }) => ({
    title: "Falta el apóstrofo (')",
    text: `En las contracciones el apóstrofo reemplaza letras: «don't» es «do not», «isn't» es «is not». Escribiste «${fragment}».`,
  }),
  I_AM_VB: () => ({
    title: 'Después de «am» no va el verbo solo',
    text: '«I am» va con un verbo terminado en -ing (I am going) o con un adjetivo (I am happy). Y «I am agree» no existe: se dice «I agree».',
  }),
  EN_A_VS_AN: () => ({
    title: '«a» o «an»',
    text: 'Antes de un sonido de vocal se usa «an» (an apple, an hour); antes de consonante, «a» (a car, a dog). Importa el sonido, no la letra.',
  }),
  CONFUSION_OF_ME_I: () => ({
    title: '«I» o «me»',
    text: 'Cuando sos vos quien hace la acción, se usa «I», no «me». Y si hablás de otra persona y de vos, la otra persona va primero: «He and I go».',
  }),
  ENGLISH_WORD_REPEAT_RULE: ({ fragment }) => ({
    title: 'Palabra repetida',
    text: `Escribiste dos veces seguidas «${fragment}». Alcanza con una.`,
  }),
  TO_AFTER_MODAL_VERBS: () => ({
    title: 'Sin «to» después de can, should, must…',
    text: 'Después de can, should, must y similares el verbo va solo, sin «to»: «can swim», no «can to swim».',
  }),
  THERE_S_MANY: () => ({
    title: '«There is» o «There are»',
    text: 'Con una sola cosa se usa «there is» (There is a cat). Con varias, «there are» (There are two cats).',
  }),
  MOST_COMPARATIVE: () => ({
    title: 'Sobra «more»',
    text: 'Con adjetivos cortos el comparativo ya termina en -er (taller, bigger). «More» se usa con los largos: more interesting.',
  }),
  MORFOLOGIK_RULE_EN_US: ({ fragment, suggestion }) => ({
    title: 'Revisá cómo se escribe',
    text: suggestion
      ? `No encuentro «${fragment}» en inglés. Puede ser un error al tipear: mirá si alguna de las sugerencias es lo que querías escribir. (Si es un nombre propio, está bien.)`
      : `No encuentro «${fragment}» en inglés. Puede ser un error al tipear o un nombre propio.`,
  }),
  WANT_THAT_I: () => ({
    title: '«Want that» no se usa',
    text: 'Para decir «quiero que vengas» se dice «I want you to come», no «want that you come».',
  }),
  COMMA_PARENTHESIS_WHITESPACE: () => ({
    title: 'Espacios y puntuación',
    text: 'La coma y el punto van pegados a la palabra anterior, y después va un espacio: «I have a dog, and a cat.»',
  }),
  MUCH_COUNTABLE: () => ({
    title: '«Many» para lo que se cuenta',
    text: 'Con cosas que se pueden contar en plural (friends, books) se usa «many». «Much» es para lo que no se cuenta: much water, much time.',
  }),
  MANY_NN_U: () => ({
    title: '«Much» para lo que no se cuenta',
    text: 'Palabras como money, water, time o information no se cuentan de a una: con ellas se usa «much», no «many».',
  }),
  DEPEND_ON: () => ({
    title: 'Es «depend on»',
    text: 'Con «depend» se usa «on»: «It depends on you», no «depends of».',
  }),
  PERS_PRONOUN_AGREEMENT: () => ({
    title: 'El verbo tiene que combinar con la persona',
    text: 'Cada persona usa su forma de «to be»: I am · you are · he/she/it is · we are · they are. En pasado: I/he/she/it was · you/we/they were.',
  }),
  A_NNS: () => ({
    title: '«A» va con una sola cosa',
    text: '«A» y «an» se usan con una sola cosa. Y hay palabras sin plural, como «information»: se dice «information» o «a piece of information».',
  }),
  AUXILIARY_DO_WITH_INCORRECT_VERB_FORM: () => ({
    title: 'Después de did / do / does, el verbo va sin cambios',
    text: "Con did, do o does el verbo principal queda en su forma base: «I didn't go», no «I didn't went». El pasado ya está en «did».",
  }),
  MD_BASEFORM: () => ({
    title: 'Después de can, will, should… el verbo va solo',
    text: 'Los verbos como can, will, should y must van seguidos del verbo sin cambios: «She can sing», no «She can sings».',
  }),
  THEIR_IS: () => ({
    title: '«Their» o «there»',
    text: '«There» es «ahí / hay» (There are two cats). «Their» es «de ellos» (their house). Suenan igual, pero significan cosas distintas.',
  }),
  YEAR_OLD_HYPHEN: () => ({
    title: 'Guiones en «25-year-old»',
    text: 'Antes de un sustantivo va con guiones y «year» en singular: «a 25-year-old man». Para decir la edad, sin guiones: «He is 25 years old».',
  }),
  SHORT_COMPARATIVES: () => ({
    title: 'Sobra «more»',
    text: 'Con adjetivos cortos el comparativo termina en -er (happier, taller): «happier than you», no «more happy». «More» se usa con los largos: more interesting.',
  }),
  SAY_TELL: () => ({
    title: '«Say» o «tell»',
    text: '«Say» se usa sin decir a quién («He said hello»). Si nombrás a la persona, se usa «tell»: «He told me that…».',
  }),
  LET_IT_INFINITIVE: () => ({
    title: 'Sin «to» después de «let»',
    text: 'Después de «let me» el verbo va solo: «Let me go», no «Let me to go».',
  }),
  BEEN_PART_AGREEMENT: () => ({
    title: 'Después de is / am / are no va el verbo solo',
    text: 'Después de «is / am / are» se usa un adjetivo (She is happy), -ing (She is going) o un participio (It is finished). Con «agree» se dice «I agree» / «She agrees».',
  }),
  WHITESPACE_RULE: () => ({
    title: 'Espacio de más',
    text: 'Hay dos espacios seguidos. Con uno alcanza.',
  }),
}

const STYLE_CATEGORIES = new Set([
  'STYLE', 'PLAIN_ENGLISH', 'REDUNDANCY', 'COLLOCATIONS', 'NONSTANDARD_PHRASES', 'REPETITIONS_STYLE', 'WIKIPEDIA',
])

const CATEGORY_TEXT: Record<string, { title: string; text: string }> = {
  TYPOS: { title: 'Revisá la ortografía', text: 'Puede haber un error de escritura acá.' },
  GRAMMAR: { title: 'Revisá la gramática', text: 'Esta parte no suena bien en inglés: puede haber un error de estructura o de concordancia.' },
  CASING: { title: 'Mayúsculas y minúsculas', text: 'Revisá si esta palabra lleva mayúscula o minúscula.' },
  PUNCTUATION: { title: 'Puntuación', text: 'Revisá los signos de puntuación acá.' },
  TYPOGRAPHY: { title: 'Espacios y signos', text: 'Revisá los espacios y los signos de esta parte.' },
  CONFUSED_WORDS: { title: 'Palabras que se confunden', text: 'Parece que mezclaste dos palabras que se parecen.' },
}

const GENERIC = { title: 'Revisá esta parte', text: 'El corrector marcó algo acá. Mirá la sugerencia de abajo.' }
const STYLE = {
  title: 'Se entiende, pero se puede decir mejor',
  text: 'Es solo una sugerencia de estilo: lo que escribiste no está mal.',
}

const CONTEXT_CHARS = 22

function overlaps(a: GrammarMatch, b: GrammarMatch): boolean {
  return a.offset < b.offset + b.length && b.offset < a.offset + a.length
}

function cleanContext(part: string, side: 'before' | 'after'): string {
  // Evita mostrar media palabra en el borde recortado.
  return side === 'before' ? part.replace(/^\S*\s/, '') : part.replace(/\s\S*$/, '')
}

export function toFeedback(text: string, m: GrammarMatch, index: number): Feedback {
  // LanguageTool a veces marca solo "do" dentro de "don't": se muestra la palabra completa.
  const contraction = text.slice(m.offset + m.length).match(/^n['’]t/i)?.[0] ?? ''
  const end = m.offset + m.length + contraction.length
  const fragment = text.slice(m.offset, end)

  const truncatedBefore = m.offset > CONTEXT_CHARS
  const rawBefore = text.slice(Math.max(0, m.offset - CONTEXT_CHARS), m.offset)
  const before = truncatedBefore ? '…' + cleanContext(rawBefore, 'before') : rawBefore
  const truncatedAfter = end + CONTEXT_CHARS < text.length
  const rawAfter = text.slice(end, end + CONTEXT_CHARS)
  const after = truncatedAfter ? cleanContext(rawAfter, 'after') + '…' : rawAfter

  const suggestions = [
    ...new Set(
      m.suggestions
        .map((s) => (contraction && !/n['’]t$/i.test(s) ? s.trim() + contraction : s.trim()))
        .filter((s) => s && s !== fragment.trim()),
    ),
  ].slice(0, 3)

  const explain = EXPLANATIONS[m.ruleId]
  const isStyle = STYLE_CATEGORIES.has(m.categoryId)
  const chosen =
    m.friendly ??
    (explain ? explain({ fragment, suggestion: suggestions[0] }) : isStyle ? STYLE : (CATEGORY_TEXT[m.categoryId] ?? GENERIC))

  return {
    key: `${m.ruleId}-${m.offset}-${index}`,
    before,
    fragment,
    after,
    title: chosen.title,
    explanation: chosen.text,
    suggestions,
    originalMessage: !m.friendly && !explain && m.message ? m.message : undefined,
    optional: !m.friendly && !explain && isStyle,
  }
}

export async function reviewText(text: string): Promise<ReviewResult> {
  let languageTool: GrammarMatch[] = []
  let checkerOffline = false
  try {
    languageTool = await checkGrammar(text)
  } catch {
    checkerOffline = true
  }

  // Las reglas propias son más específicas (y con explicación pensada para vos): si coinciden
  // con un aviso de LanguageTool en el mismo lugar, se queda la propia.
  const own: GrammarMatch[] = []
  for (const candidate of findSpanishSpeakerMistakes(text)) {
    if (own.some((m) => overlaps(m, candidate))) continue
    own.push(candidate)
  }
  const remaining = languageTool.filter((m) => !own.some((o) => overlaps(o, m)))

  const all = [...remaining, ...own].sort((a, b) => a.offset - b.offset)
  return { items: all.map((m, i) => toFeedback(text, m, i)), checkerOffline }
}
