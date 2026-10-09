import type { Condition } from '../../lib/types'
import type { Locator } from '../dom'

/*
 * SUBITO.IT — verificato 10/2026.
 * Flusso: https://www.subito.it/vendere/ (scegli la categoria) -> https://inserimento.subito.it/?category=X&type=Y
 * L'estensione salta il primo passo andando direttamente al modulo della sottocategoria (tabella `categories`).
 * Nel modulo: #title, #description, #price, foto #images-file-input (multiple), menu react-select con
 * aria-label ("Condizione dell'oggetto", "Marca", "Taglia", "Per") che si aprono con freccia giù.
 * Il pulsante "Pubblica annuncio" lo premi tu.
 */
export default {
  url: 'https://www.subito.it/vendere/',
  editPath: ['inserimento.subito.it/modifica'],
  loginUrl: 'https://areariservata.subito.it/login_form',
  formUrl: ['inserimento.subito.it', 'subito.it/vendere'],
  loggedOut: {
    url: ['areariservata.subito.it/login', '/login_form'],
    // da non loggato il menu mostra "Accedi" verso login_form (verificato 10/2026)
    selectors: ['a[href*="areariservata.subito.it/login_form"]', 'input[type="password"]'] as Locator[],
  },
  // Verificato 10/2026 da loggato.
  loggedIn: ['a[href*="areariservata.subito.it/logout"]'] /* "I tuoi annunci" c'è anche da non loggato */ as Locator[],
  // Sottocategorie -> parametri del modulo (dal menu di subito.it/vendere, 10/2026).
  categories: {
    'Orologi e gioielli': '16&type=12',
    Scarpe: '16&type=5',
    Accessori: '16&type=6',
    'Giacche e giubbotti': '16&type=2',
    'Borse e zaini': '16&type=10',
    'Vestiti e completi': '16&type=9',
    'T-shirt e camicie': '16&type=7',
    'Felpe e maglioni': '16&type=1',
    'Pantaloni e jeans': '16&type=4',
    'Intimo e pigiami': '16&type=8',
    Gonne: '16&type=3',
    Informatica: '10',
    'Console e Videogiochi': '44',
    'Audio / Video': '11',
    Fotografia: '40',
    Telefonia: '12',
    'Musica e Film': '19',
    'Libri e Riviste': '38',
    'Strumenti musicali': '39',
    Sports: '20',
    Biciclette: '41',
    Collezionismo: '21',
    'Accessori per animali': '100',
    'Abbigliamento bimbi': '17&type=1',
    "Prodotti per l'infanzia": '17&type=2',
    Giochi: '17&type=3',
    'Arredamento e Casalinghi': '14',
    Elettrodomestici: '37',
    'Giardino e Fai da te': '15',
    'Accessori auto': '5',
    'Accessori moto': '36',
  } as Record<string, string>,
  formBase: 'https://inserimento.subito.it/?category=',
  // Passo 1: campo "Scrivi l'oggetto del tuo annuncio" e categorie proposte (link a inserimento.subito.it). Verificato 10/2026.
  subject: ['#ad_name', 'input[name="ad_name"]'] as Locator[],
  suggestion: '#suggestions-autocomplete a[href*="inserimento.subito.it"]',
  // Dopo l'inserimento Subito mette l'annuncio in revisione: il link arriva dopo. Se lo trova, lo salva.
  published: {
    item: /^https:\/\/www\.subito\.it\/[^?#]*\d{6,}\.htm/,
    done: ['success', 'conferma', 'inserito'],
  },
  // Verificato 10/2026: "I tuoi annunci" con titolo, prezzo, foto, visite; "Statistiche" con visite e preferiti.
  mine: { url: 'https://areariservata.subito.it/annunci', match: /^https:\/\/areariservata\.subito\.it\/annunci\/?$/ },
  detail: { description: ['p[class*="__description"]'], photos: 'img[src*="images.sbito.it"][src*="rule=gallery"]' },
  stats: {
    views: { selectors: [] as string[], patterns: [/Visite\s*(\d[\d.]*)/, /(\d[\d.]*)\s*(?:visualizzazion|visite)/i, /(?:visualizzazioni|visite)\s*:?\s*(\d[\d.]*)/i] },
    likes: { selectors: [] as string[], patterns: [/Preferiti\s*(\d[\d.]*)/, /(\d[\d.]*)\s*(?:preferit|salvat)/i, /(?:preferiti|salvato)\s*:?\s*(\d[\d.]*)/i] },
  },
  // Verificato 10/2026 da loggato: le foto inserite da script vengono accettate (anteprime, "3/6", nessun errore).
  // Se il sito torna a rifiutarle ("Caricamento fallito") metti false: restano da caricare a mano.
  uploadPhotos: true,
  maxPhotos: 6, // Subito ne accetta al massimo 6
  fields: {
    photos: ['#images-file-input', 'input[name="images"]', 'input[type="file"][accept*="image"]'],
    title: ['#title', 'input[name="title"]', { label: 'Titolo' }],
    description: ['#description', 'textarea[name="description"]', { label: 'Descrizione' }],
    price: ['#price', 'input[name="price"]', { label: 'Prezzo' }],
    condition: ['input[aria-label="Condizione dell\'oggetto"]', '#react-select-itemCondition-input', { label: 'Condizione' }],
    brand: ['input[aria-label="Marca"]', '#react-select-fashionBrand-input'],
    size: ['input[aria-label="Taglia"]', '#react-select-fashionSize-input'],
    gender: ['input[aria-label="Per"]', '#react-select-clothingGender-input'],
    location: ['#location', 'input[name="location"]'],
  } satisfies Record<string, Locator[]>,
  // Opzioni reali: "Nuovo - mai usato in confezione originale", "Come nuovo - perfetto o ricondizionato",
  // "Ottimo - poco usato e ben conservato", "Buono - usato ma ben conservato", "Danneggiato - usato con parti guaste".
  conditions: {
    nuovo_cartellino: 'Nuovo',
    nuovo: 'Come nuovo',
    ottimo: 'Ottimo',
    buono: 'Buono',
    discreto: 'Buono',
  } satisfies Record<Condition, string>,
}
