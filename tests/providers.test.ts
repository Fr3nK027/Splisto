import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jsonFrom, originPattern, resolveAi, validBaseUrl } from '../src/lib/providers.ts'
import { cleanSettings } from '../src/lib/settings.ts'

test('resolveAi: modello e indirizzo del servizio, o quelli scritti a mano', () => {
  assert.deepEqual(resolveAi({ provider: 'gemini', model: '', baseUrl: 'https://evil.example' }), {
    id: 'gemini',
    model: 'gemini-flash-latest',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
  }) // l'indirizzo conta solo per custom e ollama
  assert.equal(resolveAi({ provider: 'custom', model: 'x', baseUrl: 'https://api.example.com/v1/' }).baseUrl, 'https://api.example.com/v1')
  assert.equal(resolveAi({ provider: 'ollama', model: '', baseUrl: '' }).baseUrl, 'http://localhost:11434/v1')
})

test('validBaseUrl e permessi', () => {
  assert.equal(validBaseUrl('https://api.groq.com/openai/v1'), true)
  assert.equal(validBaseUrl('http://localhost:11434/v1'), true)
  assert.equal(validBaseUrl('http://example.com/v1'), false)
  assert.equal(validBaseUrl('javascript:alert(1)'), false)
  assert.equal(originPattern('http://localhost:11434/v1'), 'http://localhost/*')
})

test('jsonFrom: JSON anche dentro ``` o con testo intorno', () => {
  assert.deepEqual(jsonFrom('Ecco:\n```json\n{"vinted":"Giacca"}\n```'), { vinted: 'Giacca' })
  assert.throws(() => jsonFrom('nessun json'))
})

test('cleanSettings: servizio AI dal backup senza indirizzo', () => {
  assert.deepEqual(cleanSettings({ ai: { provider: 'groq', model: 'llama', baseUrl: 'https://evil.example' } }).ai, { provider: 'groq', model: 'llama', baseUrl: '' })
  assert.equal(cleanSettings({ ai: { provider: 'custom', model: 'x', baseUrl: 'https://evil.example' } }).ai, undefined)
  assert.equal(cleanSettings({ ai: { provider: 'gemini', model: 'a b<script>' } }).ai?.model, '')
})
