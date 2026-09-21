import { Link } from 'react-router-dom'
import { Dumbbell, GraduationCap, BookOpen, PenLine, type LucideIcon } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Hola de nuevo 👋</h1>
        <p className="text-slate-400">Tu complemento diario para las clases de inglés.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Para repasar hoy" value="0" />
        <StatCard label="Palabras totales" value="0" />
      </div>

      <div className="rounded-2xl border border-violet-700/40 bg-violet-950/20 p-4">
        <h2 className="mb-2 text-sm font-medium text-violet-300">Antes de tu próxima clase</h2>
        <p className="text-sm text-slate-400">
          Esta sección se completa en la Fase 2 (Cuaderno, Tareas, Mis 3 cosas).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ActionCard to="/practicar" title="Practicar" description="Próximamente" icon={Dumbbell} highlight />
        <ActionCard to="/mi-clase" title="Mi Clase" description="Notas, tareas y gramática" icon={GraduationCap} />
        <ActionCard to="/vocabulario" title="Vocabulario" description="Tu lista de palabras" icon={BookOpen} />
        <ActionCard to="/diario" title="Diario" description="Escribí y corregí" icon={PenLine} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
        Base de la v2 lista: autenticación, navegación y estilo visual (C). Las funciones de cada sección
        se construyen en las próximas fases del plan.
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}

function ActionCard({
  to,
  title,
  description,
  icon: Icon,
  highlight,
}: {
  to: string
  title: string
  description: string
  icon: LucideIcon
  highlight?: boolean
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-violet-500 ${
        highlight ? 'border-violet-600 bg-violet-950/40' : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${highlight ? 'bg-violet-600' : 'bg-slate-800'}`}>
        <Icon size={20} className={highlight ? 'text-white' : 'text-violet-400'} />
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="mt-0.5 text-xs text-slate-400">{description}</div>
      </div>
    </Link>
  )
}
