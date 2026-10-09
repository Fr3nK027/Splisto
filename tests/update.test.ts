import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newer, safePath } from '../src/lib/update.ts'

test('newer: confronta le versioni numero per numero', () => {
  assert.equal(newer('1.2.0', '1.1.0'), true)
  assert.equal(newer('1.10.0', '1.9.2'), true)
  assert.equal(newer('1.2', '1.2.0'), false)
  assert.equal(newer('1.1.0', '1.1.0'), false)
  assert.equal(newer('1.0.9', '1.1.0'), false)
})

test('safePath: solo percorsi dentro la cartella dell\'estensione', () => {
  assert.equal(safePath('src/dashboard/index.html'), true)
  assert.equal(safePath('manifest.json'), true)
  for (const p of ['../x.js', 'a/../../x', '/etc/x', 'a//b', 'C:/x', 'a\\b', '']) assert.equal(safePath(p), false, p)
})
