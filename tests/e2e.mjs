// Prova vera dell'estensione compilata (npm run build, poi npm run e2e): browser con profilo pulito, dist caricata.
// Controlla che lo script dei siti esista solo durante un lavoro e che i 5 siti rispondano a "Verifica accessi"
// (profilo pulito = non connesso: l'esito atteso è "Disconnesso", che arriva solo se lo script è girato).
// Browser: variabile BROWSER, altrimenti Edge (Chrome ufficiale ignora --load-extension dalla versione 137).
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const ext = resolve('dist')
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: false,
  userDataDir: mkdtempSync(join(tmpdir(), 'splisto-e2e-')),
  args: ['--no-first-run', '--no-default-browser-check', `--load-extension=${ext}`, `--disable-extensions-except=${ext}`],
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SITES = ['vinted', 'ebay', 'subito', 'facebook', 'wallapop']
try {
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 20_000 })
  const dash = await browser.newPage()
  await dash.goto(sw.url().replace('service-worker-loader.js', 'src/dashboard/index.html'))
  const registered = () => dash.evaluate(() => chrome.scripting.getRegisteredContentScripts().then((s) => s.length))

  assert.equal(await registered(), 0, 'a riposo lo script dei siti non deve esistere')
  assert.equal(await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'checkAuth' })), true, 'il service worker risponde')
  await sleep(1500)
  assert.equal(await registered(), 1, 'durante il lavoro lo script è registrato')

  let auth = {}
  for (let i = 0; i < 40 && !SITES.every((p) => auth[`auth:${p}`] && !auth[`auth:${p}`].checking); i++) {
    await sleep(1500)
    auth = await dash.evaluate((keys) => chrome.storage.local.get(keys), SITES.map((p) => `auth:${p}`))
  }
  for (const p of SITES) assert.equal(auth[`auth:${p}`]?.ok, false, `${p}: lo script ha visto la pagina di accesso`)
  await sleep(1500)
  assert.equal(await registered(), 0, 'finiti i lavori lo script sparisce')

  // "Accedi": la scheda di accesso è un lavoro finché resta aperta (conferma da sola il rientro)
  const opened = new Promise((r) => browser.once('targetcreated', (t) => r(t)))
  assert.equal(await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'login', platform: 'vinted' })), true)
  const login = await (await opened).page()
  await sleep(2000)
  assert.equal(await registered(), 1, 'scheda di accesso aperta: script registrato')
  await login.close()
  await sleep(1500)
  assert.equal(await registered(), 0, 'scheda di accesso chiusa: script tolto')
  console.log('e2e ok')
} finally {
  await browser.close()
}
