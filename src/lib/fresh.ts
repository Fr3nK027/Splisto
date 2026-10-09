/*
 * Dopo `npm run build` Chrome continua a usare il manifest caricato all'avvio: permessi nuovi e content script
 * nuovi non valgono finché l'estensione non viene ricaricata. Qui lo si rileva confrontando il manifest in memoria
 * con quello su disco, e si ricarica da soli (una volta ogni 2 minuti al massimo, per non entrare in un ciclo).
 */

type Manifest = Partial<chrome.runtime.Manifest> & Record<string, unknown>
const shape = (m: Manifest) => JSON.stringify([m.version, m.permissions, m.host_permissions, m.content_scripts, m.web_accessible_resources])

async function stale(): Promise<boolean> {
  try {
    const disk = (await (await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })).json()) as Manifest
    return shape(disk) !== shape(chrome.runtime.getManifest() as Manifest)
  } catch {
    return false
  }
}

/** Ricarica l'estensione se su disco c'è una build diversa. `reopen` = riapri la dashboard dopo. true = sta ricaricando. */
export async function reloadIfStale(reopen: boolean): Promise<boolean> {
  if (!(await stale())) return false
  // la ricarica azzera job e code: aspetta che compilazioni, controlli e importazioni siano finiti
  const session = await chrome.storage.session.get(null)
  if (Object.keys(session).some((k) => k.startsWith('job:'))) return false
  const { reloadedAt = 0 } = await chrome.storage.local.get('reloadedAt')
  if (Date.now() - (reloadedAt as number) < 120_000) return false
  await chrome.storage.local.set({ reloadedAt: Date.now(), ...(reopen && { afterReload: 'open' }) })
  chrome.runtime.reload()
  return true
}
