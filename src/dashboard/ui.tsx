import { Eye, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PLATFORM_LABEL } from '../lib/platforms'
import { PLATFORMS, type AuthState, type LastImport, type Msg, type Platform, type PlatformStats, type StatusState } from '../lib/types'

export const STATE_LABEL: Record<StatusState, string> = {
  idle: 'Non inviato',
  opening: 'In compilazione…',
  filled: 'Compilato',
  incomplete: 'Da completare',
  login: 'Accesso richiesto',
  error: 'Errore',
  published: 'Pubblicato',
  removed: 'Rimosso',
}

export function Dot({ state = 'idle' }: { state?: StatusState }) {
  return <span className={`dot dot-${state}`} aria-hidden="true" />
}

/** Miniatura da Blob (crea e libera l'object URL). */
export function Thumb({ blob, className = 'thumb' }: { blob?: Blob; className?: string }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url ? <img className={className} src={url} alt="" /> : <div className={`${className} thumb-empty`} />
}

/** Richiama `cb` quando il service worker segnala un cambio di stato. */
export function useStatusChanged(cb: (listingId: string) => void) {
  useEffect(() => {
    const onMsg = (m: Msg) => {
      if (m.type === 'statusChanged') cb(m.listingId)
    }
    chrome.runtime.onMessage.addListener(onMsg)
    return () => chrome.runtime.onMessage.removeListener(onMsg)
  }, [cb])
}

export const fmt = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('it-IT'))

/** Visualizzazioni e like (– = non letti). */
export function StatPair({ views, likes }: { views?: number | null; likes?: number | null }) {
  return (
    <span className="stat-pair">
      <span title="Visualizzazioni">
        <Eye size={13} aria-label="Visualizzazioni" /> {fmt(views)}
      </span>
      <span title="Like / preferiti / osservatori">
        <Heart size={13} aria-label="Like" /> {fmt(likes)}
      </span>
    </span>
  )
}

export const statsAge = (s?: PlatformStats) =>
  s ? new Date(s.at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

/** "adesso", "5 min fa", "3 h fa", poi la data. */
export function ago(ts?: number): string {
  if (!ts) return 'mai'
  const m = Math.round((Date.now() - ts) / 60_000)
  if (m < 1) return 'adesso'
  if (m < 60) return `${m} min fa`
  if (m < 24 * 60) return `${Math.round(m / 60)} h fa`
  return new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

/** Stato degli accessi ai siti, aggiornato dal service worker in chrome.storage.local ('auth:<sito>'). */
export function useAuth(): Partial<Record<Platform, AuthState>> {
  const [auth, setAuth] = useState<Partial<Record<Platform, AuthState>>>({})
  useEffect(() => {
    const keys = PLATFORMS.map((p) => `auth:${p}`)
    const load = () =>
      void chrome.storage.local.get(keys).then((all) => setAuth(Object.fromEntries(PLATFORMS.map((p) => [p, all[`auth:${p}`]]))))
    const onCh = (ch: Record<string, unknown>, area: string) => area === 'local' && keys.some((k) => k in ch) && load()
    load()
    chrome.storage.onChanged.addListener(onCh)
    const t = setInterval(load, 60_000) // rinfresca "x min fa"
    return () => {
      chrome.storage.onChanged.removeListener(onCh)
      clearInterval(t)
    }
  }, [])
  return auth
}

// Loghi ufficiali in public/logos (presi dai siti, 10/2026). Varianti scure dove il colore originale non si legge.
const DARK_LOGO: Record<string, string> = { vinted: 'vinted-dark', 'vinted-mark': 'vinted-mark-dark' }

/** Logo del sito: `mark` = icona quadrata per spazi piccoli, altrimenti il logotipo. */
export function Logo({ p, mark = false }: { p: Platform; mark?: boolean }) {
  const name = p === 'facebook' ? 'facebook' : mark ? `${p}-mark` : p
  const dark = DARK_LOGO[name]
  return (
    <span className={`logo logo-${mark ? 'mark' : 'word'} logo-${p}`}>
      <picture>
        {dark && <source srcSet={`/logos/${dark}.svg`} media="(prefers-color-scheme: dark)" />}
        <img src={`/logos/${name}.svg`} alt={PLATFORM_LABEL[p]} />
      </picture>
      {/* Facebook non ha un logotipo "Marketplace": icona + nome del servizio */}
      {p === 'facebook' && !mark && <span className="logo-sub">Marketplace</span>}
    </span>
  )
}

/** Riepilogo dell'ultima importazione dai siti (scritto dal service worker in chrome.storage.local). */
export function useLastImport(): LastImport | undefined {
  const [li, setLi] = useState<LastImport>()
  useEffect(() => {
    const load = () => void chrome.storage.local.get('lastImport').then((o) => setLi(o.lastImport as LastImport | undefined))
    const onCh = (ch: Record<string, unknown>, area: string) => area === 'local' && 'lastImport' in ch && load()
    load()
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])
  return li
}
