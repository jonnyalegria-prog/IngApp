import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVocabStore } from '../store/useVocabStore'
import { speak, canSpeak } from '../lib/speech'
import { isDue } from '../lib/srs'
import { errorMessage, translateOne } from '../lib/translate'
import VocabSuggestions from '../components/VocabSuggestions'
import type { Word } from '../lib/types'

export default function Vocabulary() {
  const { words, loaded, load, addWord, removeWord } = useVocabStore()

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Vocabulario</h1>
        <p className="text-slate-400">
          Para cargar todo lo de una clase de una vez, usá el{' '}
          <Link to="/mi-clase?tab=notas" className="text-violet-400 hover:underline">
            Cuaderno
          </Link>
          . Acá podés agregar palabras sueltas rápido.
        </p>
      </div>
      <AddWordForm onAdd={addWord} />
      <VocabSuggestions existingTerms={words.map((w) => w.term)} onAdd={addWord} />
      <WordList words={words} onRemove={removeWord} />
    </div>
  )
}

// DeepL capitaliza como si fuera una oración; para palabras sueltas se respeta la mayúscula del original.
function matchCase(source: string, result: string): string {
  const isSentence = /[.!?]$/.test(result) || result.trim().split(/\s+/).length > 4
  if (isSentence || source.charAt(0) !== source.charAt(0).toLowerCase()) return result
  return result.charAt(0).toLowerCase() + result.slice(1)
}

function AddWordForm({
  onAdd,
}: {
  onAdd: (term: string, translation: string, example?: string) => Promise<void>
}) {
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [example, setExample] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)

  // Con uno solo de los dos campos completo, DeepL completa el otro (el ejemplo sirve de contexto).
  const canTranslate = !translating && Boolean(term.trim()) !== Boolean(translation.trim())

  async function handleTranslate() {
    setTranslating(true)
    setTranslateError(null)
    try {
      if (term.trim()) {
        const text = term.trim()
        const result = await translateOne(text, {
          from: 'en',
          to: 'es',
          context: example.trim() || undefined,
          cache: text.length <= 60,
        })
        setTranslation(matchCase(text, result))
      } else {
        const text = translation.trim()
        const result = await translateOne(text, { from: 'es', to: 'en', cache: text.length <= 60 })
        setTerm(matchCase(text, result))
      }
    } catch (err) {
      setTranslateError(errorMessage(err))
    } finally {
      setTranslating(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!term.trim() || !translation.trim()) return
    await onAdd(term.trim(), translation.trim(), example.trim())
    setTerm('')
    setTranslation('')
    setExample('')
    setTranslateError(null)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 font-medium text-white">Agregar palabra o frase</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Palabra o frase en inglés"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <input
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          placeholder="Significado en español"
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
      </div>
      <input
        value={example}
        onChange={(e) => setExample(e.target.value)}
        placeholder="Ejemplo de uso (opcional)"
        className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Agregar
        </button>
        <button
          type="button"
          onClick={handleTranslate}
          disabled={!canTranslate}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          {translating ? 'Traduciendo...' : '🌐 Traducir'}
        </button>
        <span className="text-xs text-slate-500">Completá un campo y traduzco el otro.</span>
      </div>
      {translateError && <p className="mt-2 text-sm text-red-400">{translateError}</p>}
    </form>
  )
}

function WordList({
  words,
  onRemove,
}: {
  words: Word[]
  onRemove: (id: string) => Promise<void>
}) {
  return (
    <div>
      <h2 className="mb-3 font-medium text-white">Todas tus palabras ({words.length})</h2>
      <div className="flex flex-col divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
        {words.length === 0 && <p className="p-4 text-sm text-slate-400">Todavía no agregaste vocabulario.</p>}
        {[...words].reverse().map((word) => (
          <div key={word.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                {word.term}
                {canSpeak() && (
                  <button onClick={() => speak(word.term)} className="text-slate-500 hover:text-violet-400" title="Escuchar">
                    🔊
                  </button>
                )}
                {isDue(word) && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">a repasar</span>}
              </div>
              <div className="text-sm text-slate-400">{word.translation}</div>
              {word.example && <div className="text-xs italic text-slate-500">"{word.example}"</div>}
            </div>
            <button onClick={() => onRemove(word.id)} className="text-slate-500 hover:text-red-400">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
