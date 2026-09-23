import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { getSettings, STREAK_UPDATED_EVENT } from '../lib/storage'

export default function TopBar() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const refresh = () => {
      getSettings()
        .then((s) => setStreak(s.streak))
        .catch(() => {})
    }
    refresh()
    window.addEventListener(STREAK_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, refresh)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur">
      <span className="text-lg font-semibold text-violet-400">IngApp</span>
      <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
        <Flame size={18} fill="currentColor" />
        {streak}
      </span>
    </header>
  )
}
