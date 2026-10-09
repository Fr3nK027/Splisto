import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestMatch, conditionFrom, editUrlFor, idInUrl, parseNumber, facebookDescription, norm, parsePrice, parseVintedAlt, pickBySize, priceText, htmlToText, PHOTO_URL, platformOfUrl, PUBLISH_WORDS, sameItem, SITE_URL, withDetails } from '../src/content/text.ts'

const pick = (opts: string[], w: string) => bestMatch(opts, (s) => s, w)

test('norm', () => {
  assert.equal(norm('  Attività   all’aperto * '), 'attivita all’aperto')
  assert.equal(norm('Titolo:'), 'titolo')
})

test('bestMatch: exact beats contains', () => {
  assert.equal(pick(['Come nuovo', 'Nuovo'], 'Nuovo'), 'Nuovo')
  assert.equal(pick(['Usato - Come nuovo', 'Usato - Buone condizioni'], 'usato - buone'), 'Usato - Buone condizioni')
  assert.equal(pick(['Nuovo', 'Usato'], 'Nuovo con cartellino'), 'Nuovo')
  assert.equal(pick(['Ottime condizioni', 'Buone condizioni'], 'Buone'), 'Buone condizioni')
  assert.equal(pick(['Donna', 'Uomo'], 'Bambini'), undefined)
  assert.equal(pick(['a', 'b'], ''), undefined)
})

test('bestMatch: tie prefers last (deepest DOM node)', () => {
  const nodes = [{ id: 'outer', t: 'Donna' }, { id: 'inner', t: 'Donna' }]
  assert.equal(bestMatch(nodes, (n) => n.t, 'donna')?.id, 'inner')
})

test('priceText', () => {
  assert.equal(priceText(10), '10')
  assert.equal(priceText(10.5), '10,50')
  assert.equal(priceText(null), '')
})

test('withDetails', () => {
  assert.equal(withDetails({ description: 'Giacca Zara blu', brand: 'Zara', size: 'M', color: 'Blu' }), 'Giacca Zara blu\n\nTaglia: M')
  assert.equal(withDetails({ description: 'x', brand: '', size: '', color: '' }), 'x')
})

test('pickBySize', () => {
  const s: [number, string][] = [[1000, 'Piccolo'], [5000, 'Medio'], [Infinity, 'Grande']]
  assert.equal(pickBySize(800, s), 'Piccolo')
  assert.equal(pickBySize(3000, s), 'Medio')
  assert.equal(pickBySize(9000, s), 'Grande')
})

test('PUBLISH_WORDS', () => {
  for (const t of ['Pubblica', 'Metti in vendita', 'Pubblica annuncio', 'Carica', 'Pubblicalo', 'Pubblicare ora', 'Publicar', 'Subir producto', 'Publish']) assert.match(t, PUBLISH_WORDS)
  for (const t of ['Salva', 'Salva modifiche', 'Aggiorna', 'Pubblica annuncio']) assert.match(t, PUBLISH_WORDS)
  for (const t of ['Piccolo', 'Donna', 'Nuovo con cartellino', 'Usato - Buone condizioni', 'Caricabatterie', 'Salvataggi', 'Aggiornamento', 'Poster']) assert.doesNotMatch(t, PUBLISH_WORDS)
})

test('parseCount', async () => {
  const { parseCount } = await import('../src/content/text.ts')
  assert.equal(parseCount('Annuncio · 1.234 visualizzazioni · 5 preferiti', [/(\d[\d.]*)\s*visualizzazion/i]), 1234)
  assert.equal(parseCount('Preferiti: 7', [/(\d[\d.]*)\s*preferit/i, /preferiti\s*:?\s*(\d[\d.]*)/i]), 7)
  assert.equal(parseCount('niente', [/(\d+)\s*clic/i]), null)
})

