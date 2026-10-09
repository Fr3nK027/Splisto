import { Check, Dot, Minus, Plus, RotateCcw, Send, Trash2, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { bulkPatch, snapshot, type BulkOps, type TextMode } from '../lib/bulk'
import { deleteListing, getListing, saveFields } from '../lib/db'
import { CATEGORIES, CONDITION_LABEL, PLATFORM_LABEL } from '../lib/platforms'
import { PLATFORMS, type Condition, type Listing, type Msg, type Platform } from '../lib/types'
import { Logo } from './ui'

type SiteOp = 'keep' | 'add' | 'remove'
const NEXT: Record<SiteOp, SiteOp> = { keep: 'add', add: 'remove', remove: 'keep' }
const SITE_TITLE: Record<SiteOp, string> = { keep: 'non cambia', add: 'aggiungi', remove: 'togli' }

interface Props {
  ids: string[]
  anyOnline: boolean
  onlineOn: Record<Platform, number> // annunci selezionati online su ogni sito
  onChanged: () => void
  onClear: () => void
}

/** Modifica insieme gli annunci selezionati: prezzo, titolo, descrizione, condizione, categoria, marca, siti. */
export function BulkBar({ ids, anyOnline, onlineOn, onChanged, onClear }: Props) {
  const [priceMode, setPriceMode] = useState<'' | 'set' | 'pct' | 'add'>('')
  const [priceValue, setPriceValue] = useState('')
  const [titleMode, setTitleMode] = useState<'' | 'append' | 'prepend' | 'replace'>('')
  const [titleText, setTitleText] = useState('')
  const [titleFind, setTitleFind] = useState('')
  const [descMode, setDescMode] = useState<'' | TextMode>('')
  const [descText, setDescText] = useState('')
  const [descFind, setDescFind] = useState('')
  const [condition, setCondition] = useState<'' | Condition>('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [sites, setSites] = useState<Partial<Record<Platform, SiteOp>>>({})
  const [undo, setUndo] = useState<Record<string, Partial<Listing>> | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [relistSkip, setRelistSkip] = useState<Platform[]>([])
  const relistSites = PLATFORMS.filter((p) => onlineOn[p] > 0 && !relistSkip.includes(p))
  const relistCount = relistSites.reduce((n, p) => n + onlineOn[p], 0)

  const value = Number(priceValue.replace(',', '.'))
  const ops: BulkOps = {
    ...(priceMode && priceValue.trim() && Number.isFinite(value) && { price: { mode: priceMode, value } }),
    ...(titleMode && (titleText.trim() || (titleMode === 'replace' && titleFind)) && { title: { mode: titleMode, text: titleText, find: titleFind } }),
    ...(descMode && (descText.trim() || descMode === 'set' || (descMode === 'replace' && descFind)) && { description: { mode: descMode, text: descText, find: descFind } }),
    ...(condition && { condition }),
    ...(category && { category }),
    ...(brand.trim() && { brand }),
    addPlatforms: PLATFORMS.filter((p) => sites[p] === 'add'),
    removePlatforms: PLATFORMS.filter((p) => sites[p] === 'remove'),
  }
  const hasChanges = Object.keys(ops).some((k) => !['addPlatforms', 'removePlatforms'].includes(k)) || !!ops.addPlatforms?.length || !!ops.removePlatforms?.length

  async function apply() {
    setBusy(true)
    const saved: Record<string, Partial<Listing>> = {}
    for (const id of ids) {
      const l = await getListing(id)
      if (!l) continue
      const patch = bulkPatch(l, ops)
      if (!Object.keys(patch).length) continue
      saved[id] = snapshot(l, patch)
      await saveFields(id, patch)
    }
    const n = Object.keys(saved).length
    setUndo(n ? saved : null)
    setMsg(n ? `Aggiornati ${n} ${n === 1 ? 'annuncio' : 'annunci'}.` : 'Nessun annuncio da cambiare con queste scelte.')
    setBusy(false)
    onChanged()
  }

  /** Applica le modifiche e poi, per ogni annuncio: nuovo dove manca, pagina "Modifica" dove è già online. */
  async function applyAndSend() {
    if (hasChanges) await apply()
    setBusy(true)
    let sites = 0
    for (const id of ids) {
      const l = await getListing(id)
      if (!l || l.sold) continue
      // con annunci già online si aggiornano solo quelli; altrimenti si pubblica sui siti scelti
      const platforms = anyOnline ? l.platforms.filter((p) => l.status[p]?.state === 'published') : l.platforms
      if (!platforms.length) continue
      const n = (await chrome.runtime.sendMessage({ type: 'publish', listingId: id, platforms, queue: true } satisfies Msg)) as unknown
      if (typeof n === 'number') sites += n // senza i siti da aggiornare a mano (es. Wallapop)
    }
    setBusy(false)
    setMsg(
      sites
        ? `Apro ${sites} pagine una alla volta: controlla ogni scheda e premi tu il pulsante finale (Pubblica, Salva, Aggiorna).`
        : 'Nessun sito da aggiornare tra gli annunci selezionati.',
    )
  }

  /** "Duplica come nuovi": per ogni sito apre il vecchio annuncio (lo elimini tu) e compila uno nuovo identico. */
  async function relist() {
    const names = relistSites.map((p) => PLATFORM_LABEL[p]).join(', ')
    if (!confirm(`Duplicare come nuovi gli annunci selezionati su ${names}?\n\nSi aprono ${relistCount} vecchi annunci in schede in background: eliminali tu dal sito. I moduli dei nuovi si compilano uno alla volta: il pulsante finale lo premi tu.`)) return
    setBusy(true)
    let n = 0
    for (const id of ids) {
      const r = (await chrome.runtime.sendMessage({ type: 'relist', listingId: id, platforms: relistSites } satisfies Msg)) as unknown
      if (typeof r === 'number') n += r
    }
    setBusy(false)
    setMsg(
      n
        ? `Duplico come nuovi: ${n} moduli in coda, uno alla volta. Nelle schede in background elimina i vecchi annunci; poi pubblica i nuovi dal modulo compilato.`
        : 'Nessun annuncio online sui siti scelti.',
    )
    onChanged()
  }

  async function revert() {
    if (!undo) return
    setBusy(true)
    for (const [id, prev] of Object.entries(undo)) await saveFields(id, prev)
    setUndo(null)
    setMsg('Modifiche annullate.')
    setBusy(false)
    onChanged()
  }

  async function remove() {
    if (!confirm(`Eliminare ${ids.length} annunci da Splisto? Sui siti restano online. L'operazione non si può annullare.`)) return
    for (const id of ids) await deleteListing(id)
    onClear()
    onChanged()
  }

  return (
    <section className="bulk" aria-label="Modifica gli annunci selezionati">
      <header className="bulk-head">
        <h2>
          Modifica {ids.length} {ids.length === 1 ? 'annuncio' : 'annunci'}
        </h2>
        <button className="icon-btn small" onClick={onClear} title="Annulla selezione" aria-label="Annulla selezione">
          <X size={16} />
        </button>
      </header>

      <div className="bulk-grid">
        <div className="field">
          <label htmlFor="bulk-price-mode">Prezzo</label>
          <div className="bulk-pair">
            <select id="bulk-price-mode" value={priceMode} onChange={(e) => setPriceMode(e.target.value as typeof priceMode)}>
              <option value="">Non cambiare</option>
              <option value="set">Imposta a €</option>
              <option value="pct">Più/meno %</option>
              <option value="add">Più/meno €</option>
            </select>
            {priceMode && (
              <input
                inputMode="decimal"
                aria-label="Valore del prezzo"
                placeholder={priceMode === 'set' ? 'es. 25' : 'es. -10'}
                value={priceValue}
                onChange={(e) => setPriceValue(e.target.value)}
              />
            )}
          </div>
          {priceMode === 'pct' && <span className="hint">Negativo per scontare: -10 = 10% in meno. Vale anche per i prezzi per sito.</span>}
        </div>

        <div className="field">
          <label htmlFor="bulk-title-mode">Titolo</label>
          <div className="bulk-pair">
            <select id="bulk-title-mode" value={titleMode} onChange={(e) => setTitleMode(e.target.value as typeof titleMode)}>
              <option value="">Non cambiare</option>
              <option value="prepend">Aggiungi all’inizio</option>
              <option value="append">Aggiungi in fondo</option>
              <option value="replace">Sostituisci una parola</option>
            </select>
            {titleMode === 'replace' && <input aria-label="Testo da cercare nel titolo" placeholder="cerca…" value={titleFind} onChange={(e) => setTitleFind(e.target.value)} />}
          </div>
          {titleMode && (
            <input aria-label="Testo del titolo" placeholder={titleMode === 'replace' ? 'sostituisci con…' : 'es. COME NUOVO'} value={titleText} onChange={(e) => setTitleText(e.target.value)} />
          )}
        </div>

        <div className="field bulk-wide">
          <label htmlFor="bulk-desc-mode">Descrizione</label>
          <div className="bulk-pair">
            <select id="bulk-desc-mode" value={descMode} onChange={(e) => setDescMode(e.target.value as typeof descMode)}>
              <option value="">Non cambiare</option>
              <option value="append">Aggiungi in fondo</option>
              <option value="prepend">Aggiungi all’inizio</option>
              <option value="replace">Sostituisci un testo</option>
              <option value="set">Sostituisci tutta</option>
            </select>
            {descMode === 'replace' && <input aria-label="Testo da cercare nella descrizione" placeholder="cerca…" value={descFind} onChange={(e) => setDescFind(e.target.value)} />}
          </div>
          {descMode && (
            <textarea
              rows={2}
              aria-label="Testo della descrizione"
              placeholder={descMode === 'replace' ? 'sostituisci con…' : 'es. Spedisco in 24/48 ore. Possibile ritiro a mano.'}
              value={descText}
              onChange={(e) => setDescText(e.target.value)}
            />
          )}
        </div>

        <div className="field">
          <label htmlFor="bulk-condition">Condizione</label>
          <select id="bulk-condition" value={condition} onChange={(e) => setCondition(e.target.value as typeof condition)}>
            <option value="">Non cambiare</option>
            {Object.entries(CONDITION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="bulk-category">Categoria</label>
          <select id="bulk-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Non cambiare</option>
            {Object.entries(CATEGORIES).map(([k, c]) => (
              <option key={k} value={k}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="bulk-brand">Marca</label>
          <input id="bulk-brand" placeholder="vuoto = non cambiare" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>

        <div className="field bulk-wide">
          <span className="bulk-label">Pubblica su (clic: aggiungi, togli, non cambiare)</span>
          <div className="bulk-sites">
            {PLATFORMS.map((p) => {
              const op = sites[p] ?? 'keep'
              return (
                <button
                  key={p}
                  type="button"
                  className={`site-op site-${op}`}
                  onClick={() => setSites({ ...sites, [p]: NEXT[op] })}
                  aria-label={`${PLATFORM_LABEL[p]}: ${SITE_TITLE[op]}`}
                  title={`${PLATFORM_LABEL[p]}: ${SITE_TITLE[op]}`}
                >
                  <Logo p={p} mark />
                  <span aria-hidden="true">{op === 'add' ? <Plus size={14} /> : op === 'remove' ? <Minus size={14} /> : <Dot size={14} />}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {anyOnline && (
        <div className="relist">
          <div className="relist-text">
            <strong>
              <RotateCcw size={16} aria-hidden="true" /> Duplica come nuovi
            </strong>
            <span className="hint">Toglie e rimette l’annuncio identico: sul sito torna in cima come appena messo. Il vecchio lo elimini tu, il nuovo lo pubblichi tu.</span>
          </div>
          <div className="relist-sites">
            {PLATFORMS.filter((p) => onlineOn[p] > 0).map((p) => (
              <label key={p} className="pf-toggle compact" title={`${PLATFORM_LABEL[p]}: ${onlineOn[p]} online`}>
                <input type="checkbox" checked={!relistSkip.includes(p)} onChange={(e) => setRelistSkip(e.target.checked ? relistSkip.filter((x) => x !== p) : [...relistSkip, p])} />
                <Logo p={p} mark />
                <span className="seg-count">{onlineOn[p]}</span>
                <Check className="pf-tick" size={14} strokeWidth={3} aria-hidden="true" />
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={relist} disabled={busy || !relistCount}>
            <RotateCcw size={15} aria-hidden="true" /> Duplica {relistCount} {relistCount === 1 ? 'annuncio' : 'annunci'}
          </button>
        </div>
      )}

      <footer className="bulk-foot">
        <p className="hint" aria-live="polite">
          {msg ||
            (anyOnline
              ? '“Aggiorna sui siti” apre la pagina Modifica di ogni sito e compila i nuovi valori; il salvataggio sul sito lo confermi tu.'
              : 'Le modifiche valgono per i prossimi invii ai siti.')}
        </p>
        <div className="bulk-actions">
          {undo && (
            <button className="btn-secondary" onClick={revert} disabled={busy}>
              <Undo2 size={16} aria-hidden="true" /> Annulla modifiche
            </button>
          )}
          <button className="btn-text danger" onClick={remove} disabled={busy}>
            <Trash2 size={15} aria-hidden="true" /> Elimina
          </button>
          {anyOnline ? (
            <>
              <button className="btn-secondary" onClick={apply} disabled={busy || !hasChanges}>
                Solo in Splisto
              </button>
              <button className="btn-primary" onClick={applyAndSend} disabled={busy}>
                <Send size={15} aria-hidden="true" /> {hasChanges ? 'Applica e aggiorna sui siti' : 'Aggiorna sui siti'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={applyAndSend} disabled={busy}>
                <Send size={15} aria-hidden="true" /> Applica e pubblica
              </button>
              <button className="btn-primary" onClick={apply} disabled={busy || !hasChanges}>
                {busy ? 'Salvo…' : `Applica a ${ids.length}`}
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  )
}
