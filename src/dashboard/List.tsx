import { Check, CopyPlus, RotateCcw, Download, ExternalLink, Plus, RefreshCw, Search, Send, Settings as SettingsIcon, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { SITES } from '../content/selectors'
import { editUrlFor, SITE_URL } from '../content/text'
import { bulkPatch } from '../lib/bulk'
import { allListings, deleteListing, duplicateListing, getListing, newListing, saveFields, saveListing } from '../lib/db'
import { outOfSync, PLATFORM_LABEL, STALE_DAYS } from '../lib/platforms'
import { PLATFORMS, type AuthState, type LastImport, type Listing, type Msg, type Platform } from '../lib/types'
import { BulkBar } from './BulkBar'
import { ago, Dot, Logo, STATE_LABEL, StatPair, Thumb, useAuth, useLastImport, useStatusChanged } from './ui'

const DAY = 86_400_000
const fmt = (n: number | null) => (n == null ? '–' : n.toLocaleString('it-IT'))

/** Giorni online del primo sito su cui l'annuncio è pubblicato (null se non pubblicato o venduto). */
function daysOnline(l: Listing): number | null {
  if (l.sold) return null
  const at = Object.values(l.status)
    .filter((s) => s?.state === 'published' && s.publishedAt)
    .map((s) => s!.publishedAt!)
  return at.length ? Math.floor((Date.now() - Math.min(...at)) / DAY) : null
}

/** Somma di visualizzazioni o like sugli annunci online (null = nessun numero letto). */
function total(items: Listing[], k: 'views' | 'likes', only?: Platform): number | null {
  const vals = items.flatMap((l) =>
    (only ? [only] : PLATFORMS)
      .filter((p) => l.status[p]?.state === 'published')
      .map((p) => l.stats[p]?.[k])
      .filter((v): v is number => v != null),
  )
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}

/** Il sito su cui è pubblicato, se è uno solo (suggerisce di pubblicarlo anche altrove). */
function onlyOn(l: Listing): Platform | null {
  const on = PLATFORMS.filter((p) => l.status[p]?.state === 'published')
  return on.length === 1 ? on[0] : null
}

/** Online da almeno 7 giorni e nessun like dove le statistiche sono state lette: conviene "Duplica come nuovo". */
function stuck(l: Listing): boolean {
  const days = daysOnline(l)
  const on = PLATFORMS.filter((p) => l.status[p]?.state === 'published' && l.stats[p])
  return days != null && days >= 7 && on.length > 0 && on.every((p) => !l.stats[p]!.likes)
}

const online = (items: Listing[], p: Platform) => items.filter((l) => l.status[p]?.state === 'published').length

function AuthPill({ a }: { a?: AuthState }) {
  const [cls, text] = a?.checking
    ? ['checking', 'Verifico…']
    : a?.ok === true
      ? ['on', 'Connesso']
      : a?.ok === false
        ? ['off', 'Disconnesso']
        : a
          ? ['unknown', 'Non verificabile']
          : ['unknown', 'Da verificare']
  return <span className={`pill pill-${cls}`}>{text}</span>
}

const openSite = (p: Platform, login = false) => void chrome.tabs.create({ url: login ? SITES[p].loginUrl : SITES[p].mine.url, active: true })

/** Siti da cui l'annuncio è sparito per 2 importazioni di fila (venduto o tolto?). */
const goneSites = (l: Listing) => (l.sold ? [] : PLATFORMS.filter((p) => l.status[p]?.state === 'published' && (l.status[p]?.missingCount ?? 0) >= 2))
/** Venduto: siti dove è ancora pubblicato e va tolto. */
const toRemove = (l: Listing) => (l.sold ? PLATFORMS.filter((p) => p !== l.sold!.platform && l.status[p]?.state === 'published') : [])

/** Siti dove l'annuncio online è diverso da Splisto, con cosa cambia (es. "eBay: prezzo"). */
const staleSites = (l: Listing) => PLATFORMS.map((p) => [p, outOfSync(l, p)] as const).filter(([, why]) => why.length)

/** "Importati 2 annunci nuovi 5 min fa · eBay: Accesso richiesto" */
function importText(li?: LastImport): string {
  if (!li) return ''
  if (li.running.length) return `Importo i tuoi annunci da ${li.running.map((p) => PLATFORM_LABEL[p]).join(', ')}…`
  const errs = Object.entries(li.errors).map(([p, e]) => `${PLATFORM_LABEL[p as Platform]}: ${e}`)
  const head = li.created
    ? `Importazione ${ago(li.at)}: ${li.created} ${li.created === 1 ? 'annuncio nuovo' : 'annunci nuovi'}.`
    : `Importazione ${ago(li.at)}: nessun annuncio nuovo.`
  return [head, ...errs].join(' · ')
}

/**
 * Comando al service worker. Dopo una nuova build Chrome tiene il service worker vecchio, che non conosce i comandi
 * nuovi e risponde null: ricarica l'estensione una volta e il comando riparte da solo (vedi onInstalled).
 */
async function command(msg: Extract<Msg, { type: 'checkAuth' | 'importAll' | 'refreshStats' }>, note: string, onNote: (s: string) => void) {
  const r = (await chrome.runtime.sendMessage(msg satisfies Msg)) as unknown
  if (r === true) return onNote(note)
  if (r && typeof r === 'object' && 'error' in r) return onNote(`Errore: ${String((r as { error: unknown }).error)}`)
  const { reloadedAt = 0 } = await chrome.storage.local.get('reloadedAt')
  if (Date.now() - (reloadedAt as number) < 120_000) {
    return onNote('Il comando non parte. Apri chrome://extensions e guarda "Errori" sulla scheda di Splisto.')
  }
  await chrome.storage.local.set({ reloadedAt: Date.now(), afterReload: msg.type })
  chrome.runtime.reload()
}

function Platforms({ items, note, onNote }: { items: Listing[]; note: string; onNote: (s: string) => void }) {
  const auth = useAuth()
  const lastImport = useLastImport()
  const importing = !!lastImport?.running.length && Date.now() - lastImport.at < 180_000
  const active = items.filter((l) => !l.sold)
  const off = PLATFORMS.filter((p) => auth[p]?.ok === false)
  const checking = PLATFORMS.some((p) => auth[p]?.checking)
  const lastStats = Math.max(0, ...items.flatMap((l) => Object.values(l.stats).map((s) => s?.at ?? 0)))
  const onlineTotal = PLATFORMS.reduce((n, p) => n + online(active, p), 0)

  const check = () => command({ type: 'checkAuth' }, 'Controllo gli accessi: si aprono e chiudono 5 schede in background (circa 15 secondi).', onNote)

  const refreshStats = () =>
    command({ type: 'refreshStats' }, 'Leggo le statistiche dalle pagine dei tuoi annunci: si aprono e chiudono alcune schede in background.', onNote)

  return (
    <section className="panel" aria-labelledby="pf-title">
      {off.length > 0 && (
        <div className="alert" role="alert">
          <div>
            <strong>Disconnesso da {off.map((p) => PLATFORM_LABEL[p]).join(', ')}</strong>
            <span>
              {off.includes('ebay')
                ? 'eBay: serve l’accesso su ebay.it per pubblicare e modificare (quello di ebay.com, dove vedi i tuoi annunci, è separato e basta per importarli).'
                : 'Rientra: senza accesso compilazione e statistiche su quel sito non funzionano.'}
            </span>
          </div>
          <span className="alert-actions">
            {off.map((p) => (
              <button key={p} className="btn-secondary" onClick={() => openSite(p, true)}>
                Accedi a {PLATFORM_LABEL[p]} <ExternalLink size={14} aria-hidden="true" />
              </button>
            ))}
          </span>
        </div>
      )}

      <header className="panel-head">
        <div className="panel-title">
          <h2 id="pf-title">Piattaforme</h2>
          <p className="panel-sub">
            <b>{onlineTotal}</b> online · <b>{fmt(total(active, 'views'))}</b> visualizzazioni · <b>{fmt(total(active, 'likes'))}</b> like
          </p>
        </div>
        <div className="panel-actions">
          <button className="btn-secondary" onClick={check} disabled={checking}>
            <ShieldCheck size={16} aria-hidden="true" /> {checking ? 'Verifico…' : 'Verifica accessi'}
          </button>
          <button className="btn-secondary" onClick={() => command({ type: 'importAll' }, '', onNote)} disabled={importing}>
            <Download size={16} aria-hidden="true" /> {importing ? 'Importo…' : 'Importa annunci'}
          </button>
          <button className="btn-secondary" onClick={refreshStats}>
            <RefreshCw size={16} aria-hidden="true" /> Aggiorna statistiche
          </button>
        </div>
      </header>

      <ul className="pf-strip">
        {PLATFORMS.map((p) => {
          const a = auth[p]
          const isOff = a?.ok === false
          return (
            <li key={p} className={`pf-cell${isOff ? ' is-off' : ''}`}>
              <div className="pf-cell-top">
                <Logo p={p} />
                <button
                  className={isOff ? 'btn-secondary small' : 'icon-btn small'}
                  onClick={() => openSite(p, isOff)}
                  title={`${isOff ? 'Accedi a' : 'Apri i tuoi annunci su'} ${PLATFORM_LABEL[p]}`}
                  aria-label={`${isOff ? 'Accedi a' : 'Apri'} ${PLATFORM_LABEL[p]}`}
                >
                  {isOff && 'Accedi'} <ExternalLink size={14} aria-hidden="true" />
                </button>
              </div>
              <div className="pf-auth">
                <AuthPill a={a} />
                <span className="pf-when">{a?.at ? ago(a.at) : 'mai controllato'}</span>
              </div>
              {!!a?.broken?.length && (
                <span className="tag tag-warn" title="Il sito ha cambiato pagina: usa “Insegna” alla prossima compilazione o aggiorna i selettori (README).">
                  Campi non trovati: {a.broken.join(', ')}
                </span>
              )}
              <dl className="pf-nums">
                <div>
                  <dt>Online</dt>
                  <dd>{online(active, p)}</dd>
                </div>
                <div>
                  <dt>Visite</dt>
                  <dd>{fmt(total(active, 'views', p))}</dd>
                </div>
                <div>
                  <dt>Like</dt>
                  <dd>{fmt(total(active, 'likes', p))}</dd>
                </div>
              </dl>
            </li>
          )
        })}
      </ul>
      <p className="panel-foot" aria-live="polite">
        {note || importText(lastImport) || (lastStats ? `Statistiche lette ${ago(lastStats)}.` : 'Statistiche non ancora lette: usa “Aggiorna statistiche”.')}
      </p>
    </section>
  )
}

const shortName = (p: Platform) => (p === 'facebook' ? 'Facebook' : PLATFORM_LABEL[p])

/** Siti dove l'annuncio non c'è ancora: né pubblicato, né in compilazione, né tolto a mano. */
const missingOn = (l: Listing, targets: readonly Platform[]) =>
  targets.filter((p) => !['published', 'removed', 'opening'].includes(l.status[p]?.state ?? 'idle'))

const IMPORT_FRESH = 10 * 60_000 // importazione più vecchia: prima di sincronizzare si rileggono i siti
const READ_WAIT = 90_000 // attesa massima per descrizione e foto degli annunci appena importati

/**
 * "Sincronizza tutto": ogni annuncio già online su almeno un sito (anche messo a mano dal telefono, es. su Vinted)
 * viene compilato sugli altri siti scelti per lui dove manca, uno alla volta. Prima rilegge i tuoi annunci da
 * tutti i siti se l'ultima importazione è vecchia. Il pulsante finale su ogni sito lo premi tu.
 */
function Sync({ items, onNote, onReload }: { items: Listing[]; onNote: (s: string) => void; onReload: () => void }) {
  const lastImport = useLastImport()
  const [skip, setSkip] = useState<Platform[]>([]) // siti su cui non copiare
  const [phase, setPhase] = useState<{ step: 'idle' | 'importing' | 'reading' | 'queueing'; at: number }>({ step: 'idle', at: 0 })
  const targets = PLATFORMS.filter((p) => !skip.includes(p))
  const todo = (l: Listing) => missingOn(l, l.platforms.filter((p) => targets.includes(p)))
  const found = items.filter((l) => !l.sold && PLATFORMS.some((p) => l.status[p]?.state === 'published') && todo(l).length > 0)
  // importati da poco: descrizione e foto arrivano dopo qualche secondo dalla pagina dell'annuncio
  const ready = found.filter((l) => l.title.trim() && l.description.trim())
  const reading = (l: Listing) => PLATFORMS.some((p) => Date.now() - (l.status[p]?.detailAt ?? 0) < 5 * 60_000)
  const waiting = found.filter((l) => !ready.includes(l) && reading(l)).length
  const empty = found.length - ready.length - waiting // senza descrizione: da completare a mano
  const forms = ready.reduce((n, l) => n + todo(l).length, 0)
  const importRunning = !!lastImport?.running.length && Date.now() - lastImport.at < 180_000

  async function queueAll() {
    setPhase({ step: 'queueing', at: Date.now() })
    let opened = 0
    let count = 0
    for (const l of ready) {
      const platforms = todo(l)
      const n = (await chrome.runtime.sendMessage({ type: 'publish', listingId: l.id, platforms, queue: true } satisfies Msg)) as unknown
      if (typeof n === 'number' && n > 0) {
        opened += n
        count++
      }
    }
    setPhase({ step: 'idle', at: 0 })
    onReload()
    onNote(
      opened
        ? `Sincronizzo ${count} ${count === 1 ? 'annuncio' : 'annunci'}: ${opened} moduli in coda, uno alla volta in primo piano. Controlla ognuno e premi tu il pulsante finale sul sito.${waiting ? ` ${waiting} ancora in lettura: ripeti tra poco.` : ''}`
        : 'Tutto sincronizzato: nessun annuncio manca sui siti scelti.',
    )
  }

  async function start() {
    if (lastImport && Date.now() - lastImport.at < IMPORT_FRESH && !importRunning) return void queueAll()
    if (importRunning) return setPhase({ step: 'importing', at: lastImport!.at }) // già in corso: si aspetta quella
    setPhase({ step: 'importing', at: Date.now() })
    await command({ type: 'importAll' }, 'Leggo i tuoi annunci da tutti i siti (schede in background), poi sincronizzo…', onNote)
  }

  // importazione finita: aspetta descrizione e foto dei nuovi, poi mette in coda
  useEffect(() => {
    if (phase.step === 'importing' && lastImport && lastImport.at >= phase.at - 1000 && !lastImport.running.length) setPhase({ step: 'reading', at: Date.now() })
    if (phase.step === 'reading' && (!waiting || Date.now() - phase.at > READ_WAIT)) void queueAll()
  })
  // durante l'attesa i dati arrivano in background: rilegge gli annunci
  useEffect(() => {
    if (phase.step !== 'importing' && phase.step !== 'reading') return
    const t = setInterval(onReload, 3000)
    const stop = setTimeout(() => setPhase({ step: 'reading', at: 0 }), 4 * 60_000) // importazione bloccata: si va avanti
    return () => {
      clearInterval(t)
      clearTimeout(stop)
    }
  }, [phase.step, onReload])

  const busy = phase.step !== 'idle'
  const label =
    phase.step === 'importing'
      ? 'Leggo i siti…'
      : phase.step === 'reading'
        ? `Leggo descrizioni e foto${waiting ? ` (${waiting})` : ''}…`
        : phase.step === 'queueing'
          ? 'Metto in coda…'
          : 'Sincronizza tutto'

  return (
    <section className="dup" aria-labelledby="sync-title">
      <div className="dup-intro">
        <h2 id="sync-title">
          <RefreshCw size={18} aria-hidden="true" /> Sincronizza tutti gli annunci
        </h2>
        <p className="hint">
          Messo un annuncio solo su Vinted (o dal telefono)? Lo leggo e lo compilo sugli altri siti dove manca, tutti in un colpo. Il pulsante finale su ogni sito lo premi tu.
        </p>
      </div>

      <div className="dup-line">
        <span className="dup-label">Su</span>
        <div className="dup-targets five">
          {PLATFORMS.map((p) => (
            <label key={p} className="pf-toggle compact" title={PLATFORM_LABEL[p]}>
              <input type="checkbox" checked={!skip.includes(p)} disabled={busy} onChange={(e) => setSkip(e.target.checked ? skip.filter((x) => x !== p) : [...skip, p])} />
              <Logo p={p} mark />
              <span className="seg-name">{shortName(p)}</span>
              <Check className="pf-tick" size={14} strokeWidth={3} aria-hidden="true" />
            </label>
          ))}
        </div>
      </div>

      <footer className="dup-foot">
        <p className="hint" aria-live="polite">
          {found.length
            ? `${ready.length} ${ready.length === 1 ? 'annuncio' : 'annunci'} da completare · ${forms} ${forms === 1 ? 'modulo' : 'moduli'}${waiting ? ` · ${waiting} in lettura` : ''}${empty ? ` · ${empty} senza descrizione (aprili e completali)` : ''}.`
            : targets.length
              ? 'Tutto sincronizzato. Premi lo stesso per rileggere i siti e trovare annunci nuovi.'
              : 'Scegli almeno un sito.'}{' '}
          {lastImport && !busy && `Ultima lettura dei siti: ${ago(lastImport.at)}.`}
        </p>
        <button className="btn-primary" disabled={busy || !targets.length} onClick={() => void start()}>
          <RefreshCw size={16} aria-hidden="true" className={busy ? 'spin' : undefined} /> {label}
        </button>
      </footer>
    </section>
  )
}

export function List() {
  const [items, setItems] = useState<Listing[] | null>(null)
  const [q, setQ] = useState('')
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const reload = useCallback(() => void allListings().then(setItems), [])
  useEffect(reload, [reload])
  useStatusChanged(reload)

  async function create() {
    const l = newListing()
    await saveListing(l)
    location.hash = `#/edit/${l.id}`
  }

  /** Ribasso rapido: -10% in Splisto e pagina "Modifica" dei siti dove è online (il salvataggio lo confermi tu). */
  async function dropPrice(l: Listing) {
    const fresh = await getListing(l.id)
    if (!fresh || fresh.price == null) return
    const patch = bulkPatch(fresh, { price: { mode: 'pct', value: -10 } })
    if (!confirm(`Abbassare "${fresh.title}" da ${fresh.price} € a ${patch.price} € e aprire i siti per salvarlo?`)) return
    await saveFields(l.id, patch)
    const online = PLATFORMS.filter((p) => fresh.status[p]?.state === 'published')
    const n = online.length ? ((await chrome.runtime.sendMessage({ type: 'publish', listingId: l.id, platforms: online } satisfies Msg)) as unknown) : 0
    setNote(
      typeof n === 'number' && n > 0
        ? `Prezzo abbassato a ${patch.price} €: controlla ${n === 1 ? 'la scheda aperta' : `le ${n} schede aperte`} e premi tu Salva / Aggiorna.`
        : `Prezzo abbassato a ${patch.price} € in Splisto: aggiornalo a mano sui siti.`,
    )
    reload()
  }

  /** Un annuncio online su un solo sito: lo compila sugli altri siti scelti per lui. */
  async function duplicateTo(l: Listing) {
    const platforms = missingOn(l, l.platforms)
    if (!l.description.trim()) return setNote('Descrizione non ancora letta dal sito: aspetta qualche secondo o aprilo e completala.')
    const n = (await chrome.runtime.sendMessage({ type: 'publish', listingId: l.id, platforms } satisfies Msg)) as unknown
    setNote(
      typeof n === 'number' && n > 0
        ? `Compilo “${l.title}” su ${platforms.map((p) => PLATFORM_LABEL[p]).join(', ')}: controlla ogni modulo e premi tu il pulsante finale sul sito.`
        : 'Nessun modulo da aprire.',
    )
    reload()
  }

  async function relist(l: Listing) {
    const on = PLATFORMS.filter((p) => l.status[p]?.state === 'published')
    if (!confirm(`Duplicare come nuovo "${l.title}" su ${on.map((p) => PLATFORM_LABEL[p]).join(', ')}?\n\nSi apre il vecchio annuncio: eliminalo tu dal sito. Il modulo del nuovo si compila da solo: il pulsante finale lo premi tu.`)) return
    const n = (await chrome.runtime.sendMessage({ type: 'relist', listingId: l.id, platforms: on } satisfies Msg)) as unknown
    setNote(typeof n === 'number' && n > 0 ? `Elimina il vecchio annuncio nelle schede aperte, poi pubblica il nuovo dal modulo compilato (${n} ${n === 1 ? 'sito' : 'siti'}).` : 'Nessun annuncio online da duplicare.')
    reload()
  }

  async function remove(l: Listing) {
    if (!confirm(`Eliminare "${l.title || 'Senza titolo'}"? L'operazione non si può annullare.`)) return
    await deleteListing(l.id)
    reload()
  }

  const all = items ?? []
  const sold = all.filter((l) => l.sold).length
  const needle = q.trim().toLowerCase()
  const shown = all.filter((l) => !needle || [l.title, l.brand, l.description].some((s) => s.toLowerCase().includes(needle)))
  const pickedIds = all.filter((l) => picked.has(l.id)).map((l) => l.id) // solo annunci che esistono ancora
  const allShownPicked = shown.length > 0 && shown.every((l) => picked.has(l.id))
  const toggle = (id: string, on: boolean) => {
    const next = new Set(picked)
    if (on) next.add(id)
    else next.delete(id)
    setPicked(next)
  }

  return (
    <>
      <header className="top">
        <div className="brand">
          <img src="/icons/icon-48.png" alt="" width="44" height="44" />
          <div>
            <h1>Splisto</h1>
            <span className="brand-sub">Scrivi una volta, vendi ovunque</span>
          </div>
        </div>
        <div className="bar-actions">
          <a className="icon-btn" href="#/settings" title="Impostazioni" aria-label="Impostazioni">
            <SettingsIcon size={19} aria-hidden="true" />
          </a>
          <button className="btn-primary" onClick={create}>
            <Plus size={18} aria-hidden="true" /> Nuovo<span className="hide-sm">annuncio</span>
          </button>
        </div>
      </header>

      <Platforms items={all} note={note} onNote={setNote} />
      <Sync items={all} onNote={setNote} onReload={reload} />

      <section aria-labelledby="ads-title">
        <header className="list-head">
          <h2 id="ads-title">Annunci</h2>
          <span className="list-count">
            {all.length - sold} {all.length - sold === 1 ? 'attivo' : 'attivi'}
            {sold > 0 && ` · ${sold} ${sold === 1 ? 'venduto' : 'venduti'}`}
          </span>
          {shown.some(stuck) && (
            <button className="btn-text accent" onClick={() => setPicked(new Set(shown.filter(stuck).map((l) => l.id)))} title="Online da 7+ giorni senza like: da duplicare come nuovi">
              Seleziona i fermi ({shown.filter(stuck).length})
            </button>
          )}
          {shown.length > 1 && (
            <label className="pick-all">
              <input
                type="checkbox"
                checked={allShownPicked}
                onChange={(e) => setPicked(e.target.checked ? new Set([...picked, ...shown.map((l) => l.id)]) : new Set())}
              />
              Seleziona tutti
            </label>
          )}
          <label className="search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Cerca titolo, marca, descrizione"
              aria-label="Cerca negli annunci"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </header>

        {items && !items.length && (
          <div className="empty">
            <strong>Nessun annuncio</strong>
            <p>Scrivi l’annuncio una volta: foto, titolo, prezzo. Poi “Pubblica ovunque” compila i siti per te.</p>
            <button className="btn-secondary" onClick={create}>
              <Plus size={16} aria-hidden="true" /> Crea il primo annuncio
            </button>
          </div>
        )}
        {items && items.length > 0 && !shown.length && <p className="empty">Nessun risultato per “{q}”.</p>}

        <ul className="list">
          {shown.map((l) => {
            const days = daysOnline(l)
            const stale = staleSites(l)
            const gone = goneSites(l)
            const toDrop = toRemove(l)
            return (
              <li key={l.id} className={`row${l.sold ? ' is-sold' : ''}${picked.has(l.id) ? ' is-picked' : ''}`}>
                <label className="pick">
                  <input
                    type="checkbox"
                    checked={picked.has(l.id)}
                    onChange={(e) => toggle(l.id, e.target.checked)}
                    aria-label={`Seleziona ${l.title || 'annuncio senza titolo'}`}
                  />
                </label>
                <a className="row-main" href={`#/edit/${l.id}`}>
                  <Thumb blob={l.photos[0]} />
                  <div className="row-text">
                    <strong>{l.title || 'Senza titolo'}</strong>
                    <span className="row-meta">
                      <span className="price">{l.price != null ? `${l.price.toLocaleString('it-IT')} €` : 'Prezzo non indicato'}</span>
                      {l.sold && <span className="tag">Venduto</span>}
                      {l.importedFrom && <span className="tag">Importato da {PLATFORM_LABEL[l.importedFrom]}</span>}
                      {!l.sold && !gone.length && onlyOn(l) && <span className="tag tag-accent">Solo su {PLATFORM_LABEL[onlyOn(l)!]}</span>}
                      {stuck(l) ? (
                        <span className="tag tag-warn">Fermo da {days} giorni, nessun like</span>
                      ) : (
                        days != null && days >= STALE_DAYS && <span className="tag tag-warn">Online da {days} giorni: valuta un ribasso</span>
                      )}
                      {toDrop.length > 0 && <span className="tag tag-danger">Venduto: togli da {toDrop.map((p) => PLATFORM_LABEL[p]).join(', ')}</span>}
                      {gone.length > 0 && (
                        <span className="tag tag-warn" title="Non compare più tra i tuoi annunci attivi da 2 importazioni">
                          Sparito da {gone.map((p) => PLATFORM_LABEL[p]).join(', ')}: venduto o tolto?
                        </span>
                      )}
                      {stale.length > 0 && (
                        <span className="tag tag-warn" title="Prezzo o titolo sul sito diversi da quelli in Splisto">
                          Da aggiornare: {stale.map(([p, why]) => `${PLATFORM_LABEL[p]} (${why.join(', ')})`).join(', ')}
                        </span>
                      )}
                    </span>
                  </div>
                </a>
                <span className="chips">
                  {l.platforms.map((p) => {
                    const st = l.status[p]?.state ?? 'idle'
                    return (
                      <span key={p} className="chip" title={`${PLATFORM_LABEL[p]}: ${STATE_LABEL[st]}`}>
                        <Logo p={p} mark />
                        <Dot state={st} />
                        {l.stats[p] && <StatPair views={l.stats[p]!.views} likes={l.stats[p]!.likes} />}
                      </span>
                    )
                  })}
                </span>
                <div className="row-actions">
                  {toDrop.length > 0 && (
                    <button
                      className="btn-text danger-strong"
                      title="Apre l'annuncio sugli altri siti: eliminalo lì, poi segnalo come rimosso nel pannello Stato"
                      onClick={() => {
                        for (const p of toDrop) {
                          const u = l.status[p]?.url
                          if (u && SITE_URL.test(u)) void chrome.tabs.create({ url: u, active: false })
                        }
                        setNote(
                          `Ho aperto l'annuncio su ${toDrop.map((p) => PLATFORM_LABEL[p]).join(', ')}: eliminalo dal sito, poi “Segna rimosso” nell'annuncio.`,
                        )
                      }}
                    >
                      Togli dagli altri siti
                    </button>
                  )}
                  {stuck(l) && (
                    <button className="btn-text accent" onClick={() => void relist(l)} title="Toglie e rimette l'annuncio identico: sul sito torna in cima come nuovo">
                      <RotateCcw size={14} aria-hidden="true" /> Duplica come nuovo
                    </button>
                  )}
                  {days != null && days >= STALE_DAYS && l.price != null && (
                    <button className="btn-text accent" onClick={() => void dropPrice(l)} title="Abbassa il prezzo del 10% e apri i siti per salvarlo">
                      −10% sui siti
                    </button>
                  )}
                  {stale.some(([p]) => editUrlFor(p, l.status[p]!)) && (
                    <button
                      className="btn-text accent"
                      onClick={() =>
                        void chrome.runtime.sendMessage({
                          type: 'publish',
                          listingId: l.id,
                          platforms: stale.map(([p]) => p).filter((p) => editUrlFor(p, l.status[p]!)),
                        } satisfies Msg)
                      }
                      title="Apre la pagina Modifica di quei siti e compila i nuovi valori: il salvataggio lo confermi tu"
                    >
                      Aggiorna sui siti
                    </button>
                  )}
                  {!l.sold && !gone.length && onlyOn(l) && missingOn(l, l.platforms).length > 0 && (
                    <button
                      className="btn-text accent"
                      title={`Compila l'annuncio su ${missingOn(l, l.platforms)
                        .map((p) => PLATFORM_LABEL[p])
                        .join(', ')}: il pulsante finale lo premi tu`}
                      onClick={() => void duplicateTo(l)}
                    >
                      <Send size={14} aria-hidden="true" /> Pubblica sugli altri siti
                    </button>
                  )}
                  <button
                    className="icon-btn small ghost"
                    onClick={() => duplicateListing(l).then(reload)}
                    title="Crea una copia in Splisto"
                    aria-label={`Crea una copia di ${l.title || 'annuncio senza titolo'}`}
                  >
                    <CopyPlus size={16} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-btn small ghost danger"
                    onClick={() => remove(l)}
                    title="Elimina da Splisto"
                    aria-label={`Elimina ${l.title || 'annuncio senza titolo'}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {pickedIds.length > 0 && (
        <BulkBar
          ids={pickedIds}
          anyOnline={all.some((l) => picked.has(l.id) && Object.values(l.status).some((s) => s?.state === 'published'))}
          onlineOn={Object.fromEntries(PLATFORMS.map((p) => [p, all.filter((l) => picked.has(l.id) && !l.sold && l.status[p]?.state === 'published').length])) as Record<Platform, number>}
          onChanged={reload}
          onClear={() => setPicked(new Set())}
        />
      )}
    </>
  )
}
