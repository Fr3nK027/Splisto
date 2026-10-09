import { createRoot } from 'react-dom/client'
import { App } from './App'
// font inclusi nell'estensione (nessuna richiesta a Google Fonts)
import '@fontsource-variable/albert-sans'
import '@fontsource/marcellus/latin.css'
import './style.css'

createRoot(document.getElementById('root')!).render(<App />)
