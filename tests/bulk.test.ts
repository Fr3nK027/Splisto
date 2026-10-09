import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bulkPatch, newPrice, newText, snapshot } from '../src/lib/bulk.ts'
import { outOfSync } from '../src/lib/platforms.ts'
import type { Listing } from '../src/lib/types.ts'

const base = (over: Partial<Listing> = {}): Listing => ({
  id: 'a',
  createdAt: 0,
  updatedAt: 0,
  title: 'Giacca Levis',
  description: 'Usata poco.',
  price: 40,
  category: 'altro',
  condition: 'buono',
  brand: '',
  size: '',
  color: '',
  weightG: null,
  dims: '',
  photos: [],
  platforms: ['vinted', 'ebay'],
  categoryOverride: {},
  titleOverride: {},
  priceOverride: {},
  sold: null,
  status: {},
  stats: {},
  ...over,
})

test('newPrice', () => {
  assert.equal(newPrice(40, { mode: 'pct', value: -10 }), 36)
  assert.equal(newPrice(29.99, { mode: 'add', value: -5 }), 24.99)
  assert.equal(newPrice(10, { mode: 'add', value: -50 }), 0)
  assert.equal(newPrice(null, { mode: 'pct', value: 10 }), null)
  assert.equal(newPrice(null, { mode: 'set', value: 15 }), 15)
})

test('newText', () => {
  assert.equal(newText('Usata poco.', { mode: 'append', text: 'Spedisco in 24h' }), 'Usata poco.\n\nSpedisco in 24h')
  assert.equal(newText('', { mode: 'append', text: 'Spedisco in 24h' }), 'Spedisco in 24h')
  assert.equal(newText('Usata poco.', { mode: 'prepend', text: 'SCONTATO' }), 'SCONTATO\n\nUsata poco.')
  assert.equal(newText('ritiro a Bologna, Bologna', { mode: 'replace', find: 'Bologna', text: 'Milano' }), 'ritiro a Milano, Milano')
  assert.equal(newText('abc', { mode: 'replace', find: '', text: 'x' }), 'abc')
  assert.equal(newText('abc', { mode: 'append', text: '  ' }), 'abc')
})

test('bulkPatch: solo i campi che cambiano, prezzi per sito inclusi', () => {
  const l = base({ priceOverride: { ebay: 50 } })
  const p = bulkPatch(l, { price: { mode: 'pct', value: -10 }, condition: 'buono', addPlatforms: ['subito'], removePlatforms: ['ebay'] })
  assert.equal(p.price, 36)
  assert.deepEqual(p.priceOverride, { ebay: 45 })
  assert.equal('condition' in p, false) // già "buono"
  assert.deepEqual(p.platforms, ['vinted', 'subito'])
  assert.deepEqual(snapshot(l, p), { price: 40, priceOverride: { ebay: 50 }, platforms: ['vinted', 'ebay'] })
  assert.deepEqual(bulkPatch(base(), {}), {})
  assert.deepEqual(bulkPatch(base(), { price: { mode: 'set', value: 40 } }), {})
})

test('outOfSync: prezzo o titolo diversi dal sito', () => {
  const pub = (over: object) => ({ vinted: { state: 'published' as const, sitePrice: 40, siteTitle: 'Giacca Levis', ...over } })
  assert.deepEqual(outOfSync(base({ status: pub({}) }), 'vinted'), [])
  assert.deepEqual(outOfSync(base({ price: 36, status: pub({}) }), 'vinted'), ['prezzo'])
  assert.deepEqual(outOfSync(base({ priceOverride: { vinted: 40 }, price: 30, status: pub({}) }), 'vinted'), [])
  assert.deepEqual(outOfSync(base({ title: 'Giacca Levis taglia M usata', status: pub({ siteTitle: 'Giacca Levis taglia M' }) }), 'vinted'), []) // tagliato dal sito
  assert.deepEqual(outOfSync(base({ title: 'Felpa Nike', status: pub({}) }), 'vinted'), ['titolo'])
  assert.deepEqual(outOfSync(base({ price: 36 }), 'vinted'), []) // non pubblicato
  assert.deepEqual(outOfSync(base({ price: 36, status: pub({ sitePrice: undefined }) }), 'vinted'), []) // prezzo sul sito sconosciuto
})
