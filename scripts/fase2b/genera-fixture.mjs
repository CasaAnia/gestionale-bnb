#!/usr/bin/env node
// ============================================================================
// FIXTURE ANONIMIZZATA (Fase 2B) — legge il backup reale SOLO in locale e
// produce, FUORI dal repository, una copia strutturale completamente
// anonimizzata da caricare sul progetto Supabase di PROVA.
//
//  - stessi conteggi e stesse relazioni (id rimappati deterministicamente);
//  - quadrature conservate PER COSTRUZIONE (importi sintetici: la spesa è
//    la somma delle sue righe sintetiche);
//  - UUID, date, importi e OGNI testo libero sostituiti deterministicamente
//    (stesso input ⇒ stesso output: lo script è ripetibile);
//  - niente email, utenti Auth, URL, hash o metadati originali;
//  - niente fotografie: per lo storage si generano 81 file FINTI di testo.
//
// Uso: node scripts/fase2b/genera-fixture.mjs [dir-backup] [dir-uscita]
//   default backup: quello del 27/08 sulla scrivania
//   default uscita: ~/.gestionale-2b/fixture  (permessi 700, FUORI dal repo)
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'

const BACKUP = process.argv[2] ||
  '/Users/amerigogranata/Desktop/Backup completo spese prima del rifacimento 2026-08-27'
const OUT = process.argv[3] || join(homedir(), '.gestionale-2b', 'fixture')

const SEED = 'fase2b-2026-08-28'   // fisso: rigenerare produce la stessa fixture
const sha = (s) => createHash('sha256').update(SEED + '|' + s).digest('hex')

// UUID sintetico deterministico (formato v4 valido)
function uuidDi(orig) {
  const h = sha('uuid:' + orig)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
// data sintetica nel 2030, deterministica; stessa data reale ⇒ stessa sintetica
function dataDi(orig) {
  if (!orig) return null
  const h = parseInt(sha('data:' + String(orig).slice(0, 10)).slice(0, 8), 16)
  const mese = (h % 12) + 1, giorno = (h >> 4) % 28 + 1
  return `2030-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}
const tsDi = (orig) => orig ? dataDi(orig) + 'T10:00:00+00:00' : null
// testo sintetico deterministico per valore, con prefisso leggibile
const contatori = new Map()
const mappe = new Map()
function testoDi(prefisso, orig) {
  if (orig == null || orig === '') return null
  const chiave = prefisso + '|' + orig
  if (!mappe.has(chiave)) {
    const n = (contatori.get(prefisso) || 0) + 1
    contatori.set(prefisso, n)
    mappe.set(chiave, `${prefisso}-${n}`)
  }
  return mappe.get(chiave)
}
const centDi = (chiave, max) => (parseInt(sha('cent:' + chiave).slice(0, 8), 16) % max) + 1

const leggi = (t) => JSON.parse(readFileSync(join(BACKUP, 'tabelle', `${t}.json`), 'utf8'))
const groups = leggi('family_groups')
const cats = leggi('family_categories')
const subcats = leggi('family_subcategories')
const expenses = leggi('family_expenses')
const items = leggi('family_expense_items')
const receipts = leggi('family_receipts')
const budgets = leggi('family_budgets')
const rules = leggi('family_product_rules')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'tabelle'), { recursive: true })
mkdirSync(join(OUT, 'file-finti'), { recursive: true })
chmodSync(join(OUT, '..'), 0o700)
chmodSync(OUT, 0o700)

// ---- anonimizzazione (ordine: prima le tabelle referenziate) ----
const aGroups = groups.map(g => ({
  id: uuidDi(g.id), name: testoDi('Gruppo', g.name), emoji: null, sort: g.sort,
  created_at: tsDi(g.created_at), ambito: g.ambito || 'personale',
}))
const aCats = cats.map(c => ({
  id: uuidDi(c.id), group_id: uuidDi(c.group_id),
  name: testoDi('Categoria', c.name),           // stesso nome reale ⇒ stesso sintetico (tassonomia condivisa)
  sort: c.sort, created_at: tsDi(c.created_at),
}))
const aSubcats = subcats.map(s => ({
  id: uuidDi(s.id), category_name: testoDi('Categoria', s.category_name),
  name: testoDi('Sottocategoria', s.name), sort: s.sort, created_at: tsDi(s.created_at),
}))
const aReceipts = receipts.map((r, i) => ({
  id: uuidDi(r.id),
  storage_path: `${dataDi(r.uploaded_at)}/finto-${i + 1}.txt`,
  note: r.note ? testoDi('nota', r.note) : null,
  status: r.status, uploaded_at: tsDi(r.uploaded_at), processed_at: tsDi(r.processed_at),
  ambito: r.ambito || 'personale',
}))
// righe: importi sintetici; la spesa diventa la somma delle sue righe
const aItems = items.map(it => ({
  id: uuidDi(it.id), expense_id: uuidDi(it.expense_id),
  name: testoDi('Prodotto', it.name),
  amount: centDi('item:' + it.id, 4999) / 100,
  qty: Number(it.qty) > 0 ? Math.min(Math.round(Number(it.qty)) || 1, 9) : 1,
  created_at: tsDi(it.created_at),
  category_id: it.category_id ? uuidDi(it.category_id) : null,
  subcategory: it.subcategory ? testoDi('Sottocategoria', it.subcategory) : null,
}))
const sommaPerSpesa = new Map()
for (const it of aItems)
  sommaPerSpesa.set(it.expense_id, (sommaPerSpesa.get(it.expense_id) || 0) + Math.round(it.amount * 100))
const aExpenses = expenses.map(e => {
  const id = uuidDi(e.id)
  const somma = sommaPerSpesa.get(id)
  return {
    id, expense_date: dataDi(e.expense_date),
    amount: (somma ?? centDi('exp:' + e.id, 9999)) / 100,
    group_id: e.group_id ? uuidDi(e.group_id) : null,
    category_id: e.category_id ? uuidDi(e.category_id) : null,
    store: e.store ? testoDi('Negozio', e.store) : null,
    product: e.product ? testoDi('Prodotto', e.product) : null,
    description: e.description ? testoDi('testo', e.description) : null,
    recurring: !!e.recurring, receipt_id: e.receipt_id ? uuidDi(e.receipt_id) : null,
    source: e.source || 'manuale', created_at: tsDi(e.created_at),
    subcategory: e.subcategory ? testoDi('Sottocategoria', e.subcategory) : null,
  }
})
const aBudgets = budgets.map(b => ({
  id: uuidDi(b.id), ambito: b.ambito || 'personale',
  category_name: testoDi('Categoria', b.category_name),
  monthly_amount: centDi('bud:' + b.id, 50000) / 100, created_at: tsDi(b.created_at),
}))
const aRules = rules.map(r => ({
  id: uuidDi(r.id), keyword: testoDi('parola', r.keyword),
  group_id: r.group_id ? uuidDi(r.group_id) : null,
  category_id: r.category_id ? uuidDi(r.category_id) : null,
  track_detail: !!r.track_detail, created_at: tsDi(r.created_at),
}))

const tabelle = {
  family_groups: aGroups, family_categories: aCats, family_subcategories: aSubcats,
  family_receipts: aReceipts, family_expenses: aExpenses, family_expense_items: aItems,
  family_budgets: aBudgets, family_product_rules: aRules,
}
for (const [t, rows] of Object.entries(tabelle))
  writeFileSync(join(OUT, 'tabelle', `${t}.json`), JSON.stringify(rows, null, 1))

// ---- SQL di caricamento (svuota i SEED delle migrazioni, poi inserisce) ----
const sqlVal = v => v == null ? 'null'
  : typeof v === 'boolean' ? String(v)
  : typeof v === 'number' ? String(v)
  : `'${String(v).replace(/'/g, "''")}'`
