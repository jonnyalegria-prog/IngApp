import { useMemo, useState } from 'react'
import * as storage from '../lib/storage'
import { getWeekKey } from '../lib/week'
import { getWeeklySuggestions } from '../lib/suggestions'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../lib/toast'
import LoadError from '../components/LoadError'
import type { AppSettings, DiscoveryPick, EnglishLevel } from '../lib/types'

const LEVEL_LABELS: Record<EnglishLevel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export default function Discovery() {
  const toast = useToast()
  const load = useLoad(async () => {
    const [settings, picks] = await Promise.all([storage.getSettings(), storage.getDiscoveryPicks()])
    return { settings, picks }
  })
  const settings: AppSettings = load.data?.settings ?? { streak: 0, level: 'principiante' }
  const picks = useMemo(() => load.data?.picks ?? [], [load.data])
  const setPicks = (next: DiscoveryPick[] | ((prev: DiscoveryPick[]) => DiscoveryPick[])) =>
    load.setData((prev) => ({
      settings: prev?.settings ?? { streak: 0, level: 'principiante' },
      picks: typeof next === 'function' ? next(prev?.picks ?? []) : next,
    }))
  const [ownText, setOwnText] = useState('')

  const weekKey = getWeekKey()

  const thisWeekPicks = useMemo(() => picks.filter((p) => p.weekKey === weekKey), [picks, weekKey])
  const pastWeeks = useMemo(() => {
    const groups = new Map<string, DiscoveryPick[]>()
    for (const pick of picks) {
      if (pick.weekKey === weekKey) continue
      if (!groups.has(pick.weekKey)) groups.set(pick.weekKey, [])
      groups.get(pick.weekKey)!.push(pick)
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [picks, weekKey])

  const suggestions = getWeeklySuggestions(settings.level).filter(
    (s) => !thisWeekPicks.some((p) => p.text === s.title),
  )

  async function changeLevel(level: EnglishLevel) {
    const updated = { ...settings, level }
    load.setData((prev) => ({ picks: prev?.picks ?? [], settings: updated }))
    await toast.run(() => storage.saveSettings(updated), 'No pude guardar tu nivel.')
  }

  async function addPick(text: string, source: 'suggestion' | 'own') {
    if (!text.trim() || thisWeekPicks.length >= 3) return
    const pick: DiscoveryPick = {
      id: crypto.randomUUID(),
      weekKey,
      text: text.trim(),
      source,
      createdAt: new Date().toISOString(),
    }
    const result = await toast.run(() => storage.saveDiscoveryPick(pick), 'No pude guardar eso.')
    if (!result.ok) return
    setPicks((prev) => [pick, ...prev])
    setOwnText('')
  }

  async function removePick(pick: DiscoveryPick) {
    const result = await toast.run(() => storage.deleteDiscoveryPick(pick.id), 'No pude borrarlo.')
    if (!result.ok) return
    setPicks((prev) => prev.filter((p) => p.id !== pick.id))
    toast.undo('Eliminado', async () => {
      const restored = await toast.run(() => storage.saveDiscoveryPick(pick), 'No pude recuperarlo.')
      if (restored.ok) setPicks((prev) => [pick, ...prev])
    })
  }

  const complete = thisWeekPicks.length >= 3

  if (load.error && !load.data) return <LoadError message={load.error} onRetry={load.reload} />
  if (load.loading) return <p className="text-slate-400">Cargando...</p>

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-slate-400">
        Lo que tu profe te pide cada clase: 3 cosas nuevas que aprendiste durante la semana. Anótalas acá a
        medida que las vas encontrando, así llegas al domingo con todo listo.
      </p>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-white">
            Esta semana: {thisWeekPicks.length}/3 {complete && '✅'}
          </h2>
        </div>

        {thisWeekPicks.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {thisWeekPicks.map((pick) => (
              <div key={pick.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <span className="text-sm text-white">{pick.text}</span>
                <button
                  onClick={() => void removePick(pick)}
                  className="shrink-0 text-slate-400 hover:text-red-400"
                  aria-label="Borrar"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {!complete && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void addPick(ownText, 'own')
              }}
              className="flex gap-2"
            >
              <input
                value={ownText}
                onChange={(e) => setOwnText(e.target.value)}
                placeholder="Algo que aprendiste esta semana..."
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!ownText.trim()}
                className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
              >
                Agregar
              </button>
            </form>

            {suggestions.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-slate-400">¿No se te ocurre nada? Estas son algunas ideas:</p>
                  <select
                    value={settings.level}
                    onChange={(e) => void changeLevel(e.target.value as EnglishLevel)}
                    className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                  >
                    {(Object.keys(LEVEL_LABELS) as EnglishLevel[]).map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABELS[l]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  {suggestions.map((item) => (
                    <div key={item.id} className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-violet-300">{item.title}</div>
                          <p className="mt-1 text-sm text-slate-300">{item.explanation}</p>
                          <p className="mt-1 text-xs italic text-slate-400">"{item.example}"</p>
                        </div>
                        <button
                          onClick={() => void addPick(item.title, 'suggestion')}
                          className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                        >
                          Usar esta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {pastWeeks.length > 0 && (
        <div>
          <h2 className="mb-2 font-medium text-white">Semanas anteriores</h2>
          <div className="flex flex-col gap-2">
            {pastWeeks.map(([week, weekPicks]) => (
              <div key={week} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 text-xs text-slate-400">Semana {week}</div>
                <ul className="flex flex-col gap-1">
                  {weekPicks.map((pick) => (
                    <li key={pick.id} className="text-sm text-slate-300">
                      • {pick.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
