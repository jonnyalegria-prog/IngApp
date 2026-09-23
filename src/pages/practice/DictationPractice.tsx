import { useEffect, useState } from 'react'
import { canSpeak, speak } from '../../lib/speech'
import { getDictationSentences } from '../../lib/exerciseBank'
import { markPracticed } from '../../lib/storage'
import TranslateLine from '../../components/TranslateLine'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function DictationPractice() {
  const [sentences, setSentences] = useState<{ text: string }[] | null>(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    getDictationSentences().then((s) => {
      setSentences(s)
      setCurrentIdx(Math.floor(Math.random() * Math.max(s.length, 1)))
    })
  }, [])

  if (!canSpeak()) {
    return <p className="text-slate-400">Tu navegador no soporta lectura de voz, así que el dictado no está disponible acá.</p>
  }

  if (sentences === null) return <p className="text-slate-400">Cargando...</p>
  if (sentences.length === 0) return <p className="text-slate-400">Todavía no hay frases de dictado cargadas.</p>

  const current = sentences[currentIdx]

  function playAudio() {
    speak(current.text)
  }

  function next() {
    const others = sentences!.filter((_, i) => i !== currentIdx)
    const pickIdx = sentences!.indexOf(others[Math.floor(Math.random() * others.length)])
    setCurrentIdx(pickIdx)
    setInput('')
    setChecked(false)
  }

  const isCorrect = checked && normalize(input) === normalize(current.text)

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-400">Escuchá la frase y escribí exactamente lo que oíste.</p>
      <button onClick={playAudio} className="rounded-2xl border border-violet-600 bg-violet-950/30 px-6 py-4 text-2xl hover:bg-violet-950/50">
        🔊
      </button>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={checked}
        placeholder="Escribí lo que escuchaste..."
        className="w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 disabled:opacity-70"
      />
      {!checked ? (
        <button
          onClick={() => {
            setChecked(true)
            markPracticed()
          }}
          disabled={!input.trim()}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          Revisar
        </button>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          <p className={`text-sm font-medium ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {isCorrect ? '¡Correcto! 🎉' : 'No coincide exactamente.'}
          </p>
          {!isCorrect && <p className="text-sm text-slate-300">Frase correcta: "{current.text}"</p>}
          <TranslateLine text={current.text} />
          <button onClick={next} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            Siguiente frase
          </button>
        </div>
      )}
    </div>
  )
}
