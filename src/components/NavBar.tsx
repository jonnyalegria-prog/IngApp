import { NavLink } from 'react-router-dom'
import { Home, GraduationCap, BookOpen, Dumbbell, PenLine } from 'lucide-react'

const links = [
  { to: '/', label: 'Inicio', end: true, icon: Home },
  { to: '/mi-clase', label: 'Mi Clase', icon: GraduationCap },
  { to: '/vocabulario', label: 'Vocabulario', icon: BookOpen },
  { to: '/practicar', label: 'Practicar', icon: Dumbbell },
  { to: '/diario', label: 'Diario', icon: PenLine },
]

export default function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                isActive ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            <link.icon size={22} strokeWidth={2} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
