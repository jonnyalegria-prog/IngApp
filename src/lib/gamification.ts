export interface GamificationData {
  wordsCount: number
  streak: number
  tasksCompleted: number
  notebookEntries: number
  discoveryPicksTotal: number
  completeWeeks: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  check: (d: GamificationData) => boolean
}

export const achievements: Achievement[] = [
  { id: 'first-word', title: 'Primer paso', description: 'Agregaste tu primera palabra', check: (d) => d.wordsCount >= 1 },
  { id: 'vocab-25', title: 'Vocabulario en marcha', description: '25 palabras cargadas', check: (d) => d.wordsCount >= 25 },
  { id: 'vocab-100', title: 'Coleccionista', description: '100 palabras cargadas', check: (d) => d.wordsCount >= 100 },
  { id: 'streak-7', title: 'Una semana seguida', description: '7 días de racha', check: (d) => d.streak >= 7 },
  { id: 'streak-30', title: 'Un mes de constancia', description: '30 días de racha', check: (d) => d.streak >= 30 },
  { id: 'notebook-5', title: 'Cuaderno ordenadito', description: '5 clases registradas', check: (d) => d.notebookEntries >= 5 },
  { id: 'tasks-10', title: 'Cumplidor', description: '10 tareas completadas', check: (d) => d.tasksCompleted >= 10 },
  { id: 'weeks-5', title: 'Reportero semanal', description: '5 semanas con "Mis 3 cosas" completas', check: (d) => d.completeWeeks >= 5 },
]

export function calculatePoints(d: GamificationData): number {
  return d.wordsCount * 5 + d.notebookEntries * 10 + d.tasksCompleted * 5 + d.discoveryPicksTotal * 3 + d.streak * 2
}
