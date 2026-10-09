/*
 * Servizi AI per le funzioni ✨. Claude usa l'API Anthropic; gli altri l'API "compatibile OpenAI"
 * (/chat/completions), che offrono anche Gemini, OpenRouter, Groq, Mistral e Ollama.
 * Il modello si può cambiare nelle Impostazioni: i nomi qui sono solo il punto di partenza (10/2026).
 */
export const PROVIDER_IDS = ['anthropic', 'gemini', 'openai', 'openrouter', 'groq', 'mistral', 'ollama', 'custom'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface Provider {
  label: string
  baseUrl: string // vuoto = da scrivere (solo "custom")
  model: string
  keyUrl?: string // dove si crea la chiave
  note?: string
  noKey?: boolean
  fallbackModels?: string[] // se il modello predefinito non risponde (solo quando il modello non è scelto a mano)
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: { label: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', note: 'A pagamento con credito API (l’abbonamento Pro non vale per l’API).' },
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest', fallbackModels: ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite'], keyUrl: 'https://aistudio.google.com/apikey', note: 'Piano gratuito con un account Google, foto incluse.' },
  openai: { label: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', note: 'A pagamento con credito API (l’abbonamento ChatGPT non vale per l’API).' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys', note: 'Molti modelli con una chiave; alcuni gratuiti (nome che finisce con ":free").' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'meta-llama/llama-4-scout-17b-16e-instruct', keyUrl: 'https://console.groq.com/keys', note: 'Piano gratuito, molto veloce.' },
  mistral: { label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', note: 'Piano gratuito di prova.' },
  ollama: { label: 'Ollama (sul tuo PC)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2-vision', noKey: true, note: 'Gratis e offline: installa Ollama e scarica il modello. Nessun dato esce dal PC.' },
  custom: { label: 'Altro (compatibile OpenAI)', baseUrl: '', model: '', note: 'Indirizzo dell’API che termina con /v1 (o simile) e nome del modello.' },
}

export interface AiSettings {
  provider: ProviderId
  model: string // vuoto = quello del servizio
  baseUrl: string // solo per "custom" (o per spostare Ollama)
}

export const DEFAULT_AI: AiSettings = { provider: 'anthropic', model: '', baseUrl: '' }

export const isProvider = (v: unknown): v is ProviderId => PROVIDER_IDS.includes(v as ProviderId)

/** Indirizzo accettato: https, oppure http solo sul PC (Ollama e simili). */
export function validBaseUrl(u: string): boolean {
  try {
    const x = new URL(u)
    return x.protocol === 'https:' || (x.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname))
  } catch {
    return false
  }
}

export const MODEL_RE = /^[\w.:/@-]{1,120}$/

/** Servizio, modello e indirizzo effettivi. */
export function resolveAi(ai: AiSettings): { id: ProviderId; model: string; baseUrl: string } {
  const p = PROVIDERS[ai.provider] ?? PROVIDERS.anthropic
  const custom = ai.provider === 'custom' || ai.provider === 'ollama'
  return {
    id: isProvider(ai.provider) ? ai.provider : 'anthropic',
    model: ai.model.trim() || p.model,
    baseUrl: (custom && ai.baseUrl.trim() ? ai.baseUrl.trim() : p.baseUrl).replace(/\/+$/, ''),
  }
}

/** Permesso da chiedere per contattare quell'indirizzo (es. "https://api.groq.com/*"). */
export const originPattern = (baseUrl: string) => {
  const u = new URL(baseUrl)
  return `${u.protocol}//${u.hostname}/*` // i permessi non indicano la porta
}

/** Oggetto JSON in una risposta, anche se il modello l'ha messo in un blocco ``` o con testo intorno. */
export function jsonFrom(text: string): Record<string, unknown> {
  const a = text.indexOf('{')
  const b = text.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try {
      const v = JSON.parse(text.slice(a, b + 1))
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    } catch {
      // risposta non valida: errore sotto
    }
  }
  throw new Error('Risposta non valida dal servizio AI. Riprova.')
}
