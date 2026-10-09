import { learnedKey } from '../lib/settings'
import { PLATFORMS, type Adapter, type FillOptions, type JobListing, type JobReply, type Msg, type Platform, type TabMsg } from '../lib/types'
import { ebay } from './adapters/ebay'
import { facebook } from './adapters/facebook'
import { subito } from './adapters/subito'
import { vinted } from './adapters/vinted'
import { wallapop } from './adapters/wallapop'
import { findOne, locatorFor, setLearned, sleep, type Locator } from './dom'
import { goToOwnProfile, isMine, readDetail, readMine, wallapopEditUrl, wallapopItem } from './importers'
import { SITES } from './selectors'
import { norm, parseCount } from './text'

// Registrato dal service worker solo mentre c'è un lavoro in corso: lavora nelle schede aperte da Splisto, nelle altre
// pagine dei siti chiede se c'è un job per la sua scheda e si ferma subito. Senza lavori non esiste.
const ADAPTERS: Record<Platform, Adapter> = { vinted, ebay, subito, facebook, wallapop }
const platform = PLATFORMS.find((p) => location.hostname.includes(p))
let current: JobListing | null = null // annuncio di questa scheda, per "Insegna"
let currentJob: { edit?: boolean; url?: string } = {} // modifica di un annuncio già online: pagina di destinazione

const send = (m: Msg) => {
  if (m.type === 'result' || m.type === 'published' || m.type === 'stats' || m.type === 'auth' || m.type === 'imported' || m.type === 'detail') console.info('[Splisto]', m)
  return chrome.runtime.sendMessage(m)
}

async function loadLearned(p: Platform): Promise<Record<string, Locator>> {
  const k = learnedKey(p)
  const all = ((await chrome.storage.local.get(k))[k] ?? {}) as Record<string, Locator>
  setLearned(all)
  return all
}

/** Pagina di login (URL) o elementi da non loggato, purché non ci sia anche il menu utente. */
function loggedOut(p: Platform): boolean {
  const s = SITES[p].loggedOut
  if (s.url.some((u) => location.href.includes(u))) return true
  return !findOne(SITES[p].loggedIn) && !!findOne(s.selectors)
}

const loggedIn = (p: Platform) => !!findOne(SITES[p].loggedIn) || !!SITES[p].loggedInText?.test(document.body?.innerText.slice(0, 500) ?? '')

/** Pagina dello stesso dominio usato dal controllo accessi (ebay.com ha una sessione diversa da ebay.it). */
const sameAuthDomain = (p: Platform) => location.hostname.endsWith(new URL(SITES[p].authUrl ?? SITES[p].url).hostname.replace(/^www\./, ''))

/** Scheda di accesso aperta da Splisto: appena compare il menu utente, l'accesso è confermato (ogni pagina riparte da qui). */
async function watchLogin(p: Platform) {
  for (const end = Date.now() + 15 * 60_000; Date.now() < end; await sleep(2000)) {
    if (loggedIn(p) && sameAuthDomain(p)) return void send({ type: 'auth', platform: p, ok: true })
  }
}

/** Controllo accessi: aspetta che la pagina mostri o il menu utente o il login. */
async function checkAuth(p: Platform) {
  let ok: boolean | null = null
  let outSince = 0
  for (const t0 = Date.now(); Date.now() - t0 < 15000; await sleep(500)) {
    if (loggedIn(p)) {
      ok = true
      break
    }
    if (SITES[p].loggedOut.url.some((u) => location.href.includes(u))) {
      ok = false // rimandato alla pagina di login: certo
      break
    }
    // Un pulsante "Accedi" da solo non basta: Subito lo mostra per mezzo secondo anche da loggato,
    // prima di riconoscerti (verificato 10/2026). Deve restare almeno 4 secondi.
    if (!loggedOut(p)) outSince = 0
    else if (!outSince) outSince = Date.now()
    else if (Date.now() - outSince >= 4000) {
      ok = false
      break
    }
  }
  await send({ type: 'auth', platform: p, ok, ...(ok && { broken: await probeFields(p) }) })
}

