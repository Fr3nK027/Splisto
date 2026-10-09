import type { Condition } from '../../lib/types'
import type { Locator } from '../dom'

/*
 * FACEBOOK MARKETPLACE — verificato 10/2026 (Facebook in italiano):
 *  - foto: input[type=file][accept^="image/*"] multiple;  Titolo, Prezzo: <label> che contiene l'input;
 *  - Categoria, Condizione: <label role="combobox">; opzioni Condizione: Nuovo / Usato - Come nuovo /
 *    Usato - Buono / Usato - Accettabile;  Descrizione e Marca sono dentro "Altri dettagli" (da espandere).
 * Dopo la compilazione il sito chiede "Avanti" e poi "Pubblica": li premi tu.
 * Facebook genera classi CSS casuali: usa solo testo delle etichette/aria-label (Facebook in italiano).
 * Verifica: apri https://www.facebook.com/marketplace/create/item, F12 > Ctrl+Maiusc+C sul campo e
 * controlla il testo della <label> o l'attributo aria-label. Se usi Facebook in inglese, sostituisci
 * con "Title", "Price", "Category", "Condition", "Description", "Brand".
 */
export default {
  url: 'https://www.facebook.com/marketplace/create/item',
  editPath: ['/marketplace/edit'],
  loginUrl: 'https://www.facebook.com/login/',
  formUrl: ['/marketplace/create'],
  loggedOut: {
    url: ['/login'],
    selectors: ['#login_form', 'form[action*="login"]', 'input[name="pass"]'] as Locator[],
  },
  // Verificato 10/2026 da loggato.
  loggedIn: ['[aria-label="Il tuo profilo"]', '[aria-label="Controlli e impostazioni account"]'] as Locator[],
  // Dopo "Pubblica" Facebook porta a "Le tue inserzioni": il link del singolo annuncio non c'è, si segna solo pubblicato.
  published: {
    item: /^https:\/\/www\.facebook\.com\/marketplace\/item\/\d+/,
    done: ['/marketplace/you/selling', '/marketplace/selling'],
  },
  // Verificato 10/2026: "I tuoi annunci" con titolo, prezzo, foto e clic; id dell'annuncio nel link "Metti in evidenza".
  mine: { url: 'https://www.facebook.com/marketplace/you/selling', match: /^https:\/\/www\.facebook\.com\/marketplace\/you\/selling\/?$/ },
  detail: { description: [], photos: 'img[alt^="Foto del prodotto"]' },
  stats: {
    views: { selectors: [] as string[], patterns: [/(\d[\d.]*)\s*(?:clic|visualizzazion|persone hanno visualizzato)/i] },
    likes: { selectors: [] as string[], patterns: [/(\d[\d.]*)\s*(?:salvataggi|persone hanno salvato|salvat)/i] },
  },
  moreDetails: 'Altri dettagli',
  // Verificato 10/2026 da loggato: le foto inserite da script vengono accettate ("Foto · 2/10" e anteprima).
  // Metti false se il sito torna a rifiutarle: restano da caricare a mano.
  uploadPhotos: true,
  // contatore delle foto caricate, es. "Foto · 2/10 - Puoi aggiungere fino a 10 foto."
  photoCount: /(\d+)\s*\/\s*10\b/,
  fields: {
    photos: ['input[type="file"][accept*="image"]', 'input[type="file"]'],
    title: [{ label: 'Titolo' }],
    price: [{ label: 'Prezzo' }],
    category: [{ label: 'Categoria' }],
    condition: [{ label: 'Condizione' }],
    description: [{ label: 'Descrizione' }],
    brand: [{ label: 'Marca' }],
  } satisfies Record<string, Locator[]>,
  conditions: {
    nuovo_cartellino: 'Nuovo',
    nuovo: 'Nuovo',
    ottimo: 'Usato - Come nuovo',
    buono: 'Usato - Buono',
    discreto: 'Usato - Accettabile',
  } satisfies Record<Condition, string>,
}
