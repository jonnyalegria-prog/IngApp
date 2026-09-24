import { useEffect, useState } from 'react'
import * as storage from '../lib/storage'
import { canSpeak, speak } from '../lib/speech'
import { errorMessage, fetchVocabSuggestions, type VocabSuggestion } from '../lib/translate'
import { useVocabStore, type AddResult } from '../store/useVocabStore'
import type { AppSettings, EnglishLevel } from '../lib/types'

const LEVEL_LABELS: Record<EnglishLevel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

interface Props {
  onAdd: (term: string, translation: string, example?: string) => Promise<AddResult | 'error'>
}

/** "Palabras nuevas para ti": sugerencias por nivel con traducción de DeepL según el ejemplo. */
export default function VocabSuggestions({ onAdd }: Props) {
  const words = useVocabStore((s) => s.words)
  const [settings, setSettings] = useState<AppSettings>({ streak: 0, level: 'principiante' })
  const [suggestions, setSuggestions] = useState<VocabSuggestion[]>([])
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    storage.getSettings().then(setSettings).catch(() => {})
  }, [])

  async function changeLevel(level: EnglishLevel) {
    const updated = { ...settings, level }
    setSettings(updated)
    setSuggestions([])
    setExhausted(false)
    setAsked(false)
    setError(null)
    try {
      await storage.saveSettings(updated)
    } catch {
      // el nivel igual se usa en esta sesión
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const exclude = [...words.map((w) => w.term), ...suggestions.map((s) => s.term)]
      const res = await fetchVocabSuggestions(settings.level, 5, exclude)
      setSuggestions(res.suggestions)
      setExhausted(res.exhausted)
      setAsked(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function add(s: VocabSuggestion) {
    // Si ya la tenías, también queda marcada como agregada.
    const outcome = await onAdd(s.term, s.translation, s.example)
    if (outcome !== 'error') setAdded((prev) => new Set(prev).add(s.term))
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-white">Palabras nuevas para ti</h2>
        <select
          value={settings.level}
          onChange={(e) => changeLevel(e.target.value as EnglishLevel)}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
        >
          {(Object.keys(LEVEL_LABELS) as EnglishLevel[]).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Vocabulario de tu nivel, traducido según el ejemplo para que el significado sea el correcto.
      </p>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-slate-800 rounded-md border border-slate-800">
          {suggestions.map((s) => (
            <div key={s.term} className="flex items-start justify-between gap-3 p-3">
              <div>
                <div className="flex items-center gap-2 font-medium text-white">
                  {s.term}
                  {canSpeak() && (
                    <button onClick={() => speak(s.term)} className="text-slate-400 hover:text-violet-400" title="Escuchar">
                      🔊
                    </button>
                  )}
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">{s.theme}</span>
                </div>
                <div className="text-sm text-sky-300">{s.translation}</div>
                <div className="text-xs italic text-slate-400">"{s.example}"</div>
                {s.note && <div className="mt-1 text-xs text-amber-400">⚠ {s.note}</div>}
              </div>
              <button
                onClick={() => add(s)}
                disabled={added.has(s.term)}
                className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:bg-slate-800 disabled:text-emerald-400"
              >
                {added.has(s.term) ? '✓ Agregada' : 'Agregar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {asked && exhausted && suggestions.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">¡Ya tienes todas las palabras del banco para este nivel! Prueba con otro nivel.</p>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={load}
        disabled={loading}
        className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
      >
        {loading ? 'Buscando...' : suggestions.length > 0 ? 'Otras 5 palabras' : 'Dame 5 palabras'}
      </button>
    </section>
  )
}
