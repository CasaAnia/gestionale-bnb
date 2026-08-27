// Test NEGATIVI del verificatore esteso (Fase 2A): fixture SINTETICHE
// alterate di proposito — record mancante, campo modificato, id duplicato,
// relazione spezzata, differenza economica, aggiunte consentite/vietate.
// Nessun dato reale, nessun accesso a Supabase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dirname, '..', '..', 'scripts', 'verifica-spese.mjs')

type Tabelle = Record<string, Record<string, unknown>[]>
const BASE: Tabelle = {
  family_groups: [
    { id: 'g-casa', name: 'Casa', emoji: null, sort: 1, ambito: 'personale' },
    { id: 'g-bnb', name: 'B&B', emoji: null, sort: 5, ambito: 'azienda' },
  ],
  family_categories: [{ id: 'c1', group_id: 'g-casa', name: 'Spesa alimentare', sort: 1 }],
  family_subcategories: [{ id: 's1', category_name: 'Spesa alimentare', name: 'Pane', sort: 1 }],
  family_expenses: [
    { id: 'e1', expense_date: '2026-08-10', amount: 10, group_id: 'g-casa', category_id: 'c1', receipt_id: 'r1', recurring: false, source: 'foto' },
    { id: 'e2', expense_date: '2026-08-11', amount: 5.5, group_id: 'g-bnb', category_id: null, receipt_id: null, recurring: false, source: 'manuale' },
  ],
  family_expense_items: [
    { id: 'i1', expense_id: 'e1', name: 'Pane fresco', amount: 10, qty: 1 },
  ],
  family_receipts: [{ id: 'r1', storage_path: '2026-08-10/x.jpg', note: null, status: 'letto', uploaded_at: 'z' }],
  family_budgets: [],
  family_product_rules: [],
}

function scriviFixture(dati: Tabelle): string {
  const dir = mkdtempSync(join(tmpdir(), 'fix-spese-'))
  mkdirSync(join(dir, 'tabelle'))
  for (const [t, rows] of Object.entries(dati))
    writeFileSync(join(dir, 'tabelle', `${t}.json`), JSON.stringify(rows, null, 1))
  return dir
}
const clona = (): Tabelle => structuredClone(BASE)

function confronta(rif: string, cand: string, ...flags: string[]) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--confronta', rif, cand, ...flags], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (e) {
    const errore = e as { status: number; stdout: string; stderr: string }
    return { code: errore.status, out: (errore.stdout || '') + (errore.stderr || '') }
  }
}

const RIF = scriviFixture(BASE)

test('verificatore: identici ⇒ nessuna differenza, esce 0', () => {
  const r = confronta(RIF, scriviFixture(BASE))
  assert.equal(r.code, 0)
  assert.match(r.out, /nessuna differenza/)
})

test('verificatore: record mancante ⇒ errore chiaro, esce 1', () => {
  const c = clona(); c.family_expenses = c.family_expenses.filter(e => e.id !== 'e1')
  c.family_expense_items = []   // per non incolpare solo la relazione
  const r = confronta(RIF, scriviFixture(c))
  assert.equal(r.code, 1)
  assert.match(r.out, /MANCANTE nel candidato: e1/)
  assert.match(r.out, /DIFFERENZA ECONOMICA personale/)
})

test('verificatore: campo modificato ⇒ segnala id e NOME del campo, non il contenuto', () => {
  const c = clona(); c.family_expenses[0].amount = 11
  const r = confronta(RIF, scriviFixture(c))
  assert.equal(r.code, 1)
  assert.match(r.out, /MODIFICATO e1: campi \[amount\]/)
  assert.ok(!r.out.includes('Pane fresco'))   // niente contenuti personali nel riepilogo
})

test('verificatore: id duplicato ⇒ segnalato', () => {
  const c = clona(); c.family_expenses.push({ ...c.family_expenses[0] })
  const r = confronta(RIF, scriviFixture(c))
  assert.equal(r.code, 1)
  assert.match(r.out, /id DUPLICATI nel candidato: e1/)
})

test('verificatore: relazione spezzata ⇒ segnalata', () => {
  const c = clona(); c.family_expense_items.push({ id: 'i9', expense_id: 'e-fantasma', name: 'X', amount: 1, qty: 1 })
  const r = confronta(RIF, scriviFixture(c), '--consenti-aggiunte')
  assert.equal(r.code, 1)
  assert.match(r.out, /relazione SPEZZATA.*i9/)
})

test('verificatore: record aggiunti ⇒ errore, ma con --consenti-aggiunte passano', () => {
  const c = clona()
  c.family_expenses.push({ id: 'e-nuova', expense_date: '2026-08-20', amount: 3, group_id: 'g-casa', category_id: 'c1', receipt_id: null, recurring: false, source: 'manuale' })
  const stretto = confronta(RIF, scriviFixture(c))
  assert.equal(stretto.code, 1)
  assert.match(stretto.out, /AGGIUNTI nel candidato/)
  const permissivo = confronta(RIF, scriviFixture(c), '--consenti-aggiunte')
  assert.equal(permissivo.code, 0)
  assert.match(permissivo.out, /aggiunte consentite|consentiti/)
})
