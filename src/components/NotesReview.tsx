import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { pairFromLine, type ClassifiedLine } from '../lib/notesParser'
import { toReviewItems, type ReviewItem, type ReviewKind } from '../lib/reviewItems'
import { errorMessage, matchCase, translate } from '../lib/translate'

interface Props {
  lines: ClassifiedLine[]
  dateLabel: string
  saving: boolean
  onBack: () => void
  onSave: (items: ReviewItem[]) => void
}

const SECTIONS: { kind: ReviewKind; title: string }[] = [
  { kind: 'vocab', title: 'Vocabulario' },
  { kind: 'task', title: 'Tareas' },
  { kind: 'grammar', title: 'Gramática' },
  { kind: 'skip', title: 'No se guardarán' },
]

const inputClass =
  'min-w-0 flex-1 rounded-md border bg-slate-950 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500'

export default function NotesReview({ lines, dateLabel, saving, onBack, onSave }: Props) {
  const [items, setItems] = useState<ReviewItem[]>(() => toReviewItems(lines))
  const [translating, setTranslating] = useState(false)
  const [translateError, setTranslateError] = useState<string | null>(null)

  function update(id: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function moveTo(id: string, kind: ReviewKind) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        if (kind === 'vocab' && !it.term) {
          const pair = pairFromLine(it.text)
          return { ...it, kind, term: pair?.term ?? it.text, meaning: pair?.meaning ?? '', swapped: pair?.swapped }
        }
        return { ...it, kind }
      }),
    )
  }

  function swap(it: ReviewItem) {
    update(it.id, { term: it.meaning, meaning: it.term, swapped: false, sameWord: false })
  }

  const missing = items.filter((it) => it.kind === 'vocab' && it.term.trim() && !it.meaning.trim())

  // Solo se mandan a DeepL las palabras sueltas que faltan, de a 20 (el máximo por pedido).
  async function translateMissing() {
    setTranslating(true)
    setTranslateError(null)
    try {
      for (let i = 0; i < missing.length; i += 20) {
        const chunk = missing.slice(i, i + 20)
        const results = await translate(
          chunk.map((it) => ({ text: it.term.trim() })),
          { from: 'en', to: 'es', cache: true },
        )
        setItems((prev) =>
          prev.map((it) => {
            const n = chunk.findIndex((c) => c.id === it.id)
            if (n < 0) return it
            const result = results[n]
            const same = result.trim().toLowerCase() === it.term.trim().toLowerCase()
            return same ? { ...it, sameWord: true } : { ...it, meaning: matchCase(it.term, result), sameWord: false }
          }),
        )
      }
    } catch (err) {
      setTranslateError(errorMessage(err))
    } finally {
      setTranslating(false)
    }
  }

  const vocabToSave = items.filter((it) => it.kind === 'vocab' && it.term.trim() && it.meaning.trim()).length
  const vocabWithoutMeaning = items.filter((it) => it.kind === 'vocab' && !(it.term.trim() && it.meaning.trim())).length
  const tasks = items.filter((it) => it.kind === 'task' && it.text.trim()).length
  const grammar = items.filter((it) => it.kind === 'grammar' && it.text.trim()).length
  const nothingToSave = vocabToSave + tasks + grammar === 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Revisa cómo quedó tu clase del {dateLabel}</h2>
        <p className="mt-1 text-sm text-slate-400">
          Corrige lo que haga falta. Con el menú de cada línea la mueves de sección, y con{' '}
          <ArrowLeftRight size={13} className="inline align-[-2px]" /> das vuelta el inglés y el español.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const rows = items.filter((it) => it.kind === section.kind)
        if (rows.length === 0) return null
        return (
          <section key={section.kind}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-medium text-white">
                {section.title} ({rows.length})
              </h3>
              {section.kind === 'vocab' && missing.length > 0 && (
                <button
                  type="button"
                  onClick={translateMissing}
                  disabled={translating}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  {translating ? 'Traduciendo...' : missing.length === 1 ? '🌐 Traducir la que falta' : `🌐 Traducir las ${missing.length} que faltan`}
                </button>
              )}
            </div>
            {section.kind === 'vocab' && translateError && <p className="mb-2 text-sm text-red-400">{translateError}</p>}

            <div
              className={`flex flex-col divide-y divide-slate-800 rounded-2xl border bg-slate-900 ${
                section.kind === 'skip' ? 'border-slate-800 opacity-70' : 'border-slate-800'
              }`}
            >
              {rows.map((it) => (
                <Row key={it.id} item={it} onUpdate={update} onSwap={swap} onMove={moveTo} />
              ))}
            </div>
          </section>
        )
      })}

      <div className="rounded-2xl border border-violet-700/40 bg-violet-950/20 p-4 text-sm text-violet-200">
        Se guardarán {vocabToSave} palabra(s), {tasks} tarea(s) y {grammar} nota(s) de gramática.
        {vocabWithoutMeaning > 0 && (
          <span className="mt-1 block text-amber-300">
            {vocabWithoutMeaning} palabra(s) sin significado no se guardarán: tradúcelas o escríbelas tú.
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          ← Volver a editar
        </button>
        <button
          type="button"
          onClick={() => onSave(items)}
          disabled={saving || nothingToSave}
          className="flex-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {saving ? 'Guardando...' : 'Guardar clase'}
        </button>
      </div>
    </div>
  )
}

