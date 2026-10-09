import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanSettings } from '../src/lib/settings.ts'

test('cleanSettings: tiene solo chiavi note e valori validi', () => {
  const out = cleanSettings({
    apiKey: 'sk-ant-rubata',
    authEvery: 0.01,
    'learned:ebay': { condition: 'button.publish' },
    afterReload: 'importAll',
    tone: 'amichevole',
    sequential: 'si',
    footers: { all: 'Spedisco in 24h', evil: 'x', ebay: 42 },
    fees: { vinted: { pct: 5, fixed: 0.7 }, ebay: { pct: 900, fixed: -1 } },
  })
  assert.deepEqual(Object.keys(out).sort(), ['fees', 'footers', 'tone'])
  assert.equal(out.tone, 'amichevole')
  assert.deepEqual(out.footers, { all: 'Spedisco in 24h' })
  assert.deepEqual(out.fees?.vinted, { pct: 5, fixed: 0.7 })
  assert.deepEqual(out.fees?.ebay, { pct: 0, fixed: 0 })
  assert.equal(cleanSettings({ authEvery: 6 }).authEvery, 6)
})
