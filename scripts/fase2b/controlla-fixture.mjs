#!/usr/bin/env node
// ============================================================================
// CONTROLLO PRE-UPLOAD della fixture (Fase 2B): la cartella deve contenere
// SOLO SQL/JSON/CSV/TXT piccoli e file finti — nessuna immagine, PDF o
// documento reale, nessuna email, nessun riferimento al progetto di
// produzione. Se qualcosa non torna: exit 1 e NIENTE upload.
// ============================================================================
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { refProduzione } from './guardia.mjs'

const DIR = process.argv[2] || join(homedir(), '.gestionale-2b', 'fixture')
const ESTENSIONI_OK = new Set(['sql', 'json', 'csv', 'txt'])
const MAGIC_VIETATI = [
  [0xff, 0xd8, 0xff],          // JPEG
  [0x89, 0x50, 0x4e, 0x47],    // PNG
  [0x25, 0x50, 0x44, 0x46],    // PDF (%PDF)
  [0x47, 0x49, 0x46],          // GIF
  [0x50, 0x4b],                // ZIP/Office
]
let errori = 0
const err = m => { console.log('  ✗ ' + m); errori++ }

const file = readdirSync(DIR, { recursive: true })
  .filter(f => statSync(join(DIR, f)).isFile())
console.log(`Controllo ${file.length} file in ${DIR}`)
const prod = refProduzione()

for (const f of file) {
  const p = join(DIR, f)
  const ext = f.split('.').pop().toLowerCase()
  if (!ESTENSIONI_OK.has(ext)) err(`estensione non ammessa: ${f}`)
  const st = statSync(p)
  if (st.size > 5 * 1024 * 1024) err(`file troppo grande (${st.size} byte): ${f}`)
  const buf = readFileSync(p)
  for (const magic of MAGIC_VIETATI) {
    if (magic.every((b, i) => buf[i] === b)) err(`contenuto binario vietato (immagine/PDF/archivio): ${f}`)
  }
  const testo = buf.toString('utf8')
  if (testo.includes(prod)) err(`riferimento alla PRODUZIONE dentro: ${f}`)
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/.test(testo)) err(`possibile EMAIL dentro: ${f}`)
  if (/sb_secret|sbp_|service_role_key|eyJhbGciOi/.test(testo)) err(`possibile CHIAVE dentro: ${f}`)
}
if (errori > 0) { console.error(`CONTROLLO FALLITO: ${errori} problemi. NIENTE upload.`); process.exit(1) }
console.log('CONTROLLO OK: solo SQL/JSON/CSV/TXT sintetici, nessun contenuto reale.')