function inserti(t, rows) {
  if (!rows.length) return `-- ${t}: vuota\n`
  const cols = Object.keys(rows[0])
  const values = rows.map(r => `(${cols.map(c => sqlVal(r[c])).join(', ')})`).join(',\n')
  return `insert into public.${t} (${cols.join(', ')}) values\n${values};\n`
}
const sql = [
  '-- FIXTURE ANONIMIZZATA Fase 2B — SOLO per il progetto di PROVA.',
  '-- Svuota i dati seed delle migrazioni e carica la copia strutturale.',
  'begin;',
  'delete from public.family_product_rules;',
  'delete from public.family_budgets;',
  'delete from public.family_expense_items;',
  'delete from public.family_expenses;',
  'delete from public.family_receipts;',
  'delete from public.family_subcategories;',
  'delete from public.family_categories;',
  'delete from public.family_groups;',
  inserti('family_groups', aGroups),
  inserti('family_categories', aCats),
  inserti('family_subcategories', aSubcats),
  inserti('family_receipts', aReceipts),
  inserti('family_expenses', aExpenses),
  inserti('family_expense_items', aItems),
  inserti('family_budgets', aBudgets),
  inserti('family_product_rules', aRules),
  'commit;',
].join('\n')
writeFileSync(join(OUT, 'carica-fixture.sql'), sql)

// ---- 81 file finti per lo storage (testo, MAI contenuto reale) ----
aReceipts.forEach((r, i) => {
  writeFileSync(join(OUT, 'file-finti', `finto-${i + 1}.txt`),
    `File finto n. ${i + 1} per la prova 2B. Nessun contenuto reale.\n`)
})
writeFileSync(join(OUT, 'file-finti', 'percorsi.json'),
  JSON.stringify(aReceipts.map((r, i) => ({ file: `finto-${i + 1}.txt`, storage_path: r.storage_path })), null, 1))

// ---- manifest sintetico ----
const cent = n => Math.round(n * 100)
const ambitoDi = new Map(aGroups.map(g => [g.id, g.ambito]))
const totale = amb => aExpenses
  .filter(e => (e.group_id ? ambitoDi.get(e.group_id) : 'personale') === amb)
  .reduce((s, e) => s + cent(e.amount), 0)
const manifest = {
  generato_il: 'deterministico (seed fisso)',
  attesi: {
    spese: aExpenses.length, righe: aItems.length, documenti: aReceipts.length,
    gruppi: aGroups.length, categorie: aCats.length, sottocategorie: aSubcats.length,
    regole: aRules.length,
    totalePersonaleCent: totale('personale'), totaleAziendaCent: totale('azienda'),
    senzaDocumento: aExpenses.filter(e => !e.receipt_id).length,
    senzaDocumentoCent: aExpenses.filter(e => !e.receipt_id).reduce((s, e) => s + cent(e.amount), 0),
    collegamentiAttesi: aExpenses.filter(e => e.receipt_id).length,
    documentiMisti: new Set(aExpenses.filter(e => e.receipt_id).map(e => e.receipt_id)).size,
  },
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('Fixture generata in', OUT)
console.log(JSON.stringify(manifest.attesi, null, 1))
