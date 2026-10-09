import { useEffect, useState } from 'react'
import { reloadIfStale } from '../lib/fresh'
import { getApiKey } from '../lib/secret'
import { Editor } from './Editor'
import { List } from './List'
import { Settings } from './Settings'

// Rotte: #/  ·  #/edit/<id>  ·  #/settings
export function App() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => void reloadIfStale(true), []) // estensione ricompilata: ricarica e riapri la dashboard
  useEffect(() => void getApiKey(), []) // sposta subito la chiave API fuori da chrome.storage.local (versioni precedenti)
  useEffect(() => {
    const onHash = () => setHash(location.hash)
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  const [, view, id] = hash.split('/')
  return (
    <main className={view === 'edit' || view === 'settings' ? 'page' : 'page wide'}>
      {view === 'edit' && id ? <Editor key={id} id={id} /> : view === 'settings' ? <Settings /> : <List />}
    </main>
  )
}
