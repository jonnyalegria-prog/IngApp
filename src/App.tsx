import { Route, Routes } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import TopBar from './components/TopBar'
import NavBar from './components/NavBar'
import Dashboard from './pages/Dashboard'
import Placeholder from './pages/Placeholder'

function App() {
  return (
    <AuthGate>
      <TopBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/mi-clase"
            element={
              <Placeholder
                title="Mi Clase"
                phase="Fase 2 (Organización)"
                description="Cuaderno, Tareas, Mis 3 cosas y Gramática van a vivir acá, con clasificación automática de tus notas."
              />
            }
          />
          <Route
            path="/vocabulario"
            element={
              <Placeholder
                title="Vocabulario"
                phase="Fase 3 (Aprendizaje activo)"
                description="Tu lista de palabras con repetición espaciada, más sugerencias de vocabulario nuevo por nivel."
              />
            }
          />
          <Route
            path="/practicar"
            element={
              <Placeholder
                title="Practicar"
                phase="Fase 3 (Aprendizaje activo)"
                description="Repaso de vocabulario, ejercicios de gramática, dictado, pronunciación y conversación simulada."
              />
            }
          />
          <Route
            path="/diario"
            element={
              <Placeholder
                title="Diario"
                phase="Fase 3 (Aprendizaje activo)"
                description="Escritura libre con corrección y ejercicios guiados de escritura."
              />
            }
          />
        </Routes>
      </main>
      <NavBar />
    </AuthGate>
  )
}

export default App