test('sameUrl', async () => {
  const { sameUrl } = await import('../src/content/text.ts')
  assert.ok(sameUrl('https://www.vinted.it/items/123-giacca?referrer=x', 'https://www.vinted.it/items/123-giacca/'))
  assert.ok(!sameUrl('https://www.vinted.it/items/123', 'https://www.vinted.it/items/124'))
  assert.ok(!sameUrl('', ''))
})

test('parsePrice', () => {
  assert.equal(parsePrice('799,00 €'), 799)
  assert.equal(parsePrice('1.299 €'), 1299)
  assert.equal(parsePrice('Prezzo €449.99'), 449.99)
  assert.equal(parsePrice('24,99 €'), 24.99)
  assert.equal(parsePrice('EUR 566,68'), 566.68)
  assert.equal(parsePrice('EUR 1.234,00'), 1234)
  assert.equal(parsePrice('EUR 799.00 Buy It Now'), 799)
  assert.equal(parsePrice('EUR 1,299.00'), 1299)
  assert.equal(parsePrice('Item ID: 398366727822\nEUR 799.00 Buy It Now'), 799)
  assert.equal(parsePrice('EUR 499.99Local pickup'), 499.99)
  assert.equal(parsePrice('gratis'), null)
})

test('sameItem: titoli tagliati e prezzi vicini', () => {
  const fb = { title: 'SET DA GIARDINO BIZZOTTO IN POLYRATTAN CON TAVOLO ESTENSIBILE', price: 499 }
  assert.ok(sameItem({ title: 'SET DA GIARDINO BIZZOTTO IN POLYRATTAN CON TAVOLO', price: 499 }, fb))
  assert.ok(sameItem({ title: 'NAS QNAP 4-Bay TVS-463 🖥️', price: 449 }, { title: 'Nas QNAP 4-bay TVS-463 16GB Ram', price: 449.99 }))
  assert.ok(!sameItem({ title: 'MSI Katana gf66 12ue', price: 799 }, { title: 'Cover BURGA glitter rosa', price: 29.99 }))
  assert.ok(!sameItem({ title: 'Cover BURGA bianca marmo', price: 29.99 }, { title: 'Cover BURGA glitter rosa Samsung', price: 29.99 }))
  assert.ok(!sameItem({ title: 'MSI Katana gf66', price: 799 }, { title: 'MSI Katana gf66', price: 300 }))
})

test('conditionFrom', () => {
  assert.equal(conditionFrom('Ottime'), 'ottimo')
  assert.equal(conditionFrom('Usato - Buono'), 'buono')
  assert.equal(conditionFrom('Usato - Come nuovo'), 'ottimo')
  assert.equal(conditionFrom('Come nuovo - perfetto o ricondizionato'), 'nuovo')
  assert.equal(conditionFrom('Nuovo con cartellino'), 'nuovo_cartellino')
  assert.equal(conditionFrom('Danneggiato - usato con parti guaste'), 'discreto')
  assert.equal(conditionFrom(''), null)
})

test('parseVintedAlt', () => {
  assert.deepEqual(parseVintedAlt('Felpa con cappuccio Shoe in cotone 🌈, brand: Shoe, condizioni: Ottime, taglia: L, €24.99'), {
    title: 'Felpa con cappuccio Shoe in cotone 🌈',
    brand: 'Shoe',
    condition: 'Ottime',
    size: 'L',
  })
  assert.equal(parseVintedAlt('MSI Katana GF66 12ue, brand: MSI, condizioni: Ottime, €799.00').size, '')
})

test('facebookDescription', () => {
  const page = 'Annuncio\nDettagli\nCondizione\nUsato - Buono\nBrand\nBizzotto\nColore\nMarrone scuro\n✅ DESIGN MODERNO\nRitiro a mano.\nSan Lazzaro di Savena, Bologna · La posizione è approssimativa\nInformazioni sul venditore'
  assert.equal(facebookDescription(page), '✅ DESIGN MODERNO\nRitiro a mano.')
  assert.equal(facebookDescription('niente qui'), '')
})