/** Da loggato sulla pagina del modulo: campi che i selettori (o "Insegna") non trovano più. */
async function probeFields(p: Platform): Promise<string[] | undefined> {
  const probe = SITES[p].probe
  if (!probe || !SITES[p].formUrl.some((u) => location.href.includes(u))) return undefined // pagina diversa dal modulo: nessun esito
  const learned = await loadLearned(p)
  const locs = (key: string) => [...(learned[key] ? [learned[key]] : []), ...(SITES[p].fields[key] ?? [])]
  const missing = () => probe.filter(({ key }) => !findOne(locs(key))).map((f) => f.label)
  for (const end = Date.now() + 8000; missing().length && Date.now() < end; ) await sleep(500) // il modulo può comparire dopo il menu utente
  return missing()
}

/** Importazione: pagina "i miei annunci" -> elenco annunci al service worker. */
async function runImport(p: Platform) {
  await sleep(1500)
  if (loggedOut(p)) return void send({ type: 'imported', platform: p, items: [], error: 'Accesso richiesto' })
  if (p === 'vinted' && (await goToOwnProfile())) return // la pagina cambia: il job resta e si riparte da qui
  for (let i = 0; i < 8 && !isMine(p); i++) await sleep(1000)
  if (!isMine(p)) {
    return void send({ type: 'imported', platform: p, items: [], error: `Pagina dei tuoi annunci non trovata (${location.pathname})` })
  }
  await send({ type: 'imported', platform: p, ...(await readMine(p)) })
}

/**
 * Riprova quando l'URL cambia (siti a pagina singola, o dopo il login) o, se indicato, quando compare un campo
 * del passo successivo (procedure a passi sulla stessa pagina). Un solo timer alla volta; smette dopo 30 minuti.
 */
let rerunTimer: ReturnType<typeof setInterval> | undefined
function rerunOnUrlChange(resumeOn?: Locator[]) {
  clearInterval(rerunTimer)
  const href = location.href
  const until = Date.now() + 30 * 60_000
  rerunTimer = setInterval(() => {
    if (Date.now() > until) return clearInterval(rerunTimer)
    if (location.href !== href || (resumeOn && findOne(resumeOn))) {
      clearInterval(rerunTimer)
      void start()
    }
  }, 1000)
}

let running = false
async function start() {
  if (!platform || running) return
  running = true
  try {
    await run(platform)
  } finally {
    running = false
  }
}

async function run(platform: Platform) {
  const job = (await send({ type: 'getJob', platform })) as JobReply
  if (!job) return // job finito (es. scheda tornata indietro dopo la pubblicazione)
  if (job.kind === 'auth') return checkAuth(platform)
  if (job.kind === 'login') return watchLogin(platform)
  if (job.kind === 'import') return runImport(platform)
  // pagina pubblica dell'annuncio: si legge anche senza accesso (es. eBay con l'accesso solo su ebay.com)
  if (job.kind === 'detail') return void send({ type: 'detail', detail: await readDetail(platform) })
  if (job.kind === 'stats') return collectStats(platform)
  current = job.listing
  currentJob = { edit: job.edit, url: job.url }
  if (job.kind === 'await') return watchPublished(platform, job.listing.title)
  await fill(platform, job.listing, { edit: job.edit })
}

