import { useEffect, useState } from 'react'
import { checkGrammar, type GrammarMatch } from '../../lib/languagetool'
import { getWritingPrompts, type WritingPromptContent } from '../../lib/exerciseBank'

export default function WritingPractice() {
  const [mode, setMode] = useState<'libre' | 'guiado'>('libre')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1">
        <button
          onClick={() => setMode('libre')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${mode === 'libre' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          Texto libre
        </button>
        <button
          onClick={() => setMode('guiado')}
          className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${mode === 'guiado' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          Consignas guiadas
        </button>
      </div>
      {mode === 'libre' ? <FreeWriting /> : <GuidedWriting />}
    </div>
  )
}

function FreeWriting() {
  const [text, setText] = useState('')
  const [matches, setMatches] = useState<GrammarMatch[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheck() {
    if (!text.trim()) return
    setChecking(true)
    setError(null)
    try {
      setMatches(await checkGrammar(text))
    } catch {
      setError('No se pudo conectar con el corrector. Probá de nuevo en un momento.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Today I learned that..."
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <button
        onClick={handleCheck}
        disabled={checking || !text.trim()}
        className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {checking ? 'Revisando...' : 'Revisar gramática'}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {matches && (
        <div className="mt-4 flex flex-col gap-2">
          {matches.length === 0 ? (
            <p className="text-sm text-emerald-400">¡Sin errores detectados! 🎉</p>
          ) : (
            matches.map((m, idx) => (
              <div key={idx} className="rounded-md border border-amber-700/40 bg-amber-950/30 p-3 text-sm">
                <p className="text-amber-300">{m.shortMessage}</p>
                <p className="text-slate-400">{m.message}</p>
                {m.suggestions.length > 0 && (
                  <p className="mt-1 text-slate-300">
                    Sugerencias: <span className="text-white">{m.suggestions.join(', ')}</span>
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function GuidedWriting() {
  const [prompts, setPrompts] = useState<WritingPromptContent[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    getWritingPrompts().then(setPrompts)
  }, [])

  if (!prompts) return <p className="text-slate-400">Cargando...</p>
  if (prompts.length === 0) return <p className="text-slate-400">Todavía no hay consignas cargadas.</p>
  const current = prompts[index % prompts.length]

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-white">{current.instruction}</p>
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        placeholder="Escribí tu respuesta..."
        className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <div className="mt-3 flex gap-2">
        {current.example && (
          <button onClick={() => setRevealed(true)} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
            Ver ejemplo
          </button>
        )}
        <button
          onClick={() => {
            setIndex(index + 1)
            setAnswer('')
            setRevealed(false)
          }}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Siguiente
        </button>
      </div>
      {revealed && current.example && <p className="mt-3 text-sm italic text-emerald-400">Ejemplo: "{current.example}"</p>}
    </div>
  )
}