test('SITE_URL / PHOTO_URL / platformOfUrl', () => {
  for (const u of ['https://www.vinted.it/items/1', 'https://areariservata.subito.it/annunci', 'https://it.wallapop.com/item/x', 'https://www.facebook.com/marketplace/item/1/'])
    assert.match(u, SITE_URL)
  for (const u of ['https://evil.example/ebay.it/itm/1234567', 'http://www.vinted.it/', 'https://vinted.it.evil.com/', 'javascript:alert(1)']) assert.doesNotMatch(u, SITE_URL)
  assert.match('https://images1.vinted.net/t/a/310x430/1.webp?s=x', PHOTO_URL)
  assert.match('https://scontent-mxp1-1.xx.fbcdn.net/v/x.jpg', PHOTO_URL)
  assert.doesNotMatch('https://evil.example/fbcdn.net/x.jpg', PHOTO_URL)
  assert.equal(platformOfUrl('https://signin.ebay.it/ws'), 'ebay')
  assert.equal(platformOfUrl('https://www.ebay.com/mys/active'), 'ebay')
  assert.equal(platformOfUrl('https://notvinted.it/'), null)
  assert.equal(platformOfUrl('nonsense'), null)
})

test('htmlToText', () => {
  const html = '<html><style>p{color:red}</style><body><div>Vendo <b>MSI</b> Katana&nbsp;GF66</div><p>Perfetto &amp; garantito</p><ul><li>16 GB</li><li>1 TB</li></ul><script>alert(1)</script></body></html>'
  assert.equal(htmlToText(html), 'Vendo MSI Katana GF66\nPerfetto & garantito\n- 16 GB\n- 1 TB')
})

test('editUrlFor / idInUrl', () => {
  assert.equal(idInUrl('https://www.vinted.it/items/9914875968-msi-katana'), '9914875968')
  assert.equal(editUrlFor('vinted', { url: 'https://www.vinted.it/items/9914875968-msi' }), 'https://www.vinted.it/items/9914875968/edit')
  assert.equal(editUrlFor('facebook', { remoteId: '27198695583163304' }), 'https://www.facebook.com/marketplace/edit/?listing_id=27198695583163304')
  assert.equal(editUrlFor('ebay', { remoteId: '398366727822' }), 'https://www.ebay.it/lstng?mode=ReviseItem&itemId=398366727822')
  assert.equal(
    editUrlFor('subito', { remoteId: '659756840', statsUrl: 'https://areariservata.subito.it/performance/id:ad:05b185d4-3617-4c83-951a-b18db9a4616c:list:659756840' }),
    'https://inserimento.subito.it/modifica?id=05b185d4-3617-4c83-951a-b18db9a4616c',
  )
  assert.equal(editUrlFor('subito', { remoteId: '659756840' }), null) // senza il link "Statistiche" manca l'uuid
  assert.equal(editUrlFor('wallapop', { remoteId: 'x' }), null)
  assert.equal(editUrlFor('wallapop', { url: 'https://it.wallapop.com/item/intero-album-pokemon-995239952' }), 'https://it.wallapop.com/item/intero-album-pokemon-995239952')
  assert.equal(editUrlFor('wallapop', { url: 'https://evil.example/item/x' }), null)
  assert.equal(editUrlFor('vinted', {}), null)
})

test('parseNumber / idInUrl eBay / entità', () => {
  assert.equal(parseNumber('19,90 €'), 19.9)
  assert.equal(parseNumber('€ 1.299,50'), 1299.5)
  assert.equal(parseNumber('1,299.50'), 1299.5)
  assert.equal(parseNumber('abc'), null)
  assert.equal(idInUrl('https://www.ebay.it/itm/cover-8001234567890/398366727822'), '398366727822')
  assert.equal(htmlToText('<p>Perch&eacute; &egrave; bello &#xE8; &euro; 5 &amp;lt;</p><table><tr><td>Marca</td><td>Nike</td></tr></table><link rel="x">'), 'Perché è bello è € 5 &lt;\nMarca Nike')
})
