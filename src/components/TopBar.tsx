import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function TopBar() {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: settings } = await supabase.from('user_settings').select('streak').eq('user_id', data.user.id).maybeSingle()
      setStreak(settings?.streak ?? 0)
    })
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
