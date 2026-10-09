import type { FillOptions, FillResult, WirePhoto } from '../lib/types'
import { bestMatch, loose, norm, parseNumber, PUBLISH_WORDS, sameText } from './text'

/**
 * Come trovare un campo:
 * - stringa = selettore CSS (preferisci [name], [aria-label], [data-testid], #id stabili);
 * - { label } = testo della <label>, aria-label, placeholder o aria-labelledby (inizia con / uguale).
 */
export type Locator = string | { label: string }

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const visible = (el: Element) => el.getClientRects().length > 0

const CONTROL = 'input:not([type=hidden]),textarea,select,[contenteditable="true"],[role="combobox"],[role="button"],button'

function byLabel(text: string): HTMLElement | null {
  const t = norm(text)
  const match = (s: string | null | undefined) => !!s && norm(s).startsWith(t)
  for (const lab of document.querySelectorAll('label')) {
    if (!visible(lab) || !match(lab.textContent)) continue
    if (lab.htmlFor) {
      const target = document.getElementById(lab.htmlFor)
      if (target) return target
    }
    if (lab.matches('[role="combobox"],[role="button"]')) return lab
    const inner = lab.querySelector<HTMLElement>(CONTROL)
    if (inner) return inner
  }
  for (const el of document.querySelectorAll<HTMLElement>('[aria-label],[placeholder]')) {
    if (visible(el) && (match(el.getAttribute('aria-label')) || match(el.getAttribute('placeholder')))) {
      return el.matches(CONTROL) ? el : (el.querySelector<HTMLElement>(CONTROL) ?? el)
    }
  }
  for (const el of document.querySelectorAll<HTMLElement>('[aria-labelledby]')) {
    const txt = el.getAttribute('aria-labelledby')!.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
    if (visible(el) && match(txt)) return el
  }
  return null
}

export function findOne(locs: Locator[]): HTMLElement | null {
  for (const loc of locs) {
    let el: HTMLElement | null = null
    if (typeof loc === 'string') {
      try {
        el = document.querySelector<HTMLElement>(loc)
      } catch {
        console.warn('[Splisto] selettore non valido:', loc)
      }
    } else el = byLabel(loc.label)
    if (el) return el
  }
  return null
}

export async function waitFor(locs: Locator[], timeout = 8000): Promise<HTMLElement | null> {
  const end = Date.now() + timeout
  for (;;) {
    const el = findOne(locs)
    if (el || Date.now() > end) return el
    await sleep(250)
  }
}

/** Scrive in input/textarea in modo che React & co. se ne accorgano; gestisce anche contenteditable e iframe. */
export function setText(el: HTMLElement, value: string): boolean {
  if (el instanceof HTMLIFrameElement) {
    // funziona solo se l'iframe è same-origin; l'editor può essere il body o un div dentro
    // (eBay: <div class="se-rte-editor__rich" contenteditable>, verificato 10/2026)
    const doc = el.contentDocument
    const target = doc?.body?.isContentEditable || doc?.designMode === 'on' ? doc.body : doc?.querySelector<HTMLElement>('[contenteditable="true"]')
    return target ? setText(target, value) : false
  }
  el.focus()
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Prima come da tastiera (seleziona tutto + inserisci testo): i campi prezzo con formato, come quello di Vinted
    // ("799,00 €"), rifiutano un valore impostato direttamente e tornano al vecchio prezzo (verificato 10/2026).
    // Riuscito = stesso testo, o (per i numeri) stesso valore anche se il sito lo formatta ("800" -> "800,00 €").
    const numeric = /^\d+(?:[.,]\d+)?$/.test(value.trim())
    const took = () => el.value === value || (numeric && parseNumber(el.value) === parseNumber(value))
    // Solo se il campo ha davvero il fuoco: altrimenti il testo finirebbe nel campo precedente.
    if (el.ownerDocument.activeElement === el) {
      try {
        el.select()
        el.ownerDocument.execCommand('insertText', false, value)
      } catch {
        // alcuni tipi di input non supportano la selezione: si passa al metodo diretto
      }
    }
    if (!took()) {
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    el.dispatchEvent(new Event('blur', { bubbles: false }))
    return took()
  }
  if (el.isContentEditable || el.ownerDocument.designMode === 'on') {
    const doc = el.ownerDocument
    doc.getSelection()?.selectAllChildren(el)
    doc.execCommand('insertText', false, value)
    if (!el.textContent?.trim()) el.textContent = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }
  return false
}

