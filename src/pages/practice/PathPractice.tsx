import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import * as storage from '../../lib/storage'
import { getBankWords } from '../../lib/exerciseBank'
import { canSpeak, speak } from '../../lib/speech'
import { termKey } from '../../lib/classSave'
import { findUnit, nextUnit, UNITS, wordsForUnit, type BankWord, type Unit } from '../../lib/units'
import { buildQuiz, isPassing, PASS_SCORE, scorePercent, type QuizQuestion } from '../../lib/unitQuiz'
import { useLoad } from '../../lib/useLoad'
import { useToast } from '../../lib/toast'
import { useVocabStore } from '../../store/useVocabStore'
import LoadError from '../../components/LoadError'

export default function PathPractice() {
  const [params, setParams] = useSearchParams()
  const { words: myWords, loaded, load: loadWords } = useVocabStore()
  const data = useLoad(async () => {
    const [bank, progress] = await Promise.all([getBankWords(), storage.getUnitProgress()])
    return { bank, progress }
  })

  useEffect(() => {
    if (!loaded) void loadWords()
  }, [loaded, loadWords])

  const mine = useMemo(() => new Set(myWords.map((w) => termKey(w.term))), [myWords])

  if (data.error && !data.data) return <LoadError message={data.error} onRetry={data.reload} />
  if (!data.data || !loaded) return <p className="text-slate-400">Cargando...</p>
  const { bank, progress } = data.data

  const unit = findUnit(params.get('unit'))
  const open = (id: string | null) => setParams(id ? { tab: 'ruta', unit: id } : { tab: 'ruta' }, { replace: false })

  if (unit) {
    return (
      <UnitView
        unit={unit}
        bank={bank}
        mine={mine}
        onBack={() => open(null)}
        onProgress={(p) => data.setData((prev) => ({ bank: prev?.bank ?? bank, progress: [...(prev?.progress ?? progress).filter((x) => x.unitId !== p.unitId), p] }))}
        progress={progress.find((p) => p.unitId === unit.id)}
        onNext={(id) => open(id)}
        completed={new Set(progress.filter((p) => p.completedAt).map((p) => p.unitId))}
      />
    )
  }

  const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.unitId))
  const next = nextUnit(completed)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-slate-400">
        Un tema por unidad, en el orden que ve tu profe. Aprende las palabras y hazte la mini-prueba: con {PASS_SCORE}% o más,
        la unidad queda completada. ({completed.size}/{UNITS.length})
      </p>
      {UNITS.map((u) => {
        const unitWords = wordsForUnit(u, bank)
        const have = unitWords.filter((w) => mine.has(termKey(w.term))).length
        const p = progress.find((x) => x.unitId === u.id)
        const isNext = next?.id === u.id
        return (
          <button
            key={u.id}
            onClick={() => open(u.id)}
            className={`flex items-center gap-3 rounded-2xl border p-4 text-left hover:border-violet-500 ${
              isNext ? 'border-violet-600 bg-violet-950/30' : 'border-slate-800 bg-slate-900'
            }`}
          >
            <span className="text-2xl" aria-hidden="true">
              {u.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-white">{u.title}</span>
              <span className="block text-xs text-slate-400">
                {unitWords.length} palabras · tienes {have}
              </span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-800">
                <span
                  className="block h-full rounded-full bg-violet-500"
                  style={{ width: `${unitWords.length ? Math.round((have / unitWords.length) * 100) : 0}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 text-right text-xs">
              {p?.completedAt ? (
                <span className="text-emerald-400">✓ Lista · {p.bestScore}%</span>
              ) : p ? (
                <span className="text-amber-300">Mejor: {p.bestScore}%</span>
              ) : isNext ? (
                <span className="text-violet-300">Sigue esta</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function UnitView({
  unit,
  bank,
  mine,
  progress,
  completed,
  onBack,
  onProgress,
  onNext,
}: {
  unit: Unit
  bank: BankWord[]
  mine: Set<string>
  progress?: storage.UnitProgress
  completed: Set<string>
  onBack: () => void
  onProgress: (p: storage.UnitProgress) => void
  onNext: (id: string) => void
}) {
  const toast = useToast()
  const { addWord, addWords } = useVocabStore()
  const words = useMemo(() => wordsForUnit(unit, bank), [unit, bank])
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null)
  const missing = words.filter((w) => !mine.has(termKey(w.term)))

  async function addOne(w: BankWord) {
    const result = await toast.run(() => addWord(w.term, w.translation, w.example), 'No pude guardar la palabra.')
    if (result.ok && result.value === 'duplicate') toast.show(`Ya tenías «${w.term}».`)
  }

  async function addAll() {
    const result = await toast.run(
      () => addWords(missing.map((w) => ({ term: w.term, translation: w.translation, example: w.example }))),
      'No pude guardar las palabras. Intenta de nuevo.',
    )
    if (result.ok) toast.show(`Listo: agregué ${result.value.added} palabra(s) a tu vocabulario.`, { kind: 'success' })
  }

  if (quiz) {
    return (
      <UnitQuiz
        unit={unit}
        questions={quiz}
        onRetry={() => setQuiz(buildQuiz(words, { audio: canSpeak() }))}
        onExit={() => setQuiz(null)}
        onProgress={onProgress}
        nextUnit={(() => {
          const others = new Set(completed)
          others.add(unit.id)
          return nextUnit(others)
        })()}
        onNext={onNext}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="self-start text-sm text-violet-400 hover:underline">
        ← Todas las unidades
      </button>
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <span aria-hidden="true">{unit.emoji}</span> {unit.title}
        </h2>
        <p className="text-sm text-slate-400">{unit.description}</p>
        {progress?.completedAt && <p className="mt-1 text-sm text-emerald-400">✓ Unidad completada · mejor puntaje {progress.bestScore}%</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setQuiz(buildQuiz(words, { audio: canSpeak() }))}
          disabled={words.length < 4}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Hacer la mini-prueba
        </button>
        {missing.length > 0 && (
          <button onClick={() => void addAll()} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
            Agregar las {missing.length} que me faltan
          </button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900">
        {words.map((w) => {
          const have = mine.has(termKey(w.term))
          return (
            <div key={w.term} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium text-white">
                  <span lang="en" translate="no">
                    {w.term}
                  </span>
                  {canSpeak() && (
                    <button onClick={() => speak(w.term)} className="text-slate-400 hover:text-violet-400" aria-label={`Escuchar ${w.term}`}>
                      🔊
                    </button>
                  )}
                </div>
                <div className="text-sm text-violet-300">{w.translation}</div>
                {w.example && (
                  <div className="text-xs italic text-slate-400" lang="en" translate="no">
                    "{w.example}"
                  </div>
                )}
                {w.note && <div className="mt-0.5 text-xs text-amber-300/90">💡 {w.note}</div>}
              </div>
              {have ? (
                <span className="mt-1 shrink-0 text-emerald-400" title="Ya está en tu vocabulario">
                  <Check size={18} />
                </span>
              ) : (
                <button
                  onClick={() => void addOne(w)}
                  className="mt-0.5 shrink-0 rounded-md bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-violet-300"
                  aria-label={`Agregar ${w.term} a mi vocabulario`}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function UnitQuiz({
  unit,
  questions,
  nextUnit: following,
  onRetry,
  onExit,
  onProgress,
  onNext,
}: {
  unit: Unit
  questions: QuizQuestion[]
  nextUnit?: Unit
  onRetry: () => void
  onExit: () => void
  onProgress: (p: storage.UnitProgress) => void
  onNext: (id: string) => void
}) {
  const toast = useToast()
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [result, setResult] = useState<{ score: number; passing: boolean } | null>(null)

  const current = questions[index]

  // Las preguntas de escuchar suenan solas al aparecer.
  useEffect(() => {
    if (current?.speak && !result) speak(current.speak)
  }, [current, result])

  async function finish(finalCorrect: number) {
    const score = scorePercent(finalCorrect, questions.length)
    const passing = isPassing(score)
    setResult({ score, passing })
    const saved = await toast.run(() => storage.saveUnitResult(unit.id, score, passing), 'No pude guardar tu resultado.')
    if (saved.ok) onProgress(saved.value)
  }

  function choose(option: string) {
    if (selected || !current) return
    setSelected(option)
    const ok = option === current.answer
    storage.markPracticed()
    storage.logPractice({ kind: 'unit_quiz', topic: unit.title.slice(0, 60), item: current.term, correct: ok })
    if (ok) setCorrect((c) => c + 1)
  }

  function next() {
    setSelected(null)
    if (index + 1 >= questions.length) void finish(correct)
    else setIndex(index + 1)
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <div className="text-3xl">{result.passing ? '🎉' : '💪'}</div>
        <h2 className="text-xl font-semibold text-white">
          {correct}/{questions.length} · {result.score}%
        </h2>
        <p className="text-slate-300">
          {result.passing
            ? `¡Unidad «${unit.title}» completada!`
            : `Para completar la unidad necesitas ${PASS_SCORE}% o más. Repasa las palabras y vuelve a intentarlo.`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={onRetry} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
            Repetir la prueba
          </button>
          {result.passing && following && (
            <button onClick={() => onNext(following.id)} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
              Siguiente: {following.title}
            </button>
          )}
          <button onClick={onExit} className="rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
            Volver a la unidad
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">
        {unit.title} — {index + 1}/{questions.length}
      </p>
      <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        {current.kind === 'listen' ? (
          <>
            <p className="text-sm text-slate-400">Escucha y elige la palabra</p>
            <button
              onClick={() => speak(current.speak ?? '')}
              className="rounded-2xl border border-violet-600 bg-violet-950/30 px-6 py-3 text-2xl hover:bg-violet-950/50"
              aria-label="Escuchar de nuevo"
            >
              🔊
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">{current.kind === 'meaning' ? '¿Qué significa?' : '¿Cómo se dice en inglés?'}</p>
            <p className="text-2xl font-semibold text-white" lang={current.kind === 'meaning' ? 'en' : 'es'} translate="no">
              {current.prompt}
            </p>
          </>
        )}
      </div>
      <div className="flex w-full max-w-md flex-col gap-2">
        {current.options.map((option) => {
          const isRight = option === current.answer
          let style = 'border-slate-700 bg-slate-900 text-white hover:border-violet-500'
          if (selected) {
            if (isRight) style = 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
            else if (option === selected) style = 'border-red-600 bg-red-950/40 text-red-300'
            else style = 'border-slate-800 bg-slate-900 text-slate-400'
          }
          return (
            <button key={option} onClick={() => choose(option)} className={`rounded-md border p-3 text-left ${style}`}>
              {option}
            </button>
          )
        })}
      </div>
      {selected && (
        <button onClick={next} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          {index + 1 >= questions.length ? 'Ver mi resultado' : 'Siguiente'}
        </button>
      )}
    </div>
  )
}
