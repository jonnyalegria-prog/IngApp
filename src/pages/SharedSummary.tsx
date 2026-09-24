import { useParams } from 'react-router-dom'
import { fetchSharedSummary, type SharedSummary as SharedSummaryData } from '../lib/social'
import { kindLabel } from '../lib/progress'
import { useLoad } from '../lib/useLoad'
import LoadError from '../components/LoadError'

function formatDate(iso: string) {
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Página pública de solo lectura (sin iniciar sesión): la ve quien tenga el enlace que creaste en Ajustes.
export default function SharedSummary() {
  const { token = '' } = useParams()
  // Se envuelve el resultado: "el enlace no existe" (null) es una respuesta válida, distinta de "todavía cargando".
  const load = useLoad(async () => ({ summary: await fetchSharedSummary(token) }), [token])
  const summary = load.data?.summary

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <div className="text-sm font-semibold text-violet-400">IngApp</div>
        {summary && (
          <>
            <h1 className="text-2xl font-semibold text-white">Avance de {summary.name || 'estudio'}</h1>
            <p className="text-sm text-slate-400">Solo lectura · actualizado el {formatDate(summary.generatedAt)}</p>
          </>
        )}
      </header>

      {load.error && !load.data ? (
        <LoadError message={load.error} onRetry={load.reload} />
      ) : !load.data ? (
        <p className="text-slate-400">Cargando...</p>
      ) : summary ? (
        <Summary data={summary} />
      ) : (
        <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          Este enlace no existe o ya se desactivó. Si lo necesitas, pídele uno nuevo a quien te lo compartió.
        </p>
      )}
    </div>
  )
}

function Summary({ data }: { data: SharedSummaryData }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Racha" value={`🔥 ${data.streak}`} hint={data.lastPractice ? `última práctica: ${formatDate(data.lastPractice)}` : 'sin práctica aún'} />
        <Stat label="Palabras" value={String(data.wordsTotal)} hint={`${data.wordsMastered} dominadas`} />
        <Stat label="Días practicando" value={`${data.daysPracticed30}/30`} hint="últimos 30 días" />
        <Stat label="Respuestas" value={String(data.answers30)} hint="últimos 30 días" />
      </div>

      {data.lastClass && (
        <Panel title="Última clase">
          <p className="text-sm text-slate-300">
            Clase del {formatDate(data.lastClass.date)}: {data.lastClass.vocab} palabra(s) nuevas y {data.lastClass.tasks} tarea(s).
          </p>
          {data.tasksLastClass.total > 0 && (
            <p className="mt-1 text-sm text-slate-300">
              Tareas hechas: <strong className="text-white">{data.tasksLastClass.done}</strong> de {data.tasksLastClass.total}
            </p>
          )}
        </Panel>
      )}

      {data.byKind.length > 0 && (
        <Panel title="Cuánto acierta en cada práctica (30 días)">
          <div className="flex flex-col gap-2">
            {data.byKind.map((k) => {
              const pct = Math.round((k.correct / k.total) * 100)
              return (
                <div key={k.kind} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 truncate text-slate-300">{kindLabel(k.kind)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-slate-400">
                    {pct}% · {k.total}
                  </span>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      {data.weakTopics.length > 0 && (
        <Panel title="Temas que más cuestan">
          <ul className="flex flex-col gap-1 text-sm text-slate-300">
            {data.weakTopics.map((t) => (
              <li key={t.topic}>
                • {t.topic} <span className="text-xs text-rose-300">({t.pct}% bien en {t.total} intentos)</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {data.recentWords.length > 0 && (
        <Panel title="Últimas palabras que agregó">
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {data.recentWords.map((w) => (
              <li key={w.term} className="text-slate-300">
                <span className="text-white" lang="en" translate="no">
                  {w.term}
                </span>{' '}
                — {w.translation}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-xs text-slate-400">
        Este enlace es de solo lectura y muestra solo cifras y palabras de vocabulario. No incluye el Diario ni los apuntes de clase.
      </p>
    </>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-slate-300">{label}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">{hint}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-2 font-medium text-white">{title}</h2>
      {children}
    </section>
  )
}
