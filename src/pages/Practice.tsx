import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import VocabPractice from './practice/VocabPractice'
import GrammarPractice from './practice/GrammarPractice'
import DictationPractice from './practice/DictationPractice'
import PronunciationPractice from './practice/PronunciationPractice'
import DialoguePractice from './practice/DialoguePractice'

type Tab = 'vocabulario' | 'gramatica' | 'dictado' | 'pronunciacion' | 'conversacion'

const TABS: { id: Tab; label: string }[] = [
  { id: 'vocabulario', label: 'Vocabulario' },
  { id: 'gramatica', label: 'Gramática' },
  { id: 'dictado', label: 'Dictado' },
  { id: 'pronunciacion', label: 'Pronunciación' },
  { id: 'conversacion', label: 'Conversación' },
]

export default function Practice() {
  const [searchParams] = useSearchParams()
  const fromUrl = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === fromUrl) ? (fromUrl as Tab) : 'vocabulario')

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

      {tab === 'vocabulario' && <VocabPractice />}
      {tab === 'gramatica' && <GrammarPractice />}
      {tab === 'dictado' && <DictationPractice />}
      {tab === 'pronunciacion' && <PronunciationPractice />}
      {tab === 'conversacion' && <DialoguePractice />}
    </div>
  )
}
