import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }

// Nomi dei file senza hash: dopo una nuova build l'estensione già caricata in Chrome trova ancora i suoi file
// (con l'hash, i nomi cambiavano e le schede aperte dall'estensione restavano ferme fino a "Ricarica").
const names = { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' }

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  // Senza svuotare dist: i file (con nomi fissi) vengono sovrascritti al loro posto. Svuotandola, Chrome poteva
  // cercare il service worker proprio mentre mancava e segnare "An unknown error occurred when fetching the script".
  build: { emptyOutDir: false, rollupOptions: { output: names } },
})
