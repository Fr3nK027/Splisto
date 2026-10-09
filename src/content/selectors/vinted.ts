import type { Condition } from '../../lib/types'
import type { Locator } from '../dom'

/*
 * VINTED — verificato 10/2026 con un test reale (foto, titolo, descrizione, categoria, marca, taglia,
 * condizione, colore, prezzo compilati; nessuna pubblicazione). Taglia/condizione/pacco compaiono dopo la categoria.
 * La categoria è un menu ad albero con ricerca "Cerca una categoria": un nome solo (es. "Jeans skinny") viene cercato.
 * Come verificarli: apri https://www.vinted.it/items/new (da loggato), F12 > Elements,
 * Ctrl+Maiusc+C e clicca sul campo. Cerca attributi stabili: data-testid, id, name, aria-label.
 * In Console puoi provare: document.querySelector('[data-testid="title--input"]')
 * Ogni lista è provata in ordine: il primo che trova un elemento vince.
 */
export default {
  url: 'https://www.vinted.it/items/new',
  editPath: ['/edit'],
  loginUrl: 'https://www.vinted.it/member/signup/select_type',
  formUrl: ['/items/new'],
  loggedOut: {
    url: ['/member/signup', '/member/login', 'select_type'],
    selectors: ['[data-testid="auth-select-type"]', '[data-testid="auth-modal"]', 'input[type="password"]'] as Locator[],
  },
  // Verificato 10/2026 da loggato.
  loggedIn: ['[data-testid="user-menu-button"]', '[data-testid="header-conversations-button"]', '[data-testid="title--input"]'] as Locator[],
  // Dopo "Carica" Vinted apre la pagina dell'annuncio: da lì si salva il link.
  published: {
    item: /^https:\/\/www\.vinted\.it\/items\/\d+/,
    done: [] as string[],
  },
  // Statistiche lette dalla pagina del TUO annuncio (selettori, poi testo della pagina).
  // Verifica: apri un tuo annuncio e cerca il numero di visualizzazioni e di preferiti.
  // Verificato 10/2026: il profilo (/member/<id>) mostra i tuoi articoli con visualizzazioni e preferiti.
  // L'URL del profilo si trova dal menu utente: l'importazione parte dalla home e ci arriva da sola.
  mine: { url: 'https://www.vinted.it/', match: /^https:\/\/www\.vinted\.it\/member\/(\d+)(?:-[^/]*)?\/?$/ },
  detail: { description: ['[itemprop="description"]'], photos: '[data-testid^="item-photo-"] img' },
  stats: {
    views: { selectors: ['[data-testid*="view-count"]'], patterns: [/(\d[\d.]*)\s*visualizzazion/i, /visualizzazioni\s*:?\s*(\d[\d.]*)/i] },
    // Verificato 10/2026: [data-testid="favourite-button"] con aria-label "… Aggiunto ai preferiti da 2 utenti".
    likes: {
      selectors: [] as string[],
      patterns: [/preferiti da (\d[\d.]*) utent/i, /(\d[\d.]*)\s*(?:preferit|persone (?:l'hanno|lo hanno) aggiunto)/i],
    },
  },
  // "Cancella" sulla pagina del tuo annuncio, poi la conferma nella finestra (data-testid dal codice di Vinted, 10/2026)
  remove: ['[data-testid="item-delete-button"]', '[data-testid="item-delete-confirmation-button"]'] as Locator[],
  probe: [
    { key: 'photos', label: 'Foto' },
    { key: 'title', label: 'Titolo' },
    { key: 'description', label: 'Descrizione' },
    { key: 'price', label: 'Prezzo' },
  ],
  fields: {
    photos: ['[data-testid="add-photos-input"]', 'input[type="file"][accept*="image"]', 'input[type="file"]'],
    title: ['[data-testid="title--input"]', 'input#title', 'input[name="title"]', { label: 'Titolo' }],
    description: ['[data-testid="description--input"]', 'textarea#description', 'textarea[name="description"]', { label: 'Descrivi' }, { label: 'Descrizione' }],
    // Menu a tendina: l'estensione clicca il campo e poi l'opzione col testo voluto.
    category: ['[data-testid="catalog-select-dropdown-input"]', 'input#category', 'input[name="category"]', { label: 'Categoria' }],
    brand: ['[data-testid="brand-select-dropdown-input"]', 'input#brand', 'input[name="brand"]', { label: 'Marca' }],
    size: ['[data-testid="category-size-single-grid-input"]', '[data-testid="size-select-dropdown-input"]', { label: 'Taglia' }],
    condition: ['[data-testid="category-condition-single-list-input"]', '[data-testid="status-select-dropdown-input"]', { label: 'Condizioni' }],
    color: ['[data-testid="color-select-dropdown-input"]', 'input#color', 'input[name="color"]', { label: 'Colore' }],
    price: ['[data-testid="price-input--input"]', 'input#price', 'input[name="price"]', { label: 'Prezzo' }],
  } satisfies Record<string, Locator[]>,
  // Testo delle opzioni "Condizioni" su Vinted.
  conditions: {
    nuovo_cartellino: 'Nuovo con cartellino',
    nuovo: 'Nuovo senza cartellino',
    ottimo: 'Ottime',
    buono: 'Buone',
    discreto: 'Discrete',
  } satisfies Record<Condition, string>,
  // Pacchi (radio): cambiano con la categoria, si sceglie leggendo quelli mostrati (vedi adapters/vinted.ts)
  packages: 'input[data-testid^="package_type_selector_"]',
}
