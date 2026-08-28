#!/usr/bin/env node
// Applica sul progetto di PROVA le migrazioni storiche 0001–0019 nell'ordine
// corretto (una per volta, stop al primo errore). Guardia anti-produzione
// dentro ogni chiamata sql().
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from './api.mjs'

const DIR = 'supabase/migrations'
const file = readdirSync(DIR).filter(f => /^00(0[1-9]|1[0-9])_/.test(f)).sort()
if (file.length !== 19) { console.error('Attese 19 migrazioni, trovate', file.length); process.exit(1) }
for (const f of file) {
  const q = readFileSync(join(DIR, f), 'utf8')
  process.stdout.write('applico ' + f + ' … ')
  await sql(q)
  console.log('ok')
}
console.log('Migrazioni 0001–0019 applicate.')
