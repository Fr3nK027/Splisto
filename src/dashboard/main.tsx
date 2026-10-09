import { createRoot } from 'react-dom/client'
import { App } from './App'
// font inclusi nell'estensione (nessuna richiesta a Google Fonts)
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/hanken-grotesk'
import './style.css'

createRoot(document.getElementById('root')!).render(<App />)
