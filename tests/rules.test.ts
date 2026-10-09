import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowed, missingFromSite, sameRemote } from '../src/background/rules.ts'
import type { Msg, PlatformStatus } from '../src/lib/types.ts'

const ID = 'ext'
const BASE = 'chrome-extension://ext/'
const dash = { id: ID, url: `${BASE}src/dashboard/index.html` }
const tab = (url: string) => ({ id: ID, url, tab: {} })

test('allowed: comandi solo dalla dashboard', () => {
  const publish: Msg = { type: 'publish', listingId: 'a', platforms: ['vinted'] }
  assert.equal(allowed(publish, dash, ID, BASE), true)
  assert.equal(allowed(publish, tab('https://www.vinted.it/items/new'), ID, BASE), false)
  assert.equal(allowed(publish, { ...dash, id: 'altra' }, ID, BASE), false) // altra estensione
  assert.equal(allowed({ type: 'statusChanged', listingId: 'a' }, dash, ID, BASE), false)
  assert.equal(allowed({ type: 'login', platform: 'ebay' }, tab('https://www.ebay.it/'), ID, BASE), false) // solo la dashboard apre il login
})

test('allowed: le schede parlano solo per il proprio sito', () => {
  const auth = (platform: 'ebay' | 'facebook'): Msg => ({ type: 'auth', platform, ok: true })
  assert.equal(allowed(auth('facebook'), tab('https://www.facebook.com/marketplace/create/item'), ID, BASE), true)
  assert.equal(allowed(auth('ebay'), tab('https://www.facebook.com/marketplace/create/item'), ID, BASE), false)
  assert.equal(allowed(auth('ebay'), tab('https://ebay.it.evil.example/'), ID, BASE), false)
  assert.equal(allowed({ type: 'published', url: 'x' }, { id: ID, url: 'https://www.vinted.it/items/1' }, ID, BASE), false) // senza scheda
  assert.equal(allowed({ type: 'published', url: 'x' }, tab('https://www.vinted.it/items/1'), ID, BASE), true)
})

const pub = (over: Partial<PlatformStatus> = {}): PlatformStatus => ({ state: 'published', url: 'https://www.vinted.it/items/1234567-giacca', publishedAt: 0, ...over })

test('sameRemote: id, link o id nel link', () => {
  assert.equal(sameRemote(pub({ remoteId: '9' }), { remoteId: '9', url: 'https://www.vinted.it/items/9' }), true)
  assert.equal(sameRemote(pub(), { remoteId: '1234567', url: 'https://www.vinted.it/items/9999999' }), true)
  assert.equal(sameRemote(pub(), { remoteId: '7', url: 'https://www.vinted.it/items/7' }), false)
  assert.equal(sameRemote(undefined, { remoteId: '7', url: 'https://www.vinted.it/items/7' }), false)
})

test('missingFromSite: solo pubblicati da più di un\'ora e non visti', () => {
  const now = 10 * 3_600_000
  assert.equal(missingFromSite(pub(), false, new Set(), [], now), true)
  assert.equal(missingFromSite(pub(), false, new Set(['1234567']), [], now), false) // id nel link
  assert.equal(missingFromSite(pub({ remoteId: 'r' }), false, new Set(['r']), [], now), false)
  assert.equal(missingFromSite(pub(), false, new Set(), ['https://www.vinted.it/items/1234567-giacca'], now), false)
  assert.equal(missingFromSite(pub(), true, new Set(), [], now), false) // venduto
  assert.equal(missingFromSite(pub({ publishedAt: now - 60_000 }), false, new Set(), [], now), false) // appena pubblicato
  assert.equal(missingFromSite(pub({ state: 'removed' }), false, new Set(), [], now), false)
  assert.equal(missingFromSite({ state: 'published' }, false, new Set(), [], now), false) // senza link né id
})
