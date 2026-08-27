// Parità del filtro per ambito (Fase 1): stessa semantica del vecchio
// SpeseTracker.load(). Dati sintetici.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filtraPerAmbito } from './ambito.ts'
import type { Group, Category, Rule, Fx } from './types.ts'

const groups: Group[] = [
  { id: 'g-casa', name: 'Casa', emoji: null, sort: 1, ambito: 'personale' },
  { id: 'g-bnb', name: 'Casa Ania', emoji: null, sort: 5, ambito: 'azienda' },
  // ambito mancante ⇒ personale (comportamento storico)
  { id: 'g-vecchio', name: 'Vecchio', emoji: null, sort: 9, ambito: undefined as unknown as string },
]
const cats: Category[] = [
  { id: 'c1', group_id: 'g-casa', name: 'Spesa alimentare', sort: 1 },
  { id: 'c2', group_id: 'g-bnb', name: 'Forniture', sort: 1 },
]
const rules: Rule[] = [
  { id: 'r1', keyword: 'aceto', group_id: 'g-bnb', category_id: null, track_detail: false },
  { id: 'r2', keyword: 'orfana', group_id: null, category_id: null, track_detail: false },
]
const fx = (id: string, group_id: string | null): Fx => ({
  id, expense_date: '2026-08-10', amount: 10, group_id, category_id: null,
  store: null, product: null, description: null, recurring: false, source: 'manuale', receipt_id: null,
})
const expenses = [fx('e-casa', 'g-casa'), fx('e-bnb', 'g-bnb'), fx('e-null', null)]

test('ambito personale: suoi gruppi + spese senza gruppo; regole senza gruppo escluse', () => {
  const r = filtraPerAmbito('personale', groups, cats, rules, expenses)
  assert.deepEqual(r.groups.map(g => g.id), ['g-casa', 'g-vecchio'])
  assert.deepEqual(r.cats.map(c => c.id), ['c1'])
  assert.deepEqual(r.rules, [])
  assert.deepEqual(r.expenses.map(e => e.id), ['e-casa', 'e-null'])
})

test('ambito azienda: solo il suo; le spese senza gruppo NON entrano', () => {
  const r = filtraPerAmbito('azienda', groups, cats, rules, expenses)
  assert.deepEqual(r.groups.map(g => g.id), ['g-bnb'])
  assert.deepEqual(r.cats.map(c => c.id), ['c2'])
  assert.deepEqual(r.rules.map(x => x.id), ['r1'])
  assert.deepEqual(r.expenses.map(e => e.id), ['e-bnb'])
})
