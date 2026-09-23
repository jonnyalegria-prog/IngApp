import WritingPractice from './practice/WritingPractice'

export default function Diario() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Diario</h1>
        <p className="text-slate-400">Escribe en inglés, libre o con consignas guiadas, y te ayudo a corregirlo.</p>
      </div>
      <WritingPractice />
    </div>
  )
}
