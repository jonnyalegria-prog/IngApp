import { useEffect, useState } from 'react'
import { checkGrammar, type GrammarMatch } from '../../lib/languagetool'
import { getWritingPrompts, type WritingPromptContent } from '../../lib/exerciseBank'
import { errorMessage, translateOne } from '../../lib/translate'
import TranslateLine from '../../components/TranslateLine'

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
      {matches && <GrammarMatches matches={matches} />}
    </div>
  )
}

function GrammarMatches({ matches }: { matches: GrammarMatch[] }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {matches.length === 0 ? (
        <p className="text-sm text-emerald-400">¡Sin errores de gramática detectados! 🎉</p>
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
  )
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?'"]/g, '').replace(/\s+/g, ' ').trim()
}

interface GuidedResult {
  matches: GrammarMatch[] | null
  backTranslation?: string
  backError?: string
  reference?: string
  correct?: boolean
}

function GuidedWriting() {
  const [prompts, setPrompts] = useState<WritingPromptContent[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<GuidedResult | null>(null)

  useEffect(() => {
    getWritingPrompts().then(setPrompts)
  }, [])

  if (!prompts) return <p className="text-slate-400">Cargando...</p>
  if (prompts.length === 0) return <p className="text-slate-400">Todavía no hay consignas cargadas.</p>
  const current = prompts[index % prompts.length]
  const isTranslation = current.topic === 'traduccion'
  const isCloze = current.topic === 'completar'
  // Las consignas "Traducí" traen la frase en español entre comillas.
  const sourceSentence = isTranslation ? current.instruction.match(/["“](.+)["”]/)?.[1] : undefined

  async function handleCheck() {
    if (!answer.trim()) return
    setChecking(true)
    setResult(null)
    try {
      if (isCloze) {
        setResult({ matches: null, correct: normalize(answer) === normalize(current.example ?? '') })
        return
      }
      // Gramática (LanguageTool) + "retro-traducción": DeepL vuelve tu frase al español
      // para que compares si dice lo que querías decir.
      // En las consignas "Traducí" también se trae la traducción de referencia de DeepL (ya cacheada).
      const [grammar, back, reference] = await Promise.allSettled([
        checkGrammar(answer),
        translateOne(answer.trim(), { from: 'en', to: 'es' }),
        sourceSentence ? translateOne(sourceSentence, { from: 'es', to: 'en', cache: true }) : Promise.resolve(undefined),
      ])
      setResult({
        matches: grammar.status === 'fulfilled' ? grammar.value : null,
        backTranslation: back.status === 'fulfilled' ? back.value : undefined,
        backError: back.status === 'rejected' ? errorMessage(back.reason) : undefined,
        reference: reference.status === 'fulfilled' ? reference.value : undefined,
      })
    } finally {
      setChecking(false)
    }
  }

  function next() {
    setIndex(index + 1)
    setAnswer('')
    setRevealed(false)
    setResult(null)
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-white">{current.instruction}</p>
      <textarea
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value)
          setResult(null)
        }}
        rows={3}
        maxLength={1000}
        placeholder="Escribí tu respuesta..."
        className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={handleCheck}
          disabled={checking || !answer.trim()}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {checking ? 'Revisando...' : 'Revisar'}
        </button>
        {current.example && (
          <button onClick={() => setRevealed(true)} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
            Ver ejemplo
          </button>
        )}
        <button onClick={next} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
          Siguiente
        </button>
      </div>

      {revealed && current.example && <p className="mt-3 text-sm italic text-emerald-400">Ejemplo: "{current.example}"</p>}
      {sourceSentence && !result && <TranslateLine text={sourceSentence} from="es" to="en" label="Ver la traducción de DeepL" />}

      {result?.correct !== undefined && (
        <p className={`mt-3 text-sm font-medium ${result.correct ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.correct ? '¡Correcto! 🎉' : `No coincide. Respuesta esperada: "${current.example}"`}
        </p>
      )}
      {result?.matches && <GrammarMatches matches={result.matches} />}
      {result && !isCloze && result.matches === null && (
        <p className="mt-3 text-sm text-amber-400">No se pudo conectar con el corrector de gramática.</p>
      )}
      {result?.reference && (
        <div className="mt-3 rounded-md border border-emerald-700/40 bg-emerald-950/30 p-3 text-sm">
          <p className="text-slate-400">Así lo traduce DeepL:</p>
          <p className="text-emerald-300">{result.reference}</p>
          <p className="mt-1 text-xs text-slate-500">Puede haber más de una forma correcta: fijate en el tiempo verbal y el orden.</p>
        </div>
      )}
      {result?.backTranslation && (
        <div className="mt-3 rounded-md border border-sky-700/40 bg-sky-950/30 p-3 text-sm">
          <p className="text-slate-400">Tu frase, en español, dice:</p>
          <p className="text-sky-300">{result.backTranslation}</p>
          {sourceSentence ? (
            <p className="mt-1 text-slate-400">
              La consigna decía: <span className="text-white">“{sourceSentence}”</span>
            </p>
          ) : (
            <p className="mt-1 text-slate-400">¿Es lo que querías decir?</p>
          )}
        </div>
      )}
      {result?.backError && <p className="mt-3 text-sm text-red-400">{result.backError}</p>}
    </div>
  )
}
