import contentScript from '../content/index.ts?iife'
import { SITES } from '../content/selectors'
import { bigPhoto, conditionFrom, editUrlFor, htmlToText, idInUrl, PHOTO_URL, platformOfUrl, sameItem, sameUrl, SITE_URL, withDetails } from '../content/text'
import { allListings, blobToWire, deleteListing, getListing, newListing, patchListing, saveListing, updateStats, updateStatus } from '../lib/db'
import { reloadIfStale } from '../lib/fresh'
import { resizeImage } from '../lib/image'
import { categoryFor, PLATFORM_LABEL, publishedOn, sitePriceFor, titleFor } from '../lib/platforms'
import { getSettings } from '../lib/settings'
import { allowed, missingFromSite, sameRemote } from './rules'
import { PLATFORMS, type AuthState, type ImportedItem, type ItemDetail, type JobListing, type LastImport, type JobReply, type Listing, type Msg, type Platform, type StatusState, type TabMsg } from '../lib/types'

/*
 * Job = "cosa deve fare la scheda X":
 *  - fill: compila l'annuncio; poi phase 'await' = attende che l'utente pubblichi per salvare il link;
 *  - stats: legge visualizzazioni e like dalla pagina dell'annuncio (autoClose = scheda aperta da noi);
 *  - auth: controlla solo se sei ancora loggato (listingId vuoto);
 *  - import: legge la pagina "i miei annunci" del sito (listingId vuoto);
 *  - detail: legge descrizione, foto e statistiche di un annuncio appena importato;
 *  - login: pagina di accesso aperta da Splisto; quando sei rientrato conferma l'accesso (la scheda resta aperta);
 *  - remove: elimina l'annuncio dal sito (pulsanti `remove` nei selettori), poi chiude la scheda.
 * Tutto in storage.session perché il service worker può essere fermato in qualsiasi momento.
 * Lo script dei siti è registrato solo finché c'è almeno un job (syncScript): senza lavori in corso nessuna pagina lo riceve.
 */
interface Job {
  listingId: string
  platform: Platform
  kind: 'fill' | 'stats' | 'auth' | 'import' | 'detail' | 'login' | 'remove'
  phase?: 'await'
  autoClose?: boolean
  url?: string
  edit?: boolean // fill sulla pagina "Modifica" di un annuncio già pubblicato
  filledPrice?: number | null // valori effettivamente compilati: diventano "sul sito" quando l'utente salva
  filledTitle?: string
  replacePhotos?: boolean // detail: sostituisce le foto ("Riscarica le foto")
}
interface QueueItem {
  listingId: string
  platform: Platform
  url?: string
  kind?: 'stats' | 'detail' // schede in background, due alla volta
  edit?: boolean // compilazione: aggiorna un annuncio già pubblicato (url = pagina "Modifica")
  replacePhotos?: boolean
}
interface Queues {
  fill: QueueItem[]
  fillTab: number | null // scheda in compilazione (modalità "una alla volta")
  stats: QueueItem[]
  statsTabs: { id: number; at: number }[]
}

const STATS_PARALLEL = 2
/** Esiti che una scheda può mandare con 'result' ("pubblicato" e "rimosso" li decide solo il service worker). */
const TAB_STATES = new Set<StatusState>(['opening', 'filled', 'incomplete', 'login', 'error'])
const STATS_TIMEOUT = 45_000
const key = (tabId: number) => `job:${tabId}`

async function getJob(tabId: number | undefined): Promise<Job | undefined> {
  if (tabId == null) return
  return (await chrome.storage.session.get(key(tabId)))[key(tabId)] as Job | undefined
}
/** Job della scheda che scrive, solo se la pagina è del sito del job: una scheda finita su un altro sito non parla per lui. */
async function jobFor(sender: chrome.runtime.MessageSender): Promise<Job | undefined> {
  const job = await getJob(sender.tab?.id)
  return job && platformOfUrl(sender.url ?? '') === job.platform ? job : undefined
}
async function setJob(tabId: number, job: Job) {
  await chrome.storage.session.set({ [key(tabId)]: job })
  await syncScript()
}
async function dropJob(tabId: number) {
  await chrome.storage.session.remove(key(tabId))
  await syncScript()
}

// Siti in cui serve lo script (stessi host del manifest). Niente Messenger: lì non c'è mai un job.
const SITE_MATCHES = ['https://www.vinted.it/*', 'https://*.ebay.it/*', 'https://*.ebay.com/*', 'https://*.subito.it/*', 'https://www.facebook.com/*', 'https://*.wallapop.com/*']
const SCRIPT_ID = 'splisto-sites'
let scriptChain: Promise<unknown> = Promise.resolve()

/**
 * Registra lo script dei siti quando c'è un job e lo toglie quando non ce ne sono più: mentre non lavori, nessuna
 * pagina lo riceve e il service worker non si sveglia. Nelle pagine aperte a mano durante un lavoro lo script chiede
 * se c'è un job per la sua scheda e, se no, si ferma subito. In serie: register/unregister non si accavallano.
 */
