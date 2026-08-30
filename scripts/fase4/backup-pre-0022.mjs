#!/usr/bin/env node
// ============================================================================
// BACKUP FRESCO PRE-0022 della produzione — SOLA LETTURA ASSOLUTA.
// Stessa procedura concordata del 2C-A (guardia: SOLO GET/HEAD; credenziali
// da .env.local mai mostrate; niente token nuovi; doppio inventario), ma
// adeguata allo SCHEMA ATTUALE (post 0020/0021): il vecchio backup-fresco
// copriva solo le 8 tabelle storiche.
//
// CONTENUTO: le 16 tabelle family_* (storiche + documentali), app_members
// (appartenenze), rooms (riferimento per room_id), tutti i file del bucket
// con impronte SHA-256, inventario Auth SOLO mascherato.
// LIMITI DICHIARATI del ripristino: niente credenziali/utenti Auth (solo
// inventario mascherato), niente tabelle del gestionale fuori dal modulo
// spese (prenotazioni, pulizie…), rooms è una COPIA DI RIFERIMENTO (la
// tabella appartiene al nucleo del gestionale e non va ripristinata da qui).
//
// Uso: node scripts/fase4/backup-pre-0022.mjs "<cartella di destinazione>"
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
console.log('produzione (mascherata):', REF.slice(0, 4) + '****', '· modalità SOLA LETTURA (solo GET/HEAD)')

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
      await new Promise(x => setTimeout(x, 1500)); continue
    }
    return r
  }
  throw new Error('richiesta fallita dopo i tentativi')
}

// lo SCHEMA ATTUALE: tabella → colonna d'ordine per la paginazione
const TABELLE = {
  family_groups: 'id', family_categories: 'id', family_subcategories: 'id',
  family_expenses: 'id', family_expense_items: 'id', family_receipts: 'id',
  family_budgets: 'id', family_product_rules: 'id',
  family_canonical_categories: 'id', family_canonical_subcategories: 'id',
  family_subcategory_map: 'id', family_documents: 'id',
  family_draft_expenses: 'id', family_draft_items: 'id',
  family_expense_documents: 'id', family_corrections: 'id',
  app_members: 'user_id',
  rooms: 'id',              // RIFERIMENTO (nucleo gestionale): copia di consultazione
}

