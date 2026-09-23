import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, GraduationCap, BookOpen, PenLine, ClipboardList, Lightbulb, Trophy, type LucideIcon } from 'lucide-react'
import { useVocabStore } from '../store/useVocabStore'
import * as storage from '../lib/storage'
import { getWeekKey } from '../lib/week'
import { exportAllData } from '../lib/exportData'
import { achievements, calculatePoints } from '../lib/gamification'
import type { DiscoveryPick, GrammarTopic, HomeworkTask, NotebookEntry, Word } from '../lib/types'

export default function Dashboard() {
  const { words, loaded, load, dueWords } = useVocabStore()
  const [tasks, setTasks] = useState<HomeworkTask[]>([])
  const [picks, setPicks] = useState<DiscoveryPick[]>([])
  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>([])
  const [grammarTopics, setGrammarTopics] = useState<GrammarTopic[]>([])
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    if (!loaded) load()
    storage.getHomeworkTasks().then(setTasks)
    storage.getDiscoveryPicks().then(setPicks)
    storage.getNotebookEntries().then(setNotebookEntries)
    storage.getGrammarTopics().then(setGrammarTopics)
    storage.getSettings().then((s) => setStreak(s.streak))
  }, [loaded, load])

  const due = dueWords().length
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
        <h1 className="text-2xl font-semibold text-white">Hola de nuevo 👋</h1>
        <p className="text-slate-400">Tu complemento diario para las clases de inglés.</p>
      </div>

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
            {pendingTasks === 0 ? 'No tenés tareas pendientes' : `${pendingTasks} tarea(s) pendiente(s)`}
          </Link>
          <Link to="/mi-clase?tab=descubrir" className="flex items-center gap-2 hover:text-white">
            <Lightbulb size={16} className="text-violet-400" />
            Mis 3 cosas de la semana: {picksThisWeek}/3
          </Link>
        </div>
      </div>

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
        <ActionCard to="/diario" title="Diario" description="Escribí y corregí" icon={PenLine} />
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

      <ProgressSection words={words} picks={picks} tasks={tasks} notebookEntries={notebookEntries} grammarTopics={grammarTopics} />

      <button onClick={() => exportAllData()} className="self-start text-xs text-slate-500 underline hover:text-slate-300">
        Exportar mis datos (backup)
      </button>
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
}: {
  words: Word[]
  picks: DiscoveryPick[]
  tasks: HomeworkTask[]
  notebookEntries: NotebookEntry[]
  grammarTopics: GrammarTopic[]
}) {
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
            <span className="text-[9px] text-slate-500">{d.count}</span>
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