function syncScript(): Promise<unknown> {
  const run = scriptChain.then(async () => {
    const need = (await allJobs()).length > 0
    const has = (await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })).length > 0
    if (need && !has) {
      await chrome.scripting.registerContentScripts([
        { id: SCRIPT_ID, js: [contentScript], matches: SITE_MATCHES, excludeMatches: ['https://www.facebook.com/messages/*'], runAt: 'document_idle', persistAcrossSessions: false },
      ])
    }
    if (!need && has) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] })
  })
  scriptChain = run.catch((e) => console.warn('[Splisto] script dei siti:', e))
  return scriptChain
}

/** Fine del job: lo toglie e chiude la scheda se l'aveva aperta l'estensione in background. */
async function closeJob(tabId: number, job: Job) {
  await dropJob(tabId)
  if (job.autoClose) await chrome.tabs.remove(tabId).catch(() => {})
}

/** Tutti i job aperti, con la loro scheda. */
async function allJobs(): Promise<[number, Job][]> {
  return Object.entries(await chrome.storage.session.get(null))
    .filter(([k]) => k.startsWith('job:'))
    .map(([k, v]) => [Number(k.slice(4)), v as Job])
}

/** Schede di quel tipo che non hanno risposto in tempo: chiuse, e per ognuna `then`. */
async function expire(kind: Job['kind'], then: (j: Job) => Promise<unknown>) {
  for (const [id, j] of await allJobs()) {
    if (j.kind !== kind) continue
    await dropJob(id)
    await chrome.tabs.remove(id).catch(() => {})
    await then(j)
  }
}

