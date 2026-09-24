import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Pencil, X } from 'lucide-react'
import { useVocabStore, type AddResult } from '../store/useVocabStore'
import { speak, canSpeak } from '../lib/speech'
import { isDue } from '../lib/srs'
import { looksReversed } from '../lib/notesParser'
import { termKey } from '../lib/classSave'
import { errorMessage, matchCase, translateOne } from '../lib/translate'
import { friendlyError } from '../lib/errors'
import { useToast } from '../lib/toast'
import VocabSuggestions from '../components/VocabSuggestions'
import LoadError from '../components/LoadError'
import type { Word } from '../lib/types'

type AddOutcome = AddResult | 'error'

export default function Vocabulary() {
  const { words, loaded, error, load, addWord, removeWord, restoreWord, updateWord } = useVocabStore()
  const toast = useToast()

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  async function handleAdd(term: string, translation: string, example?: string): Promise<AddOutcome> {
    try {
      return await addWord(term, translation, example)
    } catch (err) {
      toast.error(friendlyError(err, 'No pude guardar la palabra. Intenta de nuevo.'))
      return 'error'
    }
  }

  async function handleRemove(word: Word) {
    const result = await toast.run(() => removeWord(word.id), 'No pude borrar la palabra.')
    if (result.ok) {
      toast.undo(`«${word.term}» eliminada`, async () => {
        await toast.run(() => restoreWord(word), 'No pude recuperar la palabra.')
      })
    }
  }

  // Da vuelta una palabra que quedó con el español arriba. Si el inglés ya existe, se suma el significado a esa
  // palabra y se borra la repetida (todo se puede deshacer).
  async function handleSwap(word: Word) {
    const term = word.translation.trim()
    const translation = word.term.trim()
    const original = { term: word.term, translation: word.translation, example: word.example }
    const existing = words.find((w) => w.id !== word.id && termKey(w.term) === termKey(term))

    if (!existing) {
      const result = await toast.run(() => updateWord(word.id, { term, translation, example: word.example }), 'No pude darla vuelta.')
      if (result.ok) {
        toast.undo(`Di vuelta «${word.term}»: ahora es «${term}»`, async () => {
          await toast.run(() => updateWord(word.id, original), 'No pude deshacerlo.')
        })
      }
      return
    }

    const known = existing.translation.split(/[,;/]/).map((part) => part.trim().toLowerCase())
    const merged = known.includes(translation.toLowerCase()) ? existing.translation : `${existing.translation}, ${translation}`
    const before = { term: existing.term, translation: existing.translation, example: existing.example }
    const result = await toast.run(async () => {
      await updateWord(existing.id, { term: existing.term, translation: merged, example: existing.example })
      await removeWord(word.id)
    }, 'No pude juntarlas.')
    if (result.ok) {
      toast.undo(`Junté «${word.term}» con «${existing.term}»`, async () => {
        await toast.run(async () => {
          await restoreWord(word)
          await updateWord(existing.id, before)
        }, 'No pude deshacerlo.')
      })
    }
  }

  async function handleUpdate(id: string, patch: { term: string; translation: string; example?: string }) {
    try {
      return await updateWord(id, patch)
    } catch (err) {
      toast.error(friendlyError(err, 'No pude guardar los cambios.'))
      return 'error' as const
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Vocabulario</h1>
        <p className="text-slate-400">
          Para cargar todo lo de una clase de una vez, usa el{' '}
          <Link to="/mi-clase?tab=notas" className="text-violet-400 hover:underline">
            Cuaderno
          </Link>
          . Acá puedes agregar palabras sueltas al tiro.
        </p>
      </div>
      {error && !loaded && <LoadError message={error} onRetry={() => void load()} />}
      <AddWordForm onAdd={handleAdd} />
      <VocabSuggestions onAdd={handleAdd} />
      <WordList words={words} onRemove={handleRemove} onUpdate={handleUpdate} onSwap={handleSwap} />
    </div>
  )
}

function AddWordForm({
  onAdd,
}: {
  onAdd: (term: string, translation: string, example?: string) => Promise<AddOutcome>
}) {
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [example, setExample] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<string | null>(null)

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
    setDuplicate(null)
    const outcome = await onAdd(term.trim(), translation.trim(), example.trim())
    if (outcome === 'duplicate') {
      setDuplicate(`Ya tienes «${term.trim()}» en tu vocabulario.`)
      return
    }
    if (outcome === 'error') return
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
          onChange={(e) => {
            setTerm(e.target.value)
            setDuplicate(null)
          }}
          placeholder="Palabra o frase en inglés"
          lang="en"
          translate="no"
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
        lang="en"
        translate="no"
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
        <span className="text-xs text-slate-400">Completa un campo y traduzco el otro.</span>
      </div>
      {duplicate && <p className="mt-2 text-sm text-amber-400">{duplicate}</p>}
      {translateError && <p className="mt-2 text-sm text-red-400">{translateError}</p>}
    </form>
  )
}

