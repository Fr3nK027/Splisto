import type { Adapter } from '../../lib/types'
import { clickText, findOne, Form, sleep } from '../dom'
import cfg from '../selectors/facebook'
import { priceText } from '../text'

export const facebook: Adapter = {
  async fill(l, opts) {
    const f = new Form(cfg.fields, opts)
    await f.ready('title')
    if (cfg.uploadPhotos && !opts?.edit && !opts?.skipPhotos && l.photos.length) {
      await f.photos(l.photos)
      // aspetta che Facebook le carichi tutte (il contatore "N/10" sale man mano)
      const want = Math.min(l.photos.length, 10)
      for (let i = 0; i < 40 && Number(document.body.innerText.match(cfg.photoCount)?.[1] ?? 0) < want; i++) await sleep(500)
      const got = Number(document.body.innerText.match(cfg.photoCount)?.[1] ?? 0)
      if (got < want) f.missing.push(got ? `Foto (caricate ${got} su ${want})` : 'Foto (da caricare a mano)')
    } else if (!opts?.edit && !opts?.skipPhotos && l.photos.length) f.missing.push('Foto (da caricare a mano)')
    await f.text('title', 'Titolo', l.title, 'required')
    await f.text('price', 'Prezzo', priceText(l.price), 'required')
    if (!opts?.edit) await f.choose('category', 'Categoria', l.categoryText, 'required')
    await f.choose('condition', 'Condizione', cfg.conditions[l.condition], 'required')
    // Descrizione e marca stanno nella sezione richiudibile "Altri dettagli"
    if (!findOne(cfg.fields.description) && clickText(cfg.moreDetails, '[role="button"],div,span')) await sleep(800)
    await f.text('description', 'Descrizione', l.description)
    await f.text('brand', 'Marca', l.brand, 'optional') // compare solo per alcune categorie
    return f.result()
  },
}
