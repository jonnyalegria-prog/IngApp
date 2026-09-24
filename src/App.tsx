import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import ErrorBoundary from './components/ErrorBoundary'
import ToastProvider from './components/ToastProvider'
import TopBar from './components/TopBar'
import NavBar from './components/NavBar'
import UpdateBanner from './components/UpdateBanner'
import Dashboard from './pages/Dashboard'
import Vocabulary from './pages/Vocabulary'

// Las pantallas menos usadas se cargan cuando se abren: la app parte más rápido, sobre todo en el teléfono.
const MyClass = lazy(() => import('./pages/MyClass'))
const Practice = lazy(() => import('./pages/Practice'))
const Diario = lazy(() => import('./pages/Diario'))
const Settings = lazy(() => import('./pages/Settings'))
const SharedSummary = lazy(() => import('./pages/SharedSummary'))

function PrivateApp() {
  return (
    <AuthGate>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
        <ErrorBoundary>
          <Suspense fallback={<p className="text-slate-400">Cargando...</p>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/mi-clase" element={<MyClass />} />
              <Route path="/vocabulario" element={<Vocabulary />} />
              <Route path="/practicar" element={<Practice />} />
              <Route path="/diario" element={<Diario />} />
              <Route path="/ajustes" element={<Settings />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <NavBar />
    </AuthGate>
  )
}

function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Enlace de solo lectura para la profe: no pide iniciar sesión. */}
        <Route
          path="/resumen/:token"
          element={
            <ErrorBoundary>
              <Suspense fallback={<p className="p-8 text-center text-slate-400">Cargando...</p>}>
                <SharedSummary />
              </Suspense>
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<PrivateApp />} />
      </Routes>
      <UpdateBanner />
    </ToastProvider>
  )
}

export default App
