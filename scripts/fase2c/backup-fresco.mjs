#!/usr/bin/env node
// ============================================================================
// FASE 2C-A — BACKUP FRESCO della produzione, in SOLA LETTURA ASSOLUTA.
//
// Guardia: verso la produzione sono ammessi ESCLUSIVAMENTE GET e HEAD.
// Qualsiasi tentativo di POST/PATCH/PUT/DELETE/RPC/SQL interrompe tutto.
// (Per questo l'elenco dei file NON usa l'API di listing dello storage, che
// è una POST: i percorsi arrivano da family_receipts.storage_path, già
// verificato in passato come elenco completo del bucket.)
//
// Legge .env.local senza mostrarlo. Non crea token. Non scrive nulla su
// Supabase. Doppio inventario: ripete finché due letture consecutive
// coincidono (l'app resta usabile nel frattempo).
//
// Uso: node scripts/fase2c/backup-fresco.mjs "<cartella di destinazione>"
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const DEST = process.argv[2]
if (!DEST) { console.error('Serve la cartella di destinazione'); process.exit(1) }
if (existsSync(DEST) && readdirSync(DEST).length > 0) {
  console.error('La destinazione esiste già e non è vuota: NON sovrascrivo. STOP.')
  process.exit(1)
}

// ---- credenziali (mai stampate) ----
const REPO = join(dirname(new URL(import.meta.url).pathname), '..', '..')
const env = Object.fromEntries(
  readFileSync(join(REPO, '.env.local'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_PROD = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
const REF = URL_PROD.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1]
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
console.log('produzione (mascherata):', REF.slice(0, 4) + '****', '· modalità SOLA LETTURA')

// ---- GUARDIA ASSOLUTA: solo GET/HEAD verso la produzione ----
async function fetchProd(percorso, metodo = 'GET', headers = {}) {
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    console.error(`GUARDIA SOLA LETTURA: tentato ${metodo} verso la produzione. STOP TOTALE.`)
    process.exit(3)
  }
  if (!percorso.startsWith('/')) { console.error('GUARDIA: percorso non valido'); process.exit(3) }
  for (let i = 0; i < 6; i++) {
    const r = await fetch(URL_PROD + percorso, {
      method: metodo,
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, ...headers },
    })
    if (r.status === 401 && (await r.clone().text()).includes('PGRST303')) {
      await new Promise(x => setTimeout(x, 1500)); continue // skew orologio gateway
    }
    return r
  }
  throw new Error('richiesta fallita dopo i tentativi')
}

const TABELLE = ['family_groups', 'family_categories', 'family_subcategories', 'family_expenses',
  'family_expense_items', 'family_receipts', 'family_budgets', 'family_product_rules']

// paginazione esplicita via Range (GET)
async function tabella(nome) {
  const righe = []
  for (let da = 0; ; da += 1000) {
    const r = await fetchProd(`/rest/v1/${nome}?select=*&order=id`, 'GET', { Range: `${da}-${da + 999}` })
    if (!r.ok) throw new Error(`${nome}: ${r.status}`)
    const blocco = await r.json()
    righe.push(...blocco)
    if (blocco.length < 1000) break
  }
  return righe
}

const sha256 = buf => createHash('sha256').update(buf).digest('hex')
const cent = n => Math.round(Number(n) * 100)

// ---- DOPPIO INVENTARIO: due letture consecutive identiche ----
async function inventario() {
  const dati = {}
  for (const t of TABELLE) dati[t] = await tabella(t)
  const impronta = sha256(Buffer.from(JSON.stringify(dati)))
  return { dati, impronta }
}
let lettura = await inventario()
for (let giro = 1; giro <= 6; giro++) {
  const seconda = await inventario()
  if (seconda.impronta === lettura.impronta) {
    console.log(`inventario stabile al giro ${giro} (due letture consecutive identiche)`)
    lettura = seconda
    break
  }
  console.log(`inventario cambiato durante la lettura (giro ${giro}): riprovo…`)
  lettura = seconda
  if (giro === 6) { console.error('inventario mai stabile in 6 giri: STOP.'); process.exit(1) }
}
const dati = lettura.dati

