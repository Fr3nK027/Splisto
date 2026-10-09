import { openDB } from 'idb'
import { SITE_URL } from '../content/text'
import { CATEGORIES } from './platforms'
import { PLATFORMS, type Condition, type Listing, type Platform, type PlatformStats, type PlatformStatus, type StatusState, type WirePhoto } from './types'

const dbp = openDB('multipost', 1, {
  upgrade(db) {
    db.createObjectStore('listings', { keyPath: 'id' })
  },
})

/** Completa i record salvati da versioni precedenti (o importati) con i campi nuovi. */
const fix = (l: Listing): Listing => ({ ...newListing(), ...l })

export async function allListings(): Promise<Listing[]> {
  const list: Listing[] = await (await dbp).getAll('listings')
  return list.map(fix).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getListing(id: string): Promise<Listing | undefined> {
  const l: Listing | undefined = await (await dbp).get('listings', id)
  return l && fix(l)
}

/**
 * Legge e riscrive un annuncio nella stessa transazione: dashboard, importazione e schede dei siti possono
 * scrivere insieme senza che uno cancelli le modifiche dell'altro. `fn` deve essere sincrona (niente await).
 */
export async function patchListing(id: string, fn: (l: Listing) => void): Promise<Listing | undefined> {
  const tx = (await dbp).transaction('listings', 'readwrite')
  const raw: Listing | undefined = await tx.store.get(id)
  let l: Listing | undefined
  if (raw) {
    l = fix(raw)
    fn(l)
    l.updatedAt = Date.now()
    await tx.store.put(l)
  }
  await tx.done
  return l
}

/** Salva solo i campi indicati (quelli modificati nell'editor). */
export const saveFields = (id: string, patch: Partial<Listing>) =>
  patchListing(id, (l) => {
    const { id: _id, status: _s, stats: _st, ...rest } = patch
    Object.assign(l, rest)
  })

/** Annuncio nuovo (creazione, duplicato). */
export async function saveListing(l: Listing): Promise<void> {
  await (await dbp).put('listings', { ...l, updatedAt: Date.now() })
}

export const updateStatus = (id: string, p: Platform, patch: Partial<PlatformStatus>) =>
  patchListing(id, (l) => {
    const prev = l.status[p]
    const next: PlatformStatus = { ...prev, ...patch, state: patch.state ?? prev?.state ?? 'idle', at: Date.now() }
    if (next.state === 'published' && prev?.state !== 'published') next.publishedAt = Date.now()
    l.status = { ...l.status, [p]: next }
  })

/** Aggiorna le statistiche; un valore null non cancella quello già letto. Se mancano entrambi non scrive nulla. */
export const updateStats = (id: string, p: Platform, s: Omit<PlatformStats, 'at'>) =>
  s.views == null && s.likes == null
    ? Promise.resolve(undefined)
    : patchListing(id, (l) => {
        const prev = l.stats[p]
        l.stats = { ...l.stats, [p]: { views: s.views ?? prev?.views ?? null, likes: s.likes ?? prev?.likes ?? null, at: Date.now() } }
      })

export async function deleteListing(id: string): Promise<void> {
  await (await dbp).delete('listings', id)
}

export function newListing(): Listing {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    title: '',
    description: '',
    price: null,
    category: 'altro',
    condition: 'buono',
    brand: '',
    size: '',
    color: '',
    weightG: null,
    dims: '',
    photos: [],
    platforms: [...PLATFORMS],
    categoryOverride: {},
    titleOverride: {},
    priceOverride: {},
    sold: null,
    status: {},
    stats: {},
  }
}

export async function duplicateListing(l: Listing): Promise<Listing> {
  const now = Date.now()
  const { importedFrom: _i, ...rest } = l
  const copy = { ...rest, id: crypto.randomUUID(), title: `${l.title} (copia)`, createdAt: now, status: {}, stats: {}, sold: null }
  await saveListing(copy)
  return copy
}

// --- Blob <-> base64 (i Blob non passano dai messaggi né dal JSON) ---

export async function blobToWire(b: Blob): Promise<WirePhoto> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { type: b.type || 'image/jpeg', data: btoa(bin) }
}

export function wireToBlob(w: WirePhoto): Blob {
  return new Blob([Uint8Array.from(atob(w.data), (c) => c.charCodeAt(0))], { type: w.type })
}

// --- Backup ---

/** File di backup: un oggetto JSON scritto a pezzi, un annuncio alla volta (niente stringa unica enorme). */
export async function exportAll(settings: Record<string, unknown>): Promise<Blob> {
  const parts: BlobPart[] = [`{"app":"multipost","version":1,"exportedAt":${JSON.stringify(new Date().toISOString())},"settings":${JSON.stringify(settings)},"listings":[`]
  const all = await allListings()
  for (const [i, l] of all.entries()) {
    parts.push((i ? ',' : '') + JSON.stringify({ ...l, photos: await Promise.all(l.photos.map(blobToWire)) }))
  }
  parts.push(']}')
  return new Blob(parts, { type: 'application/json' })
}