async function fill(p: Platform, listing: JobListing, opts?: FillOptions) {
  // pagina "Modifica": le foto sono già sul sito (e i siti non accettano quelle inserite da script)
  if (opts?.edit) opts = { ...opts, skipPhotos: true }
  await loadLearned(p)
  await sleep(1500) // lascia assestare la pagina (redirect, modali di login)

  if (loggedOut(p)) {
    await send({ type: 'result', state: 'login', keepJob: true, message: 'Accedi al sito in quella scheda: la compilazione ripartirà da sola.' })
    return rerunOnUrlChange()
  }

  // Wallapop: si apre l'annuncio, e la sua pagina contiene l'id della pagina "Modifica"
  if (currentJob.edit && p === 'wallapop' && !SITES[p].editPath.some((u) => location.href.includes(u))) {
    const edit = wallapopEditUrl()
    if (edit) {
      location.href = edit
      return
    }
    await send({ type: 'result', state: 'error', message: 'Pagina di modifica di Wallapop non trovata: l’annuncio esiste ancora ed è tuo?' })
    return
  }

  // Dopo il login alcuni siti portano alla home: torna una volta al modulo (o alla pagina "Modifica").
  const target = currentJob.edit && currentJob.url ? currentJob.url : SITES[p].url
  const onForm = currentJob.edit ? location.href.split('#')[0] === target || SITES[p].editPath.some((u) => location.href.includes(u)) : SITES[p].formUrl.some((u) => location.href.includes(u))
  if (!onForm) {
    if (!sessionStorage.getItem('multipost-redirect')) {
      sessionStorage.setItem('multipost-redirect', '1')
      location.href = target
      return
    }
    await send({ type: 'result', state: 'error', message: `Pagina del modulo non raggiungibile (${location.pathname}). Controlla l'URL nei selettori.` })
    return
  }
  sessionStorage.removeItem('multipost-redirect')

  // Rete di sicurezza: mentre l'estensione compila, nessun invio di modulo può partire (né da clic né da Invio).
  const noSubmit = (e: Event) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    console.warn('[Splisto] invio del modulo bloccato durante la compilazione')
  }
  addEventListener('submit', noSubmit, true)
  try {
    const r = await ADAPTERS[p].fill(listing, opts)
    // passaggio intermedio senza nulla da fare a mano (es. Subito che va al modulo giusto): resta "in compilazione"
    const state = r.ok ? 'filled' : r.waiting && !r.missingFields.length ? 'opening' : 'incomplete'
    await send({ type: 'result', state, missing: r.missingFields, missingKeys: r.missingKeys, keepJob: r.waiting })
    if (r.waiting) rerunOnUrlChange(r.resumeOn)
    else watchPublished(p, listing.title)
  } catch (e) {
    if (loggedOut(p)) {
      await send({ type: 'result', state: 'login', keepJob: true, message: 'Accedi al sito: la compilazione ripartirà da sola.' })
      return rerunOnUrlChange()
    }
    const key = (e as { key?: string }).key // campo di partenza non trovato: si può "insegnare"
    await send({ type: 'result', state: 'error', message: (e as Error).message, missingKeys: key ? [key] : [] })
  } finally {
    removeEventListener('submit', noSubmit, true)
  }
}

/**
 * Dopo che l'utente preme "Pubblica" sul sito: riconosce la pagina dell'annuncio e salva il link.
 * Sulle pagine di conferma prende solo un link il cui testo contiene l'inizio del titolo (non "oggetti simili").
 * Smette dopo 30 minuti.
 */
let watching = false
function watchPublished(p: Platform, title: string) {
  if (watching) return
  watching = true
  const pub = SITES[p].published
  const titleBit = norm(title).slice(0, 20)
  const until = Date.now() + 30 * 60_000
  const t = setInterval(() => {
    if (Date.now() > until) {
      clearInterval(t)
      watching = false
      return
    }
    const href = location.href
    // ancora sulla pagina "Modifica" (su Vinted anche /items/<id>/edit somiglia alla pagina dell'annuncio): aspetta
    if (currentJob.edit && (href.split('#')[0] === currentJob.url || SITES[p].editPath.some((u) => href.includes(u)))) return
    let url: string | null = null
    if (pub.item.test(href) && (!titleBit || norm(document.body.innerText).includes(titleBit))) url = href
    else if (pub.done.some((d) => href.includes(d))) {
      const link = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
        (a) => pub.item.test(a.href) && !!titleBit && norm(a.innerText || a.getAttribute('aria-label') || '').includes(titleBit),
      )
      url = link?.href ?? ''
    }
    if (url !== null) {
      clearInterval(t)
      void send({ type: 'published', url })
    }
  }, 1500)
}

