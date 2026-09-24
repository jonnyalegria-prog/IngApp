import { challengeState, WEEKLY_GOAL, type PartnerOverview } from '../lib/social'

export default function PartnerCard({ partner, onLeave }: { partner: PartnerOverview; onLeave?: () => void }) {
  const state = challengeState(partner)
  const partnerName = partner.partnerName || 'Tu pareja'
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        Meta de la semana (de lunes a domingo): {WEEKLY_GOAL} respuestas cada uno.
        {state.bothDone && <span className="ml-1 text-emerald-400">¡Los dos lo lograron! 🎉</span>}
      </p>
      <ProgressRow label="Tú" answers={partner.me.answersWeek} fraction={state.meFraction} done={state.meDone} streak={partner.me.streak} />
      <ProgressRow label={partnerName} answers={partner.partner.answersWeek} fraction={state.partnerFraction} done={state.partnerDone} streak={partner.partner.streak} />
      {onLeave && (
        <button onClick={onLeave} className="self-start text-xs text-slate-400 underline hover:text-red-300">
          Salir del reto en pareja
        </button>
      )}
    </div>
  )
}

function ProgressRow({ label, answers, fraction, done, streak }: { label: string; answers: number; fraction: number; done: boolean; streak: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-200">
          {label} <span className="text-amber-400">🔥 {streak}</span>
        </span>
        <span className={done ? 'text-emerald-400' : 'text-slate-400'}>
          {done ? '✓ ' : ''}
          {Math.min(answers, WEEKLY_GOAL)}/{WEEKLY_GOAL}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${Math.round(fraction * 100)}%` }} />
      </div>
    </div>
  )
}
