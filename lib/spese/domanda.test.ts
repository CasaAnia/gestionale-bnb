// Test di caratterizzazione del motore 💬 Domanda (Fase 1, 27/08/2026).
// Dati SINTETICI e anonimi. Nessuna capacità nuova: fotografano le richieste
// già supportate — mese, persona, categoria, sottocategoria, negozio,
// prodotto, "da sempre" e combinazioni.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rispondi, type ContestoDomanda } from './domanda.ts'
import { vociDi, itemsPerSpesa } from './voci.ts'
import type { Fx, Item, Group, Category, Subcat } from './types.ts'

const GROUPS: Group[] = [
  { id: 'g-casa', name: 'Casa', emoji: null, sort: 1, ambito: 'personale' },
  { id: 'g-anna', name: 'Anna', emoji: null, sort: 2, ambito: 'personale' },
  { id: 'g-teo', name: 'Teo', emoji: null, sort: 3, ambito: 'personale' },
  { id: 'g-ta', name: 'Teo e Anna', emoji: null, sort: 4, ambito: 'personale' },
]
const CATS: Category[] = [
  { id: 'c-spesa', group_id: 'g-casa', name: 'Spesa alimentare', sort: 1 },
  { id: 'c-bar', group_id: 'g-anna', name: 'Colazione/Bar', sort: 2 },
  { id: 'c-abb', group_id: 'g-anna', name: 'Abbigliamento', sort: 3 },
]
const SUBCATS: Subcat[] = [
  { id: 's-benzina', category_name: 'Auto', name: 'Benzina', sort: 1 },
  { id: 's-caffe', category_name: 'Colazione/Bar', name: 'Caffè', sort: 1 },
]
const catName = (id: string | null | undefined) => CATS.find(c => c.id === id)?.name || ''
const groupName = (id: string | null) => GROUPS.find(g => g.id === id)?.name || '—'

let n = 0
const fx = (over: Partial<Fx>): Fx => ({
  id: `e${++n}`, expense_date: '2026-08-10', amount: 10, group_id: 'g-casa',
  category_id: 'c-spesa', store: null, product: null, description: null,
  recurring: false, source: 'manuale', receipt_id: null, ...over,
})

const ROWS: Fx[] = [
  fx({ id: 'e-spesa', amount: 30, store: 'Supermercato Grande Rozzano', description: 'Spesa' }),
  fx({ id: 'e-caffe', amount: 2.4, group_id: 'g-anna', category_id: 'c-bar', store: 'Bar Piazza' }),
  fx({ id: 'e-vestito', amount: 55, group_id: 'g-anna', category_id: 'c-abb' }),
  fx({ id: 'e-luglio', amount: 8, expense_date: '2026-07-05', group_id: 'g-anna', category_id: 'c-bar', store: 'Bar Piazza' }),
  fx({ id: 'e-teo', amount: 12.5, group_id: 'g-teo', category_id: 'c-abb' }),
]
const ITEMS: Item[] = [
  { id: 'i1', expense_id: 'e-spesa', name: 'Kiwi', amount: 4, qty: 6 },
  { id: 'i2', expense_id: 'e-spesa', name: 'Pane fresco', amount: 3, qty: 1 },
  { id: 'i3', expense_id: 'e-spesa', name: 'Latte intero', amount: 23, qty: 12 },
  { id: 'i4', expense_id: 'e-caffe', name: 'Caffè al banco', amount: 2.4, qty: 2, subcategory: 'Caffè' },
  { id: 'i5', expense_id: 'e-vestito', name: 'Vestito estivo', amount: 55, qty: 1 },
  { id: 'i6', expense_id: 'e-luglio', name: 'Caffè al banco', amount: 8, qty: 2, subcategory: 'Caffè' },
  { id: 'i7', expense_id: 'e-teo', name: 'Maglietta', amount: 12.5, qty: 1 },
]

const ctx: ContestoDomanda = {
  rows: ROWS, month: '2026-08', groups: GROUPS, cats: CATS, subcats: SUBCATS,
  vociDi: spese => vociDi(spese, itemsPerSpesa(ITEMS), catName, groupName),
}
const chiedi = (q: string) => rispondi(q, ctx)

test('domanda: totale del mese corrente senza filtri', () => {
  const r = chiedi('quanto abbiamo speso questo mese?')
  assert.match(r, /^A agosto, in totale: €99,90 in 6 voci\./)
})

test('domanda: mese nominato (luglio) trova il mese giusto', () => {
  const r = chiedi('quanto a luglio?')
  assert.match(r, /^A luglio/)
  assert.match(r, /€8,00/)
})

test('domanda: persona (il nome più lungo vince su quello corto)', () => {
  assert.match(chiedi('cosa ha comprato Teo?'), /Teo: €12,50 in 1 voce/)
  // Gruppo composito senza spese nel mese: il motore prova anche la ricerca
  // per prodotto e, non trovando nulla, lo dice chiaro (comportamento attuale).
  const r = chiedi('quanto hanno speso Teo e Anna?')
  assert.match(r, /Non trovo nessuna voce/)
})

test('domanda: categoria per parola intera ("bar" → Colazione/Bar)', () => {
  const r = chiedi('quanto in bar questo mese?')
  assert.match(r, /colazione\/bar/)
  assert.match(r, /€2,40/)
})

test('domanda: sottocategoria, anche sulle voci che si chiamano così', () => {
  const r = chiedi('quanti caffè ad agosto?')
  assert.match(r, /caffè/)
  assert.match(r, /€2,40/)
})

test('domanda: negozio', () => {
  const r = chiedi('quanto da Bar Piazza questo mese?')
  assert.match(r, /Bar Piazza/)
  assert.match(r, /€2,40/)
})

test('domanda: prodotto cercato nei nomi delle voci', () => {
  const r = chiedi('quanto abbiamo speso di latte?')
  assert.match(r, /latte/)
  assert.match(r, /€23,00/)
})

test('domanda: "da sempre" ignora il mese', () => {
  const r = chiedi('quanti caffè da sempre?')
  assert.match(r, /^Da sempre/)
  assert.match(r, /€10,40/)          // 2,40 di agosto + 8,00 di luglio
})

test('domanda: combinazione persona + categoria', () => {
  const r = chiedi('quanto ha speso Anna in abbigliamento?')
  assert.match(r, /Anna · abbigliamento/)
  assert.match(r, /€55,00/)          // il vestito di Anna, non la maglietta di Teo
})

test('domanda: "dove abbiamo speso di più"', () => {
  const r = chiedi('dove abbiamo speso di più questo mese?')
  assert.match(r, /la voce più pesante è abbigliamento \(€68\)/)
  assert.match(r, /Supermercato Grande \(€30\)/)  // nome negozio accorciato
})

test('domanda: prodotto inesistente detto chiaro, senza totale generico', () => {
  const r = chiedi('quanto per il monopattino?')
  assert.match(r, /Non trovo nessuna voce per «quanto per il monopattino\?» a agosto/)
})

test('domanda: mese senza spese', () => {
  assert.equal(chiedi('quanto a marzo?'), 'A marzo non trovo spese registrate.')
})