function WordList({
  words,
  onRemove,
  onUpdate,
  onSwap,
}: {
  words: Word[]
  onRemove: (word: Word) => Promise<void>
  onSwap: (word: Word) => Promise<void>
  onUpdate: (id: string, patch: { term: string; translation: string; example?: string }) => Promise<AddResult | 'updated' | 'error'>
}) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const visible = [...words]
    .reverse()
    .filter((w) => !q || w.term.toLowerCase().includes(q) || w.translation.toLowerCase().includes(q))

  return (
    <div>
      <h2 className="mb-3 font-medium text-white">Todas tus palabras ({words.length})</h2>
      {words.length >= 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar una palabra..."
          className="mb-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
      )}
      <div className="flex flex-col divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
        {words.length === 0 && (
          <p className="p-4 text-sm text-slate-400">Aún no has agregado vocabulario. ¡Parte con tu primera palabra!</p>
        )}
        {words.length > 0 && visible.length === 0 && <p className="p-4 text-sm text-slate-400">No encontré ninguna palabra con eso.</p>}
        {visible.map((word) =>
          editing === word.id ? (
            <EditRow
              key={word.id}
              word={word}
              onCancel={() => setEditing(null)}
              onSave={async (patch) => {
                const outcome = await onUpdate(word.id, patch)
                if (outcome === 'updated') setEditing(null)
                return outcome
              }}
            />
          ) : (
            <div key={word.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <div className="flex items-center gap-2 font-medium text-white">
                  {word.term}
                  {canSpeak() && (
                    <button onClick={() => speak(word.term)} className="text-slate-400 hover:text-violet-400" title="Escuchar">
                      🔊
                    </button>
                  )}
                  {isDue(word) && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">a repasar</span>}
                </div>
                <div className="text-sm text-slate-400">{word.translation}</div>
                {word.example && <div className="text-xs italic text-slate-400">"{word.example}"</div>}
                {looksReversed(word.term, word.translation) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-amber-300">
                    ¿Está al revés? El inglés debería ir arriba.
                    <button
                      onClick={() => void onSwap(word)}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-amber-200 hover:bg-amber-500/30"
                    >
                      <ArrowLeftRight size={12} /> Dar vuelta
                    </button>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setEditing(word.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-violet-300"
                  aria-label={`Editar ${word.term}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => void onRemove(word)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                  aria-label={`Borrar ${word.term}`}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

function EditRow({
  word,
  onSave,
  onCancel,
}: {
  word: Word
  onSave: (patch: { term: string; translation: string; example?: string }) => Promise<AddResult | 'updated' | 'error'>
  onCancel: () => void
}) {
  const [term, setTerm] = useState(word.term)
  const [translation, setTranslation] = useState(word.translation)
  const [example, setExample] = useState(word.example ?? '')
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!term.trim() || !translation.trim()) {
      setProblem('La palabra y su significado no pueden quedar vacíos.')
      return
    }
    setSaving(true)
    setProblem(null)
    const outcome = await onSave({ term, translation, example })
    setSaving(false)
    if (outcome === 'duplicate') setProblem(`Ya tienes otra palabra «${term.trim()}».`)
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Palabra en inglés"
        lang="en"
        translate="no"
        className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
      />
      <button
        type="button"
        onClick={() => {
          setTerm(translation)
          setTranslation(term)
        }}
        className="inline-flex items-center gap-1 self-start rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
      >
        <ArrowLeftRight size={13} /> Dar vuelta inglés y español
      </button>
      <input
        value={translation}
        onChange={(e) => setTranslation(e.target.value)}
        aria-label="Significado en español"
        className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
      />
      <input
        value={example}
        onChange={(e) => setExample(e.target.value)}
        placeholder="Ejemplo de uso (opcional)"
        aria-label="Ejemplo"
        lang="en"
        translate="no"
        className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
      />
      {problem && <p className="text-sm text-amber-400">{problem}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
          Cancelar
        </button>
      </div>
    </div>
  )
}
