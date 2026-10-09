import type { Adapter, FillResult, JobListing } from '../../lib/types'
import { clickText, findOne, Form, setText, sleep } from '../dom'
import cfg from '../selectors/wallapop'
import { priceText } from '../text'

/*
 * Annuncio nuovo su Wallapop: è una procedura a passi sulla stessa pagina (verificata 10/2026).
 * "Cosa pubblicherai?" -> "Riepilogo del prodotto" + Continua -> Foto + Continua -> modulo.
 * L'estensione fa la sua parte a ogni passo e riparte quando compare il successivo; i "Continua" li premi tu.
 */
const PHOTOS_DONE = 'multipost-wallapop-photos' // foto già inserite in questa scheda (il modulo non le ricarica)
const fileInput = 'input[type="file"]'
const wait = (msg: string, resumeOn: NonNullable<FillResult['resumeOn']>): FillResult => ({ ok: false, waiting: true, resumeOn, missingFields: msg ? [msg] : [] })

async function fillForm(l: JobListing, f: Form, edit: boolean) {
  await f.ready('title')
  await f.text('title', 'Titolo', l.title, 'required')
  if (!edit) await f.choose('category', 'Categoria', l.categoryText)
  await f.text('description', 'Descrizione', l.description, 'required')
  await f.choose('condition', 'Stato', cfg.conditions[l.condition], 'optional')
  await f.text('price', 'Prezzo', priceText(l.price), 'required')
  await f.text('brand', 'Marca', l.brand, 'optional')
  await f.choose('size', 'Taglia', l.size, 'optional')
  return f.result()
}

export const wallapop: Adapter = {
  async fill(l, opts) {
    // pagina "Modifica": modulo completo, foto e categoria restano quelle del sito
    if (opts?.edit) return fillForm(l, new Form(cfg.fields, opts), true)

    // modulo completo (ultimo passo)
    if (findOne(cfg.fields.title)) {
      const photosDone = sessionStorage.getItem(PHOTOS_DONE) === '1'
      sessionStorage.removeItem(PHOTOS_DONE)
      return fillForm(l, new Form(cfg.fields, { ...opts, skipPhotos: true }), false).then((r) =>
        photosDone || opts?.skipPhotos ? r : { ...r, ok: false, missingFields: [...r.missingFields, 'Foto (da controllare)'] },
      )
    }

    // passo "Foto": inseriscile, poi tocca a te premere Continua
    if (findOne([fileInput]) && findOne(cfg.summary)) {
      if (sessionStorage.getItem(PHOTOS_DONE) !== '1' && !opts?.skipPhotos) {
        const f = new Form(cfg.fields, opts)
        await f.photos(l.photos)
        if (f.missing.length) return wait('Aggiungi le foto su Wallapop e premi “Continua”: il modulo si compila da solo', cfg.fields.title)
        sessionStorage.setItem(PHOTOS_DONE, '1')
      }
      return wait('Controlla le foto su Wallapop e premi “Continua”: il modulo si compila da solo', cfg.fields.title)
    }

    // passo "Riepilogo del prodotto"
    const summary = findOne(cfg.summary)
    if (summary) {
      setText(summary, l.title.slice(0, 50))
      return wait('Su Wallapop premi “Continua” (se è grigio, scrivi una lettera nel riepilogo): poi foto e modulo si compilano da soli', [fileInput])
    }

    // primo passo "Cosa pubblicherai?"
    if (clickText(cfg.firstStep, 'button,[role="button"]')) {
      await sleep(1500)
      return wait('', cfg.summary) // resta "in compilazione": il passo dopo arriva da solo
    }
    return wait('Su Wallapop scegli “Qualcosa che non uso più”: il modulo si compila da solo', cfg.summary)
  },
}