const toast = (id: string, title: string, message: string, priority = 0) =>
  chrome.notifications.create(id, { type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon-128.png'), title, message, priority })

// Le code sono lette e riscritte da più eventi: un lucchetto evita aggiornamenti persi.
let lock: Promise<unknown> = Promise.resolve()
function withQueues<T>(fn: (q: Queues) => Promise<T> | T): Promise<T> {
  const run = lock.then(async () => {
    const q = ((await chrome.storage.session.get('queues')).queues as Queues | undefined) ?? { fill: [], fillTab: null, stats: [], statsTabs: [] }
    const out = await fn(q)
    await chrome.storage.session.set({ queues: q })
    return out
  })
  lock = run.catch(() => {})
  return run
}

const notify = (listingId: string) =>
  chrome.runtime.sendMessage({ type: 'statusChanged', listingId } satisfies Msg).catch(() => {}) // nessuna dashboard aperta

/** Apre una scheda: prima registra il job, poi carica il sito, così il content script lo trova sempre. */
async function openTab(url: string, job: Job, active: boolean): Promise<number> {
  if (!SITE_URL.test(url)) throw new Error(`Link non consentito: ${url.slice(0, 80)}`) // solo i siti delle piattaforme
  const tab = await chrome.tabs.create({ url: 'about:blank', active })
  await setJob(tab.id!, job)
  await chrome.tabs.update(tab.id!, { url })
  return tab.id!
}

async function openFill(item: QueueItem, active: boolean): Promise<number> {
  if (item.edit) await updateStatus(item.listingId, item.platform, { edit: { state: 'opening', at: Date.now() } })
  else await updateStatus(item.listingId, item.platform, { state: 'opening', missing: [], missingKeys: [], message: undefined })
  void notify(item.listingId)
  const url = item.edit ? item.url! : SITES[item.platform].url
  return openTab(url, { listingId: item.listingId, platform: item.platform, kind: 'fill', ...(item.edit && { edit: true, url }) }, active)
}

/** Per ogni sito: annuncio nuovo dove manca, pagina "Modifica" dove è già pubblicato. */
async function fillItems(listingId: string, platforms: Platform[]): Promise<QueueItem[]> {
  const l = await getListing(listingId)
  if (!l || l.sold) return [] // venduto: niente da pubblicare né da aggiornare
  const items: QueueItem[] = []
  for (const platform of platforms) {
    const s = l.status[platform]
    if (s?.state === 'removed') continue // tolto dal sito a mano
    if (s?.state !== 'published') {
      items.push({ listingId, platform })
      continue
    }
    const url = editUrlFor(platform, s)
    if (url) items.push({ listingId, platform, edit: true, url })
    else await updateStatus(listingId, platform, { message: 'Aggiorna a mano sul sito: pagina di modifica non disponibile per questo sito.' })
  }
  return items
}

/** Mette in coda le compilazioni: si aprono una alla volta, in primo piano. */
async function queueFill(items: QueueItem[]) {
  for (const it of items) {
    if (it.edit) await updateStatus(it.listingId, it.platform, { edit: { state: 'opening', message: 'In coda…', at: Date.now() } })
    else await updateStatus(it.listingId, it.platform, { state: 'opening', message: 'In coda…', missing: [], missingKeys: [] })
  }
  await withQueues((q) => {
    q.fill.push(...items)
    return pumpFill(q)
  })
}

/** Modalità "una alla volta": apre il prossimo sito in primo piano quando il precedente ha finito. */
async function pumpFill(q: Queues) {
  if (q.fillTab != null) return
  const next = q.fill.shift()
  if (next) q.fillTab = await openFill(next, true)
}

async function pumpStats(q: Queues) {
  const now = Date.now()
  for (const t of q.statsTabs.filter((t) => now - t.at > STATS_TIMEOUT)) {
    await dropJob(t.id)
    await chrome.tabs.remove(t.id).catch(() => {})
  }
  q.statsTabs = q.statsTabs.filter((t) => now - t.at <= STATS_TIMEOUT)
  while (q.statsTabs.length < STATS_PARALLEL && q.stats.length) {
    const it = q.stats.shift()!
    try {
      const id = await openTab(it.url!, { listingId: it.listingId, platform: it.platform, kind: it.kind ?? 'stats', autoClose: true, replacePhotos: it.replacePhotos }, false)
      q.statsTabs.push({ id, at: Date.now() })
    } catch (e) {
      console.warn('[Splisto]', e) // link non valido: salta e passa al prossimo
    }
  }
  // controllo periodico per le schede che non rispondono
  if (q.statsTabs.length) await chrome.alarms.create('stats-watchdog', { periodInMinutes: 0.5 })
  else await chrome.alarms.clear('stats-watchdog')
}

/** Mette in coda letture di statistiche/dettagli (una sola volta per link) e apre le prime schede. */
const enqueueStats = (items: QueueItem[]) =>
  withQueues((q) => {
    q.stats.push(...items.filter((it) => !q.stats.some((x) => x.url === it.url)))
    return pumpStats(q)
  })

async function jobListing(l: Listing, p: Platform): Promise<JobListing> {
  const { footers } = await getSettings()
  const { photos, status: _s, stats: _st, ...rest } = l
  // Subito e Facebook non hanno sempre marca/taglia/colore: vanno in fondo alla descrizione.
  let description = p === 'subito' || p === 'facebook' ? withDetails(l) : l.description
  const footer = [footers.all, footers[p]].filter((f) => f?.trim()).join('\n\n')
  // annuncio importato o già pubblicato: il piè di pagina c'è già, non va ripetuto
  if (footer && !description.includes(footer.trim())) description = `${description.trim()}\n\n${footer.trim()}`
  return {
    ...rest,
    title: titleFor(l, p),
    price: sitePriceFor(l, p),
    description,
    photos: await Promise.all(photos.map(blobToWire)),
    categoryText: categoryFor(l, p),
  }
}

// --- Accessi: un valore per sito ('auth:vinted'...), così gli aggiornamenti in parallelo non si sovrascrivono ---

const authKey = (p: Platform) => `auth:${p}`

async function allAuth(): Promise<Partial<Record<Platform, AuthState>>> {
  const all = await chrome.storage.local.get(PLATFORMS.map(authKey))
  return Object.fromEntries(PLATFORMS.map((p) => [p, all[authKey(p)]]))
}

async function setAuth(p: Platform, ok: boolean | null, broken?: string[]) {
  const prev = (await allAuth())[p]
  // conferme passive ripetute (navigando sul sito): basta una ogni 5 minuti
  if (ok === true && !broken && prev?.ok === true && !prev.checking && Date.now() - prev.at < 5 * 60_000) return
  // i campi non trovati li aggiorna solo il controllo accessi sulla pagina del modulo
  const b = broken ?? prev?.broken
  await chrome.storage.local.set({ [authKey(p)]: { ok, at: Date.now(), ...(b?.length && { broken: b }) } satisfies AuthState })
  if (ok === false && prev?.ok !== false) {
    toast(`auth:${p}`, `${PLATFORM_LABEL[p]}: sei stato disconnesso`, 'Clicca per aprire il sito e rientrare.', 2)
  }
  await paintBadge()
}

/** Numero di siti disconnessi sull'icona dell'estensione. */
async function paintBadge() {
  const auth = await allAuth()
  const off = PLATFORMS.filter((p) => auth[p]?.ok === false)
  await chrome.action.setBadgeBackgroundColor({ color: '#e5484d' })
  await chrome.action.setBadgeText({ text: off.length ? String(off.length) : '' })
  await chrome.action.setTitle({ title: off.length ? `Disconnesso da: ${off.map((p) => PLATFORM_LABEL[p]).join(', ')}` : 'Apri Splisto' })
}

/** Pagina di accesso del sito in primo piano: lo script conferma "Connesso" appena hai fatto l'accesso. */
const openLogin = (p: Platform) => openTab(SITES[p].loginUrl, { listingId: '', platform: p, kind: 'login' }, true)

/** Apre in background la pagina "nuovo annuncio" di ogni sito e guarda se chiede il login. */
async function checkAllAuth() {
  if ((await allJobs()).some(([, j]) => j.kind === 'auth')) return // controllo già in corso
  const auth = await allAuth()
  for (const p of PLATFORMS) {
    await chrome.storage.local.set({ [authKey(p)]: { ...auth[p], ok: auth[p]?.ok ?? null, at: auth[p]?.at ?? 0, checking: true } satisfies AuthState })
    await openTab(SITES[p].authUrl ?? SITES[p].url, { listingId: '', platform: p, kind: 'auth', autoClose: true }, false)
  }
  await chrome.alarms.create('auth-timeout', { delayInMinutes: 1 })
}

/** Schede di controllo che non hanno risposto: chiudile, esito "non verificabile". */
async function authTimeout() {
  await expire('auth', (j) => setAuth(j.platform, null))
  // stato "checking" senza più una scheda dietro (scheda chiusa a mano, browser riavviato, estensione ricaricata)
  const jobs = await allJobs()
  const auth = await allAuth()
  for (const p of PLATFORMS) {
    const a = auth[p]
    if (a?.checking && !jobs.some(([, j]) => j.kind === 'auth' && j.platform === p)) {
      const { checking: _, ...rest } = a
      await chrome.storage.local.set({ [authKey(p)]: rest satisfies AuthState })
    }
  }
}

async function scheduleAuth() {
  const { authEvery } = await getSettings()
  await chrome.alarms.clear('auth-periodic')
  if (authEvery > 0) await chrome.alarms.create('auth-periodic', { delayInMinutes: 1, periodInMinutes: authEvery * 60 })
}

// --- Importazione degli annunci già online (es. messi dal telefono) ---

/** Apre in background la pagina "i miei annunci" di ogni sito (o solo di quelli indicati). */
async function importAll(platforms: readonly Platform[] = PLATFORMS) {
  if ((await allJobs()).some(([, j]) => j.kind === 'import')) return // importazione già in corso
  const prev = (await chrome.storage.local.get('lastImport')).lastImport as LastImport | undefined
  const errors = platforms.length === PLATFORMS.length ? {} : { ...prev?.errors } // gli errori degli altri siti restano
  await chrome.storage.local.set({ lastImport: { at: Date.now(), created: 0, running: [...platforms], errors } satisfies LastImport })
  for (const p of platforms) await openTab(SITES[p].mine.url, { listingId: '', platform: p, kind: 'import', autoClose: true }, false)
  await chrome.alarms.create('import-timeout', { delayInMinutes: 2 })
}

/** Aggiorna il riepilogo dell'ultima importazione (in serie: più siti rispondono insieme). */
const noteImport = (p: Platform, created: number, error?: string) =>
  withQueues(async () => {
    const li = (await chrome.storage.local.get('lastImport')).lastImport as LastImport | undefined
    if (!li) return
    li.created += created
    li.running = li.running.filter((x) => x !== p)
    if (error) li.errors[p] = error
    else delete li.errors[p]
    await chrome.storage.local.set({ lastImport: li })
  })

async function importTimeout() {
  await expire('import', (j) => noteImport(j.platform, 0, 'Nessuna risposta dalla pagina'))
  const jobs = await allJobs()
  const li = (await chrome.storage.local.get('lastImport')).lastImport as LastImport | undefined
  for (const p of li?.running ?? []) if (!jobs.some(([, j]) => j.kind === 'import' && j.platform === p)) await noteImport(p, 0, 'Interrotta')
}

/** Scarica una foto dal sito (nella versione più grande, se c'è) e la ridimensiona come quelle caricate a mano. */
async function downloadPhoto(url: string): Promise<Blob | null> {
  if (!PHOTO_URL.test(url)) return null
  for (const u of new Set([bigPhoto(url), url])) {
    try {
      const r = await fetch(u, { credentials: 'omit', signal: AbortSignal.timeout(20_000) })
      if (r.ok && PHOTO_URL.test(r.url) && r.headers.get('content-type')?.startsWith('image/')) return await resizeImage(await r.blob())
    } catch {
      // si riprova con il link originale
    }
  }
  return null
}

// Le importazioni (5 siti insieme + quella passiva) leggono tutti gli annunci e poi scrivono:
// in parallelo creerebbero doppioni. Una alla volta.
let importChain: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = importChain.then(fn)
  importChain = run.catch(() => {})
  return run
}

/**
 * Unisce gli annunci letti dal sito a quelli salvati:
 *  1. stesso id/link sul sito -> aggiorna stato e statistiche;
 *  2. stesso oggetto già presente da un altro sito (titolo e prezzo simili) -> lo collega;
 *  3. altrimenti crea un annuncio nuovo e mette in coda la lettura di descrizione e foto.
 */
const applyImport = (p: Platform, items: ImportedItem[], partial = false) =>
  serial(async () => {
    const all = await allListings()
    const details: QueueItem[] = []
    let created = 0
    const seen = new Set<string>()
    const seenUrls: string[] = []
    const soldNow: Listing[] = []
    for (const it of items) {
      if (!it.remoteId || seen.has(it.remoteId) || !SITE_URL.test(it.url)) continue
      const replaced = (id?: string | null) => !!id && all.some((x) => x.status[p]?.oldIds?.includes(id))
      if (replaced(it.remoteId) || replaced(idInUrl(it.url))) continue // vecchio annuncio sostituito con "Duplica come nuovo"
      seen.add(it.remoteId)
      seenUrls.push(it.url)
      let l = all.find((x) => sameRemote(x.status[p], it))
      let linked = false
      if (!l) {
        l = all.find((x) => !x.sold && !x.status[p]?.remoteId && !x.status[p]?.url && sameItem(x, it))
        linked = !!l
      }
      if (!l && it.sold) continue // un articolo già venduto non diventa un annuncio nuovo

      const statusFor = (prev: Listing['status'][Platform], keep: boolean) => ({
        ...prev,
        state: keep ? prev!.state : ('published' as const),
        url: it.url,
        remoteId: it.remoteId,
        statsUrl: it.statsUrl ?? prev?.statsUrl,
        sitePrice: it.price ?? prev?.sitePrice,
        siteTitle: it.title || prev?.siteTitle,
        publishedAt: prev?.publishedAt ?? Date.now(),
        at: Date.now(),
        message: linked ? 'Collegato in automatico: stesso oggetto trovato su questo sito.' : prev?.message,
        missing: [],
        missingKeys: [],
      })
      const stats = (prev?: Listing['stats'][Platform]) =>
        it.views != null || it.likes != null ? { views: it.views ?? prev?.views ?? null, likes: it.likes ?? prev?.likes ?? null, at: Date.now() } : prev

      if (l) {
        const wasSold = !!l.sold
        const updated = await patchListing(l.id, (x) => {
          const prev = x.status[p]
          if (it.sold && !x.sold) x.sold = { platform: p, at: Date.now() } // venduto su questo sito
          if (prev) prev.missingCount = 0
          // venduto o tolto dal sito a mano: non torna "pubblicato" da solo
          x.status = { ...x.status, [p]: statusFor(prev, !!x.sold || prev?.state === 'removed') }
          const st = stats(x.stats[p])
          if (st) x.stats = { ...x.stats, [p]: st }
          if (!x.platforms.includes(p)) x.platforms = [...x.platforms, p]
        })
        if (updated) Object.assign(l, updated)
        if (it.sold && !wasSold) soldNow.push(l)
      } else {
        l = {
          ...newListing(),
          title: it.title,
          price: it.price,
          brand: it.brand ?? '',
          size: it.size ?? '',
          condition: conditionFrom(it.condition ?? '') ?? 'buono',
          importedFrom: p,
        }
        l.status = { [p]: statusFor(undefined, false) }
        const st = stats()
        if (st) l.stats = { [p]: st }
        if (it.image) {
          const b = await downloadPhoto(it.image)
          if (b) l.photos = [b]
        }
        await saveListing(l)
        all.push(l)
        created++
      }
      // descrizione e foto: una volta sola per annuncio importato
      if (l.importedFrom === p && !l.status[p]?.detailAt) {
        await patchListing(l.id, (x) => {
          x.status = { ...x.status, [p]: { ...x.status[p]!, detailAt: Date.now() } }
        })
        details.push({ listingId: l.id, platform: p, url: it.url, kind: 'detail' })
      }
    }
    // Solo con un'importazione completa (non un elenco ancora in caricamento) e se la pagina ha mostrato qualcosa: un annuncio pubblicato che non compare più conta una volta;
    // alla seconda di fila si segnala. Quelli pubblicati nell'ultima ora possono non essere ancora in elenco.
    if (!partial && seen.size) {
      for (const x of all) {
        if (!missingFromSite(x.status[p], !!x.sold, seen, seenUrls)) continue
        await patchListing(x.id, (y) => {
          const st = y.status[p]
          if (st) st.missingCount = (st.missingCount ?? 0) + 1
        })
      }
    }
    for (const l of soldNow) {
      const others = publishedOn(l).filter((q) => q !== p)
      toast(
        `sold:${l.id}`,
        `Venduto su ${PLATFORM_LABEL[p]}: ${l.title.slice(0, 60)}`,
        others.length ? `Togli subito l'annuncio da ${others.map((q) => PLATFORM_LABEL[q]).join(', ')} per non venderlo due volte.` : 'Segnato come venduto in Splisto.',
        2,
      )
    }
    if (details.length) await enqueueStats(details)
    if (created) {
      toast(
        `import:${p}:${Date.now()}`,
        `${created === 1 ? 'Nuovo annuncio' : `${created} nuovi annunci`} da ${PLATFORM_LABEL[p]}`,
        'Importati in Splisto: controllali e pubblicali anche sugli altri siti.',
      )
    }
    return created
  })

/** Completa un annuncio importato con descrizione, foto, marca e condizione lette dalla sua pagina. */
async function applyDetail(listingId: string, p: Platform, d: ItemDetail, replacePhotos = false) {
  const before = await getListing(listingId)
  if (!before) return
  // le foto si scaricano prima, fuori dalla transazione; poi si scrive solo ciò che è ancora vuoto (o tutte, se richiesto)
  const blobs: Blob[] = []
  if (replacePhotos || before.photos.length <= 1) {
    for (const u of d.photos) {
      const b = await downloadPhoto(u)
      if (b) blobs.push(b)
    }
  }
  // eBay: descrizione dalla sua pagina separata (solo itm.ebaydesc.com, solo testo)
  let description = d.description
  if (!description && d.descriptionUrl && /^https:\/\/itm\.ebaydesc\.com\/itmdesc\/\d+/.test(d.descriptionUrl)) {
    try {
      const r = await fetch(d.descriptionUrl, { credentials: 'omit', signal: AbortSignal.timeout(20_000) })
      if (r.ok) description = htmlToText(await r.text()).slice(0, 20_000)
    } catch {
      // senza descrizione: resta vuota, si può scrivere a mano
    }
  }
  await patchListing(listingId, (l) => {
    const first = !l.description.trim() && !!description
    if (first) l.description = description
    if (blobs.length && (replacePhotos || l.photos.length <= 1)) l.photos = blobs
    if (!l.brand && d.brand) l.brand = d.brand
    const c = first && l.importedFrom ? conditionFrom(d.condition ?? '') : null // la condizione solo la prima volta
    if (c) l.condition = c
  })
  await updateStats(listingId, p, { views: d.views, likes: d.likes })
}

/**
 * Dopo un riavvio del browser o dell'estensione schede e code non esistono più (storage.session si svuota):
 * niente stati "in apertura / in coda" o aggiornamenti in corso rimasti appesi senza una scheda dietro.
 */
async function resetStuck() {
  const jobs = await allJobs()
  const queued = ((await chrome.storage.session.get('queues')).queues as Queues | undefined)?.fill ?? []
  const live = (id: string, p: Platform) => jobs.some(([, j]) => j.kind === 'fill' && j.listingId === id && j.platform === p) || queued.some((q) => q.listingId === id && q.platform === p)
  for (const l of await allListings()) {
    const stuck = PLATFORMS.filter((p) => {
      const s = l.status[p]
      return (s?.state === 'opening' || !!s?.edit) && !live(l.id, p)
    })
    if (!stuck.length) continue
    await patchListing(l.id, (x) => {
      for (const p of stuck) {
        const s = x.status[p]!
        x.status = { ...x.status, [p]: { ...s, edit: undefined, ...(s.state === 'opening' && { state: s.url ? 'published' : 'idle', message: undefined }) } }
      }
    })
  }
}

/** Avvio del browser o dell'estensione: ripulisce ciò che è rimasto a metà e riprogramma i controlli. */
async function boot() {
  await syncScript()
  await resetStuck()
  await scheduleAuth()
  await authTimeout()
  await importTimeout()
  await paintBadge()
}

chrome.runtime.onInstalled.addListener(async () => {
  await boot()
  // ricaricata dalla dashboard per eseguire un comando che il service worker vecchio non conosceva
  const { afterReload } = await chrome.storage.local.get('afterReload')
  if (afterReload) {
    await chrome.storage.local.remove('afterReload')
    await chrome.runtime.openOptionsPage()
    if (afterReload === 'checkAuth' || afterReload === 'importAll' || afterReload === 'refreshStats') await handle({ type: afterReload }, {})
  }
})
chrome.runtime.onStartup.addListener(async () => {
  if (!(await reloadIfStale(false))) await boot()
})
chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && 'authEvery' in ch) void scheduleAuth()
})
chrome.notifications.onClicked.addListener((id) => {
  if (id.startsWith('sold:')) void chrome.tabs.create({ url: chrome.runtime.getURL(`src/dashboard/index.html#/edit/${id.slice(5)}`), active: true })
  if (id.startsWith('import:')) void chrome.runtime.openOptionsPage()
  const p = id.startsWith('auth:') ? (id.slice(5) as Platform) : null
  if (p && SITES[p]) void openLogin(p) // notifica di disconnessione: vai al login
  chrome.notifications.clear(id)
})

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage())

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'stats-watchdog') void withQueues(pumpStats)
  if (a.name === 'auth-periodic') {
    void (async () => {
      if (await reloadIfStale(false)) return // nuova build su disco: prima ricarica (onInstalled riprogramma)
      await checkAllAuth()
      await chrome.alarms.create('import-run', { delayInMinutes: 1 }) // dopo il controllo accessi
    })()
  }
  if (a.name === 'import-run') void importAll()
  const one = a.name.startsWith('import-one:') ? (a.name.slice(11) as Platform) : null
  if (one && PLATFORMS.includes(one)) void importAll([one])
  if (a.name === 'import-timeout') void importTimeout()
  if (a.name === 'auth-timeout') void authTimeout()
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void getJob(tabId).then(async (job) => {
    if (job?.kind !== 'fill' && job?.kind !== 'remove') return
    // chiusa la pagina "Modifica" dopo la compilazione: rileggi quel sito per sapere se hai salvato (prezzo e titolo sul sito)
    if (job.edit && job.phase === 'await') await chrome.alarms.create(`import-one:${job.platform}`, { delayInMinutes: 0.5 })
    const l = await patchListing(job.listingId, (x) => {
      if (job.kind === 'remove') x.deleting = undefined // scheda chiusa a metà eliminazione: l'annuncio resta in Splisto
      const s = x.status[job.platform]
      if ((job.edit || job.kind === 'remove') && s?.edit) x.status = { ...x.status, [job.platform]: { ...s, edit: undefined } }
      else if (s?.state === 'opening') x.status = { ...x.status, [job.platform]: { ...s, state: s.url ? 'published' : 'idle', message: undefined } }
    })
    if (l) void notify(l.id)
  })
  void dropJob(tabId)
  void withQueues(async (q) => {
    q.statsTabs = q.statsTabs.filter((t) => t.id !== tabId)
    if (q.fillTab === tabId) q.fillTab = null
    await pumpFill(q)
    await pumpStats(q)
  })
})

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  if (!allowed(msg, sender, chrome.runtime.id, chrome.runtime.getURL(''))) return false
  handle(msg, sender).then(reply, (e) => {
    console.error('[Splisto]', e)
    reply({ error: (e as Error).message ?? String(e) })
  })
  return true // risposta asincrona
})

