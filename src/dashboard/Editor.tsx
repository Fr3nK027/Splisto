import { ArrowLeft, Check, ExternalLink, Send, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { checkPhotos, describeFromPhotos, improveDescription, improveTitle, titlesPerSite } from '../lib/ai'
import { deleteListing, getListing, saveFields } from '../lib/db'
import { CATEGORIES, categoryFor, CONDITION_LABEL, ebaySoldSearch, PLATFORM_LABEL, priceFor, publishedOn, TITLE_MAX, titleLimit } from '../lib/platforms'
import { DEFAULT_SETTINGS, getSettings, netPrice, setSettings, TONE_LABEL, type Settings, type Tone } from '../lib/settings'
import { SITE_URL } from '../content/text'
import { PLATFORMS, type Condition, type Listing, type Msg, type Platform } from '../lib/types'
import { Photos } from './Photos'
import { Status } from './Status'
import { Logo, useStatusChanged } from './ui'

type AiField = 'title' | 'description' | 'titles' | 'photos'
interface AiState {
  field: AiField
  loading: boolean
  text?: string
  titles?: Partial<Record<Platform, string>>
  error?: string
}

const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

export function Editor({ id }: { id: string }) {
  const [l, setL] = useState<Listing | null>(null)
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [ai, setAi] = useState<AiState | null>(null)
  const [notice, setNotice] = useState('')
  const [soldPick, setSoldPick] = useState<Platform | 'altro' | null>(null)
  // Campi modificati e non ancora salvati: si salvano solo questi, così importazione e schede dei siti
  // possono aggiornare lo stesso annuncio (descrizione, foto, stato) senza essere sovrascritti.
  const pending = useRef<Partial<Listing>>({})
  const latest = useRef<Listing | null>(null)
  latest.current = l
  const flush = useCallback(async () => {
    const patch = pending.current
    pending.current = {}
    if (Object.keys(patch).length) await saveFields(id, patch)
  }, [id])

  useEffect(() => {
    getListing(id).then((x) => (x ? setL(x) : (location.hash = '#/')))
    getSettings().then(setSettingsState)
  }, [id])

  // Salvataggio automatico (debounce) + salvataggio all'uscita.
  // Un annuncio nuovo lasciato vuoto viene eliminato; uno importato o già inviato ai siti mai.
  useEffect(() => {
    if (!l || !Object.keys(pending.current).length) return
    const t = setTimeout(() => void flush(), 400)
    return () => clearTimeout(t)
  }, [l, flush])
  useEffect(
    () => () => {
      const cur = latest.current
      if (!cur) return
      const untouched = !cur.importedFrom && !Object.keys(cur.status).length
      if (untouched && !cur.title && !cur.description && !cur.photos.length) void deleteListing(cur.id)
      else void flush()
    },
    [flush],
  )

  const set = (patch: Partial<Listing>) => {
    pending.current = { ...pending.current, ...patch }
    setL((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  /** Ricarica l'annuncio dal database (cambiato in background) tenendo le modifiche non ancora salvate. */
  const refreshStatus = useCallback(async () => {
    const fresh = await getListing(id)
    if (fresh) setL({ ...fresh, ...pending.current })
  }, [id])
  useStatusChanged(useCallback((lid: string) => lid === id && void refreshStatus(), [id, refreshStatus]))

  if (!l) return null

  const tone = settings.tone
  const limit = titleLimit(l.platforms, l.titleOverride)
  const published = publishedOn(l)
  // dove manca: annuncio nuovo; dove è già pubblicato: pagina "Modifica" del sito (niente doppioni)
  const toUpdate = l.platforms.filter((p) => published.includes(p))
  const toCreate = l.platforms.filter((p) => !published.includes(p) && l.status[p]?.state !== 'removed')

  async function runAi(field: AiField, fn: () => Promise<Partial<AiState>>) {
    setAi({ field, loading: true })
    try {
      setAi({ field, loading: false, ...(await fn()) })
    } catch (e) {
      setAi({ field, loading: false, error: (e as Error).message })
    }
  }

  async function publish(platforms: Platform[]) {
    if (!l) return
    await flush()
    const r = (await chrome.runtime.sendMessage({ type: 'publish', listingId: l.id, platforms } satisfies Msg)) as unknown
    setNotice(
      typeof r !== 'number'
        ? `Errore: ${r && typeof r === 'object' && 'error' in r ? String((r as { error: unknown }).error) : 'nessuna risposta dall’estensione, ricaricala da chrome://extensions'}`
        : !r
          ? 'Niente da aprire: su questi siti l’annuncio va aggiornato a mano (vedi Stato).'
          : settings.sequential && r > 1
            ? 'Compilo un sito alla volta in primo piano. Controlla ogni modulo e premi tu il pulsante finale sul sito.'
            : `${r === 1 ? 'Aperta 1 scheda' : `Aperte ${r} schede`}: controlla ogni modulo e premi tu il pulsante finale sul sito.`,
    )
    void refreshStatus()
  }

  async function markSold(where: Platform | 'altro') {
    if (!l) return
    set({ sold: { platform: where, at: Date.now() } })
    setSoldPick(null)
    const others = published.filter((p) => p !== where)
    for (const p of others) {
      const url = l.status[p]?.url
      if (url && SITE_URL.test(url)) await chrome.tabs.create({ url, active: false })
    }
    setNotice(
      others.length
        ? `Venduto! Ho aperto gli annunci con link su ${others.map((p) => PLATFORM_LABEL[p]).join(', ')}: eliminali dal sito, poi “Segna rimosso” qui sotto.`
        : 'Segnato come venduto.',
    )
  }

  const togglePlatform = (p: Platform, on: boolean) =>
    set({ platforms: on ? PLATFORMS.filter((x) => x === p || l.platforms.includes(x)) : l.platforms.filter((x) => x !== p) })

  const close = () => setAi(null)

  const aiBox = (field: AiField) => {
    if (ai?.field !== field || ai.loading) return null
    // cosa si mostra e cosa fa "Usa" (null = solo "Chiudi": errore o consigli sulle foto)
    const apply = ai.error || field === 'photos' ? null : field === 'titles' ? { titleOverride: { ...l.titleOverride, ...ai.titles } } : { [field]: ai.text! }
    return (
      <div className="ai-preview" role="status">
        {ai.error ? (
          <p className="error-text">{ai.error}</p>
        ) : field === 'titles' ? (
          <ul className="ai-list">
            {Object.entries(ai.titles ?? {}).map(([p, t]) => (
              <li key={p}>
                <span className="hint">
                  {PLATFORM_LABEL[p as Platform]} · {t!.length}/{TITLE_MAX[p as Platform]}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ai-text">{ai.text}</p>
        )}
        <div className="ai-actions">
          {field === 'title' && !ai.error && (
            <span className="hint">
              {ai.text!.length}/{limit}
            </span>
          )}
          {ai.error?.includes('Impostazioni') && (
            <a className="btn-text" href="#/settings">
              Apri Impostazioni
            </a>
          )}
          <button className="btn-text" onClick={close}>
            {apply ? 'Annulla' : 'Chiudi'}
          </button>
          {apply && (
            <button
              className="btn-text accent"
              onClick={() => {
                set(apply)
                close()
              }}
            >
              Usa
            </button>
          )}
        </div>
      </div>
    )
  }

  const aiBtn = (field: AiField, label: string, fn: () => Promise<Partial<AiState>>) => (
    <button className="btn-text ai-btn" disabled={ai?.loading} onClick={() => runAi(field, fn)}>
      <Sparkles size={14} aria-hidden="true" />
      {ai?.loading && ai.field === field ? 'Attendi…' : label}
    </button>
  )

  return (
    <>
      <header className="bar">
        <a className="btn-text back" href="#/">
          <ArrowLeft size={16} /> Annunci
        </a>
        <label className="tone">
          <span className="hint">Tono AI</span>
          <select
            value={tone}
            onChange={(e) => {
              const t = e.target.value as Tone
              setSettingsState({ ...settings, tone: t })
              void setSettings({ tone: t })
            }}
          >
            {Object.entries(TONE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>

      {l.sold && (
        <p className="sold-banner">
          Venduto {l.sold.platform === 'altro' ? 'fuori dalle piattaforme' : `su ${PLATFORM_LABEL[l.sold.platform]}`} il{' '}
          {new Date(l.sold.at).toLocaleDateString('it-IT')}.{' '}
          <button className="btn-text" onClick={() => set({ sold: null })}>
            Annulla vendita
          </button>
        </p>
      )}

      <Photos photos={l.photos} onChange={(photos) => set({ photos })} />
      {l.photos.length > 0 && (
        <div className="under-photos">
          {aiBtn('photos', 'Controlla foto', async () => ({ text: await checkPhotos(l) }))}
          {aiBox('photos')}
        </div>
      )}

      <section className="sheet">
        <div className="field">
          <div className="field-head">
            <label htmlFor="title">Titolo</label>
            <span className={l.title.length > limit ? 'error-text' : 'hint'}>
              {l.title.length}/{limit}
            </span>
            {aiBtn('title', 'Migliora', async () => ({ text: await improveTitle(l, limit, tone) }))}
          </div>
          <input
            id="title"
            className="title-input"
            value={l.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Es. Giacca di jeans Levi’s Trucker, taglia M"
          />
          {aiBox('title')}
        </div>

        <div className="field">
          <div className="field-head">
            <label htmlFor="description">Descrizione</label>
            {l.photos.length > 0 && aiBtn('description', 'Dalle foto', async () => ({ text: await describeFromPhotos(l, tone) }))}
            {aiBtn('description', 'Migliora', async () => ({ text: await improveDescription(l, tone) }))}
          </div>
          <textarea
            id="description"
            rows={7}
            value={l.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Condizioni, difetti, misure, motivo della vendita…"
          />
          {aiBox('description')}
        </div>
      </section>

      <section className="sheet">
        <h2 className="sheet-title">Dettagli</h2>
        <div className="grid">
          <div className="field">
            <div className="field-head">
              <label htmlFor="price">Prezzo (€)</label>
              {l.title.trim() && (
                <a
                  className="btn-text"
                  href={ebaySoldSearch(l.title)}
                  target="_blank"
                  rel="noreferrer"
                  title="Prezzi a cui oggetti simili sono stati venduti su eBay"
                >
                  Venduti su eBay <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
            </div>
            <input
              id="price"
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={l.price ?? ''}
              onChange={(e) => set({ price: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="condition">Condizione</label>
            <select id="condition" value={l.condition} onChange={(e) => set({ condition: e.target.value as Condition })}>
              {Object.entries(CONDITION_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="category">Categoria</label>
            <select id="category" value={l.category} onChange={(e) => set({ category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="brand">Marca</label>
            <input id="brand" value={l.brand} onChange={(e) => set({ brand: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="size">Taglia</label>
            <input id="size" value={l.size} onChange={(e) => set({ size: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="color">Colore</label>
            <input id="color" value={l.color} onChange={(e) => set({ color: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="weight">Peso pacco (g)</label>
            <input
              id="weight"
              type="number"
              min="0"
              step="50"
              value={l.weightG ?? ''}
              onChange={(e) => set({ weightG: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="dims">Dimensioni (cm)</label>
            <input id="dims" value={l.dims} onChange={(e) => set({ dims: e.target.value })} placeholder="30x20x10" />
          </div>
        </div>
      </section>

      <details className="per-platform">
        <summary>Campi per piattaforma</summary>
        <div className="per-platform-head">
          <p className="hint">Lascia vuoto per usare i valori principali. Categoria: “A &gt; B” = sottomenu.</p>
          {l.title.trim() &&
            l.platforms.length > 0 &&
            aiBtn('titles', 'Titoli per sito', async () => ({ titles: await titlesPerSite(l, l.platforms, tone) }))}
        </div>
        {aiBox('titles')}
        {PLATFORMS.map((p) => {
          const price = priceFor(l, p)
          const t = l.titleOverride[p] ?? ''
          return (
            <fieldset key={p} className="site-fields">
              <legend>
                <Logo p={p} mark /> {PLATFORM_LABEL[p]}
              </legend>
              <div className="field">
                <div className="field-head">
                  <label htmlFor={`title-${p}`}>Titolo</label>
                  <span className={t.length > TITLE_MAX[p] ? 'error-text' : 'hint'}>
                    {(t || l.title).length}/{TITLE_MAX[p]}
                  </span>
                </div>
                <input
                  id={`title-${p}`}
                  value={t}
                  placeholder={l.title || 'Titolo principale'}
                  onChange={(e) => set({ titleOverride: { ...l.titleOverride, [p]: e.target.value } })}
                />
              </div>
              <div className="site-row">
                <div className="field">
                  <label htmlFor={`price-${p}`}>Prezzo (€)</label>
                  <input
                    id={`price-${p}`}
                    type="number"
                    min="0"
                    step="0.5"
                    value={l.priceOverride[p] ?? ''}
                    placeholder={l.price != null ? String(l.price) : ''}
                    onChange={(e) => {
                      const { [p]: _, ...rest } = l.priceOverride
                      set({ priceOverride: e.target.value === '' ? rest : { ...rest, [p]: Number(e.target.value) } })
                    }}
                  />
                  {price != null && <span className="hint">Incassi circa {euro(netPrice(price, settings.fees[p]))}</span>}
                </div>
                <div className="field">
                  <label htmlFor={`cat-${p}`}>Categoria</label>
                  <input
                    id={`cat-${p}`}
                    value={l.categoryOverride[p] ?? ''}
                    placeholder={categoryFor({ category: l.category, categoryOverride: {} }, p) || 'Scegli sul sito'}
                    onChange={(e) => set({ categoryOverride: { ...l.categoryOverride, [p]: e.target.value } })}
                  />
                </div>
              </div>
            </fieldset>
          )
        })}
      </details>

      <section className="dock" aria-label="Pubblica">
        <fieldset className="platforms">
          <legend>Pubblica su</legend>
          {PLATFORMS.map((p) => (
            <label key={p} className="pf-toggle" title={PLATFORM_LABEL[p]}>
              <input type="checkbox" checked={l.platforms.includes(p)} onChange={(e) => togglePlatform(p, e.target.checked)} />
              <Logo p={p} />
              <Logo p={p} mark />
              <Check className="pf-tick" size={14} strokeWidth={3} aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        <div className="dock-foot">
          <p className="hint">
            {notice ||
              (l.sold
                ? 'Venduto: niente da pubblicare. “Annulla vendita” per rimetterlo in vendita.'
                : !l.title.trim()
                  ? 'Inserisci almeno il titolo.'
                  : toUpdate.length
                    ? `${toCreate.length ? `Nuovo annuncio su ${toCreate.map((p) => PLATFORM_LABEL[p]).join(', ')}; ` : ''}modifica di quello già online su ${toUpdate.map((p) => PLATFORM_LABEL[p]).join(', ')}. Il pulsante finale (Pubblica, Salva, Aggiorna) lo premi tu sul sito.`
                    : 'Apre i siti e compila il modulo. La pubblicazione finale la confermi tu; il link si salva da solo.')}
          </p>
          {!l.sold && l.title.trim() && toUpdate.length > 0 && toCreate.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => publish(toCreate)}
              title={`Solo ${toCreate.map((p) => PLATFORM_LABEL[p]).join(', ')}: gli annunci già online restano come sono`}
            >
              Solo sui nuovi siti
            </button>
          )}
          <button
            className="btn-primary"
            disabled={!!l.sold || !(toUpdate.length + toCreate.length) || !l.title.trim()}
            onClick={() => publish([...toUpdate, ...toCreate])}
          >
            <Send size={16} aria-hidden="true" />
            {toUpdate.length && toCreate.length ? 'Pubblica e aggiorna' : toUpdate.length ? 'Aggiorna sui siti' : 'Pubblica ovunque'}
          </button>
        </div>
      </section>

      <div className="publish">
        {!l.sold && published.length > 0 && (
          <div className="sold-pick">
            {soldPick === null ? (
              <button className="btn-text" onClick={() => setSoldPick(published[0])}>
                Segna come venduto…
              </button>
            ) : (
              <>
                <span className="hint">Venduto su</span>
                <select aria-label="Venduto su" value={soldPick} onChange={(e) => setSoldPick(e.target.value as Platform | 'altro')}>
                  {published.map((p) => (
                    <option key={p} value={p}>
                      {PLATFORM_LABEL[p]}
                    </option>
                  ))}
                  <option value="altro">Altro (di persona…)</option>
                </select>
                <button className="btn-text accent" onClick={() => markSold(soldPick)}>
                  Conferma
                </button>
                <button className="btn-text" onClick={() => setSoldPick(null)}>
                  Annulla
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <Status listing={l} onChanged={refreshStatus} onReopen={(p) => publish([p])} />
    </>
  )
}
