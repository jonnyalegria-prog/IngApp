import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

// Si una pantalla lanza un error al dibujarse, en vez de quedar en blanco se muestra esto.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en pantalla', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="text-4xl">😵</div>
        <h1 className="text-xl font-semibold text-white">Pucha, algo se rompió</h1>
        <p className="text-slate-300">Tus datos están a salvo. Recarga la página para seguir.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Recargar
        </button>
      </div>
    )
  }
}
