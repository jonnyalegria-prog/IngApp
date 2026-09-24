export interface Word {
  id: string
  term: string
  translation: string
  example?: string
  notes?: string
  createdAt: string
  interval: number
  repetitions: number
  easeFactor: number
  dueDate: string
  lastReviewed?: string
}

export interface GrammarTopic {
  id: string
  title: string
  notes: string
  createdAt: string
  lastReviewed?: string
}

export interface NotebookEntry {
  id: string
  classDate: string
  rawText: string
  createdAt: string
  vocabCount: number
  taskCount: number
  grammarSaved: boolean
}

export interface HomeworkTask {
  id: string
  text: string
  done: boolean
  createdAt: string
  /** Fecha (YYYY-MM-DD) de la clase que dejó la tarea; agrupa la lista por clase. */
  classDate?: string
  /** Cuándo se tildó como hecha; el progreso semanal cuenta por esta fecha. */
  completedAt?: string
  exerciseTopic?: string
}

export interface DiscoveryPick {
  id: string
  weekKey: string
  text: string
  source: 'suggestion' | 'own'
  createdAt: string
}

/** Una respuesta de práctica ya guardada (ver storage.logPractice). */
export interface PracticeRow {
  kind: string
  topic?: string
  item?: string
  correct: boolean
  createdAt: string
}

export type EnglishLevel = 'principiante' | 'intermedio' | 'avanzado'

export interface AppSettings {
  streak: number
  lastPracticeDate?: string
  level: EnglishLevel
}
