import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }

// Nomi dei file senza hash: dopo una nuova build l'estensione già caricata in Chrome trova ancora i suoi file
// (con l'hash, i nomi cambiavano e le schede aperte dall'estensione restavano ferme fino a "Ricarica").
const names = { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' }

// crxjs rende lo script dei siti (import "?iife") leggibile da qualsiasi pagina web, che così può accorgersi
// dell'estensione. chrome.scripting.executeScript non ne ha bisogno: si toglie dal manifest finale.
const noWebAccessible: Plugin = {
  name: 'no-web-accessible-resources',
  enforce: 'post',
  // order 'post': dopo il passaggio in cui crxjs completa il manifest
  generateBundle: {
    order: 'post',
    handler(_, bundle) {
      const asset = bundle['manifest.json']
      if (asset?.type !== 'asset') return
      const m = JSON.parse(String(asset.source))
      delete m.web_accessible_resources
      asset.source = JSON.stringify(m, null, 2)
    },
  },
}

export default defineConfig({
  plugins: [react(), crx({ manifest }), noWebAccessible],
  // Senza svuotare dist: i file (con nomi fissi) vengono sovrascritti al loro posto. Svuotandola, Chrome poteva
  // cercare il service worker proprio mentre mancava e segnare "An unknown error occurred when fetching the script".
  build: { emptyOutDir: false, rollupOptions: { output: names } },
})
