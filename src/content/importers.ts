import type { ImportedItem, ItemDetail, Platform } from '../lib/types'
import { sleep } from './dom'
import { SITES } from './selectors'
import { facebookDescription, parseCount, parsePrice, parseVintedAlt } from './text'

/*
 * Importazione: legge la pagina "i miei annunci" di ogni sito e la pagina del singolo annuncio.
 * Solo lettura del DOM, nessuna API interna. Vinted, Subito e Facebook verificati 10/2026;
 * eBay e Wallapop usano il lettore generico (link agli annunci + testo vicino).
 */

const num = (text: string, re: RegExp) => parseCount(text, [re])

/** Risale fino al primo antenato che contiene un'immagine e un prezzo: la "scheda" dell'annuncio. */
function cardOf(el: Element, extra?: RegExp): HTMLElement | null {
  let c: HTMLElement | null = el as HTMLElement
  for (let i = 0; i < 14 && c; i++, c = c.parentElement) {
    if (c.querySelector('img') && /€|EUR/.test(c.innerText) && (!extra || extra.test(c.innerText))) return c
  }
  return null
}

function vinted(): ImportedItem[] {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="grid-item"]')].flatMap((g) => {
    const href = g.querySelector('a[href*="/items/"]')?.getAttribute('href')
    const id = href?.match(/\/items\/(\d+)/)?.[1]
    const img = g.querySelector('img')
    if (!href || !id || !img) return []
    const a = parseVintedAlt(img.alt)
    const text = g.innerText
    return [
      {
        url: `https://www.vinted.it/items/${id}`,
        remoteId: id,
        title: a.title,
        price: parsePrice(g.querySelector('[data-testid$="--price-text"]')?.textContent ?? text),
        image: img.src, // miniatura firmata: cambiare la misura nell'URL dà 404; le foto grandi arrivano dalla pagina dell'annuncio
        views: num(text, /(\d[\d.]*)\s*visualizz/i),
        likes: num(text, /(\d[\d.]*)\s*preferit/i),
        sold: /\bVendut[oi]\b/i.test(text),
        brand: a.brand,
        condition: a.condition,
        size: a.size,
      },
    ]
  })
}

function subito(): ImportedItem[] {
  const seen = new Set<string>()
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/performance/id:ad:"]')].flatMap((a) => {
    const id = a.href.match(/:list:(\d+)/)?.[1]
    if (!id || seen.has(id)) return []
    seen.add(id)
    const card = cardOf(a, /\d+°/) // la scheda intera, con posizione, visite e messaggi
    if (!card) return []
    const text = card.innerText
    return [
      {
        url: `https://www.subito.it/vi/${id}.htm`,
        remoteId: id,
        title: (a.getAttribute('aria-label') ?? '').trim(),
        price: parsePrice(text),
        image: card.querySelector<HTMLImageElement>('img[src*="images.sbito.it"]')?.src,
        views: num(text, /\d+°\s+(\d[\d.]*)/), // posizione, visite, messaggi
        likes: null, // i preferiti sono nella pagina Statistiche
        statsUrl: a.href.split('?')[0],
      },
    ]
  })
}

function facebook(): ImportedItem[] {
  const PREFIX = 'Contrassegna come venduto '
  return [...document.querySelectorAll<HTMLElement>(`[role="main"] [role="button"][aria-label^="${PREFIX}"]`)].flatMap((b) => {
    const card = cardOf(b)
    if (!card) return []
    const link = card.querySelector<HTMLAnchorElement>('a[href*="target_id="]')
    const id = link && new URL(link.href).searchParams.get('target_id')
    if (!id) return []
    const text = card.innerText
    return [
      {
        url: `https://www.facebook.com/marketplace/item/${id}/`,
        remoteId: id,
        title: b.getAttribute('aria-label')!.slice(PREFIX.length).trim(),
        price: parsePrice(text),
        image: card.querySelector('img')?.src,
        views: num(text, /(\d[\d.]*)\s*clic/i),
        likes: null,
        sold: /\bVenduto\b/.test(text),
      },
    ]
  })
}

