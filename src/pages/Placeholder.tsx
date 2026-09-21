export default function Placeholder({ title, phase, description }: { title: string; phase: string; description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="text-slate-300">{description}</p>
        <p className="mt-2 text-xs text-slate-500">Se construye en la {phase} del plan.</p>
      </div>
    </div>
  )
}
