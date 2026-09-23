import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initServiceWorker } from './lib/pwa'

// HashRouter (not BrowserRouter) because GitHub Pages can't do server-side
// rewrites for client-side routes — URLs end up as /#/mi-clase, which Pages
// serves fine since the hash never reaches the server.
initServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
