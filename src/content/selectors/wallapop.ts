import type { Condition } from '../../lib/types'
import type { Locator } from '../dom'

/*
 * WALLAPOP (it.wallapop.com) — verificato 10/2026 da loggato.
 * - Da non loggato /app/catalog/upload rimanda a /auth/onboarding?redirectUrl=...
 * - Annuncio nuovo: /app/catalog/upload -> "Cosa pubblicherai?" -> "Qualcosa che non uso più" (/upload/consumer-goods)
 *   -> "Riepilogo del prodotto" (#summary) + Continua -> Foto + Continua -> modulo. I "Continua" li premi tu.
 * - Modifica: /app/catalog/edit/<id>, dove <id> (es. "w674yqopg76x") non è nel link dell'annuncio ma nei dati della
 *   sua pagina (__NEXT_DATA__ props.pageProps.item.id): l'estensione apre l'annuncio e da lì va alla modifica.
 *   Campi: #title, #description, #price_amount ("70.00"), menu walla-dropdown "Stato*", "Categoria e sottocategoria".
 * Il pulsante di pubblicazione lo premi tu.
 */
export default {
  url: 'https://it.wallapop.com/app/catalog/upload',
  editPath: ['/app/catalog/edit/'],
  loginUrl: 'https://it.wallapop.com/auth/onboarding',
  formUrl: ['/app/catalog/upload'],
  // passo "Riepilogo del prodotto" del modulo nuovo
  summary: ['#summary', 'input[name="summary"]'] as Locator[],
  loggedOut: {
    url: ['/auth/'],
    selectors: ['input[type="password"]'] as Locator[],
  },
  // Menu laterale da loggato: Portafoglio e profilo (verificato 10/2026; la pagina di caricamento da loggato
  // mostra prima "Cosa pubblicherai?", senza modulo).
  loggedIn: ['a[href="/app/wallet"]', 'a[href="/app/profile/info"]', 'a[href="/app/purchases"]'] as Locator[],
  // Scelta iniziale "Cosa pubblicherai?" (Qualcosa che non uso più, Lavoro, Servizi, Un auto, Un immobile).
  firstStep: 'Qualcosa che non uso più',
  published: {
    item: /^https:\/\/[a-z]+\.wallapop\.com\/item\/[^/?#]+/,
    done: ['/app/catalog/published', '/app/catalog/list'],
  },
  // Verificato 10/2026: "I tuoi articoli", schede .CatalogItem__content con prezzo, titolo e link /item/<slug>-<id>.
  mine: { url: 'https://it.wallapop.com/app/catalog/published', match: /^https:\/\/[a-z]+\.wallapop\.com\/app\/catalog\/published\/?$/ },
  // la pagina dell'annuncio si legge dai suoi dati (__NEXT_DATA__), vedi importers.ts
  detail: { description: [] as string[], photos: 'img[src*="cdn.wallapop.com"]' },
  stats: {
    views: { selectors: [] as string[], patterns: [/(\d[\d.]*)\s*visualizzazion/i, /visualizzazioni\s*:?\s*(\d[\d.]*)/i] },
    likes: { selectors: [] as string[], patterns: [/(\d[\d.]*)\s*preferit/i, /preferiti\s*:?\s*(\d[\d.]*)/i] },
  },
  uploadPhotos: true,
  fields: {
    photos: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
    title: ['#title', 'input[name="title"]', { label: 'Titolo' }],
    description: ['#description', 'textarea[name="description"]', { label: 'Descrizione' }],
    price: ['#price_amount', 'input[name="price_amount"]', { label: 'Prezzo' }],
    category: ['walla-dropdown:has(#category_leaf_id)', { label: 'Categoria e sottocategoria' }],
    condition: ['walla-dropdown[aria-label^="Stato"]', 'walla-dropdown:has(#condition)', { label: 'Stato' }],
    brand: ['[formcontrolname="brand"]', { label: 'Marca' }],
    size: ['[formcontrolname="size"]', { label: 'Taglia' }],
  } satisfies Record<string, Locator[]>,
  // Testi parziali: vince l'opzione che inizia con / contiene questo testo.
  conditions: {
    nuovo_cartellino: 'Nuovo',
    nuovo: 'Come nuovo',
    ottimo: 'Come nuovo',
    buono: 'buon',
    discreto: 'accettabil',
  } satisfies Record<Condition, string>,
}
