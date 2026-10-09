import { openDB } from 'idb'

import type { ProviderId } from './providers'

/*
 * Chiavi API (una per servizio AI) in un database IndexedDB dell'estensione: i content script girano nell'origine dei siti
 * e non possono leggerlo (chrome.storage.local invece è accessibile anche a loro). Non finisce nei backup.
 */
const dbp = openDB('multipost-secrets', 1, {
  upgrade(db) {
    db.createObjectStore('kv')
  },
})

// 'apiKey' = Anthropic (nome delle prime versioni); gli altri servizi 'apiKey:<id>'
const slot = (p: ProviderId) => (p === 'anthropic' ? 'apiKey' : `apiKey:${p}`)

export async function getApiKey(p: ProviderId = 'anthropic'): Promise<string> {
  const db = await dbp
  if (p !== 'anthropic') return ((await db.get('kv', slot(p))) as string | undefined) ?? ''
  const k = (await db.get('kv', 'apiKey')) as string | undefined
  if (k !== undefined) return k
  // versioni precedenti: la chiave stava in chrome.storage.local -> spostala e cancellala da lì
  const old = (await chrome.storage.local.get('apiKey')).apiKey
  const moved = typeof old === 'string' ? old : ''
  await db.put('kv', moved, 'apiKey')
  await chrome.storage.local.remove('apiKey')
  return moved
}

export async function setApiKey(k: string, p: ProviderId = 'anthropic'): Promise<void> {
  await (await dbp).put('kv', k, slot(p))
  await chrome.storage.local.remove('apiKey')
}