const BUTTONISH = 'button,[role="button"],input[type="submit"],input[type="image"],input[type="button"],a'

/**
 * È (o attiva) un pulsante di pubblicazione? Controlla testo visibile, aria-label, title e value,
 * e per una <label> il controllo a cui è collegata (cliccare la label clicca il controllo).
 */
export function isPublish(el: Element): boolean {
  const target = el instanceof HTMLLabelElement && el.control ? el.control : el
  const btn = target.closest(BUTTONISH) ?? target
  // value solo per i pulsanti <input>: nei campi di testo è quello che l'utente ha scritto (es. un titolo con "post")
  const value = btn instanceof HTMLInputElement && /^(submit|button|image)$/.test(btn.type) ? btn.value : ''
  const texts = [(btn as HTMLElement).innerText, btn.textContent, btn.getAttribute('aria-label'), btn.getAttribute('title'), value]
  return texts.some((t) => !!t && PUBLISH_WORDS.test(t))
}

/** Clic "completo" (alcuni menu si aprono su mousedown). Rifiuta i pulsanti di pubblicazione. */
export function click(el: HTMLElement): void {
  if (isPublish(el)) throw new Error('Bloccato: l’estensione non clicca mai il pulsante di pubblicazione.')
  el.scrollIntoView({ block: 'center' })
  const opts = { bubbles: true, cancelable: true, view: window }
  el.dispatchEvent(new PointerEvent('pointerdown', opts))
  el.dispatchEvent(new MouseEvent('mousedown', opts))
  el.dispatchEvent(new PointerEvent('pointerup', opts))
  el.dispatchEvent(new MouseEvent('mouseup', opts))
  el.click()
}

const CANDIDATE =
  '[role="option"],[role="menuitem"],[role="menuitemradio"],[role="radio"],[role="treeitem"],li,label,button,[role="button"],span,div'

const visibleCandidates = () =>
  [...document.querySelectorAll<HTMLElement>(CANDIDATE)].filter((e) => (e.textContent?.length ?? 0) < 80 && visible(e))

/** Attende un elemento col testo voluto comparso DOPO lo snapshot `before` (cioè nel menu appena aperto). */
async function waitForNewText(text: string, before: Set<HTMLElement>, timeout = 4000): Promise<HTMLElement | null> {
  const end = Date.now() + timeout
  for (;;) {
    const found = bestMatch(
      visibleCandidates().filter((e) => !before.has(e)),
      (e) => e.textContent ?? '',
      text,
    )
    if (found || Date.now() > end) return found ?? null
    await sleep(250)
  }
}

/**
 * Seleziona un'opzione: <select> nativo, oppure menu a tendina custom (apre, eventualmente scrive per filtrare,
 * clicca l'opzione). "A > B > C" = clic in sequenza nei sottomenu.
 */
