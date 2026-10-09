import { DEFAULT_AI, isProvider, MODEL_RE, type AiSettings } from './providers.ts' // con estensione: lo importano anche i test di Node
import type { Platform } from './types'

export type Tone = 'neutro' | 'amichevole' | 'conciso'
export interface Fee {
  pct: number // commissione percentuale sul prezzo
  fixed: number // costo fisso per vendita (€)
}

export interface Settings {
  tone: Tone
  /** Compila un sito alla volta in una scheda in primo piano (più lento, più affidabile). */
  sequential: boolean
  /** Testo aggiunto in fondo alla descrizione: 'all' per tutti i siti, poi quello specifico. */
  footers: Partial<Record<Platform | 'all', string>>
  /** Commissioni a carico del venditore, per il calcolo del netto. Verifica le tariffe attuali di ogni sito. */
  fees: Record<Platform, Fee>
  /** Ogni quante ore controllare in background se sei ancora loggato (0 = mai). */
  authEvery: number
  /** Servizio AI per le funzioni ✨ (la chiave sta a parte, in secret.ts). */
  ai: AiSettings
}

export const DEFAULT_SETTINGS: Settings = {
  tone: 'neutro',
  sequential: true,
  authEvery: 0, // controllo periodico spento: lo accendi tu nelle Impostazioni
  ai: DEFAULT_AI,
  footers: {},
  fees: {
    vinted: { pct: 0, fixed: 0 }, // la commissione la paga l'acquirente
    ebay: { pct: 0, fixed: 0 },
    subito: { pct: 0, fixed: 0 },
    facebook: { pct: 0, fixed: 0 },
    wallapop: { pct: 0, fixed: 0 },
  },
}

export async function getSettings(): Promise<Settings> {
  const s = (await chrome.storage.local.get({ ...DEFAULT_SETTINGS })) as Settings // i valori passati fanno da default
  return { ...s, fees: { ...DEFAULT_SETTINGS.fees, ...s.fees }, ai: { ...DEFAULT_AI, ...s.ai } } // campi aggiunti dopo il primo salvataggio
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch)
}

const AUTH_EVERY = [0, 3, 6, 12, 24]

/** Impostazioni da un backup: solo chiavi note e valori validi (un backup può arrivare da chiunque). */
export function cleanSettings(raw: Record<string, unknown>): Partial<Settings> {
  const PLATFORMS = Object.keys(DEFAULT_SETTINGS.fees) as Platform[]
  const out: Partial<Settings> = {}
  if (raw.tone === 'neutro' || raw.tone === 'amichevole' || raw.tone === 'conciso') out.tone = raw.tone
  if (typeof raw.sequential === 'boolean') out.sequential = raw.sequential
  if (AUTH_EVERY.includes(raw.authEvery as number)) out.authEvery = raw.authEvery as number
  const footers = raw.footers && typeof raw.footers === 'object' ? (raw.footers as Record<string, unknown>) : {}
  out.footers = Object.fromEntries(
    Object.entries(footers).filter(([k, v]) => (k === 'all' || (PLATFORMS as string[]).includes(k)) && typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, 2000)]),
  )
  const fees = raw.fees && typeof raw.fees === 'object' ? (raw.fees as Record<string, { pct?: unknown; fixed?: unknown }>) : {}
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : 0)
  out.fees = Object.fromEntries(PLATFORMS.map((p) => [p, { pct: n(fees[p]?.pct, 100), fixed: n(fees[p]?.fixed, 1000) }])) as Settings['fees']
  // Servizio AI: solo quelli noti e mai l'indirizzo (un backup ostile potrebbe mandare la tua chiave a un altro server)
  const ai = raw.ai && typeof raw.ai === 'object' ? (raw.ai as Record<string, unknown>) : null
  if (ai && isProvider(ai.provider) && ai.provider !== 'custom') {
    out.ai = { provider: ai.provider, model: typeof ai.model === 'string' && MODEL_RE.test(ai.model) ? ai.model : '', baseUrl: '' }
  }
  return out
}

export const netPrice = (price: number, fee: Fee) => Math.max(0, price * (1 - fee.pct / 100) - fee.fixed)

// --- Selettori appresi con "Insegna" (uno per campo, provato prima di quelli del file) ---

export const learnedKey = (p: Platform) => `learned:${p}`
