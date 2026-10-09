import type { Adapter } from '../../lib/types'
import { click, Form } from '../dom'
import cfg from '../selectors/vinted'
import { packageIndex, parseNumber, priceText } from '../text'

export const vinted: Adapter = {
  async fill(l, opts) {
    const f = new Form(cfg.fields, opts)
    await f.ready('title')
    await f.photos(l.photos)
    await f.text('title', 'Titolo', l.title, 'required')
    await f.text('description', 'Descrizione', l.description, 'required')
    // categoria prima di taglia/marca: i campi successivi dipendono da lei
    if (!opts?.edit) await f.choose('category', 'Categoria', l.categoryText, 'required')
    await f.choose('brand', 'Marca', l.brand)
    await f.choose('size', 'Taglia', l.size)
    await f.choose('condition', 'Condizioni', cfg.conditions[l.condition], 'required')
    await f.choose('color', 'Colore', l.color)
    await f.text('price', 'Prezzo', priceText(l.price), 'required')
    // pagina "Modifica": la spedizione resta quella scelta sul sito
    if (l.weightG && !opts?.edit) {
      const radios = [...document.querySelectorAll<HTMLInputElement>(cfg.packages)]
      if (radios.length) click(radios[packageIndex(l.weightG, radios.map(capacity))])
      else f.missing.push('Dimensioni del pacco')
    }
    return f.result()
  },
}

/** Portata scritta sull'opzione del pacco ("Consigliato 5 kg Per articoli…"), se c'è. Verificato 10/2026 (elettronica). */
function capacity(radio: HTMLElement): number | null {
  let box = radio.parentElement
  for (let i = 0; i < 6 && box && !box.innerText.trim(); i++) box = box.parentElement
  const m = box?.innerText.match(/(\d+(?:[.,]\d+)?)\s*kg/i)
  return m ? parseNumber(m[1]) : null
}