export async function choose(trigger: HTMLElement, wanted: string): Promise<boolean> {
  if (trigger instanceof HTMLSelectElement) {
    const opt = bestMatch([...trigger.options], (o) => o.text, wanted)
    if (!opt) return false
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(trigger, opt.value)
    trigger.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }
  const steps = wanted.split('>').map((s) => s.trim()).filter(Boolean)
  const textInputs = () => [...document.querySelectorAll<HTMLInputElement>('input[type="text"],input[type="search"],input:not([type])')].filter(visible)
  const inputsBefore = new Set(textInputs())
  let before = new Set(visibleCandidates())
  click(trigger)
  await sleep(600)
  // alcuni menu (es. react-select su Subito) si aprono solo da tastiera
  if (trigger.matches('input,[role="combobox"]') && trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', keyCode: 40, bubbles: true }))
    await sleep(400)
  }
  if (steps.length === 1) {
    // menu con campo di ricerca (es. "Cerca una categoria" su Vinted): scrivi per filtrare
    const active = document.activeElement
    const editable = (e: unknown): e is HTMLInputElement => e instanceof HTMLInputElement && e.type !== 'file' && !e.readOnly
    const search = editable(trigger)
      ? trigger
      : editable(active) && active !== trigger
        ? active
        : (textInputs().find((e) => !inputsBefore.has(e) && !e.readOnly) ?? null)
    if (search) {
      setText(search, steps[0])
      await sleep(600)
    }
  }
  for (const step of steps) {
    const opt = await waitForNewText(step, before)
    if (!opt) {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      return false
    }
    before = new Set(visibleCandidates())
    click(opt)
    await sleep(500)
  }
  return true
}

/** Clicca un elemento visibile (radio, etichetta, pulsante) per testo. */
export function clickText(text: string, selector = 'label,[role="radio"],[role="button"],button'): boolean {
  const el = bestMatch(
    [...document.querySelectorAll<HTMLElement>(selector)].filter(visible),
    (e) => e.textContent ?? '',
    text,
  )
  if (!el) return false
  click(el)
  return true
}

function toFile(w: WirePhoto, i: number): File {
  const bytes = Uint8Array.from(atob(w.data), (c) => c.charCodeAt(0))
  return new File([bytes], `foto-${i + 1}.jpg`, { type: w.type })
}

