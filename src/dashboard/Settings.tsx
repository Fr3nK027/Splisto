import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { testAi } from '../lib/ai'
import { exportAll, importAll } from '../lib/db'
import { PLATFORM_LABEL } from '../lib/platforms'
import { MODEL_RE, originPattern, PROVIDER_IDS, PROVIDERS, resolveAi, validBaseUrl, type ProviderId } from '../lib/providers'
import { getApiKey, setApiKey } from '../lib/secret'
import { cleanSettings, DEFAULT_SETTINGS, getSettings, learnedKey, setSettings, TONE_LABEL, type Settings as S, type Tone } from '../lib/settings'
import { PLATFORMS } from '../lib/types'

export function Settings() {
  const [s, setS] = useState<S>(DEFAULT_SETTINGS)
  const [key, setKey] = useState('')
  const [learned, setLearned] = useState(0)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [aiNote, setAiNote] = useState('')
  const ai = s.ai
  const prov = PROVIDERS[ai.provider] ?? PROVIDERS.anthropic

  async function countLearned() {
    const all = await chrome.storage.local.get(PLATFORMS.map(learnedKey))
    setLearned(Object.values(all).reduce((n: number, v) => n + Object.keys(v ?? {}).length, 0))
  }

  useEffect(() => {
    void getSettings().then(setS)
    void countLearned()
  }, [])
  // ogni servizio ha la sua chiave
  useEffect(() => void getApiKey(ai.provider).then(setKey), [ai.provider])

  /** Aggiorna e salva subito (campi semplici). */
  const save = (patch: Partial<S>) => {
    setS({ ...s, ...patch })
    void setSettings(patch)
  }

  const setAi = (patch: Partial<typeof ai>) => setS({ ...s, ai: { ...ai, ...patch } })

  /** Salva servizio, modello e chiave; per i servizi diversi da Claude chiede il permesso di contattarne l'indirizzo. */
  async function saveAi(): Promise<boolean> {
    const fail = (m: string) => (setAiNote(m), false)
    setAiNote('')
    const k = key.trim()
    // chiave di un altro servizio incollata qui (es. chiave Google con "Claude" selezionato): si passa al servizio giusto
    const guessed: ProviderId | null = /^(AIza|AQ\.)/.test(k) ? 'gemini' : k.startsWith('sk-ant-') ? 'anthropic' : null
    const cur = guessed && guessed !== ai.provider && ai.provider !== 'custom' ? { provider: guessed, model: '', baseUrl: '' } : { ...ai, model: ai.model.trim().replace(/^models\//, ''), baseUrl: ai.baseUrl.trim() }
    const p = PROVIDERS[cur.provider]
    if (cur.provider !== ai.provider) setS({ ...s, ai: cur })
    const r = resolveAi(cur)
    if (!r.baseUrl || !validBaseUrl(r.baseUrl)) return fail('Indirizzo dell’API non valido: usa https:// (o http://localhost per Ollama).')
    if (!MODEL_RE.test(r.model)) return fail('Nome del modello non valido.')
    if (cur.provider === 'gemini' && !/^(gemini|gemma)-/i.test(r.model)) {
      return fail('Per Gemini il modello si chiama per esempio “gemini-flash-latest”: lascia vuoto per usare quello predefinito. Nome e numero del progetto non servono, basta la chiave.')
    }
    if (cur.provider === 'anthropic' && k && !k.startsWith('sk-ant-')) return fail('La chiave Anthropic inizia con “sk-ant-”.')
    // per primo: il browser chiede il permesso solo subito dopo un clic
    if (cur.provider !== 'anthropic') {
      let granted = false
      try {
        granted = await chrome.permissions.request({ origins: [originPattern(r.baseUrl)] })
      } catch (e) {
        return fail(`Permesso non richiesto: ${(e as Error).message}. Riprova premendo il pulsante.`)
      }
      if (!granted) return fail(`Senza il permesso l’estensione non può contattare ${new URL(r.baseUrl).host}: premi di nuovo e scegli “Consenti”.`)
    }
    if (!p.noKey) await setApiKey(k, cur.provider)
    await setSettings({ ai: cur })
    setAiNote(`${p.label} salvato${cur.provider !== ai.provider ? ' (la chiave è di questo servizio: l’ho scelto io)' : ''}. ${k || p.noKey ? 'Premi “Salva e prova” per verificare.' : 'Manca la chiave.'}`)
    return true
  }

  async function tryAi() {
    if (!(await saveAi())) return
    setAiNote('Provo…')
    try {
      setAiNote(`Funziona. Risposta: “${(await testAi()).slice(0, 60)}”`)
    } catch (e) {
      setAiNote((e as Error).message)
    }
  }

  async function doExport() {
    try {
      // la chiave API sta in un archivio separato: non finisce mai nel backup
      const url = URL.createObjectURL(await exportAll({ ...(await getSettings()) }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `splisto-backup-${new Date().toISOString().slice(0, 10)}.json` })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setErr('')
      setMsg('Backup esportato.')
    } catch (e) {
      setErr(`Esportazione non riuscita: ${(e as Error).message}`)
    }
  }

  async function doImport(file: File) {
    try {
      const { count, settings } = await importAll(file)
      await setSettings(cleanSettings(settings))
      setS(await getSettings())
      setErr('')
      setMsg(`Importati ${count} annunci.`)
    } catch (e) {
      setErr(e instanceof SyntaxError ? 'Il file non è un JSON valido.' : (e as Error).message)
    }
  }

  async function resetLearned() {
    if (!confirm('Dimenticare tutti i campi insegnati? Verranno usati solo i selettori dei file.')) return
    await chrome.storage.local.remove(PLATFORMS.map(learnedKey))
    await countLearned()
    setMsg('Campi insegnati dimenticati.')
  }

  return (
    <>
      <header className="bar">
        <a className="btn-text back" href="#/">
          <ArrowLeft size={16} /> Annunci
        </a>
      </header>
      <h1>Impostazioni</h1>

      <section className="card">
        <h2>Intelligenza artificiale (funzioni ✨)</h2>
        <p className="hint">
          Scegli il servizio che scrive titoli e descrizioni e guarda le foto. Testo e foto dell’annuncio vanno solo al servizio scelto;
          la chiave resta in questo browser, in un archivio separato dagli annunci (mai nei backup).
        </p>
        <label className="check spaced">
          <span className="hint">Servizio</span>
          <select value={ai.provider} onChange={(e) => setAi({ provider: e.target.value as ProviderId, model: '', baseUrl: '' })}>
            {PROVIDER_IDS.map((id) => (
              <option key={id} value={id}>
                {PROVIDERS[id].label}
              </option>
            ))}
          </select>
        </label>
        <p className="hint spaced">
          {prov.note}{' '}
          {prov.keyUrl && (
            <a className="btn-text" href={prov.keyUrl} target="_blank" rel="noreferrer">
              Crea la chiave ↗
            </a>
          )}
        </p>
        {!prov.noKey && (
          <div className="field">
            <label htmlFor="ai-key">Chiave API</label>
            <input id="ai-key" type="password" autoComplete="off" spellCheck={false} placeholder={ai.provider === 'anthropic' ? 'sk-ant-…' : 'Incolla la chiave'} value={key} onChange={(e) => setKey(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="ai-model">Modello</label>
          <input id="ai-model" spellCheck={false} placeholder={prov.model || 'nome del modello'} value={ai.model} onChange={(e) => setAi({ model: e.target.value })} />
        </div>
        {(ai.provider === 'custom' || ai.provider === 'ollama') && (
          <div className="field">
            <label htmlFor="ai-url">Indirizzo dell’API</label>
            <input id="ai-url" type="url" spellCheck={false} placeholder={prov.baseUrl || 'https://…/v1'} value={ai.baseUrl} onChange={(e) => setAi({ baseUrl: e.target.value })} />
          </div>
        )}
        <div className="inline-form">
          <button className="btn-text accent" onClick={saveAi}>
            Salva
          </button>
          <button className="btn-text" onClick={tryAi}>
            Salva e prova
          </button>
        </div>
        {aiNote && <p className="hint spaced">{aiNote}</p>}
        <label className="check spaced">
          <span className="hint">Tono predefinito</span>
          <select value={s.tone} onChange={(e) => save({ tone: e.target.value as Tone })}>
            {Object.entries(TONE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Compilazione</h2>
        <label className="check">
          <input type="checkbox" checked={s.sequential} onChange={(e) => save({ sequential: e.target.checked })} />
          Un sito alla volta, in primo piano (consigliato)
        </label>
        <p className="hint spaced">
          Più lento ma più affidabile: nelle schede in background alcuni siti non aprono i menu a tendina. Disattiva per aprire
          tutti i siti insieme.
        </p>
        <p className="hint spaced">
          Campi insegnati con “Insegna”: {learned}.{' '}
          {learned > 0 && (
            <button className="btn-text" onClick={resetLearned}>
              Dimentica
            </button>
          )}
        </p>
      </section>

      <section className="card">
        <h2>Controllo accessi e importazione</h2>
        <p className="hint">
          Se lo accendi, ogni tanto l’estensione apre per pochi secondi, in background, una pagina di ogni sito e guarda se sei
          ancora loggato. Se sei stato disconnesso ricevi una notifica di Windows e sull’icona compare il numero di siti da sistemare.
          Subito dopo legge la pagina dei tuoi annunci su ogni sito e importa quelli nuovi (per esempio messi dal telefono), con foto,
          descrizione e statistiche. Spento, l’estensione non fa nulla finché non premi un pulsante.
        </p>
        <label className="check">
          <span className="hint">Controlla</span>
          <select value={s.authEvery} onChange={(e) => save({ authEvery: Number(e.target.value) })}>
            <option value={0}>Mai (solo con “Verifica accessi”)</option>
            <option value={3}>Ogni 3 ore</option>
            <option value={6}>Ogni 6 ore</option>
            <option value={12}>Ogni 12 ore</option>
            <option value={24}>Una volta al giorno</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Chiusura della descrizione</h2>
        <p className="hint">Aggiunta in fondo a ogni annuncio (es. spedizione, ritiro a mano, pagamenti). Prima quella generale, poi quella del sito.</p>
        <div className="field">
          <label htmlFor="footer-all">Tutti i siti</label>
          <textarea
            id="footer-all"
            rows={3}
            value={s.footers.all ?? ''}
            onChange={(e) => setS({ ...s, footers: { ...s.footers, all: e.target.value } })}
            onBlur={() => void setSettings({ footers: s.footers })}
            placeholder="Spedisco in 24/48 ore, imballo con cura. Possibile ritiro a mano a …"
          />
        </div>
        <details className="per-platform">
          <summary>Per sito</summary>
          {PLATFORMS.map((p) => (
            <div key={p} className="field">
              <label htmlFor={`footer-${p}`}>{PLATFORM_LABEL[p]}</label>
              <textarea
                id={`footer-${p}`}
                rows={2}
                value={s.footers[p] ?? ''}
                onChange={(e) => setS({ ...s, footers: { ...s.footers, [p]: e.target.value } })}
                onBlur={() => void setSettings({ footers: s.footers })}
              />
            </div>
          ))}
        </details>
      </section>

      <section className="card">
        <h2>Commissioni per il netto</h2>
        <p className="hint">Quanto trattiene ogni sito al venditore. Servono a calcolare “Incassi circa”. Controlla le tariffe attuali sul sito: cambiano spesso.</p>
        {PLATFORMS.map((p) => (
          <div key={p} className="fee-row">
            <span>{PLATFORM_LABEL[p]}</span>
            <label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={s.fees[p].pct}
                onChange={(e) => save({ fees: { ...s.fees, [p]: { ...s.fees[p], pct: Number(e.target.value) || 0 } } })}
                aria-label={`Commissione percentuale ${PLATFORM_LABEL[p]}`}
              />
              <span className="hint">%</span>
            </label>
            <label>
              <span className="hint">+</span>
              <input
                type="number"
                min="0"
                step="0.05"
                value={s.fees[p].fixed}
                onChange={(e) => save({ fees: { ...s.fees, [p]: { ...s.fees[p], fixed: Number(e.target.value) || 0 } } })}
                aria-label={`Costo fisso ${PLATFORM_LABEL[p]}`}
              />
              <span className="hint">€</span>
            </label>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="hint">
          Esporta annunci, foto e impostazioni in un file JSON. La chiave API non viene inclusa. Importando, gli annunci con lo stesso id
          vengono sostituiti.
        </p>
        <div className="inline-form">
          <button className="btn-text accent" onClick={doExport}>
            Esporta backup
          </button>
          <label className="btn-text accent">
            Importa backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void doImport(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </section>

      {err && <p className="error-text">{err}</p>}
      {!err && msg && <p className="hint">{msg}</p>}
    </>
  )
}