async function tabella(nome, ordine) {
  const righe = []
  for (let da = 0; ; da += 1000) {
    const r = await fetchProd(`/rest/v1/${nome}?select=*&order=${ordine}`, 'GET', { Range: `${da}-${da + 999}` })
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
  for (const [t, ordine] of Object.entries(TABELLE)) dati[t] = await tabella(t, ordine)
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

// ---- COERENZA dei collegamenti (prima di scrivere qualsiasi cosa) ----
const insiemeId = (t) => new Set(dati[t].map(r => r.id))
const problemi = []
const docId = insiemeId('family_documents'), spesaId = insiemeId('family_expenses'), ricId = insiemeId('family_receipts')
for (const r of dati.family_receipts) {
  if (!r.document_id) problemi.push(`ricevuta ${r.id} senza document_id`)
  else if (!docId.has(r.document_id)) problemi.push(`ricevuta ${r.id} → documento inesistente`)
}
for (const p of dati.family_expense_documents) {
  if (!spesaId.has(p.expense_id)) problemi.push(`ponte ${p.id}: spesa inesistente`)
  if (!docId.has(p.document_id)) problemi.push(`ponte ${p.id}: documento inesistente`)
}
for (const e of dati.family_expenses)
  if (e.receipt_id && !ricId.has(e.receipt_id)) problemi.push(`spesa ${e.id} → ricevuta inesistente`)
for (const i of dati.family_expense_items)
  if (!spesaId.has(i.expense_id)) problemi.push(`riga ${i.id} → spesa inesistente`)
for (const b of dati.family_draft_expenses)
  if (!docId.has(b.document_id)) problemi.push(`bozza ${b.id} → documento inesistente`)
if (problemi.length) {
  console.error('COERENZA FALLITA:', problemi.slice(0, 10).join(' · '), problemi.length > 10 ? `(+${problemi.length - 10})` : '')
  process.exit(1)
}
console.log('coerenza dei collegamenti: OK (ricevute→documenti, ponte, spese→ricevute, righe→spese, bozze→documenti)')

// ---- scrittura tabelle (JSON + CSV) ----
mkdirSync(join(DEST, 'tabelle'), { recursive: true })
const csvEsc = v => {
  if (v == null) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const colonne = {}
for (const t of Object.keys(TABELLE)) {
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
console.log('utenti auth (inventario mascherato):', utenti.length)

// ---- file del bucket (GET, percorsi dalle ricevute) + impronte ----
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
    storage_path: rct.storage_path, receipt_id: rct.id, document_id: rct.document_id,
    byte: buf.length, tipo: r.headers.get('content-type') || 'sconosciuto', sha256: sha256(buf),
  })
}
console.log('file scaricati con impronta SHA-256:', fileManifest.length)

// ---- STABILITÀ dei file: secondo scaricamento a campione (primi/ultimi/medi) ----
const campione = [...new Set([0, Math.floor(fileManifest.length / 2), fileManifest.length - 1,
  1, fileManifest.length - 2].filter(i => i >= 0 && i < fileManifest.length))]
for (const i of campione) {
  const f = fileManifest[i]
  const r = await fetchProd('/storage/v1/object/scontrini/' + f.storage_path.split('/').map(encodeURIComponent).join('/'))
  const buf = Buffer.from(await r.arrayBuffer())
  if (sha256(buf) !== f.sha256) { console.error('file INSTABILE tra due letture:', f.storage_path, '— STOP'); process.exit(1) }
}
console.log(`stabilità file verificata su ${campione.length} riscaricamenti a campione (impronte identiche)`)

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
  scopo: 'backup fresco PRE-0022 (schema attuale, post 0020/0021)',
  produzione_mascherata: REF.slice(0, 4) + '****',
  codice: { branch, commit },
  attesi: {
    ...Object.fromEntries(Object.keys(TABELLE).map(t => [t, dati[t].length])),
    totalePersonaleCent: tot('personale'),
    totaleAziendaCent: tot('azienda'),
    senzaDocumento: senzaDoc.length,
    senzaDocumentoCent: senzaDoc.reduce((s, e) => s + cent(e.amount), 0),
    spese_con_ricevuta: dati.family_expenses.filter(e => e.receipt_id).length,
    utentiAuth: utenti.length,
    file_bucket: fileManifest.length,
  },
  colonne,
  file: fileManifest,
}
writeFileSync(join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2))

writeFileSync(join(DEST, 'LEGGIMI.md'), `# Backup completo spese PRE-0022 — 30 agosto 2026

Backup di SOLA LETTURA della produzione PRIMA di applicare la 0022.
Schema ATTUALE (0020+0021 già applicate). Nessuna scrittura su Supabase.

Codice al momento del backup: branch ${branch}, commit ${commit}.

## Contenuto
- tabelle/ — ${Object.keys(TABELLE).length} tabelle complete (JSON + CSV ;): le 16 family_*
  (storiche + documentali della 0020), app_members (appartenenze) e
  rooms (COPIA DI RIFERIMENTO del nucleo gestionale, per risolvere
  room_id: NON va ripristinata da qui).
- scontrini/ — tutti i ${fileManifest.length} file del bucket, percorsi originali,
  impronte SHA-256 nel manifest.
- manifest.json — conteggi, totali in CENTESIMI, colonne, impronte.
- utenti-auth-mascherati.json — SOLO inventario mascherato.

## Limiti dichiarati del ripristino
- gli utenti Auth NON sono ripristinabili da qui (nessuna credenziale
  esportata): app_members conserva i riferimenti user_id;
- le altre tabelle del gestionale (prenotazioni, pulizie, servizi…)
  NON fanno parte di questo backup;
- rooms è solo consultazione.

## Ordine di ripristino (rispetta le chiavi esterne)
family_groups → family_categories → family_subcategories →
family_canonical_categories → family_canonical_subcategories →
family_subcategory_map → family_documents → family_receipts →
family_expenses → family_expense_items → family_expense_documents →
family_draft_expenses → family_draft_items → family_corrections →
family_budgets → family_product_rules → app_members (user_id validi)
con gli UUID originali; poi i file di scontrini/ nel bucket, agli
stessi percorsi (verificare le impronte del manifest).
`)
console.log('\nBACKUP COMPLETO in', DEST)
console.log('attesi:', JSON.stringify(manifest.attesi))
