import type { Adapter } from '../../lib/types'
import { findOne, Form, setText, sleep, waitFor } from '../dom'
import cfg from '../selectors/subito'
import { bestMatch, priceText } from '../text'

/**
 * Passo 1 senza categoria scelta a mano: scrive il titolo in "Scrivi l'oggetto del tuo annuncio" e prende la prima
 * categoria che Subito propone (link al modulo con categoria e titolo già inseriti). Verificato 10/2026:
 * "Set da giardino Bizzotto" -> Giardino e Fai da te, "Nintendo Switch OLED" -> Console e Videogiochi,
 * "Giacca di jeans Levis Trucker" -> Giacche e giubbotti (category=16&type=2), in circa un secondo.
 */
async function suggestedForm(title: string): Promise<string | null> {
  const input = await waitFor(cfg.subject, 8000)
  if (!(input instanceof HTMLInputElement) || !title.trim()) return null
  setText(input, title.slice(0, 60))
  for (let i = 0; i < 20; i++) {
    // l'elenco si apre quando il campo prende il fuoco; con la finestra in secondo piano focus() non lo segnala
    if (i % 4 === 1) {
      input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      input.dispatchEvent(new FocusEvent('focus'))
    }
    const a = document.querySelector<HTMLAnchorElement>(cfg.suggestion)
    if (a && /^https:\/\/inserimento\.subito\.it\//.test(a.href)) return a.href
    await sleep(500)
  }
  return null
}

export const subito: Adapter = {
  async fill(l, opts) {
    // Passo 1 (subito.it/vendere): vai al modulo della sottocategoria giusta.
    if (location.hostname === 'www.subito.it') {
      const mapped = (text: string) => {
        const name = bestMatch(Object.keys(cfg.categories), (k) => k, text)
        return name ? cfg.formBase + cfg.categories[name] : null
      }
      // categoria scritta a mano per Subito > categoria proposta da Subito per il titolo > categoria generica dell'annuncio
      const href = (l.categoryOverride.subito && mapped(l.categoryOverride.subito)) || (await suggestedForm(l.title)) || mapped(l.categoryText)
      if (href) {
        location.href = href
        return { ok: false, waiting: true, missingFields: [] }
      }
      return {
        ok: false,
        waiting: true,
        missingFields: ['Scegli la categoria su Subito: il modulo si compila da solo'],
      }
    }

    // Passo 2 (inserimento.subito.it): modulo completo, categoria già scelta.
    const f = new Form(cfg.fields, opts)
    await f.ready('title')
    if (cfg.uploadPhotos) await f.photos(l.photos.slice(0, cfg.maxPhotos))
    else if (l.photos.length && !opts?.skipPhotos) f.missing.push('Foto (da caricare a mano)')
    await f.text('title', 'Titolo', l.title, 'required')
    await f.text('description', 'Descrizione', l.description, 'required')
    await f.choose('condition', 'Condizione', cfg.conditions[l.condition])
    // Marca, taglia e "Per" esistono solo in alcune categorie (es. abbigliamento)
    await f.choose('brand', 'Marca', l.brand, 'optional')
    await f.choose('size', 'Taglia', l.size, 'optional')
    const gender = l.category === 'donna' ? 'Donna' : l.category === 'uomo' ? 'Uomo' : ''
    await f.choose('gender', 'Per', gender, 'optional')
    await f.text('price', 'Prezzo', priceText(l.price), 'required')
    const loc = findOne(cfg.fields.location) as HTMLInputElement | null
    if (loc && !loc.value.trim()) f.missing.push('Comune')
    return f.result()
  },
}
