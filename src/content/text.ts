// Funzioni pure (senza DOM né import) così si testano con `node --test`.

/** Minuscolo, senza accenti, spazi compattati, senza "*" o ":" finali (asterischi dei campi obbligatori). */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s*:]+$/, '')
    .trim()
}

/**
 * Sceglie l'elemento il cui testo corrisponde meglio a `wanted`:
 * uguale > inizia con > contiene > `wanted` inizia col testo (es. "Nuovo con cartellino" su un'opzione "Nuovo").
 * A parità vince il testo più corto, poi l'ultimo in ordine (nel DOM è il nodo più interno).
 */
export function bestMatch<T>(items: Iterable<T>, text: (t: T) => string, wanted: string): T | undefined {
  const w = norm(wanted)
  if (!w) return undefined
  let best: T | undefined
  let bestRank = 0
  let bestLen = Infinity
  for (const it of items) {
    const t = norm(text(it))
    if (!t) continue
    const rank = t === w ? 4 : t.startsWith(w) ? 3 : t.includes(w) ? 2 : w.startsWith(t) && t.length >= 3 ? 1 : 0
    if (rank && (rank > bestRank || (rank === bestRank && t.length <= bestLen))) {
      best = it
      bestRank = rank
      bestLen = t.length
    }
  }
  return best
}

/** Prezzo in formato italiano: 10 -> "10", 10.5 -> "10,50". */
export function priceText(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return ''
  return Number.isInteger(p) ? String(p) : p.toFixed(2).replace('.', ',')
}

/** Aggiunge in fondo marca/taglia/colore se il sito non ha campi dedicati e il testo non li cita già. */
export function withDetails(l: { description: string; brand: string; size: string; color: string }): string {
  const d = norm(l.description)
  const extra = (
    [
      ['Marca', l.brand],
      ['Taglia', l.size],
      ['Colore', l.color],
    ] as const
  )
    .filter(([, v]) => v.trim() && !d.includes(norm(v)))
    .map(([k, v]) => `${k}: ${v.trim()}`)
  return extra.length ? `${l.description.trim()}\n\n${extra.join('\n')}` : l.description
}

/** Prima etichetta il cui limite di peso (grammi) contiene il peso dato; altrimenti l'ultima. */
export function pickBySize(weightG: number, sizes: [maxG: number, label: string][]): string {
  return (sizes.find(([max]) => weightG <= max) ?? sizes[sizes.length - 1])[1]
}

/** Parole che identificano il pulsante finale di pubblicazione: non va MAI cliccato dall'estensione. */
// Anche i pulsanti finali delle pagine di modifica: "Salva" (Vinted), "Aggiorna" (Facebook), "Pubblica annuncio" (Subito).
// Comprende le forme verbali ("Pubblicalo", "Pubblicare"), lo spagnolo di Wallapop ("Publicar", "Subir producto") e l'inglese.
export const PUBLISH_WORDS =
  /\b(pubblic\w*|publicar\w*|publish\w*|metti in vendita|mettilo in vendita|metti online|carica|caricare|carica annuncio|carica articolo|inserisci annuncio|invia annuncio|vendi ora|subir\w*|list it|post|salva|salva modifiche|aggiorna|aggiorna annuncio|aggiorna inserzione|invia modifiche|conferma modifiche|rivedi inserzione|save|update|revise)\b/i

/** Sito della piattaforma (https, dominio esatto o sottodominio): l'estensione apre e legge solo questi. */
export const SITE_URL = /^https:\/\/([a-z0-9-]+\.)*(vinted\.it|ebay\.it|ebay\.com|subito\.it|facebook\.com|wallapop\.com)(\/|$)/i
/** Server delle foto delle piattaforme (gli unici da cui si scaricano immagini). */
export const PHOTO_URL = /^https:\/\/([a-z0-9-]+\.)*(vinted\.net|sbito\.it|fbcdn\.net|ebayimg\.com|wallapop\.com)\//i

/** Piattaforma dal nome host, o null se non è una delle cinque. */
export function platformOfUrl(url: string): 'vinted' | 'ebay' | 'subito' | 'facebook' | 'wallapop' | null {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  const on = (d: string) => host === d || host.endsWith(`.${d}`)
  return on('vinted.it') ? 'vinted' : on('ebay.it') || on('ebay.com') ? 'ebay' : on('subito.it') ? 'subito' : on('facebook.com') ? 'facebook' : on('wallapop.com') ? 'wallapop' : null
}

