export const PLATFORMS = ['vinted', 'ebay', 'subito', 'facebook', 'wallapop'] as const
export type Platform = (typeof PLATFORMS)[number]

export type Condition = 'nuovo_cartellino' | 'nuovo' | 'ottimo' | 'buono' | 'discreto'

export type StatusState =
  | 'idle' // mai aperto
  | 'opening' // scheda aperta, compilazione in corso
  | 'filled' // tutto compilato
  | 'incomplete' // compilato in parte, vedi missing
  | 'login' // l'utente non è loggato
  | 'error'
  | 'published' // pubblicato (rilevato in automatico o segnato a mano)
  | 'removed' // tolto dal sito dopo la vendita altrove

export interface PlatformStatus {
  state: StatusState
  missing?: string[]
  missingKeys?: string[] // chiavi dei campi mancanti, per "Insegna"
  message?: string
  url?: string
  at?: number
  publishedAt?: number
  remoteId?: string // id dell'annuncio sul sito (per riconoscerlo alle importazioni successive)
  detailAt?: number // quando sono stati chiesti descrizione e foto dell'annuncio importato (una volta sola)
  /** Aggiornamento in corso di un annuncio già pubblicato (pagina "Modifica" del sito): lo stato resta "published". */
  edit?: { state: StatusState; missing?: string[]; missingKeys?: string[]; message?: string; at: number }
  missingCount?: number // importazioni di fila in cui non era tra gli annunci attivi (2+ = venduto o tolto?)
  sitePrice?: number | null // prezzo sul sito (letto all'importazione o compilato e salvato dall'utente)
  siteTitle?: string // titolo sul sito
  statsUrl?: string // pagina con le statistiche, se diversa da url (Subito: "Statistiche" dell'annuncio)
  oldIds?: string[] // id dei vecchi annunci sostituiti da "Duplica come nuovo": le importazioni li ignorano
}

export interface PlatformStats {
  views: number | null
  likes: number | null
  at: number
}

export interface Listing {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  description: string
  price: number | null
  category: string // chiave di CATEGORIES in lib/platforms.ts
  condition: Condition
  brand: string
  size: string
  color: string
  weightG: number | null
  dims: string // es. "30x20x10" (cm)
  photos: Blob[] // in ordine, già ridimensionate
  platforms: Platform[]
  categoryOverride: Partial<Record<Platform, string>>
  titleOverride: Partial<Record<Platform, string>>
  priceOverride: Partial<Record<Platform, number>>
  sold: { platform: Platform | 'altro'; at: number } | null
  status: Partial<Record<Platform, PlatformStatus>> // scritto solo da updateStatus
  stats: Partial<Record<Platform, PlatformStats>> // scritto solo da updateStats
  importedFrom?: Platform // creato importando un annuncio già online (es. messo dal telefono)
}

/** Accesso a un sito: ok = loggato, false = disconnesso, null = non verificabile. In chrome.storage.local 'auth'. */
export interface AuthState {
  ok: boolean | null
  at: number
  checking?: boolean
  /** Campi del modulo non trovati dall'ultimo controllo accessi: selettori da aggiornare (o da "Insegna"). */
  broken?: string[]
}

/** Riepilogo dell'ultima importazione dai siti (chrome.storage.local 'lastImport', scritto dal service worker). */
export interface LastImport {
  at: number
  created: number
  running: Platform[]
  errors: Partial<Record<Platform, string>>
}

/** Annuncio letto dalla pagina "i miei annunci" di un sito. */
export interface ImportedItem {
  url: string
  remoteId: string
  title: string
  price: number | null
  image?: string
  views?: number | null
  likes?: number | null
  statsUrl?: string
  brand?: string
  condition?: string
  size?: string
  sold?: boolean // il sito lo mostra come venduto
}

/** Dettagli letti dalla pagina del singolo annuncio importato. */
export interface ItemDetail {
  description: string
  descriptionUrl?: string // eBay: pagina della descrizione (itm.ebaydesc.com)
  photos: string[] // URL delle foto sul sito
  condition?: string
  brand?: string
  views: number | null
  likes: number | null
}

/** Foto serializzata per viaggiare nei messaggi (i Blob non passano da chrome.runtime). */
export interface WirePhoto {
  type: string
  data: string // base64
}

/** Annuncio come lo riceve il content script: titolo, prezzo, categoria e descrizione già risolti per il sito. */
export interface JobListing extends Omit<Listing, 'photos' | 'status' | 'stats'> {
  photos: WirePhoto[]
  categoryText: string
}

export interface FillResult {
  ok: boolean
  missingFields: string[]
  missingKeys?: string[]
  /** true = la piattaforma ha un passaggio intermedio: tieni il job e riprova al cambio pagina. */
  waiting?: boolean
  /** Con waiting: riprova quando compare uno di questi campi (procedure a passi sulla stessa pagina, es. Wallapop). */
  resumeOn?: (string | { label: string })[]
}

export interface FillOptions {
  skipPhotos?: boolean // ricompilazione dopo "Insegna": le foto sono già caricate
  edit?: boolean // pagina "Modifica" di un annuncio già online: niente foto né categoria (restano quelle del sito)
}

export interface Adapter {
  fill(listing: JobListing, opts?: FillOptions): Promise<FillResult>
}

/** Cosa deve fare il content script in questa scheda. */
export type JobReply =
  | null
  | { kind: 'fill'; listing: JobListing; edit?: boolean; url?: string }
  | { kind: 'await'; listing: JobListing; edit?: boolean; url?: string } // modulo già compilato: attendi la pubblicazione per salvare il link
  | { kind: 'stats' }
  | { kind: 'auth' } // controlla solo se sei ancora loggato
  | { kind: 'import' } // legge la pagina "i miei annunci"
  | { kind: 'detail' } // legge descrizione, foto e statistiche di un annuncio importato

export type Msg =
  | { type: 'publish'; listingId: string; platforms: Platform[]; queue?: boolean } // queue = sempre uno alla volta
  | { type: 'relist'; listingId: string; platforms: Platform[] } // "Duplica come nuovo": vecchio da eliminare + nuovo identico
  | { type: 'getJob'; platform: Platform }
  | { type: 'result'; state: StatusState; missing?: string[]; missingKeys?: string[]; message?: string; keepJob?: boolean }
  | { type: 'published'; url: string }
  | { type: 'stats'; views: number | null; likes: number | null }
  | { type: 'refreshStats' }
  | { type: 'auth'; platform: Platform; ok: boolean | null; broken?: string[] } // broken solo dal controllo accessi
  | { type: 'checkAuth' }
  | { type: 'imported'; platform: Platform; items: ImportedItem[]; error?: string; partial?: boolean }
  | { type: 'detail'; detail: ItemDetail }
  | { type: 'importAll'; platforms?: Platform[] } // senza platforms: tutti i siti
  | { type: 'teach'; listingId: string; platform: Platform; key: string; label: string }
  | { type: 'statusChanged'; listingId: string }

/** Messaggio dal service worker al content script. */
export type TabMsg = { type: 'teach'; key: string; label: string }
