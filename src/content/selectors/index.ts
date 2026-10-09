import type { Platform } from '../../lib/types'
import type { Locator } from '../dom'
import ebay from './ebay'
import facebook from './facebook'
import subito from './subito'
import vinted from './vinted'
import wallapop from './wallapop'

interface StatSource {
  selectors: string[]
  patterns: RegExp[]
}

export interface Site {
  url: string
  formUrl: string[]
  /** Parti dell'URL della pagina "Modifica" di un annuncio già pubblicato. */
  editPath: string[]
  loggedOut: { url: string[]; selectors: Locator[] }
  /** Elementi presenti solo da loggato (menu utente, link di uscita...): conferma che l'accesso è attivo. */
  loggedIn: Locator[]
  /** Testo in cima alla pagina presente solo da loggato (es. eBay "Ciao Francesco!"). */
  loggedInText?: RegExp
  /** Pagina usata dal controllo accessi, se diversa da `url`. */
  authUrl?: string
  /** Pagina di accesso (pulsante "Accedi" della dashboard). */
  loginUrl: string
  published: { item: RegExp; done: string[] }
  stats: { views: StatSource; likes: StatSource }
  /** Pagina con i tuoi annunci attivi (importazione) e test per riconoscerla. */
  mine: { url: string; match: RegExp }
  /** Pagina del singolo annuncio: descrizione e foto (per completare gli annunci importati). */
  detail: { description: string[]; photos: string }
  fields: Record<string, Locator[]>
  /**
   * Campi che la pagina del controllo accessi (`authUrl` o `url`) mostra subito da loggato: se uno manca,
   * il selettore è da aggiornare. Solo dove quella pagina è il modulo (non eBay, che controlla la home,
   * né Wallapop, che parte da una procedura a passi).
   */
  probe?: { key: string; label: string }[]
  /**
   * Pulsanti da premere in ordine sulla pagina del tuo annuncio per eliminarlo (l'ultimo è la conferma del sito).
   * Solo dove il percorso è verificato: altrove Splisto apre l'annuncio e lo elimini tu.
   */
  remove?: Locator[]
}

export const SITES: Record<Platform, Site> = {
  vinted,
  ebay,
  subito,
  facebook,
  wallapop,
}