/** Primo numero trovato con uno dei pattern (gruppo 1). "1.234" -> 1234. */
export function parseCount(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return Number(m[1].replace(/\./g, ''))
  }
  return null
}

/** Stessa pagina, ignorando query, hash e "/" finale. */
export const sameUrl = (a: string, b: string) => {
  const clean = (u: string) => u.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
  return !!a && !!b && clean(a) === clean(b)
}

/** Prezzo da testo italiano: "799,00 €" -> 799, "1.299 €" -> 1299, "€449.99" -> 449.99. */
export function parsePrice(text: string): number | null {
  // prima "€ 12" / "EUR 12", poi "12 €": così un numero seguito dal prezzo (es. "Item ID: 3983… EUR 799.00") non vince
  const raw = text.match(/(?:€|EUR)\s*(\d[\d.,]*)/)?.[1] ?? text.match(/(\d[\d.,]*)\s*(?:€|EUR)/)?.[1]
  return raw ? parseNumber(raw) : null
}

/** Numero da testo con separatori italiani o inglesi: "1.299,50", "1,299.50", "799", "449.99". */
export function parseNumber(text: string): number | null {
  const raw = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(raw)) return null
  // "1.299,50" / "1.299" (punto = migliaia) oppure "449.99" (punto = decimali, formato inglese)
  const s =
    raw.includes(',') && raw.includes('.')
      ? raw.lastIndexOf('.') > raw.lastIndexOf(',')
        ? raw.replace(/,/g, '') // "1,299.00" (inglese, eBay.com)
        : raw.replace(/\./g, '').replace(',', '.') // "1.299,00"
      : raw.includes(',')
        ? raw.replace(',', '.')
        : /\.\d{3}(?!\d)/.test(raw)
          ? raw.replace(/\./g, '')
          : raw
  const n = Number(s.replace(/[.,]$/, ''))
  return Number.isFinite(n) ? n : null
}

const words = (s: string) => new Set(norm(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2))

/**
 * Stesso oggetto su due siti? Le parole del titolo più corto devono stare quasi tutte nell'altro
 * (i siti tagliano i titoli a lunghezze diverse) e i prezzi devono essere vicini.
 */
export function sameItem(a: { title: string; price: number | null }, b: { title: string; price: number | null }): boolean {
  const wa = words(a.title)
  const wb = words(b.title)
  const small = wa.size <= wb.size ? wa : wb
  const big = small === wa ? wb : wa
  if (small.size < 2) return false
  const shared = [...small].filter((w) => big.has(w)).length
  if (shared / small.size < 0.75) return false
  if (a.price == null || b.price == null) return true
  return Math.abs(a.price - b.price) <= Math.max(a.price, b.price) * 0.25
}

/** Condizione dal testo del sito ("Ottime", "Usato - Buono", "Come nuovo - perfetto"...). */
export function conditionFrom(text: string): 'nuovo_cartellino' | 'nuovo' | 'ottimo' | 'buono' | 'discreto' | null {
  const t = norm(text)
  if (!t) return null
  if (/cartellino|mai usato|confezione originale/.test(t)) return 'nuovo_cartellino'
  if (/come nuovo/.test(t)) return t.startsWith('usato') ? 'ottimo' : 'nuovo'
  if (/^nuov/.test(t)) return 'nuovo'
  if (/ottim/.test(t)) return 'ottimo'
  if (/buon/.test(t)) return 'buono'
  if (/discret|accettabil|danneggiat|da riparare/.test(t)) return 'discreto'
  return null
}

/** Alt delle foto nel profilo Vinted: "Titolo, brand: X, condizioni: Y, taglia: L, €24.99". */
export function parseVintedAlt(alt: string): { title: string; brand: string; condition: string; size: string } {
  const pick = (k: string) => alt.match(new RegExp(String.raw`,\s*${k}:\s*([^,]+)`))?.[1].trim() ?? ''
  return { title: alt.split(/,\s*(?:brand|condizioni|taglia):/)[0].trim(), brand: pick('brand'), condition: pick('condizioni'), size: pick('taglia') }
}