// Un backup può arrivare da chiunque: si tengono solo campi noti, con il tipo giusto.
const STATES: StatusState[] = ['idle', 'opening', 'filled', 'incomplete', 'login', 'error', 'published', 'removed']
const CONDITIONS: Condition[] = ['nuovo_cartellino', 'nuovo', 'ottimo', 'buono', 'discreto']
type Raw = Record<string, unknown>
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {})
const str = (v: unknown, max = 20_000) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const isPlatform = (v: unknown): v is Platform => PLATFORMS.includes(v as Platform)
const url = (v: unknown) => (typeof v === 'string' && SITE_URL.test(v) ? v : undefined)
const perPlatform = <T,>(v: unknown, f: (x: unknown) => T | undefined) =>
  Object.fromEntries(Object.entries(obj(v)).flatMap(([p, x]) => (isPlatform(p) && f(x) !== undefined ? [[p, f(x)]] : []))) as Partial<Record<Platform, T>>

function cleanStatus(v: unknown): PlatformStatus | undefined {
  const s = obj(v)
  if (!STATES.includes(s.state as StatusState)) return undefined
  const strings = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string').slice(0, 50) : [])
  return {
    state: s.state === 'opening' ? (url(s.url) ? 'published' : 'idle') : (s.state as StatusState), // nessuna scheda dietro dopo un ripristino
    missing: strings(s.missing),
    missingKeys: strings(s.missingKeys),
    message: str(s.message, 500) || undefined,
    url: url(s.url),
    statsUrl: url(s.statsUrl),
    remoteId: str(s.remoteId, 200) || undefined,
    oldIds: strings(s.oldIds).slice(-20).map((x) => x.slice(0, 200)),
    at: num(s.at) ?? undefined,
    publishedAt: num(s.publishedAt) ?? undefined,
    sitePrice: num(s.sitePrice) ?? undefined,
    siteTitle: str(s.siteTitle, 300) || undefined,
    missingCount: num(s.missingCount) ?? undefined,
    detailAt: num(s.detailAt) ?? undefined,
  }
}

function cleanListing(v: unknown): Listing | null {
  const r = obj(v)
  const id = str(r.id, 64)
  if (!/^[\w-]{1,64}$/.test(id)) return null
  const sold = obj(r.sold)
  const photos = (Array.isArray(r.photos) ? r.photos : []).slice(0, 10).flatMap((p) => {
    const w = obj(p)
    if (!str(w.type).startsWith('image/') || typeof w.data !== 'string') return []
    try {
      return [wireToBlob({ type: str(w.type, 40), data: w.data })]
    } catch {
      return [] // base64 non valido
    }
  })
  return {
    ...newListing(),
    id,
    createdAt: num(r.createdAt) ?? Date.now(),
    updatedAt: num(r.updatedAt) ?? Date.now(),
    title: str(r.title, 300),
    description: str(r.description),
    price: num(r.price),
    category: typeof r.category === 'string' && r.category in CATEGORIES ? r.category : 'altro',
    condition: CONDITIONS.includes(r.condition as Condition) ? (r.condition as Condition) : 'buono',
    brand: str(r.brand, 100),
    size: str(r.size, 50),
    color: str(r.color, 50),
    weightG: num(r.weightG),
    dims: str(r.dims, 50),
    photos,
    platforms: Array.isArray(r.platforms) ? r.platforms.filter(isPlatform) : [...PLATFORMS],
    categoryOverride: perPlatform(r.categoryOverride, (x) => (typeof x === 'string' ? x.slice(0, 200) : undefined)),
    titleOverride: perPlatform(r.titleOverride, (x) => (typeof x === 'string' ? x.slice(0, 300) : undefined)),
    priceOverride: perPlatform(r.priceOverride, (x) => num(x) ?? undefined),
    sold: (isPlatform(sold.platform) || sold.platform === 'altro') && num(sold.at) ? { platform: sold.platform as Platform | 'altro', at: num(sold.at)! } : null,
    status: perPlatform(r.status, cleanStatus),
    stats: perPlatform(r.stats, (x) => {
      const s = obj(x)
      return num(s.at) ? { views: num(s.views), likes: num(s.likes), at: num(s.at)! } : undefined
    }),
    importedFrom: isPlatform(r.importedFrom) ? r.importedFrom : undefined,
  }
}

/** Importa un backup: gli annunci con lo stesso id vengono sovrascritti. Prima controlla tutto, poi scrive. */
export async function importAll(file: File): Promise<{ count: number; settings: Record<string, unknown> }> {
  const data = obj(JSON.parse(await file.text()))
  if (data.app !== 'multipost' || !Array.isArray(data.listings)) throw new Error('File non valido: non è un backup di Splisto.')
  const listings = data.listings.map(cleanListing).filter((l): l is Listing => !!l)
  const tx = (await dbp).transaction('listings', 'readwrite')
  for (const l of listings) await tx.store.put(l)
  await tx.done
  return { count: listings.length, settings: obj(data.settings) }
}