async function handle(msg: Msg, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const tabId = sender.tab?.id
  switch (msg.type) {
    case 'publish': {
      const { sequential } = await getSettings()
      const items = await fillItems(msg.listingId, msg.platforms)
      if (sequential || msg.queue) await queueFill(items)
      else {
        // In parallelo: schede in background (un solo sito = in primo piano).
        for (const it of items) await openFill(it, items.length === 1)
      }
      void notify(msg.listingId)
      return items.length // siti aperti o messi in coda
    }

    case 'relist': {
      // "Duplica come nuovo": un annuncio nuovo identico al vecchio (sui siti sembra appena messo e torna in alto).
      // Il vecchio si apre in una scheda: lo elimini tu dal sito; il nuovo lo pubblichi tu dal modulo compilato.
      const l = await getListing(msg.listingId)
      if (!l || l.sold) return 0
      const ps = PLATFORMS.filter((p) => msg.platforms.includes(p) && l.status[p]?.state === 'published')
      for (const p of ps) {
        const old = l.status[p]!
        if (old.url && SITE_URL.test(old.url)) await chrome.tabs.create({ url: old.url, active: false })
        await patchListing(l.id, (x) => {
          const s = x.status[p]
          const ids = [...(s?.oldIds ?? []), s?.remoteId, idInUrl(s?.url)].filter((v): v is string => !!v)
          x.status = { ...x.status, [p]: { state: 'idle', oldIds: [...new Set(ids)].slice(-20), at: Date.now() } }
          const { [p]: _, ...stats } = x.stats // le statistiche ripartono da zero con l'annuncio nuovo
          x.stats = stats
        })
      }
      const items = await fillItems(l.id, ps)
      await queueFill(items)
      void notify(l.id)
      return items.length
    }

    case 'getJob': {
      const job = await getJob(tabId)
      if (!job || job.platform !== msg.platform) return null
      if (job.kind !== 'fill') return { kind: job.kind } satisfies JobReply
      const l = await getListing(job.listingId)
      if (!l) return null
      return { kind: job.phase ?? 'fill', listing: await jobListing(l, job.platform), edit: job.edit, url: job.url } satisfies JobReply
    }

    case 'result': {
      const job = await jobFor(sender)
      if (!job || tabId == null || !TAB_STATES.has(msg.state)) return false
      // accesso: lo decidono solo le compilazioni (dettagli e statistiche leggono anche pagine pubbliche)
      if (job.kind === 'fill' && msg.state === 'login') await setAuth(job.platform, false)
      if (job.kind === 'fill' && (msg.state === 'filled' || msg.state === 'incomplete')) await setAuth(job.platform, true)
      if (job.kind !== 'fill') {
        // es. non loggato mentre si leggono le statistiche: chiudi e vai avanti
        await closeJob(tabId, job)
        return true
      }
      const r = { state: msg.state, missing: msg.missing ?? [], missingKeys: msg.missingKeys ?? [], message: msg.message }
      // pagina "Modifica": l'esito va in edit, lo stato resta "pubblicato"
      await updateStatus(job.listingId, job.platform, job.edit ? { edit: { ...r, at: Date.now() } } : r)
      // Compilato (o errore): la scheda resta in attesa della pubblicazione per salvare il link, senza ricompilare.
      if (!msg.keepJob && (msg.state === 'filled' || msg.state === 'incomplete' || msg.state === 'error')) {
        const l = await getListing(job.listingId)
        const missed = new Set(msg.missingKeys ?? [])
        await setJob(tabId, {
          ...job,
          phase: 'await',
          filledPrice: l && msg.state !== 'error' && !missed.has('price') ? sitePriceFor(l, job.platform) : undefined,
          filledTitle: l && msg.state !== 'error' && !missed.has('title') ? titleFor(l, job.platform) : undefined,
        })
      }
      if (!msg.keepJob) {
        await withQueues(async (q) => {
          if (q.fillTab !== tabId) return
          q.fillTab = null
          await pumpFill(q)
        })
      }
      void notify(job.listingId)
      return true
    }

    case 'published': {
      const job = await jobFor(sender)
      if (!job || job.kind !== 'fill') return false
      // l'utente ha salvato sul sito quello che l'estensione ha compilato: diventa il "prezzo sul sito"
      // (solo i valori compilati davvero; la prossima importazione corregge se sul sito sono stati cambiati a mano)
      await updateStatus(job.listingId, job.platform, {
        state: 'published',
        message: job.edit ? 'Modifiche salvate sul sito.' : undefined,
        missing: [],
        missingKeys: [],
        edit: undefined,
        ...(job.filledPrice != null && { sitePrice: job.filledPrice }),
        ...(job.filledTitle && { siteTitle: job.filledTitle }),
        ...(msg.url && SITE_URL.test(msg.url) && { url: msg.url, ...(idInUrl(msg.url) && { remoteId: idInUrl(msg.url)! }) }),
      })
      await dropJob(tabId!)
      void notify(job.listingId)
      return true
    }

    case 'stats': {
      const job = await jobFor(sender)
      if (!job || job.kind !== 'stats') return false
      await updateStats(job.listingId, job.platform, { views: msg.views, likes: msg.likes })
      await closeJob(tabId!, job) // onRemoved apre la prossima
      void notify(job.listingId)
      return true
    }

    case 'refreshStats': {
      // Vinted, Subito e Facebook mostrano i numeri nella pagina "i miei annunci": basta l'importazione.
      // Pagina del singolo annuncio solo dove serve: Subito "Statistiche" (preferiti), eBay e Wallapop.
      await importAll()
      const items = (await allListings()).flatMap((l) =>
        l.sold
          ? []
          : Object.entries(l.status)
              .filter(([p, s]) => s?.state === 'published' && s.url && (s.statsUrl || p === 'ebay' || p === 'wallapop'))
              .map(([p, s]) => ({ listingId: l.id, platform: p as Platform, url: s!.statsUrl ?? s!.url })),
      )
      await enqueueStats(items)
      return true
    }

    case 'auth': {
      await setAuth(msg.platform, msg.ok, Array.isArray(msg.broken) ? msg.broken.map(String).slice(0, 10) : undefined)
      const job = await jobFor(sender)
      if (job?.kind === 'auth' || (job?.kind === 'login' && msg.ok)) await closeJob(tabId!, job) // login: scheda aperta, non autoClose
      return true
    }

    case 'imported': {
      const job = await jobFor(sender)
      if (job?.kind !== 'import') return 0
      const created = msg.error ? 0 : await applyImport(msg.platform, msg.items, msg.partial)
      await noteImport(msg.platform, created, msg.error)
      await closeJob(tabId!, job)
      void notify('')
      return created
    }

    case 'detail': {
      const job = await jobFor(sender)
      if (job?.kind !== 'detail') return false
      await applyDetail(job.listingId, job.platform, msg.detail, job.replacePhotos)
      await closeJob(tabId!, job) // onRemoved apre la prossima
      void notify(job.listingId)
      return true
    }

    case 'importAll': {
      const only = PLATFORMS.filter((p) => Array.isArray(msg.platforms) && msg.platforms.includes(p))
      await importAll(only.length ? only : PLATFORMS)
      return true
    }

    case 'checkAuth':
      await checkAllAuth()
      return true

    case 'login':
      if (!PLATFORMS.includes(msg.platform)) return false
      await openLogin(msg.platform)
      return true

    case 'teach': {
      // trova la scheda che sta compilando quell'annuncio su quel sito
      const id = (await allJobs()).find(([, j]) => j.kind === 'fill' && j.listingId === msg.listingId && j.platform === msg.platform)?.[0]
      if (id == null) return false
      const tab = await chrome.tabs.update(id, { active: true })
      if (tab?.windowId != null) await chrome.windows.update(tab.windowId, { focused: true })
      await chrome.tabs.sendMessage(id, { type: 'teach', key: msg.key, label: msg.label } satisfies TabMsg)
      return true
    }

    case 'refetchPhotos': {
      // le foto importate prima della 1.3.1 potevano essere anteprime piccole: si rileggono dalla pagina dell'annuncio
      const l = await getListing(msg.listingId)
      const online = (x?: Platform): x is Platform => !!l && !!x && l.status[x]?.state === 'published' && SITE_URL.test(l.status[x]?.url ?? '')
      const p = [l?.importedFrom, ...PLATFORMS].find(online)
      if (!l || !p) return false
      await enqueueStats([{ listingId: l.id, platform: p, url: l.status[p]!.url, kind: 'detail', replacePhotos: true }])
      return PLATFORM_LABEL[p]
    }

    case 'remove': {
      // Toglie l'annuncio dai siti dove è online. Dove il percorso è verificato (`remove` nei selettori) lo fa da
      // solo in background; altrove apre l'annuncio e lo elimini tu. thenDelete: alla fine anche da Splisto.
      const l = await getListing(msg.listingId)
      if (!l) return { auto: [], manual: [] }
      const online = msg.platforms.filter((p) => l.status[p]?.state === 'published' && SITE_URL.test(l.status[p]?.url ?? ''))
      const auto = online.filter((p) => SITES[p].remove)
      const manual = online.filter((p) => !SITES[p].remove)
      if (msg.thenDelete) {
        if (!auto.length) await deleteListing(l.id)
        else await patchListing(l.id, (x) => void (x.deleting = true))
      }
      for (const p of manual) await chrome.tabs.create({ url: l.status[p]!.url!, active: false })
      for (const p of auto) {
        await updateStatus(l.id, p, { edit: { state: 'opening', at: Date.now(), remove: true } })
        await openTab(l.status[p]!.url!, { listingId: l.id, platform: p, kind: 'remove', autoClose: true }, false)
      }
      void notify(l.id)
      return { auto, manual }
    }

    case 'removed': {
      const job = await jobFor(sender)
      if (!job || job.kind !== 'remove' || tabId == null) return false
      if (msg.ok) {
        await updateStatus(job.listingId, job.platform, { state: 'removed', edit: undefined, message: undefined })
        await closeJob(tabId, job)
      } else {
        const message = `${msg.message ?? 'errore'}. Eliminalo tu nella scheda aperta, poi “Segna rimosso”.`
        await updateStatus(job.listingId, job.platform, { edit: { state: 'error', message, at: Date.now(), remove: true } })
        await patchListing(job.listingId, (x) => void (x.deleting = undefined)) // resta in Splisto, con l'errore in vista
        await dropJob(tabId) // la scheda resta aperta per finire a mano
      }
      const l = await getListing(job.listingId)
      if (l?.deleting && !(await allJobs()).some(([, j]) => j.kind === 'remove' && j.listingId === l.id)) await deleteListing(l.id)
      void notify(job.listingId)
      return true
    }

    default:
      return null // 'statusChanged' è per la dashboard
  }
}
