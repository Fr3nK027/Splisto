/*
 * Aggiornamento dalla dashboard, senza scaricare nulla a mano.
 * Ogni nuova versione su main crea una release GitHub con splisto.json: tutti i file di dist in base64 (vedi
 * scripts/bundle.mjs e .github/workflows/check.yml). Un'estensione "decompressa" non può aggiornarsi da sola, ma
 * può scrivere nella propria cartella se l'utente gliela indica una volta (File System Access): scrive i file nuovi
 * e si ricarica. La cartella scelta resta salvata qui; dopo un riavvio del browser Chrome chiede solo di confermare.
 */
import { openDB } from 'idb'
import { busy } from './fresh.ts'

const REPO = 'Fr3nK027/Splisto'

export interface Release {
  version: string
  page: string // pagina della release (novità)
  bundle: string // API dell'asset splisto.json
}

/** true se la versione `a` è più nuova di `b` ("1.10.0" > "1.9.2"). */
export function newer(a: string, b: string): boolean {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  }
  return false
}

/** Nome di file sicuro dentro la cartella dell'estensione: niente percorsi assoluti né "..". */
export const safePath = (p: string) => p.split('/').every((s) => s !== '' && s !== '.' && s !== '..' && !/[\\:]/.test(s))

export const current = () => chrome.runtime.getManifest().version

let checked: Promise<Release | null> | undefined
/** Ultima release se più nuova di quella installata. Una sola richiesta per apertura della dashboard. */
export function checkUpdate(force = false): Promise<Release | null> {
  if (!checked || force) {
    checked = (async () => {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: 'no-store' })
      if (r.status === 404) return null // nessuna release ancora
      if (!r.ok) throw new Error(`GitHub risponde ${r.status}`)
      const j = (await r.json()) as { tag_name: string; html_url: string; assets: { name: string; url: string }[] }
      const version = j.tag_name.replace(/^v/, '')
      const asset = j.assets.find((a) => a.name === 'splisto.json')
      return asset && newer(version, current()) ? { version, page: j.html_url, bundle: asset.url } : null
    })()
    checked.catch(() => (checked = undefined)) // errore di rete: si riprova alla prossima richiesta
  }
  return checked
}

type Dir = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>
}
declare global {
  interface Window {
    showDirectoryPicker(o?: { id?: string; mode?: 'readwrite' }): Promise<Dir>
  }
}

const kv = () => openDB('splisto', 1, { upgrade: (db) => void db.createObjectStore('kv') })

async function readText(dir: Dir, name: string) {
  try {
    return await (await (await dir.getFileHandle(name)).getFile()).text()
  } catch {
    return null
  }
}

/** La cartella è quella da cui Chrome ha caricato Splisto: stesso manifest.json, byte per byte. */
async function isOurs(dir: Dir) {
  const loaded = await (await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })).text()
  return (await readText(dir, 'manifest.json')) === loaded
}

/** Cartella dell'estensione con permesso di scrittura. Va chiamata subito dopo un clic (il browser lo richiede). */
async function folder(): Promise<Dir> {
  const saved = (await (await kv()).get('kv', 'dir')) as Dir | undefined
  if (saved && (await saved.requestPermission({ mode: 'readwrite' })) === 'granted' && (await isOurs(saved))) return saved
  const dir = await window.showDirectoryPicker({ id: 'splisto', mode: 'readwrite' })
  if (!(await isOurs(dir))) {
    throw new Error('Questa non è la cartella da cui è caricata Splisto. In chrome://extensions, sotto Splisto, la trovi alla voce "Caricata da": scegli quella (contiene manifest.json).')
  }
  await (await kv()).put('kv', dir, 'dir')
  return dir
}

async function write(root: Dir, path: string, b64: string) {
  const parts = path.split('/')
  let dir: FileSystemDirectoryHandle = root
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true })
  const w = await (await dir.getFileHandle(parts.at(-1)!, { create: true })).createWritable()
  await w.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
  await w.close()
}

/** Scarica la release, la scrive nella cartella dell'estensione e ricarica. `onStep` = cosa sta facendo. */
export async function installUpdate(rel: Release, onStep: (s: string) => void): Promise<void> {
  // per primo, finché vale il clic: chiede la cartella (o conferma il permesso)
  const dir = await folder()
  if (await busy()) throw new Error('Ci sono compilazioni o controlli in corso: aggiorna quando sono finiti.')
  onStep('Scarico…')
  const r = await fetch(rel.bundle, { headers: { Accept: 'application/octet-stream' } })
  if (!r.ok) throw new Error(`Download non riuscito (${r.status})`)
  const b = (await r.json()) as { version?: string; files?: Record<string, string> }
  const files = b.files ?? {}
  const paths = Object.keys(files)
  if (b.version !== rel.version || !files['manifest.json'] || !paths.every(safePath)) throw new Error('Il pacchetto scaricato non è valido.')
  onStep('Installo…')
  // manifest.json per ultimo: se qualcosa va storto a metà, Chrome continua a caricare la versione di prima
  for (const p of paths.filter((p) => p !== 'manifest.json')) await write(dir, p, files[p])
  await write(dir, 'manifest.json', files['manifest.json'])
  await chrome.storage.local.set({ reloadedAt: Date.now(), afterReload: 'open' })
  chrome.runtime.reload()
}
