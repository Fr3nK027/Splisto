// Modifica di più annunci insieme. Funzioni pure (senza chrome/DB) così si testano con `node --test`.
import type { Condition, Listing, Platform } from './types'

export type TextMode = 'append' | 'prepend' | 'replace' | 'set'

export interface BulkOps {
  /** set = prezzo fisso; pct = +/- percentuale; add = +/- euro (vale anche per i prezzi per sito). */
  price?: { mode: 'set' | 'pct' | 'add'; value: number }
  description?: { mode: TextMode; text: string; find?: string }
  title?: { mode: Exclude<TextMode, 'set'>; text: string; find?: string }
  condition?: Condition
  category?: string
  brand?: string
  addPlatforms?: Platform[]
  removePlatforms?: Platform[]
}

const round = (n: number) => Math.max(0, Math.round(n * 100) / 100)

export function newPrice(p: number | null, op: NonNullable<BulkOps['price']>): number | null {
  if (op.mode === 'set') return round(op.value)
  if (p == null) return null // percentuale o differenza su un prezzo che non c'è: resta vuoto
  return round(op.mode === 'pct' ? p * (1 + op.value / 100) : p + op.value)
}

export function newText(t: string, op: { mode: TextMode; text: string; find?: string }): string {
  switch (op.mode) {
    case 'set':
      return op.text
    case 'append':
      return op.text.trim() ? `${t.trimEnd()}${t.trim() ? '\n\n' : ''}${op.text.trim()}` : t
    case 'prepend':
      return op.text.trim() ? `${op.text.trim()}${t.trim() ? '\n\n' : ''}${t.trimStart()}` : t
    case 'replace':
      return op.find ? t.split(op.find).join(op.text) : t
  }
}

/** Campi da cambiare su un annuncio (solo quelli che cambiano davvero). */
export function bulkPatch(l: Listing, ops: BulkOps): Partial<Listing> {
  const patch: Partial<Listing> = {}
  if (ops.price) {
    const price = newPrice(l.price, ops.price)
    if (price !== l.price) patch.price = price
    // percentuale e differenza valgono anche per i prezzi per sito; un prezzo fisso li lascia come sono
    if (ops.price.mode !== 'set' && Object.keys(l.priceOverride).length) {
      patch.priceOverride = Object.fromEntries(Object.entries(l.priceOverride).map(([p, v]) => [p, newPrice(v ?? null, ops.price!) ?? v]))
    }
  }
  if (ops.description) {
    const d = newText(l.description, ops.description)
    if (d !== l.description) patch.description = d
  }
  if (ops.title) {
    const t = newText(l.title, ops.title).replace(/\s+/g, ' ').trim()
    if (t !== l.title) patch.title = t
  }
  if (ops.condition && ops.condition !== l.condition) patch.condition = ops.condition
  if (ops.category && ops.category !== l.category) patch.category = ops.category
  if (ops.brand?.trim() && ops.brand.trim() !== l.brand) patch.brand = ops.brand.trim()
  if (ops.addPlatforms?.length || ops.removePlatforms?.length) {
    const next = [...new Set([...l.platforms, ...(ops.addPlatforms ?? [])])].filter((p) => !ops.removePlatforms?.includes(p))
    if (next.join() !== l.platforms.join()) patch.platforms = next
  }
  return patch
}

/** Valori attuali dei campi che una modifica cambierà (per poterla annullare). */
export function snapshot(l: Listing, patch: Partial<Listing>): Partial<Listing> {
  return Object.fromEntries(Object.keys(patch).map((k) => [k, l[k as keyof Listing]])) as Partial<Listing>
}
