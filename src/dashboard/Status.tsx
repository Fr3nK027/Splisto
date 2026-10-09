import { useState } from 'react'
import { SITE_URL } from '../content/text'
import { saveFields, updateStatus } from '../lib/db'
import { outOfSync, PLATFORM_LABEL, sitePriceFor } from '../lib/platforms'
import { PLATFORMS, type Listing, type Msg, type Platform, type PlatformStatus, type StatusState } from '../lib/types'
import { Dot, Logo, STATE_LABEL, StatPair, statsAge } from './ui'

const FIELD_LABEL: Record<string, string> = {
  photos: 'Foto',
  title: 'Titolo',
  description: 'Descrizione',
  price: 'Prezzo',
  category: 'Categoria',
  condition: 'Condizione',
  brand: 'Marca',
  size: 'Taglia',
  color: 'Colore',
  weight: 'Peso',
  keywords: 'Cosa vendi',
}

const EDIT_LABEL: Partial<Record<StatusState, string>> = {
  opening: 'apro la pagina di modifica…',
  filled: 'modifiche compilate, controlla e premi tu Salva / Aggiorna sul sito',
  incomplete: 'compilato in parte',
  login: 'accedi al sito in quella scheda',
  error: 'errore',
}

/** Campi da "insegnare": della compilazione o dell'aggiornamento in corso. */
function teachKeys(s?: PlatformStatus): string[] {
  const bad = (st?: StatusState) => st === 'incomplete' || st === 'error'
  const keys = bad(s?.state) ? s?.missingKeys : bad(s?.edit?.state) ? s?.edit?.missingKeys : []
  return [...new Set(keys ?? [])]
}

interface Props {
  listing: Listing
  onChanged: () => void
  onReopen: (p: Platform) => void
}

