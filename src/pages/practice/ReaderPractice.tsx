import { useEffect, useState } from 'react'
import { getReadingTexts, type ReadingText } from '../../lib/exerciseBank'
import * as storage from '../../lib/storage'
import { markPracticed } from '../../lib/storage'
import { canSpeak, speak } from '../../lib/speech'
import { errorMessage, translateOne } from '../../lib/translate'
import { useVocabStore } from '../../store/useVocabStore'
import TranslateLine from '../../components/TranslateLine'
import type { EnglishLevel } from '../../lib/types'

const LEVEL_LABELS: Record<EnglishLevel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

interface OpenText {
  title: string
  body: string
  /** Los textos del banco se cachean para todos; el texto pegado por el usuario no. */
  fromBank: boolean
}

export default function ReaderPractice() {
  const [texts, setTexts] = useState<ReadingText[] | null>(null)
  const [level, setLevel] = useState<EnglishLevel>('principiante')
  const [open, setOpen] = useState<OpenText | null>(null)
  const [pasted, setPasted] = useState('')

  useEffect(() => {
    getReadingTexts().then(setTexts)
    storage.getSettings().then((s) => setLevel(s.level)).catch(() => {})
  }, [])

  if (open) return <Reader text={open} onBack={() => setOpen(null)} />

  if (!texts) return <p className="text-slate-400">Cargando...</p>
  const visible = texts.filter((t) => t.level === level)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-slate-400">Lee y toca cualquier palabra para ver su significado.</p>
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as EnglishLevel)}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-white"
        >
          {(Object.keys(LEVEL_LABELS) as EnglishLevel[]).map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 && <p className="text-sm text-slate-400">Aún no hay lecturas para este nivel.</p>}
      {visible.map((t) => (
        <button
          key={t.id}
          onClick={() => setOpen({ title: t.title, body: t.body, fromBank: true })}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left hover:border-violet-500"
        >
          <div className="font-medium text-white">{t.title}</div>
          <div className="mt-1 line-clamp-2 text-sm text-slate-400">{t.body}</div>
        </button>
      ))}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 font-medium text-white">Leer un texto mío</h2>
        <p className="mb-2 text-xs text-slate-400">
          Pega un texto en inglés (un mensaje, un artículo corto). Solo se envían a DeepL las palabras que toques, con su
          oración como contexto.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={4}
          maxLength={6000}
          placeholder="Pega acá tu texto en inglés..."
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <button
          onClick={() => setOpen({ title: 'Mi texto', body: pasted.trim(), fromBank: false })}
          disabled={!pasted.trim()}
          className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Leer
        </button>
      </div>
    </div>
  )
}

interface Selection {
  word: string
  sentence: string
  /** Índices (oración, palabra) para resaltar la palabra tocada. */
  at: string
}

function splitSentences(body: string): string[] {
  return body.match(/[^.!?\n]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? []
}

function cleanWord(raw: string): string {
  const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  return w === 'I' || /^I'/.test(w) ? w : w.toLowerCase()
}

function Reader({ text, onBack }: { text: OpenText; onBack: () => void }) {
  const { words, loaded, load, addWord } = useVocabStore()
  const [selection, setSelection] = useState<Selection | null>(null)
  const [translation, setTranslation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (!loaded) load()
  }, [loaded, load])

  const sentences = splitSentences(text.body)

  async function pick(word: string, sentence: string, at: string) {
    if (!word) return
    markPracticed()
    setSelection({ word, sentence, at })
    setTranslation(null)
    setError(null)
    setJustAdded(false)
    try {
      setTranslation(await translateOne(word, { from: 'en', to: 'es', context: sentence, cache: text.fromBank }))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const alreadySaved = selection ? words.some((w) => w.term.toLowerCase() === selection.word.toLowerCase()) : false

  async function saveWord() {
    if (!selection || !translation) return
    await addWord(selection.word, translation, selection.sentence)
    setJustAdded(true)
  }

  return (
    <div className="flex flex-col gap-4 pb-40">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-violet-400 hover:underline">
          ← Volver
        </button>
        {canSpeak() && (
          <button onClick={() => speak(text.body)} className="text-sm text-slate-400 hover:text-violet-400">
            🔊 Escuchar todo
          </button>
        )}
      </div>

      <h2 className="text-lg font-semibold text-white">{text.title}</h2>

      <p className="text-lg leading-loose text-slate-100">
        {sentences.map((sentence, si) => (
          <span key={si}>
            {sentence.split(/\s+/).map((raw, wi) => {
              const at = `${si}:${wi}`
              const selected = selection?.at === at
              return (
                <span key={wi}>
                  <button
                    type="button"
                    onClick={() => pick(cleanWord(raw), sentence, at)}
                    className={`rounded px-0.5 ${selected ? 'bg-violet-600/40 text-white' : 'hover:bg-slate-800 active:bg-violet-600/30'}`}
                  >
                    {raw}
                  </button>{' '}
                </span>
              )
            })}
          </span>
        ))}
      </p>

      {text.fromBank && text.body.length <= 1500 && <TranslateLine text={text.body} label="Ver todo el texto en español" />}

      {selection && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mx-auto w-full max-w-2xl px-4">
          <div className="rounded-2xl border border-violet-600 bg-slate-900 p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold text-white">
                  {selection.word}
                  {canSpeak() && (
                    <button onClick={() => speak(selection.word)} className="text-base text-slate-400 hover:text-violet-400">
                      🔊
                    </button>
                  )}
                </div>
                {translation === null && !error && <p className="text-sm text-slate-400">Traduciendo...</p>}
                {translation !== null && <p className="text-sky-300">{translation}</p>}
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
              <button onClick={() => setSelection(null)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <TranslateLine text={selection.sentence} cache={text.fromBank} label="Traducir la oración" />
            {translation !== null &&
              (alreadySaved || justAdded ? (
                <p className="mt-2 text-sm text-emerald-400">✓ Está en tu vocabulario</p>
              ) : (
                <button
                  onClick={saveWord}
                  className="mt-3 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  Agregar a mi vocabulario
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
