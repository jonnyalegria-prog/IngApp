import { useState } from 'react'
import { canSpeak, speak, speakSlow } from '../../lib/speech'
import { getDictationSentences } from '../../lib/exerciseBank'
import { checkWords, isCorrectDictation } from '../../lib/dictation'
import { logPractice, markPracticed } from '../../lib/storage'
import { shuffle } from '../../lib/shuffle'
import { useLoad } from '../../lib/useLoad'
import LoadError from '../../components/LoadError'
import TranslateLine from '../../components/TranslateLine'

export default function DictationPractice() {
  const load = useLoad(async () => shuffle(await getDictationSentences()))
  const [position, setPosition] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [round, setRound] = useState(0)

  if (!canSpeak()) {
    return <p className="text-slate-400">Tu navegador no soporta lectura de voz, así que el dictado no está disponible acá.</p>
  }
  if (load.error && !load.data) return <LoadError message={load.error} onRetry={load.reload} />
  if (!load.data) return <p className="text-slate-400">Cargando...</p>
  const sentences = load.data
  if (sentences.length === 0) return <p className="text-slate-400">Aún no hay frases de dictado cargadas.</p>

  // Las frases van en orden mezclado y no se repiten hasta terminar la vuelta.
  const current = sentences[position % sentences.length]
  const isCorrect = checked && isCorrectDictation(current.text, input)

  function check() {
    setChecked(true)
    markPracticed()
    logPractice({ kind: 'dictation', topic: 'dictado', item: current.text, correct: isCorrectDictation(current.text, input) })
  }

  function next() {
    const nextPosition = position + 1
    if (nextPosition % sentences.length === 0) {
      load.setData(shuffle(sentences))
      setRound((r) => r + 1)
    }
    setPosition(nextPosition)
    setInput('')
    setChecked(false)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">
        Escucha la frase y escribe exactamente lo que oíste. · {(position % sentences.length) + 1}/{sentences.length}
        {round > 0 && ` · vuelta ${round + 1}`}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => speak(current.text)}
          className="rounded-2xl border border-violet-600 bg-violet-950/30 px-6 py-4 text-2xl hover:bg-violet-950/50"
          aria-label="Escuchar la frase"
        >
          🔊
        </button>
        <button
          onClick={() => speakSlow(current.text)}
          className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4 text-sm text-slate-200 hover:bg-slate-800"
          aria-label="Escuchar más lento"
        >
          🐢 Más lento
        </button>
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={checked}
        lang="en"
        translate="no"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="Escribe lo que escuchaste..."
        className="w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 disabled:opacity-70"
      />
      {!checked ? (
        <button
          onClick={check}
          disabled={!input.trim()}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Revisar
        </button>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          <p className={`text-sm font-medium ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {isCorrect ? '¡Buena! 🎉' : 'Casi. Las palabras en rojo no las tenías:'}
          </p>
          <p className="text-center text-base" lang="en" translate="no">
            {checkWords(current.text, input).map((w, i) => (
              <span key={i} className={w.ok ? 'text-slate-200' : 'font-medium text-red-400 underline decoration-red-400/60'}>
                {w.word}{' '}
              </span>
            ))}
          </p>
          <TranslateLine text={current.text} />
          <button onClick={next} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Siguiente frase
          </button>
        </div>
      )}
    </div>
  )
}