/**
 * Facebook non marca la descrizione: nel testo della pagina sta tra le coppie "Dettagli" (Condizione, Brand...)
 * e la riga della posizione ("Città · La posizione è approssimativa").
 */
export function facebookDescription(pageText: string): string {
  const start = pageText.indexOf('Dettagli\n')
  const end = pageText.search(/\n[^\n]*La posizione è approssimativa/)
  if (start < 0 || end < start) return ''
  const lines = pageText.slice(start + 'Dettagli\n'.length, end).split('\n')
  while (lines.length > 2 && /^(Condizione|Brand|Marca|Colore|Taglia|Materiale|Modello|Dimensioni|Tipo|Genere)$/i.test(lines[0].trim())) lines.splice(0, 2)
  return lines.join('\n').trim()
}

// Entità più comuni nelle descrizioni italiane (&amp; per ultima: "&amp;lt;" resta "&lt;" e non diventa "<").
const ENTITIES: Record<string, string> = {
  nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", euro: '€', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—', deg: '°', middot: '·', bull: '•', times: '×', copy: '©', reg: '®',
  agrave: 'à', aacute: 'á', egrave: 'è', eacute: 'é', igrave: 'ì', iacute: 'í', ograve: 'ò', oacute: 'ó', ugrave: 'ù', uacute: 'ú',
  Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù', ccedil: 'ç', ntilde: 'ñ', amp: '&',
}

/** Testo leggibile da una pagina HTML semplice (descrizione eBay su itm.ebaydesc.com). Senza DOM: gira anche nel service worker. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|table|ul|ol)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .split('\n')
    .filter((line) => !line || /[\p{L}\p{N}]/u.test(line)) // righe di soli trattini (voci di elenco vuote)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Id numerico dell'annuncio dentro il suo link (Vinted /items/123-titolo, Subito ...-582394872.htm, eBay /itm/slug/123). */
export const idInUrl = (u?: string) => u?.match(/\/itm\/(?:[^/?#]+\/)?(\d{6,})/)?.[1] ?? u?.match(/(\d{6,})/)?.[1] // eBay: l'id è dopo /itm/ (lo slug può contenere cifre)

/**
 * Pagina "Modifica" di un annuncio già pubblicato, o null se il sito non è supportato o mancano i dati.
 * Verificato 10/2026: Vinted /items/<id>/edit, Subito inserimento.subito.it/modifica?id=<uuid> (l'uuid è nel link
 * "Statistiche"), Facebook /marketplace/edit/?listing_id=<id>, eBay ebay.it/lstng?mode=ReviseItem&itemId=<id>.
 */
export function editUrlFor(p: string, s: { remoteId?: string; url?: string; statsUrl?: string }): string | null {
  const id = (s.remoteId && /^\d{6,}$/.test(s.remoteId) ? s.remoteId : undefined) ?? idInUrl(s.url)
  switch (p) {
    case 'vinted':
      return id ? `https://www.vinted.it/items/${id}/edit` : null
    case 'facebook':
      return id ? `https://www.facebook.com/marketplace/edit/?listing_id=${id}` : null
    case 'ebay':
      return id ? `https://www.ebay.it/lstng?mode=ReviseItem&itemId=${id}` : null
    case 'subito': {
      const uuid = s.statsUrl?.match(/id:ad:([0-9a-f-]{36})/i)?.[1]
      return uuid ? `https://inserimento.subito.it/modifica?id=${uuid}` : null
    }
    case 'wallapop':
      // la pagina "Modifica" ha un id che sta solo nella pagina dell'annuncio: si apre quella e da lì si va alla modifica
      return s.url && /^https:\/\/[a-z]+\.wallapop\.com\/item\/[^/?#]+$/.test(s.url) ? s.url : null
    default:
      return null
  }
}

/** Confronto che ignora spazi, punteggiatura, emoji e maiuscole (es. descrizione eBay con formattazione). */
export const loose = (s: string) => norm(s).replace(/[^\p{L}\p{N}]/gu, '')
export function sameText(current: string, wanted: string): boolean {
  const numeric = /^\d+(?:[.,]\d+)?$/.test(wanted.trim())
  return numeric ? parseNumber(current) === parseNumber(wanted) : loose(current) === loose(wanted)
}
