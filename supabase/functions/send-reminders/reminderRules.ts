// Reglas de los recordatorios: qué avisar y cuándo. Son funciones puras (sin Deno ni red) para poder probarlas
// con Vitest; la función `send-reminders` las usa tal cual.

export interface ReminderPrefs {
  enabled: boolean
  /** Hora local (0 a 23) a la que quieres el aviso. */
  hour: number
  /** Avisar la víspera de la clase si quedan tareas. */
  classEve: boolean
  /** Día de tu clase: 0 = domingo ... 6 = sábado. */
  classWeekday: number
  /** Última fecha local (YYYY-MM-DD) en que se mandó cada aviso, para no repetirlo el mismo día. */
  lastDailySent: string | null
  lastEveSent: string | null
}

export interface UserSnapshot {
  dueWords: number
  pendingTasks: number
  practicedToday: boolean
  streak: number
}

export interface Reminder {
  kind: 'daily' | 'eve'
  title: string
  body: string
  /** Ruta dentro de la app (después de #). */
  url: string
  tag: string
}

/** Cuántas horas después de la hora elegida todavía se manda el aviso (por si una ejecución falló). */
export const CATCH_UP_HOURS = 2

export function localParts(now: Date, timeZone: string): { date: string; hour: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')) % 24,
    weekday: weekdays.indexOf(get('weekday')),
  }
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export function decideReminders(now: Date, timeZone: string, prefs: ReminderPrefs, snap: UserSnapshot): Reminder[] {
  if (!prefs.enabled) return []
  const local = localParts(now, timeZone)
  const inWindow = local.hour >= prefs.hour && local.hour <= prefs.hour + CATCH_UP_HOURS
  if (!inWindow) return []

  const out: Reminder[] = []

  if (prefs.lastDailySent !== local.date && !snap.practicedToday) {
    if (snap.streak >= 2) {
      out.push({
        kind: 'daily',
        title: `🔥 No pierdas tu racha de ${snap.streak} días`,
        body:
          snap.dueWords > 0
            ? `Te ${plural(snap.dueWords, 'espera 1 palabra', `esperan ${snap.dueWords} palabras`)}. Son solo unos minutitos.`
            : 'Practica un ratito hoy y la mantienes.',
        url: '/practicar?tab=vocabulario',
        tag: 'daily',
      })
    } else if (snap.dueWords > 0) {
      out.push({
        kind: 'daily',
        title: `📚 Te ${plural(snap.dueWords, 'espera 1 palabra', `esperan ${snap.dueWords} palabras`)}`,
        body: 'Un repaso cortito y listo. ¡Tú puedes!',
        url: '/practicar?tab=vocabulario',
        tag: 'daily',
      })
    }
  }

  // La víspera de la clase (el día anterior al día de la clase).
  const eveWeekday = (prefs.classWeekday + 6) % 7
  if (prefs.classEve && local.weekday === eveWeekday && prefs.lastEveSent !== local.date && snap.pendingTasks > 0) {
    out.push({
      kind: 'eve',
      title: '📝 Mañana es tu clase',
      body: `Te ${plural(snap.pendingTasks, 'falta 1 tarea', `faltan ${snap.pendingTasks} tareas`)}. ¡Todavía alcanzas a hacerla${snap.pendingTasks === 1 ? '' : 's'}!`,
      url: '/mi-clase?tab=tareas',
      tag: 'eve',
    })
  }

  return out
}
