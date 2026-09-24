// Ruta de aprendizaje: una unidad por tema del temario de la profe. Cada unidad junta las palabras del banco
// que tienen esos temas (`vocab_bank.theme`).

export interface Unit {
  id: string
  title: string
  emoji: string
  description: string
  themes: string[]
  /** Orden natural de las palabras cuando importa (números, días, meses...). El resto queda al final, en orden alfabético. */
  order?: string[]
}

const NUMBERS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty', 'sixty',
  'seventy', 'eighty', 'ninety', 'one hundred', 'one thousand', 'one million',
]

export const UNITS: Unit[] = [
  {
    id: 'frases',
    title: 'Frases para partir',
    emoji: '💬',
    description: 'Saludar, presentarte y pedir ayuda. Lo básico para hablar desde el primer día.',
    themes: ['frases utiles'],
  },
  { id: 'numeros', title: 'Números', emoji: '🔢', description: 'Del cero al millón.', themes: ['numeros'], order: NUMBERS },
  { id: 'colores', title: 'Colores', emoji: '🎨', description: 'Los colores para describir todo.', themes: ['colores'] },
  { id: 'familia', title: 'Familia', emoji: '👨‍👩‍👧', description: 'Tu familia y las personas cercanas.', themes: ['familia'] },
  { id: 'casa', title: 'Partes de la casa', emoji: '🏠', description: 'Piezas, muebles y cosas de la casa.', themes: ['casa'] },
  {
    id: 'dias',
    title: 'Días de la semana',
    emoji: '📅',
    description: 'Los días, las partes del día y hablar de "hoy", "mañana" y "ayer".',
    themes: ['dias'],
    order: [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'weekdays', 'weekend', 'today',
      'tomorrow', 'yesterday', 'the day after tomorrow', 'the day before yesterday', 'tonight', 'every day', 'day', 'week',
      'morning', 'afternoon', 'evening', 'night',
    ],
  },
  {
    id: 'meses',
    title: 'Meses',
    emoji: '🗓️',
    description: 'Los doce meses y palabras para hablar de fechas.',
    themes: ['meses'],
    order: [
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
      'December', 'month', 'year', 'date', 'birthday', 'calendar',
    ],
  },
  {
    id: 'estaciones',
    title: 'Estaciones del año',
    emoji: '🍂',
    description: 'Primavera, verano, otoño e invierno.',
    themes: ['estaciones'],
    order: ['spring', 'summer', 'autumn', 'fall', 'winter', 'season', 'vacation', 'leaf'],
  },
  { id: 'ropa', title: 'Ropa', emoji: '👕', description: 'Lo que te pones y cómo hablar de eso.', themes: ['ropa'] },
  { id: 'cuerpo', title: 'Partes del cuerpo', emoji: '🖐️', description: 'Para describir a alguien o explicar qué te duele.', themes: ['cuerpo'] },
  { id: 'animales', title: 'Animales', emoji: '🐶', description: 'Mascotas, animales de campo y de la selva.', themes: ['animales'] },
  {
    id: 'ordinales',
    title: 'Números ordinales',
    emoji: '🥇',
    description: 'Primero, segundo, tercero... hasta el décimo.',
    themes: ['ordinales'],
    order: ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'last', 'next'],
  },
  { id: 'profesiones', title: 'Profesiones', emoji: '👩‍⚕️', description: 'A qué se dedica cada persona.', themes: ['profesiones'] },
  { id: 'ciudad', title: 'Lugares de la ciudad', emoji: '🏙️', description: 'Lo que hay en una ciudad y cómo moverte por ella.', themes: ['ciudad', 'lugares'] },
  { id: 'transporte', title: 'Medios de transporte', emoji: '🚌', description: 'Cómo te mueves y cómo pedir un pasaje.', themes: ['transporte'] },
  { id: 'verbos', title: 'Los 50 verbos más usados', emoji: '🏃', description: 'Los verbos que más vas a usar al hablar.', themes: ['verbos basicos'] },
  { id: 'adjetivos', title: 'Adjetivos y antónimos', emoji: '↔️', description: 'Adjetivos básicos con su opuesto.', themes: ['adjetivos'] },
  { id: 'clima', title: 'El clima', emoji: '⛅', description: 'Cómo está el día y qué tiempo hace.', themes: ['clima'] },
  { id: 'sentimientos', title: 'Sentimientos', emoji: '😊', description: 'Cómo te sientes y cómo decirlo.', themes: ['sentimientos'] },
  { id: 'conectores', title: 'Conectores básicos', emoji: '🔗', description: 'Palabras para unir ideas: and, but, because...', themes: ['conectores'] },
  { id: 'comida', title: 'Comida', emoji: '🍎', description: 'Alimentos, bebidas y cómo pedir en un restaurante.', themes: ['comida'] },
]

export function findUnit(id: string | null): Unit | undefined {
  return id ? UNITS.find((u) => u.id === id) : undefined
}

export interface BankWord {
  term: string
  translation: string
  example: string
  note: string | null
  level: string
  theme: string
}

/** Las palabras de una unidad, en su orden natural (o alfabético si no hay uno). */
export function wordsForUnit(unit: Unit, bank: BankWord[]): BankWord[] {
  const words = bank.filter((w) => unit.themes.includes(w.theme) && w.translation)
  const rank = (w: BankWord) => {
    const i = unit.order?.indexOf(w.term) ?? -1
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return words.sort((a, b) => rank(a) - rank(b) || a.term.localeCompare(b.term))
}

/** La primera unidad que todavía no completaste. */
export function nextUnit(completed: Set<string>): Unit | undefined {
  return UNITS.find((u) => !completed.has(u.id))
}
