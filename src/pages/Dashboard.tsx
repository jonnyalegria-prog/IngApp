import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Dumbbell,
  Flame,
  GraduationCap,
  Lightbulb,
  PenLine,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useVocabStore } from '../store/useVocabStore'
import * as storage from '../lib/storage'
import { getWeekKey, localDateString } from '../lib/week'
import { exportAllData } from '../lib/exportData'
import { achievements, calculatePoints } from '../lib/gamification'
import { DAILY_GOAL, KIND_TAB, accuracyByKind, answersToday, goalFraction, kindLabel, lastPracticedKind, weakTopics } from '../lib/progress'
import { nextUnit, UNITS } from '../lib/units'
import { useLoad } from '../lib/useLoad'
import LoadError from '../components/LoadError'
import type { DiscoveryPick, GrammarTopic, HomeworkTask, NotebookEntry, PracticeRow, Word } from '../lib/types'

export default function Dashboard() {
  const { words, loaded, load, dueWords } = useVocabStore()
  const data = useLoad(async () => {
    const [tasks, picks, notebookEntries, grammarTopics, settings, log, units] = await Promise.all([
      storage.getHomeworkTasks(),
      storage.getDiscoveryPicks(),
      storage.getNotebookEntries(),
      storage.getGrammarTopics(),
      storage.getSettings(),
      // El registro de práctica es un extra: si falla, el resto del Inicio igual se ve.
      storage.getPracticeLog(30).catch((): PracticeRow[] => []),
      storage.getUnitProgress().catch((): storage.UnitProgress[] => []),
    ])
    return { tasks, picks, notebookEntries, grammarTopics, settings, log, units }
  })

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  if (data.error && !data.data) return <LoadError message={data.error} onRetry={data.reload} />
  if (!data.data) return <p className="text-slate-400">Cargando...</p>

  const { tasks, picks, notebookEntries, grammarTopics, settings, log, units } = data.data
  const completedUnits = new Set(units.filter((u) => u.completedAt).map((u) => u.unitId))
  const upNext = nextUnit(completedUnits)
  const streak = settings.streak
  const practicedToday = settings.lastPracticeDate === localDateString()
  const answered = answersToday(log)
  const weak = weakTopics(log)

  const due = dueWords().length
  const next = nextStep(due, lastPracticedKind(log))
  const pendingTasks = tasks.filter((t) => !t.done).length
  const tasksCompleted = tasks.filter((t) => t.done).length
  const weekKey = getWeekKey()
  const picksThisWeek = picks.filter((p) => p.weekKey === weekKey).length

  const weekCounts = new Map<string, number>()
  for (const p of picks) weekCounts.set(p.weekKey, (weekCounts.get(p.weekKey) ?? 0) + 1)
  const completeWeeks = [...weekCounts.values()].filter((c) => c >= 3).length

  const gData = {
    wordsCount: words.length,
    streak,
    tasksCompleted,
    notebookEntries: notebookEntries.length,
    discoveryPicksTotal: picks.length,
    completeWeeks,
  }
  const points = calculatePoints(gData)
  const unlockedAchievements = achievements.filter((a) => a.check(gData))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">¡Hola de nuevo! 👋</h1>
        <p className="text-slate-400">Tu compañero para las clases de inglés, todos los días.</p>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-4">
        <Flame size={32} className="shrink-0 text-amber-400" fill="currentColor" />
        <div className="min-w-0 flex-1">
          <div className="text-xl font-semibold text-white">
            {streak === 0 ? 'Aún sin racha' : `${streak} ${streak === 1 ? 'día' : 'días'} de racha`}
          </div>
          <div className="text-sm text-slate-300">
            {practicedToday
              ? '¡Hoy ya practicaste! Vuelve mañana.'
              : streak > 0
                ? 'Practica hoy para no perderla.'
                : 'Practica hoy y parte tu racha.'}
          </div>
        </div>
        <GoalRing count={answered} />
      </div>

      <Link
        to={next.to}
        className="flex items-center justify-between gap-3 rounded-2xl border border-violet-600 bg-violet-950/40 p-4 transition hover:border-violet-400"
      >
        <div>
          <div className="text-xs uppercase tracking-wide text-violet-300">{next.kicker}</div>
          <div className="text-lg font-semibold text-white">{next.title}</div>
        </div>
        <ArrowRight className="shrink-0 text-violet-300" />
      </Link>

      {upNext && (
        <Link
          to={`/practicar?tab=ruta&unit=${upNext.id}`}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4 transition hover:border-violet-500"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tu ruta de aprendizaje</span>
            <span>
              {completedUnits.size}/{UNITS.length} unidades
            </span>
          </div>
          <div className="mt-1 text-base font-medium text-white">
            <span aria-hidden="true">{upNext.emoji}</span> Sigue con: {upNext.title}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round((completedUnits.size / UNITS.length) * 100)}%` }} />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Para repasar hoy" value={String(due)} />
        <StatCard label="Palabras totales" value={String(words.length)} />
        <StatCard label="Puntos" value={String(points)} />
      </div>

      <div className="rounded-2xl border border-violet-700/40 bg-violet-950/20 p-4">
        <h2 className="mb-2 text-sm font-medium text-violet-300">Antes de tu próxima clase</h2>
        <div className="flex flex-col gap-2 text-sm text-slate-300">
          <Link to="/mi-clase?tab=tareas" className="flex items-center gap-2 hover:text-white">
            <ClipboardList size={16} className="text-violet-400" />
            {pendingTasks === 0 ? '¡No tienes tareas pendientes! 🎉' : `${pendingTasks} tarea(s) pendiente(s)`}
          </Link>
          <Link to="/mi-clase?tab=descubrir" className="flex items-center gap-2 hover:text-white">
            <Lightbulb size={16} className="text-violet-400" />
            Mis 3 cosas de la semana: {picksThisWeek}/3
          </Link>
        </div>
      </div>

      {weak.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Target size={18} className="text-rose-400" />
            <h2 className="font-medium text-white">Para reforzar</h2>
          </div>
          <p className="mb-3 text-sm text-slate-400">Estos temas te han costado más en las últimas semanas:</p>
          <div className="flex flex-col gap-2">
            {weak.map((t) => (
              <Link
                key={`${t.kind}|${t.key}`}
                to={`/practicar?tab=${KIND_TAB[t.kind] ?? 'gramatica'}`}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 hover:border-violet-500"
              >
                <span>{t.key}</span>
                <span className="text-xs text-rose-300">
                  {t.pct}% bien · {t.total} intentos
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          to="/practicar"
          title="Practicar"
          description={due > 0 ? `${due} esperando repaso` : 'Al día'}
          icon={Dumbbell}
          highlight
        />
        <ActionCard to="/mi-clase" title="Mi Clase" description="Notas, tareas y gramática" icon={GraduationCap} />
        <ActionCard to="/vocabulario" title="Vocabulario" description="Tu lista de palabras" icon={BookOpen} />
        <ActionCard to="/diario" title="Diario" description="Escribe y te ayudo a corregir" icon={PenLine} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          <h2 className="font-medium text-white">Logros ({unlockedAchievements.length}/{achievements.length})</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {achievements.map((a) => {
            const unlocked = a.check(gData)
            return (
              <div
                key={a.id}
                title={a.description}
                className={`rounded-xl border p-3 text-center ${
                  unlocked ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-800 bg-slate-950/40 opacity-50'
                }`}
              >
                <div className="text-xl">{unlocked ? '🏆' : '🔒'}</div>
                <div className="mt-1 text-[11px] font-medium text-slate-200">{a.title}</div>
              </div>
            )
          })}
        </div>
      </div>

      <ProgressSection
        words={words}
        picks={picks}
        tasks={tasks}
        notebookEntries={notebookEntries}
        grammarTopics={grammarTopics}
        log={log}
      />

      <button onClick={() => void exportAllData()} className="self-start text-xs text-slate-400 underline hover:text-slate-300">
        Exportar mis datos (backup)
      </button>
    </div>
  )
}

interface NextStep {
  to: string
  kicker: string
  title: string
}

// El botón grande del Inicio: lo que toca ahora, o seguir con lo último que hiciste.
function nextStep(due: number, lastKind: string | null): NextStep {
  if (due > 0) {
    return { to: '/practicar?tab=vocabulario', kicker: 'Te toca hoy', title: `Repasar ${due} ${due === 1 ? 'palabra' : 'palabras'}` }
  }
  const tab = lastKind ? KIND_TAB[lastKind] : undefined
  if (lastKind && tab) {
    return { to: `/practicar?tab=${tab}`, kicker: 'Seguir donde quedaste', title: kindLabel(lastKind) }
  }
  return { to: '/practicar', kicker: 'Para empezar', title: 'Elige qué practicar' }
}

function GoalRing({ count }: { count: number }) {
  const size = 64
  const stroke = 6
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const done = count >= DAILY_GOAL
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Meta de hoy">
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - goalFraction(count))}
          className={done ? 'text-emerald-400' : 'text-amber-400'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
        <span className="text-sm font-semibold text-white">{done ? '✓' : Math.min(count, DAILY_GOAL)}</span>
        <span className="text-[10px] text-slate-400">de {DAILY_GOAL}</span>
      </div>
    </div>
  )
}

function weeklyBuckets<T>(items: T[], getWeekKeyOf: (item: T) => string, weeks: number): { label: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const key = getWeekKeyOf(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  const result: { label: string; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    const key = getWeekKey(d)
    result.push({ label: key.split('-W')[1], count: counts[key] ?? 0 })
  }
  return result
}

function ProgressSection({
  words,
  picks,
  tasks,
  notebookEntries,
  grammarTopics,
  log,
}: {
  words: Word[]
  picks: DiscoveryPick[]
  tasks: HomeworkTask[]
  notebookEntries: NotebookEntry[]
  grammarTopics: GrammarTopic[]
  log: PracticeRow[]
}) {
  const accuracy = accuracyByKind(log)
  const wordsPerWeek = weeklyBuckets(words, (w) => getWeekKey(new Date(w.createdAt)), 8)
  const picksPerWeek = weeklyBuckets(picks, (p) => p.weekKey, 8)
  const tasksDonePerWeek = weeklyBuckets(
    tasks.filter((t) => t.done),
    // Cuenta en la semana en que se tildó (las viejas sin fecha usan la de creación).
    (t) => getWeekKey(new Date(t.completedAt ?? t.createdAt)),
    8,
  )
  const classesPerWeek = weeklyBuckets(notebookEntries, (n) => getWeekKey(new Date(n.classDate + 'T00:00:00')), 8)

  const hasAnyData = words.length > 0 || picks.length > 0 || tasks.length > 0 || notebookEntries.length > 0
  if (!hasAnyData) return null

  const wordsMastered = words.filter((w) => w.repetitions >= 3).length

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 font-medium text-white">Tu progreso (últimas 8 semanas)</h2>
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-lg font-semibold text-white">{wordsMastered}</div>
          <div className="text-[11px] text-slate-400">Palabras dominadas</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-white">{grammarTopics.length}</div>
          <div className="text-[11px] text-slate-400">Temas de gramática</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-white">{notebookEntries.length}</div>
          <div className="text-[11px] text-slate-400">Clases registradas</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniBarChart title="Palabras nuevas por semana" data={wordsPerWeek} color="#7c3aed" />
        <MiniBarChart title="Mis 3 cosas completadas" data={picksPerWeek} color="#059669" />
        <MiniBarChart title="Tareas completadas por semana" data={tasksDonePerWeek} color="#f59e0b" />
        <MiniBarChart title="Clases registradas por semana" data={classesPerWeek} color="#38bdf8" />
      </div>
      {accuracy.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-slate-400">Cuánto aciertas en cada práctica (últimos 30 días)</p>
          <div className="flex flex-col gap-2">
            {accuracy.map((a) => (
              <div key={a.key} className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0 truncate text-slate-300">{kindLabel(a.key)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-slate-400">
                  {a.pct}% · {a.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniBarChart({ title, data, color }: { title: string; data: { label: string; count: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">{title}</p>
      <div className="flex h-20 items-end gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-sm"
              style={{ height: `${Math.max((d.count / max) * 100, 4)}%`, backgroundColor: color }}
              title={`Semana ${d.label}: ${d.count}`}
            />
            <span className="text-[9px] text-slate-400">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}

function ActionCard({
  to,
  title,
  description,
  icon: Icon,
  highlight,
}: {
  to: string
  title: string
  description: string
  icon: LucideIcon
  highlight?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-violet-500 ${
        highlight ? 'border-violet-600 bg-violet-950/40' : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${highlight ? 'bg-violet-600' : 'bg-slate-800'}`}>
        <Icon size={20} className={highlight ? 'text-white' : 'text-violet-400'} />
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="mt-0.5 text-xs text-slate-400">{description}</div>
      </div>
    </Link>
  )
}
