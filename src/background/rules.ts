// Regole del service worker senza chrome.* né IndexedDB, così si testano con `node --test`.
import { idInUrl, platformOfUrl, sameUrl } from '../content/text.ts'
import type { ImportedItem, Msg, PlatformStatus } from '../lib/types.ts'

// Comandi che solo la dashboard può dare; gli altri messaggi arrivano dalle schede dei siti.
const FROM_DASHBOARD = new Set<Msg['type']>(['publish', 'relist', 'refreshStats', 'importAll', 'checkAuth', 'teach'])

interface Sender {
  id?: string
  url?: string
  tab?: unknown
}

/** Il messaggio può essere eseguito? `extId` / `extBase` = id e indirizzo base di questa estensione. */
export function allowed(msg: Msg, sender: Sender, extId: string, extBase: string): boolean {
  if (sender.id !== extId || !msg || typeof msg !== 'object') return false
  const fromDashboard = !!sender.url?.startsWith(extBase)
  if (FROM_DASHBOARD.has(msg.type)) return fromDashboard
  if (msg.type === 'statusChanged') return false
  // dalle schede: la piattaforma dichiarata deve essere quella del sito da cui arriva il messaggio
  const site = platformOfUrl(sender.url ?? '')
  if (!sender.tab || !site) return false
  return !('platform' in msg) || msg.platform === site
}

/** L'annuncio letto dal sito è quello salvato con questo stato (stesso id, stesso link o id nel link)? */
export function sameRemote(s: PlatformStatus | undefined, it: Pick<ImportedItem, 'remoteId' | 'url'>): boolean {
  return (!!s?.remoteId && s.remoteId === it.remoteId) || sameUrl(s?.url ?? '', it.url) || (!!idInUrl(s?.url) && idInUrl(s?.url) === it.remoteId)
}

/**
 * Dopo un'importazione completa: un annuncio pubblicato che non compare tra quelli letti dal sito.
 * Non conta se venduto, senza link/id, o pubblicato nell'ultima ora (può non essere ancora in elenco).
 */
export function missingFromSite(s: PlatformStatus | undefined, sold: boolean, seen: Set<string>, seenUrls: string[], now = Date.now()): boolean {
  if (sold || s?.state !== 'published' || (!s.remoteId && !s.url)) return false
  if (now - (s.publishedAt ?? 0) < 3_600_000) return false
  const id = idInUrl(s.url)
  const there = (!!s.remoteId && seen.has(s.remoteId)) || (!!id && seen.has(id)) || seenUrls.some((u) => sameUrl(s.url ?? '', u))
  return !there
}