export function Status({ listing, onChanged, onReopen }: Props) {
  const [teachNote, setTeachNote] = useState<Partial<Record<Platform, string>>>({})
  const shown = PLATFORMS.filter((p) => listing.platforms.includes(p) || listing.status[p])
  if (!shown.some((p) => listing.status[p])) return null

  const set = (p: Platform, patch: Parameters<typeof updateStatus>[2]) => updateStatus(listing.id, p, patch).then(onChanged)

  async function teach(p: Platform, key: string) {
    const label = FIELD_LABEL[key] ?? key
    const ok = await chrome.runtime.sendMessage({ type: 'teach', listingId: listing.id, platform: p, key, label } satisfies Msg)
    setTeachNote({
      ...teachNote,
      [p]: ok
        ? `Vai sulla scheda ${PLATFORM_LABEL[p]} e clicca il campo «${label}».`
        : 'La scheda di compilazione non è più aperta: usa “Riapri”, poi “Insegna”.',
    })
  }

  return (
    <section className="status" aria-live="polite">
      <h2>Stato</h2>
      <ul>
        {shown.map((p) => {
          const s = listing.status[p]
          const state = s?.state ?? 'idle'
          const stats = listing.stats[p]
          const soldElsewhere = listing.sold && listing.sold.platform !== p && state === 'published'
          return (
            <li key={p} className={`status-row pf-${p}`}>
              <div className="status-head">
                <span className="status-name">
                  <Logo p={p} />
                </span>
                <span className="status-meta">
                  {stats && (
                    <span title={`Letto il ${statsAge(stats)}`}>
                      <StatPair views={stats.views} likes={stats.likes} />
                    </span>
                  )}
                  <span className={`state state-${listing.sold?.platform === p ? 'sold' : state}`}>
                    <Dot state={state} /> {listing.sold?.platform === p ? 'Venduto qui' : STATE_LABEL[state]}
                  </span>
                </span>
              </div>

              {s?.message && <p className={state === 'error' ? 'error-text' : 'hint'}>{s.message}</p>}
              {state === 'published' && !listing.sold && (s?.missingCount ?? 0) >= 2 && (
                <div className="status-actions">
                  <span className="hint warn-text">Non compare più tra i tuoi annunci su {PLATFORM_LABEL[p]}:</span>
                  <button className="btn-text accent" onClick={() => saveFields(listing.id, { sold: { platform: p, at: Date.now() } }).then(onChanged)}>
                    Venduto qui
                  </button>
                  <button className="btn-text" onClick={() => set(p, { state: 'removed', missingCount: 0 })}>
                    Tolto dal sito
                  </button>
                  <button className="btn-text" onClick={() => set(p, { missingCount: 0 })}>
                    È ancora online
                  </button>
                </div>
              )}
              {outOfSync(listing, p).length > 0 && (
                <p className="hint warn-text">
                  Sul sito è diverso ({outOfSync(listing, p).join(', ')})
                  {outOfSync(listing, p).includes('prezzo') && `: lì ${s!.sitePrice!.toLocaleString('it-IT')} €, qui ${sitePriceFor(listing, p)!.toLocaleString('it-IT')} €`}. Usa
                  “Aggiorna sul sito”: compila la pagina Modifica, poi premi tu Salva / Aggiorna.
                </p>
              )}
              {s?.edit && (
                <p className={s.edit.state === 'error' ? 'error-text' : 'hint'}>
                  <Dot state={s.edit.state} /> Aggiornamento: {EDIT_LABEL[s.edit.state] ?? STATE_LABEL[s.edit.state]}
                  {!!s.edit.missing?.length && ` — da fare a mano: ${s.edit.missing.join(', ')}`}
                  {s.edit.state === 'error' && s.edit.message && ` — ${s.edit.message}`}
                </p>
              )}
              {(state === 'incomplete' || state === 'error') && !!s?.missing?.length && (
                <p className="hint">Da completare a mano: {s.missing.join(', ')}</p>
              )}
              {soldElsewhere && <p className="hint warn-text">Venduto altrove: elimina l’annuncio da {PLATFORM_LABEL[p]}, poi segnalo come rimosso.</p>}

              {teachKeys(s).length > 0 && (
                <div className="status-actions">
                  <span className="hint">Campo non trovato? Insegnamelo:</span>
                  {teachKeys(s).map((k) => (
                    <button key={k} className="btn-text accent" onClick={() => teach(p, k)}>
                      {FIELD_LABEL[k] ?? k}
                    </button>
                  ))}
                </div>
              )}
              {teachNote[p] && <p className="hint">{teachNote[p]}</p>}

              {state === 'published' ? (
                <div className="status-actions">
                  <input
                    type="url"
                    placeholder="Link dell’annuncio (si salva da solo dopo la pubblicazione)"
                    defaultValue={s?.url ?? ''}
                    key={s?.url ?? ''}
                    onBlur={(e) => e.target.value.trim() !== (s?.url ?? '') && set(p, { url: e.target.value.trim() })}
                  />
                  {s?.url && SITE_URL.test(s.url) && (
                    <a className="btn-text" href={s.url} target="_blank" rel="noreferrer">
                      Apri
                    </a>
                  )}
                  {soldElsewhere ? (
                    <button className="btn-text accent" onClick={() => set(p, { state: 'removed' })}>
                      Segna rimosso
                    </button>
                  ) : (
                    <>
                      {!listing.sold && (
                        <>
                          <button className="btn-text accent" onClick={() => onReopen(p)}>
                            Aggiorna sul sito
                          </button>
                          <button
                            className="btn-text"
                            title="Toglie e rimette l'annuncio identico: sul sito torna in cima come nuovo"
                            onClick={() =>
                              confirm(`Duplicare come nuovo su ${PLATFORM_LABEL[p]}? Si apre il vecchio annuncio: eliminalo tu. Il modulo del nuovo si compila da solo, il pulsante finale lo premi tu.`) &&
                              void chrome.runtime.sendMessage({ type: 'relist', listingId: listing.id, platforms: [p] } satisfies Msg).then(onChanged)
                            }
                          >
                            Duplica come nuovo
                          </button>
                        </>
                      )}
                      <button className="btn-text" onClick={() => set(p, { state: 'filled' })}>
                        Non pubblicato
                      </button>
                    </>
                  )}
                </div>
              ) : state === 'removed' ? (
                !listing.sold && (
                  <div className="status-actions">
                    <button className="btn-text" onClick={() => set(p, { state: 'idle', url: undefined, remoteId: undefined, sitePrice: undefined, siteTitle: undefined }).then(() => onReopen(p))}>
                      Ripubblica
                    </button>
                  </div>
                )
              ) : (
                <div className="status-actions">
                  <button className="btn-text" onClick={() => onReopen(p)}>
                    {state === 'idle' ? `Pubblica su ${PLATFORM_LABEL[p]}` : 'Riapri'}
                  </button>
                  <button className="btn-text" onClick={() => set(p, { state: 'published', message: undefined, missing: [], missingKeys: [] })}>
                    Segna come pubblicato
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
