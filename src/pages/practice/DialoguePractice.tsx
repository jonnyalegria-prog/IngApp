import { useState } from 'react'
import { canSpeak, speak } from '../../lib/speech'
import { getDialogues, type DialogueContent } from '../../lib/exerciseBank'
import { logPractice, markPracticed } from '../../lib/storage'
import { useLoad } from '../../lib/useLoad'
import LoadError from '../../components/LoadError'
import TranslateLine from '../../components/TranslateLine'

export default function DialoguePractice() {
  const load = useLoad(getDialogues)
  const dialogues = load.data
  const [active, setActive] = useState<DialogueContent | null>(null)
  const [nodeId, setNodeId] = useState('start')
  const [history, setHistory] = useState<{ speaker: 'npc' | 'you'; text: string }[]>([])

  function startDialogue(d: DialogueContent) {
    setActive(d)
    setNodeId('start')
    const startNode = d.nodes.find((n) => n.id === 'start')
    setHistory(startNode ? [{ speaker: startNode.speaker, text: startNode.text }] : [])
  }

  function choose(next: string, label: string) {
    if (!active) return
    const nextNode = active.nodes.find((n) => n.id === next)
    if (!nextNode) return
    markPracticed()
    setHistory((h) => [...h, { speaker: 'you', text: label }, { speaker: nextNode.speaker, text: nextNode.text }])
    setNodeId(next)
    // Cada respuesta cuenta para la meta del día; al llegar al final del diálogo queda anotado el escenario.
    logPractice({ kind: 'dialogue', topic: active.scenario.slice(0, 60), item: label, correct: true })
  }

  function exit() {
    setActive(null)
    setHistory([])
  }

  if (load.error && !dialogues) return <LoadError message={load.error} onRetry={load.reload} />
  if (!dialogues) return <p className="text-slate-400">Cargando...</p>

  if (!active) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-slate-400">Elige un escenario para practicar un diálogo guiado.</p>
        {dialogues.length === 0 && <p className="text-sm text-slate-400">Aún no hay diálogos cargados.</p>}
        {dialogues.map((d, i) => (
          <button
            key={i}
            onClick={() => startDialogue(d)}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left font-medium text-white hover:border-violet-500"
          >
            {d.scenario}
          </button>
        ))}
      </div>
    )
  }

  const currentNode = active.nodes.find((n) => n.id === nodeId)
  const finished = !currentNode || currentNode.options.length === 0

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">{active.scenario}</p>

      <div className="flex flex-col gap-2">
        {history.map((line, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-3 text-sm ${
              line.speaker === 'you'
                ? 'ml-8 border-violet-600 bg-violet-950/30 text-white'
                : 'mr-8 border-slate-800 bg-slate-900 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {line.speaker === 'npc' && canSpeak() && (
                <button onClick={() => speak(line.text)} className="shrink-0 text-slate-400 hover:text-violet-400">
                  🔊
                </button>
              )}
              <span>{line.text}</span>
            </div>
            <TranslateLine text={line.text} />
          </div>
        ))}
      </div>

      {!finished && currentNode && (
        <div className="flex flex-col gap-2">
          {currentNode.options.map((opt) => (
            <div key={opt.next} className="rounded-md border border-slate-700 bg-slate-900 p-3">
              <button onClick={() => choose(opt.next, opt.label)} className="w-full text-left text-sm text-white hover:text-violet-300">
                {opt.label}
              </button>
              <TranslateLine text={opt.label} />
            </div>
          ))}
        </div>
      )}

      {finished && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
          <div className="text-2xl">🎉</div>
          <p className="text-white">¡Bacán, terminaste el diálogo!</p>
          <button onClick={exit} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
            Elegir otro escenario
          </button>
        </div>
      )}
    </div>
  )
}
