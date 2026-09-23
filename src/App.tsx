import { Route, Routes } from 'react-router-dom'
import AuthGate from './components/AuthGate'
import TopBar from './components/TopBar'
import NavBar from './components/NavBar'
import UpdateBanner from './components/UpdateBanner'
import Dashboard from './pages/Dashboard'
import MyClass from './pages/MyClass'
import Vocabulary from './pages/Vocabulary'
import Practice from './pages/Practice'
import Diario from './pages/Diario'

function App() {
  return (
    <>
      <AuthGate>
        <TopBar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mi-clase" element={<MyClass />} />
            <Route path="/vocabulario" element={<Vocabulary />} />
            <Route path="/practicar" element={<Practice />} />
            <Route path="/diario" element={<Diario />} />
          </Routes>
        </main>
        <NavBar />
      </AuthGate>
      <UpdateBanner />
    </>
  )
}

export default App
