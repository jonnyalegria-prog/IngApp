import type { Feedback } from '../lib/grammarFeedback'

interface Props {
  items: Feedback[]
  /** El corrector externo no respondió: solo se revisaron errores típicos. */
  partial?: boolean
}

// Lo que escribiste y las sugerencias van marcados como inglés y "no traducir",
// para que el traductor del navegador no los convierta al español.
export default function GrammarFeedback({ items, partial }: Props) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {partial && (
        <p className="text-sm text-amber-400">
          No pude conectar con el corrector principal, así que solo revisé errores típicos. Prueba de nuevo en un ratito.
        </p>
      )}

      {items.length === 0 ? (
        !partial && (
          <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3 text-sm">
            <p className="font-medium text-emerald-300">¡Bacán! No encontré errores 🎉</p>
            <p className="mt-1 text-slate-400">El corrector no lo ve todo: si algo te suena raro, consúltalo con tu profe.</p>
          </div>
        )
      ) : (
        <>
          <p className="text-sm text-slate-300">
            {items.length === 1 ? 'Encontré 1 cosa para revisar:' : `Encontré ${items.length} cosas para revisar:`}
          </p>
          {items.map((item) => (
            <div
              key={item.key}
              className={`rounded-xl border p-3 text-sm ${
                item.optional ? 'border-sky-700/40 bg-sky-950/20' : 'border-amber-700/40 bg-amber-950/20'
              }`}
            >
              <p className={`font-medium ${item.optional ? 'text-sky-300' : 'text-amber-300'}`}>{item.title}</p>

              <p className="mt-1 text-slate-400">
                Escribiste:{' '}
                <span lang="en" translate="no" className="text-slate-200">
                  {item.before}
                  <mark className="rounded bg-amber-500/30 px-0.5 text-amber-100">{item.fragment}</mark>
                  {item.after}
                </span>
              </p>

              <p className="mt-1.5 text-slate-300">{item.explanation}</p>

              {item.suggestions.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-slate-400">
                  Prueba así:
                  {item.suggestions.map((s) => (
                    <span
                      key={s}
                      lang="en"
                      translate="no"
                      className="rounded bg-emerald-900/40 px-1.5 py-0.5 font-medium text-emerald-300"
                    >
                      {s}
                    </span>
                  ))}
                </p>
              )}

              {item.originalMessage && (
                <p lang="en" translate="no" className="mt-1.5 text-xs text-slate-500">
                  Corrector: {item.originalMessage}
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
