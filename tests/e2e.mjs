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
// pagina "Vinted" finta per l'eliminazione: "Cancella" apre la conferma, la conferma porta al profilo
const ITEM = `<!doctype html><body>
<button data-testid="item-delete-button">Cancella</button>
<div id="modal" hidden><button data-testid="item-delete-confirmation-button">Conferma</button></div>
<script>
document.querySelector('[data-testid="item-delete-button"]').onclick = () => { document.getElementById('modal').hidden = false }
document.querySelector('[data-testid="item-delete-confirmation-button"]').onclick = () => { location.href = '/member/1' }
</script></body>`
const idb = (page, op, value) =>
  page.evaluate(
    (op, value) =>
      new Promise((ok, ko) => {
        const r = indexedDB.open('multipost', 1)
        r.onsuccess = () => {
          const tx = r.result.transaction('listings', 'readwrite')
          const q = op === 'put' ? tx.objectStore('listings').put(value) : tx.objectStore('listings').get(value)
          tx.oncomplete = () => ok(q.result ?? null)
          tx.onerror = ko
        }
      }),
    op,
    value,
  )
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

  // Eliminazione: annuncio online su Vinted, eliminato in Splisto. La pagina del sito è finta (la rete non la vede).
  await idb(dash, 'put', { id: 'e2e', title: 'Prova', updatedAt: Date.now(), deleting: true, status: { vinted: { state: 'published', url: 'https://www.vinted.it/items/1-prova' } } })
  const site = await browser.newPage()
  await site.setRequestInterception(true)
  site.on('request', (r) => (r.url().startsWith('https://www.vinted.it/') ? r.respond({ status: 200, contentType: 'text/html', body: r.url().includes('/items/') ? ITEM : '<body>profilo</body>' }) : r.continue()))
  await site.goto('https://www.vinted.it/start')
  const worker = await sw.worker()
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.vinted.it/start' }))[0].id)
  await worker.evaluate((id) => chrome.storage.session.set({ [`job:${id}`]: { listingId: 'e2e', platform: 'vinted', kind: 'remove', autoClose: true } }), tabId)
  await dash.evaluate(() => chrome.runtime.sendMessage({ type: 'login', platform: 'ebay' })) // un lavoro qualsiasi registra lo script
  await sleep(1500)
  const closed = new Promise((r) => site.once('close', r))
  await site.goto('https://www.vinted.it/items/1-prova')
  await Promise.race([closed, sleep(20_000)])
  await sleep(1500)
  assert.equal(site.isClosed(), true, 'eliminato dal sito: scheda chiusa')
  assert.equal(await idb(dash, 'get', 'e2e'), null, 'eliminato dal sito: tolto anche da Splisto')
  console.log('e2e ok')
} finally {
  await browser.close()
}
