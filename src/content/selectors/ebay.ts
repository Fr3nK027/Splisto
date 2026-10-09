import type { Condition } from '../../lib/types'
import type { Locator } from '../dom'

/*
 * EBAY.IT — pagina "Modifica" (/lstng?mode=ReviseItem, poi /lstng?draftId=…&mode=ReviseItem) verificata 10/2026:
 * input[name=title], input[name=price] ("499,99"), descrizione in iframe[title=Descrizione] con un div contenteditable.
 * Modulo nuovo verificato 10/2026 (/lstng?draftId=…&mode=AddItem): stessi campi; specifiche come
 * <button name="attributes.Marca|Taglia|Colore"> che aprono un menu con ricerca; niente campo peso
 * (c'è solo "Dimensioni del pacco", un preset tipo "Pacco fino a 2 kg").
 * Il flusso eBay (verificato 10/2026):
 *  1. /sl/prelist/suggest  -> campo "cosa vendi": l'estensione scrive il titolo e si ferma.
 *  2. /sl/prelist/identify -> categoria, "Trova una corrispondenza", condizione: li scegli tu.
 *  3. /lstng?...           -> modulo completo: l'estensione lo compila da sola quando ci arrivi.
 * Verifica: F12 > Ctrl+Maiusc+C sul campo; preferisci name/aria-label. La descrizione di solito è un
 * editor dentro un <iframe>: seleziona l'iframe e annota title/id.
 */
export default {
  url: 'https://www.ebay.it/sl/prelist/suggest',
  editPath: ['/lstng'],
  loginUrl: 'https://signin.ebay.it/ws/eBayISAPI.dll?SignIn&ru=https%3A%2F%2Fwww.ebay.it%2F',
  formUrl: ['/sl/prelist', '/lstng', '/sl/list'],
  prelistUrl: ['/sl/prelist'],
  suggestUrl: ['/sl/prelist/suggest'],
  // Il controllo accessi usa la home: la pagina "vendi" mostra il campo di ricerca anche a chi eBay riconosce
  // ma non ha fatto l'accesso (verificato 10/2026). Da non loggato la home mostra "Ciao! Accedi o registrati".
  authUrl: 'https://www.ebay.it/',
  loggedOut: {
    url: ['signin.ebay', '/signin/'],
    selectors: ['a[href*="signup.ebay.it"]', '#signin-form', 'input#userid', 'input[type="password"]'] as Locator[],
  },
  // Da loggato in cima alla pagina c'è il saluto col nome: "Hi Francesco!" su ebay.com (verificato 10/2026),
  // "Ciao <nome>!" su ebay.it; da non loggato "Ciao! Accedi o registrati" (senza nome).
  loggedIn: [] as Locator[],
  loggedInText: /\b(?:Ciao|Hi)\s+(?!Accedi|Sign)[^\s!]+!/,
  // Dopo "Metti in vendita" eBay mostra una pagina di conferma con il link all'oggetto (/itm/...).
  published: {
    item: /^https:\/\/www\.ebay\.it\/itm\/(?:[^/?#]+\/)?\d{6,}/,
    done: ['/sl/success', 'success'],
  },
  // I tuoi annunci attivi: My eBay su ebay.com (verificato 10/2026, sessione di ebay.com). Ogni scheda (#mainContent
  // div.columns) ha titolo, "Item ID", "EUR 799.00", visualizzazioni ("7 Views") e osservatori ("1 Watcher").
  // Con l'accesso anche su ebay.it la stessa pagina c'è su www.ebay.it/mys/active (verificato 10/2026).
  mine: { url: 'https://www.ebay.com/mys/active', match: /^https:\/\/www\.ebay\.(?:com|it)\/mys\/(?:active|overview)\/?$/ },
  // Pagina dell'annuncio: foto in .ux-image-carousel (grandi in data-zoom-src); la descrizione è in un iframe
  // su itm.ebaydesc.com, scaricato a parte dal service worker.
  detail: { description: [] as string[], photos: '.ux-image-carousel img' },
  stats: {
    views: { selectors: [] as string[], patterns: [/(\d[\d.]*)\s*visualizzazion/i, /visualizzazioni\s*:?\s*(\d[\d.]*)/i] },
    likes: {
      selectors: [] as string[],
      patterns: [/(\d[\d.]*)\s*(?:osservator|utenti (?:lo |la )?(?:stanno )?osserv|persone (?:lo |la )?(?:stanno )?osserv)/i, /osservat[oi]\s*:?\s*(\d[\d.]*)/i],
    },
  },
  fields: {
    // Attenzione a non prendere la barra di ricerca in alto (name="_nkw").
    // Verificato 10/2026: <input aria-label="Dicci cosa vuoi vendere" id="…@keyword-@box-@input-textbox">
    keywords: ['input[aria-label="Dicci cosa vuoi vendere"]', 'input[id*="keyword"]', { label: 'Dicci cosa' }, 'input[name="keywords"]'],
    photos: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
    title: ['input[name="title"]', { label: 'Titolo' }],
    price: ['input[name="price"]', { label: 'Prezzo' }],
    description: ['iframe[title*="escrizione"]', 'iframe[id*="rte"]', 'textarea[name="description"]', '[contenteditable="true"][aria-label*="escrizione"]'],
    condition: ['select[name="condition"]', { label: 'Condizione' }],
    // Specifiche oggetto: di solito pulsanti che aprono un menu con ricerca.
    brand: ['button[name="attributes.Marca"]', { label: 'Marca' }],
    size: ['button[name="attributes.Taglia"]', { label: 'Taglia' }], // senza aria-label: solo il name
    color: ['button[name="attributes.Colore"]', { label: 'Colore' }],
    weight: ['input[name="majorWeight"]', { label: 'Peso' }], // solo nel modulo «avanzato»
  } satisfies Record<string, Locator[]>,
  conditions: {
    nuovo_cartellino: 'Nuovo con cartellino',
    nuovo: 'Nuovo',
    ottimo: 'Usato',
    buono: 'Usato',
    discreto: 'Usato',
  } satisfies Record<Condition, string>,
}
