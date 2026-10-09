import { PLATFORMS, type Condition, type Listing, type Platform } from './types.ts' // .ts: i test con node lo caricano davvero

/** Siti dove l'annuncio è online. */
export const publishedOn = (l: Pick<Listing, 'status'>) => PLATFORMS.filter((p) => l.status[p]?.state === 'published')

export const PLATFORM_LABEL: Record<Platform, string> = {
  vinted: 'Vinted',
  ebay: 'eBay',
  subito: 'Subito',
  facebook: 'Facebook Marketplace',
  wallapop: 'Wallapop',
}

// Limiti di caratteri del titolo. Verificali sul sito se cambiano: l'editor usa il più basso
// tra le piattaforme selezionate.
export const TITLE_MAX: Record<Platform, number> = {
  vinted: 100,
  ebay: 80,
  subito: 50,
  facebook: 100,
  wallapop: 50, // da verificare
}

export const CONDITION_LABEL: Record<Condition, string> = {
  nuovo_cartellino: 'Nuovo con cartellino',
  nuovo: 'Nuovo',
  ottimo: 'Ottimo',
  buono: 'Buono',
  discreto: 'Discreto',
}

/**
 * Categorie comuni con la mappatura di default per piattaforma.
 * Il valore è il testo da cercare nel menu categoria del sito; "A > B > C" = clic in sequenza.
 * Un solo nome (senza ">") viene scritto nel campo di ricerca del menu, se c'è: su Vinted conviene la
 * sottocategoria finale (es. "Jeans skinny"), che il menu ad albero richiede comunque.
 * Vinted (verificato 10/2026): Donna, Uomo, Articoli griffati, Bambini, Casa, Elettronica, Libri e media,
 * Hobby e collezionismo, Sport; Donna > Vestiti/Scarpe/Borse/Accessori/Bellezza.
 * Subito (verificato 10/2026): sottocategorie del menu di subito.it/vendere (tabella in selectors/subito.ts).
 * Facebook (verificato 10/2026): i testi delle categorie qui sotto esistono tutti nel menu.
 * Wallapop (non verificato): testi parziali delle categorie principali, vince quella che inizia così.
 * Per eBay la categoria la sceglie l'utente dopo aver inserito il titolo: il testo è un suggerimento.
 * Si può sovrascrivere per singolo annuncio nella sezione "Campi per piattaforma".
 */
export const CATEGORIES: Record<string, { label: string } & Record<Platform, string>> = {
  donna: { label: 'Abbigliamento donna', vinted: 'Donna > Vestiti', ebay: 'Abbigliamento donna', subito: 'Vestiti e completi', facebook: 'Abbigliamento e scarpe da donna', wallapop: 'Moda' },
  uomo: { label: 'Abbigliamento uomo', vinted: 'Uomo > Vestiti', ebay: 'Abbigliamento uomo', subito: 'Vestiti e completi', facebook: 'Abbigliamento e scarpe da uomo', wallapop: 'Moda' },
  scarpe: { label: 'Scarpe', vinted: 'Donna > Scarpe', ebay: 'Scarpe', subito: 'Scarpe', facebook: 'Abbigliamento e scarpe da donna', wallapop: 'Moda' },
  borse: { label: 'Borse e accessori', vinted: 'Donna > Borse', ebay: 'Borse', subito: 'Borse e zaini', facebook: 'Borse e valigie', wallapop: 'Moda' },
  bambini: { label: 'Bambini', vinted: 'Bambini', ebay: 'Bambini', subito: 'Abbigliamento bimbi', facebook: 'Neonati e bambini', wallapop: 'Bambini' },
  elettronica: { label: 'Elettronica', vinted: 'Elettronica', ebay: 'Elettronica', subito: 'Audio / Video', facebook: 'Elettronica e computer', wallapop: 'Tecnologia' },
  telefonia: { label: 'Telefonia', vinted: 'Elettronica', ebay: 'Cellulari e smartphone', subito: 'Telefonia', facebook: 'Cellulari', wallapop: 'Cellulari' },
  libri: { label: 'Libri', vinted: 'Libri e media', ebay: 'Libri', subito: 'Libri e Riviste', facebook: 'Libri, film e musica', wallapop: 'Cinema' },
  casa: { label: 'Casa', vinted: 'Casa', ebay: 'Casa', subito: 'Arredamento e Casalinghi', facebook: 'Articoli per la casa', wallapop: 'Casa' },
  giochi: { label: 'Giochi e giocattoli', vinted: 'Bambini', ebay: 'Giocattoli', subito: 'Giochi', facebook: 'Giocattoli e videogiochi', wallapop: 'Bambini' },
  sport: { label: 'Sport', vinted: 'Sport', ebay: 'Sport', subito: 'Sports', facebook: "Sport e attività all'aperto", wallapop: 'Sport' },
  altro: { label: 'Altro', vinted: '', ebay: '', subito: '', facebook: 'Varie', wallapop: 'Altro' },
}

export function categoryFor(l: Pick<Listing, 'category' | 'categoryOverride'>, p: Platform): string {
  return l.categoryOverride[p]?.trim() || CATEGORIES[l.category]?.[p] || ''
}

/** Limite del titolo principale: il più basso tra i siti scelti che non hanno un titolo proprio. */
export function titleLimit(platforms: Platform[], overrides: Listing['titleOverride'] = {}): number {
  const use = platforms.filter((p) => !overrides[p]?.trim())
  return Math.min(...(use.length ? use : (Object.keys(TITLE_MAX) as Platform[])).map((p) => TITLE_MAX[p]))
}

// Siti con prezzi solo in euro interi (campo senza decimali): si arrotonda prima di compilare e di confrontare.
const WHOLE_EUROS: Partial<Record<Platform, true>> = { subito: true, facebook: true }
/** Prezzo come va scritto su quel sito. */
export const sitePriceFor = (l: Pick<Listing, 'price' | 'priceOverride'>, p: Platform) => {
  const v = priceFor(l, p)
  return v != null && WHOLE_EUROS[p] ? Math.round(v) : v
}

export const titleFor = (l: Pick<Listing, 'title' | 'titleOverride'>, p: Platform) => l.titleOverride[p]?.trim() || l.title
export const priceFor = (l: Pick<Listing, 'price' | 'priceOverride'>, p: Platform) => l.priceOverride[p] ?? l.price

/** Dopo quanti giorni online senza vendita suggerire un ribasso. */
export const STALE_DAYS = 14

export const ebaySoldSearch = (q: string) =>
  `https://www.ebay.it/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`

const normTitle = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Cosa è diverso tra Splisto e l'annuncio online su quel sito (vuoto = allineato o non verificabile).
 * Il titolo conta solo se diverso anche come inizio: i siti lo tagliano a lunghezze diverse.
 */
export function outOfSync(l: Listing, p: Platform): string[] {
  const s = l.status[p]
  if (s?.state !== 'published' || l.sold) return []
  const out: string[] = []
  const price = sitePriceFor(l, p)
  if (s.sitePrice != null && price != null && Math.abs(s.sitePrice - price) >= 0.01) out.push('prezzo')
  if (s.siteTitle) {
    const a = normTitle(titleFor(l, p))
    const b = normTitle(s.siteTitle)
    if (a && b && !a.startsWith(b) && !b.startsWith(a)) out.push('titolo')
  }
  return out
}
