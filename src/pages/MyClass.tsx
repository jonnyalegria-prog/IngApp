import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Notebook from './Notebook'
import Tasks from './Tasks'
import Discovery from './Discovery'
import Grammar from './Grammar'

type Tab = 'notas' | 'tareas' | 'descubrir' | 'gramatica'

const TABS: { id: Tab; label: string }[] = [
  { id: 'notas', label: 'Notas' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'descubrir', label: 'Mis 3 cosas' },
  { id: 'gramatica', label: 'Gramática' },
]

export default function MyClass() {
  const [searchParams, setSearchParams] = useSearchParams()
  const fromUrl = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === fromUrl) ? (fromUrl as Tab) : 'notas')

  function selectTab(t: Tab) {
    setTab(t)
    setSearchParams({ tab: t })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Mi Clase</h1>
        <p className="text-slate-400">Todo lo de tu clase semanal, en un solo lugar.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notas' && <Notebook />}
      {tab === 'tareas' && <Tasks />}
      {tab === 'descubrir' && <Discovery />}
      {tab === 'gramatica' && <Grammar />}
    </div>
  )
}
