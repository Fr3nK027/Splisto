import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sameText } from '../src/content/text.ts'

test('sameText: pagina Modifica, si riscrive solo ciò che è cambiato', () => {
  assert.equal(sameText('499,99', '499.99'), true)
  assert.equal(sameText('499,99', '450'), false)
  assert.equal(sameText('✅ DESIGN MODERNO:\n\nRealizzato  in polyrattan.', 'DESIGN MODERNO: Realizzato in polyrattan'), true)
  assert.equal(sameText('Giacca usata poco', 'Giacca usata pochissimo'), false)
  assert.equal(sameText('', 'x'), false)
})