function KindSelect({ item, onMove }: { item: ReviewItem; onMove: (id: string, kind: ReviewKind) => void }) {
  return (
    <select
      value={item.kind}
      onChange={(e) => onMove(item.id, e.target.value as ReviewKind)}
      aria-label="Mover a otra sección"
      className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
    >
      <option value="vocab">Vocabulario</option>
      <option value="task">Tarea</option>
      <option value="grammar">Gramática</option>
      <option value="skip">No guardar</option>
    </select>
  )
}

function Row({
  item,
  onUpdate,
  onSwap,
  onMove,
}: {
  item: ReviewItem
  onUpdate: (id: string, patch: Partial<ReviewItem>) => void
  onSwap: (item: ReviewItem) => void
  onMove: (id: string, kind: ReviewKind) => void
}) {
  if (item.kind === 'vocab') {
    const noMeaning = !item.meaning.trim()
    let note = ''
    if (item.sameWord) note = 'DeepL devolvió la misma palabra: ¿ya estaba en español? Prueba con ⇄.'
    else if (noMeaning) note = 'Falta el significado.'
    else if (item.swapped) note = 'Le di vuelta: el inglés venía a la derecha.'

    return (
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <input
            value={item.term}
            onChange={(e) => onUpdate(item.id, { term: e.target.value })}
            placeholder="Inglés"
            lang="en"
            translate="no"
            aria-label="Palabra en inglés"
            className={`${inputClass} border-slate-700`}
          />
          <button
            type="button"
            onClick={() => onSwap(item)}
            title="Dar vuelta inglés y español"
            aria-label="Dar vuelta inglés y español"
            className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-violet-300"
          >
            <ArrowLeftRight size={16} />
          </button>
          <input
            value={item.meaning}
            onChange={(e) => onUpdate(item.id, { meaning: e.target.value, sameWord: false })}
            placeholder="Español"
            aria-label="Significado en español"
            className={`${inputClass} ${noMeaning ? 'border-amber-600/70' : 'border-slate-700'}`}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${item.sameWord || noMeaning ? 'text-amber-400' : 'text-slate-400'}`}>{note}</span>
          <KindSelect item={item} onMove={onMove} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <textarea
        value={item.text}
        onChange={(e) => onUpdate(item.id, { text: e.target.value })}
        rows={2}
        aria-label="Texto de la línea"
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white"
      />
      <div className="flex justify-end">
        <KindSelect item={item} onMove={onMove} />
      </div>
    </div>
  )
}
