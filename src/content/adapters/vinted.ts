import type { Adapter } from '../../lib/types'
import { click, findOne, Form } from '../dom'
import cfg from '../selectors/vinted'
import { pickBySize, priceText } from '../text'

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
    if (l.weightG) {
      const radio = findOne([pickBySize(l.weightG, cfg.packages)])
      if (radio) click(radio)
      else f.missing.push('Dimensioni del pacco')
    }
    return f.result()
  },
}
