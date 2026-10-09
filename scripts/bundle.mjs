// Pacchetto per l'aggiornamento dalla dashboard (src/lib/update.ts): tutti i file di una build in un JSON, in base64.
// Uso: node scripts/bundle.mjs dist splisto.json
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const [dir, out] = process.argv.slice(2)
const files = {}
for (const f of readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!f.isFile()) continue
  const path = join(f.parentPath, f.name)
  files[relative(dir, path).split(sep).join('/')] = readFileSync(path).toString('base64')
}
const { version } = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
writeFileSync(out, JSON.stringify({ version, files }))
console.log(`${out}: ${version}, ${Object.keys(files).length} file`)