// ---- scrittura tabelle (JSON + CSV) ----
mkdirSync(join(DEST, 'tabelle'), { recursive: true })
const csvEsc = v => {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const colonne = {}
for (const t of TABELLE) {
  writeFileSync(join(DEST, 'tabelle', `${t}.json`), JSON.stringify(dati[t], null, 1))
  const cols = [...new Set(dati[t].flatMap(r => Object.keys(r)))]
  colonne[t] = cols
  writeFileSync(join(DEST, 'tabelle', `${t}.csv`),
    '﻿' + [cols.join(';'), ...dati[t].map(r => cols.map(c => csvEsc(r[c])).join(';'))].join('\n'))
  console.log(`tabella ${t}: ${dati[t].length} righe`)
}

// ---- inventario Auth SOLO mascherato (GET) ----
const rAuth = await fetchProd('/auth/v1/admin/users?page=1&per_page=100')
const utenti = ((await rAuth.json()).users || []).map(u => ({
  email_mascherata: (u.email || '').slice(0, 2) + '***@' + (u.email || '@').split('@')[1],
  creato: (u.created_at || '').slice(0, 10),
  ultimo_accesso: (u.last_sign_in_at || 'mai').slice(0, 10),
}))
writeFileSync(join(DEST, 'utenti-auth-mascherati.json'), JSON.stringify(utenti, null, 2))
console.log('utenti auth (mascherati):', utenti.length)

// ---- file del bucket (GET, percorsi dalle ricevute) ----
mkdirSync(join(DEST, 'scontrini'), { recursive: true })
const fileManifest = []
for (const rct of dati.family_receipts) {
  const r = await fetchProd('/storage/v1/object/scontrini/' + rct.storage_path.split('/').map(encodeURIComponent).join('/'))
  if (!r.ok) { console.error('file NON scaricabile:', rct.storage_path, r.status, '— STOP'); process.exit(1) }
  const buf = Buffer.from(await r.arrayBuffer())
  const percorso = join(DEST, 'scontrini', rct.storage_path)
  mkdirSync(dirname(percorso), { recursive: true })
  writeFileSync(percorso, buf)
  fileManifest.push({
    storage_path: rct.storage_path, receipt_id: rct.id, byte: buf.length,
    tipo: r.headers.get('content-type') || 'sconosciuto', sha256: sha256(buf),
  })
}
console.log('file scaricati:', fileManifest.length)

// ---- totali in centesimi + manifest ----
const ambitoDi = new Map(dati.family_groups.map(g => [g.id, g.ambito || 'personale']))
const tot = amb => dati.family_expenses
  .filter(e => (e.group_id ? ambitoDi.get(e.group_id) : 'personale') === amb)
  .reduce((s, e) => s + cent(e.amount), 0)
const senzaDoc = dati.family_expenses.filter(e => !e.receipt_id)
let branch = '?', commit = '?'
try {
  branch = execSync('git branch --show-current', { cwd: REPO }).toString().trim()
  commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim()
} catch { /* git non disponibile */ }

const manifest = {
  generato_il: new Date().toISOString(),
  produzione_mascherata: REF.slice(0, 4) + '****',
  codice: { branch, commit },
  attesi: {
    spese: dati.family_expenses.length,
    righe: dati.family_expense_items.length,
    documenti: dati.family_receipts.length,
    gruppi: dati.family_groups.length,
    categorie: dati.family_categories.length,
    sottocategorie: dati.family_subcategories.length,
    regole: dati.family_product_rules.length,
    totalePersonaleCent: tot('personale'),
    totaleAziendaCent: tot('azienda'),
    senzaDocumento: senzaDoc.length,
    senzaDocumentoCent: senzaDoc.reduce((s, e) => s + cent(e.amount), 0),
    collegamenti: dati.family_expenses.filter(e => e.receipt_id).length,
    utentiAuth: utenti.length,
  },
  colonne,
  file: fileManifest,
}
writeFileSync(join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2))

writeFileSync(join(DEST, 'LEGGIMI.md'), `# Backup completo spese pre-2C — 28 agosto 2026

Backup di SOLA LETTURA fatto PRIMA di applicare le migrazioni 0020/0021
(Fase 2C). Nessuna scrittura è avvenuta su Supabase.

Codice al momento del backup: branch ${branch}, commit ${commit}.

## Contenuto
- tabelle/ — le ${TABELLE.length} tabelle family_* complete (JSON + CSV, separatore ;),
  con tutti gli ID e le relazioni originali.
- scontrini/ — tutti i ${fileManifest.length} file del bucket, percorsi originali.
- manifest.json — conteggi, totali in CENTESIMI, colonne, hash SHA-256 di
  ogni file, branch/commit del codice.
- utenti-auth-mascherati.json — solo numero e indirizzi mascherati.

## Ripristino (in caso di bisogno)
1. Tabelle: ricaricare tabelle/*.json via REST o SQL nell'ordine
   family_groups → family_categories → family_subcategories →
   family_receipts → family_expenses → family_expense_items →
   family_budgets → family_product_rules, con gli UUID originali.
2. File: ricaricare scontrini/ nel bucket "scontrini" mantenendo il
   percorso relativo come storage_path.
3. Verificare con: node scripts/verifica-spese.mjs "<questa cartella>"
   --manifest "<questa cartella>/manifest.json" e gli hash del manifest.
`)
console.log('BACKUP COMPLETATO in', DEST)
console.log('totali (cent):', JSON.stringify({ personale: tot('personale'), azienda: tot('azienda') }))