function readStat(src: { selectors: string[]; patterns: RegExp[] }): number | null {
  for (const sel of src.selectors) {
    const digits = document.querySelector(sel)?.textContent?.replace(/\D/g, '')
    if (digits) return Number(digits)
  }
  // testo visibile + aria-label (es. Vinted: "Aggiunto ai preferiti da 2 utenti" è solo nell'aria-label)
  const aria = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join('\n')
  return parseCount(`${document.body.innerText}\n${aria}`, src.patterns)
}

/** Legge visualizzazioni e like dalla pagina del proprio annuncio. */
async function collectStats(p: Platform) {
  await sleep(2000)
  if (loggedOut(p)) return void send({ type: 'result', state: 'login', message: 'Accedi al sito per leggere le statistiche.' })
  let views: number | null = null
  let likes: number | null = null
  // Wallapop: visite e preferiti sono nei dati della pagina (verificato 10/2026)
  const w = p === 'wallapop' ? wallapopItem() : null
  if (w && typeof w.views === 'number') return void send({ type: 'stats', views: w.views, likes: typeof w.favorites === 'number' ? w.favorites : null })
  for (const end = Date.now() + 12000; Date.now() < end; await sleep(1000)) {
    views = readStat(SITES[p].stats.views)
    likes = readStat(SITES[p].stats.likes)
    if (views != null && likes != null) break
  }
  await send({ type: 'stats', views, likes })
}

/** Modalità "Insegna": l'utente clicca il campo giusto e l'estensione ne ricorda il selettore. */
async function teach(p: Platform, key: string, label: string) {
  const bar = document.createElement('div')
  bar.textContent = `Splisto · clicca il campo «${label}» (Esc per annullare)`
  bar.style.cssText =
    'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1d1f1e;color:#fff;' +
    'padding:10px 16px;border-radius:10px;font:600 14px "Segoe UI",sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)'
  document.documentElement.append(bar)

  let hovered: HTMLElement | null = null
  let prevOutline = ''
  const unhover = () => hovered && (hovered.style.outline = prevOutline)
  const target = await new Promise<Element | null>((resolve) => {
    const block = (e: Event) => {
      if (bar.contains(e.target as Node)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.type === 'click') finish(e.target as Element)
    }
    const over = (e: Event) => {
      unhover()
      hovered = e.target as HTMLElement
      prevOutline = hovered.style.outline
      hovered.style.outline = '2px solid #ff5f1f'
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && finish(null)
    const events = ['pointerdown', 'mousedown', 'mouseup', 'click']
    function finish(el: Element | null) {
      events.forEach((t) => removeEventListener(t, block, true))
      removeEventListener('mouseover', over, true)
      removeEventListener('keydown', key, true)
      unhover()
      resolve(el)
    }
    events.forEach((t) => addEventListener(t, block, true))
    addEventListener('mouseover', over, true)
    addEventListener('keydown', key, true)
  })
  if (!target) return bar.remove()

  const loc = locatorFor(target, key)
  if (!loc) {
    bar.textContent = 'Questo elemento non ha attributi stabili: aggiorna il file dei selettori (vedi README).'
    return void setTimeout(() => bar.remove(), 6000)
  }
  const all = await loadLearned(p)
  await chrome.storage.local.set({ [learnedKey(p)]: { ...all, [key]: loc } })
  await loadLearned(p)
  bar.textContent = 'Salvato. Ricompilo i campi…'
  if (current) await fill(p, current, { skipPhotos: key !== 'photos', edit: currentJob.edit })
  bar.remove()
}

// Una volta per pagina: il service worker può segnalare "caricata" più volte per la stessa pagina.
const page = globalThis as { __splisto?: boolean }
if (platform && !page.__splisto) {
  page.__splisto = true
  chrome.runtime.onMessage.addListener((m: TabMsg) => {
    if (m.type === 'teach') void teach(platform, m.key, m.label)
  })
  void start()
}