/** eBay: My eBay "Active" / "Overview" su ebay.com. Verificato 10/2026. */
function ebay(): ImportedItem[] {
  const root = document.querySelector('#mainContent') ?? document.body
  const seen = new Set<string>()
  return [...root.querySelectorAll<HTMLAnchorElement>('a[href*="/itm/"]')].flatMap((a) => {
    const id = a.href.match(/\/itm\/(?:[^/?#]+\/)?(\d{6,})/)?.[1]
    if (!id || seen.has(id)) return []
    const card = cardOf(a)
    if (!card) return []
    seen.add(id)
    const text = card.innerText
    // titolo: il testo più lungo tra i link all'annuncio (una riga "badge" prima del titolo non lo sostituisce)
    const linkTitle = [...card.querySelectorAll<HTMLAnchorElement>(`a[href*="/itm/"]`)].map((x) => x.innerText.trim()).sort((a, b) => b.length - a.length)[0]
    const count = (re: RegExp) => {
      const m = text.match(re)?.[1]
      return m ? Number(m.replace(/[.,]/g, '')) : null
    }
    return [
      {
        url: `https://www.ebay.it/itm/${id}`,
        remoteId: id,
        title: linkTitle || (text.split('\n').map((s) => s.trim()).find(Boolean) ?? ''),
        price: parsePrice(text),
        image: card.querySelector<HTMLImageElement>('img[src*="ebayimg.com"]')?.src,
        views: count(/(\d[\d,.]*)\s*views?\b/i),
        likes: count(/(\d[\d,.]*)\s*watchers?\b/i),
      },
    ]
  })
}

/** Wallapop "I tuoi articoli": scheda con prezzo, titolo, date. Verificato 10/2026. */
function wallapop(): ImportedItem[] {
  const seen = new Set<string>()
  const items = [...document.querySelectorAll<HTMLElement>('.CatalogItem__content')].flatMap((card) => {
    const a = card.querySelector<HTMLAnchorElement>('a[href*="/item/"]')
    const url = a?.href.split(/[?#]/)[0]
    if (!url || !SITES.wallapop.published.item.test(url) || seen.has(url)) return []
    seen.add(url)
    const text = card.innerText
    // "70 €\nintero album pokemon\nPubblicato\n28/03/2024\nModificato\n30/09/2026"
    const title = text
      .split('\n')
      .map((s) => s.trim())
      .find((s) => s && !/€|^(Pubblicato|Modificato|Riservato|Venduto)$|^\d{1,2}\/\d{1,2}\/\d{2,4}$/i.test(s))
    if (!title) return []
    return [{ url, remoteId: url.match(/-(\d{6,})$/)?.[1] ?? url, title, price: parsePrice(text), image: card.querySelector('img')?.src }]
  })
  return items.length ? items : generic('wallapop')
}

/** Lettore di riserva: link agli annunci (stesso schema di "published.item") con la scheda intorno. */
function generic(p: Platform): ImportedItem[] {
  const re = SITES[p].published.item
  const seen = new Set<string>()
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].flatMap((a) => {
    const url = a.href.split(/[?#]/)[0]
    if (!re.test(url) || seen.has(url)) return []
    const card = cardOf(a)
    if (!card) return []
    seen.add(url)
    const img = card.querySelector('img')
    // titolo: il testo più lungo tra i link all'annuncio (il primo spesso è solo la foto)
    const linkText = [...card.querySelectorAll<HTMLAnchorElement>('a[href]')]
      .filter((x) => x.href.split(/[?#]/)[0] === url)
      .flatMap((x) => x.innerText.split('\n'))
      .map((s) => s.trim())
      .filter((s) => s && !/€/.test(s))
      .sort((x, y) => y.length - x.length)[0]
    const title = (linkText || img?.alt || '').slice(0, 200)
    if (!title) return []
    return [{ url, remoteId: url.match(/(\d{6,})/)?.[1] ?? url, title, price: parsePrice(card.innerText), image: img?.src }]
  })
}

const READERS: Record<Platform, () => ImportedItem[]> = {
  vinted,
  subito,
  facebook,
  ebay,
  wallapop,
}

/** Scorre in fondo finché compaiono nuovi annunci (liste caricate a blocchi), poi li legge. */
export async function readMine(p: Platform): Promise<{ items: ImportedItem[]; partial: boolean }> {
  let items: ImportedItem[] = []
  let stable = 0
  for (let i = 0; i < 25 && stable < 3; i++) {
    await sleep(1200)
    const now = READERS[p]()
    stable = now.length && now.length === items.length ? stable + 1 : 0
    items = now
    scrollTo(0, document.body.scrollHeight) // ponytail: in una scheda in background lo scroll infinito può fermarsi; i primi blocchi arrivano comunque
  }
  return { items, partial: stable < 3 } // ancora in caricamento allo scadere: elenco forse incompleto
}

/** Lettura singola, senza scorrere (per la pagina aperta a mano dall'utente). */
export const readNow = (p: Platform) => READERS[p]()

/**
 * Id del tuo profilo Vinted: cookie braze_external_id ("<id>:...") o dati della pagina ("userId").
 * Il cookie manca se rifiuti i cookie di marketing: allora vale "userId" solo se nella pagina è uno solo
 * (home e profilo mostrano solo il tuo, verificato 10/2026); più id diversi = non si sa quale è il tuo.
 */
function ownVintedId(): string | undefined {
  const cookie = document.cookie.match(/(?:^|;\s*)braze_external_id=(\d+)/)?.[1]
  if (cookie) return cookie
  const ids = new Set([...document.scripts].flatMap((s) => [...(s.textContent ?? '').matchAll(/\\?"userId\\?":\\?"?(\d+)/g)].map((m) => m[1])))
  return ids.size === 1 ? [...ids][0] : undefined
}

const here = () => location.origin + location.pathname

/** Vinted: vai al tuo profilo (niente clic sul menu utente, che in una scheda in background può non aprirsi). */
export async function goToOwnProfile(): Promise<boolean> {
  if (SITES.vinted.mine.match.test(here())) return false
  for (let i = 0; i < 10; i++, await sleep(500)) {
    const id = ownVintedId()
    if (id) {
      location.href = `https://www.vinted.it/member/${id}`
      return true
    }
  }
  return false
}

/** È la pagina dei MIEI annunci? URL esatto (senza query) e, su Vinted, l'id del profilo deve essere il tuo. */
export function isMine(p: Platform): boolean {
  const m = here().match(SITES[p].mine.match)
  if (!m) return false
  return p !== 'vinted' || (!!m[1] && m[1] === ownVintedId())
}

/** Dati dell'annuncio nella pagina Wallapop (Next.js): id per la modifica, descrizione, foto, visite. Verificato 10/2026. */
interface WallapopItem {
  id?: string
  description?: { original?: string }
  images?: { urls?: { big?: string } }[]
  views?: number
  favorites?: number
  condition?: { text?: string }
  brand?: string | null
}
export function wallapopItem(): WallapopItem | null {
  try {
    const item = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent ?? '')?.props?.pageProps?.item
    return item && typeof item === 'object' ? (item as WallapopItem) : null
  } catch {
    return null
  }
}

/** Pagina "Modifica" del tuo annuncio Wallapop, dall'id nei dati della pagina dell'annuncio. */
export function wallapopEditUrl(): string | null {
  const id = wallapopItem()?.id
  return typeof id === 'string' && /^[a-z0-9]{6,24}$/i.test(id) ? `${location.origin}/app/catalog/edit/${id}` : null
}

export async function readDetail(p: Platform): Promise<ItemDetail> {
  const cfg = SITES[p]
  await sleep(2500)
  const w = p === 'wallapop' ? wallapopItem() : null
  if (w) {
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    return {
      description: String(w.description?.original ?? '').trim(),
      photos: (w.images ?? []).map((i) => String(i.urls?.big ?? '')).filter((u) => u.startsWith('https://')).slice(0, 10),
      condition: w.condition?.text,
      brand: w.brand ?? undefined,
      views: num(w.views),
      likes: num(w.favorites),
    }
  }
  const main = document.querySelector('[role="main"], main') ?? document.body
  const text = (main as HTMLElement).innerText
  const description =
    cfg.detail.description.map((s) => document.querySelector<HTMLElement>(s)?.innerText.trim()).find(Boolean) ||
    (p === 'facebook' ? facebookDescription(text) : '')
  const photos = [
    ...new Map(
      [...document.querySelectorAll<HTMLImageElement>(cfg.detail.photos)]
        .map((i) => i.getAttribute('data-zoom-src') || i.getAttribute('data-src') || i.currentSrc || i.src)
        .filter((u) => u.startsWith('https://'))
        .map((u) => [u.split('?')[0], u] as const),
    ).values(),
  ].slice(0, 10)
  // eBay: la descrizione sta in un iframe di itm.ebaydesc.com, che il service worker scarica a parte
  const descSrc = document.querySelector<HTMLIFrameElement>('iframe#desc_ifr, iframe[src*="ebaydesc.com"]')?.src
  return {
    description,
    descriptionUrl: descSrc && /^https:\/\/itm\.ebaydesc\.com\/itmdesc\/\d+/.test(descSrc) ? descSrc : undefined,
    photos,
    condition: text.match(/Condizion[ei]\s*\n?\s*([^\n]{3,60})/)?.[1]?.trim(),
    brand: text.match(/(?:Brand|Marca)\s*\n?\s*([^\n]{2,40})/)?.[1]?.trim(),
    views: parseCount(text, cfg.stats.views.patterns),
    likes: parseCount(text, cfg.stats.likes.patterns),
  }
}
