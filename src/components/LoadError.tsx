interface Props {
  message: string
  onRetry: () => void
}

// Aviso de "no se pudo cargar" con botón para reintentar.
export default function LoadError({ message, onRetry }: Props) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-red-700/60 bg-red-950/30 p-4 text-sm">
      <p className="text-red-200">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Reintentar
      </button>
    </div>
  )
}
