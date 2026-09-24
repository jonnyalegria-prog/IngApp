import { useSearchParams } from 'react-router-dom'
import PathPractice from './practice/PathPractice'
import VocabPractice from './practice/VocabPractice'
import GrammarPractice from './practice/GrammarPractice'
import DictationPractice from './practice/DictationPractice'
import ListeningPractice from './practice/ListeningPractice'
import PronunciationPractice from './practice/PronunciationPractice'
import DialoguePractice from './practice/DialoguePractice'
import ReaderPractice from './practice/ReaderPractice'

type Tab = 'ruta' | 'vocabulario' | 'gramatica' | 'lectura' | 'dictado' | 'escucha' | 'pronunciacion' | 'conversacion'

const TABS: { id: Tab; label: string }[] = [
  { id: 'ruta', label: 'Ruta' },
  { id: 'vocabulario', label: 'Vocabulario' },
  { id: 'gramatica', label: 'Gramática' },
  { id: 'lectura', label: 'Lectura' },
  { id: 'dictado', label: 'Dictado' },
  { id: 'escucha', label: 'Escucha' },
  { id: 'pronunciacion', label: 'Pronunciación' },
  { id: 'conversacion', label: 'Conversación' },
]

export default function Practice() {
  // La pestaña sale de la dirección (?tab=), así el botón atrás y los enlaces internos la cambian de verdad.
  const [searchParams, setSearchParams] = useSearchParams()
  const fromUrl = searchParams.get('tab')
  const tab: Tab = TABS.some((t) => t.id === fromUrl) ? (fromUrl as Tab) : 'vocabulario'
  const setTab = (t: Tab) => setSearchParams({ tab: t }, { replace: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ruta' && <PathPractice />}
      {tab === 'vocabulario' && <VocabPractice />}
      {tab === 'gramatica' && <GrammarPractice />}
      {tab === 'lectura' && <ReaderPractice />}
      {tab === 'dictado' && <DictationPractice />}
      {tab === 'escucha' && <ListeningPractice />}
      {tab === 'pronunciacion' && <PronunciationPractice />}
      {tab === 'conversacion' && <DialoguePractice />}
    </div>
  )
}