function attach(input: HTMLInputElement, files: File[]) {
  const dt = new DataTransfer()
  files.forEach((f) => dt.items.add(f))
  input.files = dt.files
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

type Mode = 'required' | 'normal' | 'optional'

/** Testo che il campo mostra ora (input, select, editor in iframe, menu personalizzato). */
function currentText(el: HTMLElement): string {
  if (el instanceof HTMLIFrameElement) return el.contentDocument?.body?.innerText ?? ''
  if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.text ?? ''
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value
  return el.innerText ?? ''
}


/** Selettori appresi con "Insegna" (chrome.storage.local): hanno la precedenza su quelli dei file. */
let learned: Record<string, Locator> = {}
export const setLearned = (l: Record<string, Locator>) => void (learned = l)

/** Compila un modulo campo per campo e tiene traccia di ciò che manca. */
export class Form {
  missing: string[] = []
  missingKeys: string[] = []
  constructor(
    private fields: Record<string, Locator[]>,
    private opts: FillOptions = {},
  ) {}

  private locs(key: string): Locator[] {
    return learned[key] ? [learned[key], ...(this.fields[key] ?? [])] : (this.fields[key] ?? [])
  }

  private find(key: string, mode: Mode = 'normal') {
    return waitFor(this.locs(key), mode === 'optional' ? 2000 : 8000)
  }

  miss(key: string, label: string, mode: Mode = 'normal') {
    if (mode === 'optional') return
    this.missing.push(label)
    this.missingKeys.push(key)
  }

  /** Attende il primo campo del modulo; se non arriva la pagina non è quella attesa. */
  async ready(key: string, timeout = 20000) {
    if (!(await waitFor(this.locs(key), timeout))) {
      throw Object.assign(new Error('Modulo non trovato: la pagina è cambiata? Usa "Insegna" o aggiorna i selettori (vedi README).'), { key })
    }
  }

  // Pagina "Modifica": si scrive solo ciò che è cambiato, così la formattazione del sito resta.
  async text(key: string, label: string, value: string | null | undefined, mode: Mode = 'normal') {
    if (!value) return mode === 'required' && this.missing.push(label)
    const el = await this.find(key, mode)
    if (el && this.opts.edit && sameText(currentText(el), value)) return // già uguale sul sito
    let ok = false
    try {
      ok = !!el && setText(el, value)
    } catch {
      ok = false
    }
    if (!ok) this.miss(key, label, mode)
    await sleep(150)
  }

  async choose(key: string, label: string, value: string | null | undefined, mode: Mode = 'normal') {
    // pagina "Modifica": un menu facoltativo che non compare non è "da fare a mano"
    if (this.opts.edit && mode === 'normal') mode = 'optional'
    if (!value) return mode === 'required' && this.missing.push(label)
    const el = await this.find(key, mode)
    if (el && this.opts.edit) {
      // si cambia solo un valore che si vede ed è diverso: un menu che non mostra la scelta attuale non si tocca
      const now = loose(currentText(el))
      if (!now || now.includes(loose(value))) return
    }
    let ok = false
    try {
      ok = !!el && (await choose(el, value))
    } catch {
      ok = false // es. il blocco anti-pubblicazione ha fermato un clic: il campo resta da fare a mano
    }
    if (!ok) this.miss(key, label, mode)
    await sleep(300)
  }

  async photos(photos: WirePhoto[]) {
    if (this.opts.skipPhotos) return
    if (!photos.length) return this.missing.push('Foto')
    const files = photos.map(toFile)
    const input = (await waitFor(this.locs('photos'), 15000)) as HTMLInputElement | null
    if (!(input instanceof HTMLInputElement)) return this.miss('photos', 'Foto')
    if (input.multiple) attach(input, files)
    else {
      // input a file singolo: carica una foto alla volta (il sito spesso ricrea l'input)
      for (const f of files) {
        const el = findOne(this.locs('photos')) as HTMLInputElement | null
        if (!el) return this.miss('photos', 'Foto (caricate in parte)')
        attach(el, [f])
        await sleep(1500)
      }
    }
    await sleep(4000) // lascia al sito il tempo di caricare e mostrare le anteprime
    // Alcuni siti rifiutano i file inseriti da script (visto su Subito, 10/2026): segnalalo invece di tacere.
    if (/caricamento fallito|errore[^.\n]{0,40}caricamento|upload failed/i.test(document.body.innerText)) {
      this.miss('photos', 'Foto (il sito le ha rifiutate: caricale a mano)')
    }
  }

  result(): FillResult {
    return { ok: this.missing.length === 0, missingFields: this.missing, missingKeys: this.missingKeys }
  }
}

/** Selettore stabile per l'elemento cliccato in modalità "Insegna"; null se non ce n'è uno affidabile. */
export function locatorFor(target: Element, key: string): Locator | null {
  let el: Element | null = target
  if (key === 'photos') {
    // l'utente clicca l'area di caricamento: cerca l'input file più vicino risalendo
    for (let n: Element | null = target, i = 0; n && i < 8; n = n.parentElement, i++) {
      el = n.matches('input[type="file"]') ? n : n.querySelector('input[type="file"]')
      if (el) break
    }
  } else el = target.closest(CONTROL) ?? target.closest('label') ?? target
  // un campo "insegnato" non può mai essere il pulsante di pubblicazione (l'input delle foto sì: non si clicca, riceve file)
  if (!el || (key !== 'photos' && isPublish(el))) return null
  const tag = el.tagName.toLowerCase()
  for (const a of ['data-testid', 'name', 'aria-label', 'placeholder', 'id']) {
    const v = el.getAttribute(a)
    if (!v) continue
    if (a === 'id' && /\d{3,}|^:|[A-Za-z0-9_-]{20,}/.test(v)) continue // id generati: cambiano a ogni caricamento
    const sel = a === 'id' ? `#${CSS.escape(v)}` : `${tag}[${a}=${JSON.stringify(v)}]`
    if (document.querySelectorAll(sel).length === 1) return sel
  }
  const text = (el as HTMLInputElement).labels?.[0]?.textContent ?? (el.tagName === 'LABEL' ? el.textContent : null)
  const label = text?.replace(/\s+/g, ' ').trim().slice(0, 40)
  return label ? { label } : null
}
