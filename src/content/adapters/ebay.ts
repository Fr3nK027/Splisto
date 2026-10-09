import type { Adapter } from '../../lib/types'
import { Form } from '../dom'
import cfg from '../selectors/ebay'
import { priceText } from '../text'

export const ebay: Adapter = {
  async fill(l, opts) {
    const f = new Form(cfg.fields, opts)

    // Passo 1: eBay chiede prima cosa vendi, poi categoria e condizione (scelte dall'utente).
    if (cfg.prelistUrl.some((u) => location.href.includes(u))) {
      await f.ready('keywords')
      await f.text('keywords', 'Titolo', l.title, 'required')
      const hint = l.categoryText ? ` (suggerita: ${l.categoryText})` : ''
      return {
        ok: false,
        waiting: true,
        missingFields: [...f.missing, `Scegli su eBay categoria${hint} e condizione, poi continua: il modulo si compila da solo`],
      }
    }

    // Passo 2: modulo completo.
    await f.ready('title')
    await f.photos(l.photos)
    await f.text('title', 'Titolo', l.title, 'required')
    await f.choose('condition', 'Condizione', cfg.conditions[l.condition], 'optional') // spesso già scelta al passo 1
    await f.text('description', 'Descrizione', l.description, 'required')
    await f.choose('brand', 'Marca', l.brand)
    await f.choose('size', 'Taglia', l.size)
    await f.choose('color', 'Colore', l.color)
    await f.text('price', 'Prezzo', priceText(l.price), 'required')
    // ponytail: solo il peso in kg; le dimensioni del pacco restano manuali
    if (l.weightG) await f.text('weight', 'Peso', priceText(Math.ceil(l.weightG / 100) / 10), opts?.edit ? 'optional' : 'normal') // non c'è nella pagina Modifica
    return f.result()
  },
}
