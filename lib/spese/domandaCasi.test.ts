// ============================================================================
// Test 3.2B.2 dei tre casi concreti della revisione sulla Domanda, con la
// fixture indicata: Casa = 10 €, Matteo = 4 €, Ania = 20 €.
// Alias delle etichette (Teo → Matteo, M e A → Matteo e Ania), nota sulla
// persona REALMENTE applicata, risultato vuoto dopo i filtri senza crash.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vociEstese, type RisolutoriVoce, type FxEsteso } from './voci.ts'
import { rispondiNelContesto } from './domandaContesto.ts'
import type { Group, Category, Subcat } from './types.ts'

const GRUPPI = new Map([['g-casa', 'Casa'], ['g-teo', 'Matteo'], ['g-ania', 'Ania'], ['g-mea', 'Matteo e Ania']])
const risolutori: RisolutoriVoce = {
  gruppo: id => (id ? GRUPPI.get(id) : undefined) ?? '—',
  categoria: () => 'Spesa alimentare',
  sottocategoria: () => '',
}
const spesa = (x: Partial<FxEsteso> & { id: string; amount: number; group_id: string }): FxEsteso => ({
  expense_date: '2026-08-20', category_id: 'c-spesa', store: 'Esselunga', product: null,
  description: 'Spesa', recurring: false, source: '', receipt_id: null, subcategory: null, ...x,
})
const GRUPPI_LISTA: Group[] = [
  { id: 'g-casa', name: 'Casa', emoji: null, sort: 0, ambito: 'personale' },
  { id: 'g-teo', name: 'Matteo', emoji: null, sort: 0, ambito: 'personale' },
  { id: 'g-ania', name: 'Ania', emoji: null, sort: 0, ambito: 'personale' },
  { id: 'g-mea', name: 'Matteo e Ania', emoji: null, sort: 0, ambito: 'personale' },
]
const CATS: Category[] = [{ id: 'c-spesa', group_id: 'g-casa', name: 'Spesa alimentare', sort: 0 }]
const SUBCATS: Subcat[] = []
const ROWS = [
  spesa({ id: 's-casa', amount: 10, group_id: 'g-casa' }),
  spesa({ id: 's-teo', amount: 4, group_id: 'g-teo' }),
  spesa({ id: 's-ania', amount: 20, group_id: 'g-ania', expense_date: '2026-07-10' }),  // Ania: solo a LUGLIO
]
const ctx = {
  rows: ROWS, month: '2026-08', groups: GRUPPI_LISTA, cats: CATS, subcats: SUBCATS,
  vociDi: (spese: FxEsteso[]) => vociEstese(spese, {}, risolutori),
}
const AGOSTO = { isMese: true, periodStart: '2026-08-01', periodEnd: '2026-08-31', periodLabel: 'ad agosto', personaNome: null }

test('caso 1 — "Dove ha speso di più Teo?": Teo È Matteo (4 €), non il totale di tutti', () => {
  const r = rispondiNelContesto('Dove ha speso di più Teo?', ctx, AGOSTO)
  assert.ok(r.includes('€4'), r)                       // PRIMA: 14 € (Teo non riconosciuto)
  assert.ok(!r.includes('14'), r)
  assert.ok(!r.includes('sto guardando solo'), r)      // la persona è nella domanda: niente nota
})

test('caso 1b — anche "M e A" scritto nella domanda viene riconosciuto come persona esplicita', () => {
  // (nella forma che il motore di Fase 1 supporta: "dove ha speso di più…";
  // "quanto ha speso X?" secco non è mai stato capito, nemmeno coi nomi veri)
  const righe = [...ROWS, spesa({ id: 's-mea', amount: 6, group_id: 'g-mea' })]
  const r = rispondiNelContesto('Dove ha speso di più M e A?', { ...ctx, rows: righe }, AGOSTO)
  assert.ok(r.includes('€6'), r)
  assert.ok(!r.includes('sto guardando solo'), r)
})

test('caso 2 — intervallo scelto + filtro Matteo, ma la domanda nomina Casa: 10 € e NESSUNA nota "sto guardando solo"', () => {
  const sel = { isMese: false, periodStart: '2026-08-01', periodEnd: '2026-08-31', periodLabel: 'dal 1 al 31 agosto', personaNome: 'Matteo' }
  const r = rispondiNelContesto('Dove ha speso di più Casa?', ctx, sel)
  assert.ok(r.includes('€10'), r)
  assert.ok(!r.includes('sto guardando solo'), r)      // PRIMA la nota compariva lo stesso
})

test('caso 3 — Ania senza righe nel periodo: risposta onesta, NESSUN crash', () => {
  // Ania ha speso solo a luglio; il periodo scelto è una settimana di agosto
  const sel = { isMese: false, periodStart: '2026-08-17', periodEnd: '2026-08-23', periodLabel: 'dal 17 al 23 agosto', personaNome: null }
  const r = rispondiNelContesto('Dove ha speso di più Ania?', ctx, sel)   // PRIMA: TypeError
  assert.ok(r.toLowerCase().includes('non trovo'), r)
  // e anche col filtro persona selezionato, stessa tenuta
  const r2 = rispondiNelContesto('dove abbiamo speso di più?', ctx, { ...sel, personaNome: 'Ania' })
  assert.ok(r2.toLowerCase().includes('non trovo'), r2)
})

test('la nota indica la persona applicata con la SUA etichetta ("Teo", non "Matteo")', () => {
  const r = rispondiNelContesto('quanto abbiamo speso?', ctx, { ...AGOSTO, personaNome: 'Matteo' })
  assert.ok(r.includes('4'), r)
  assert.ok(r.includes('sto guardando solo Teo'), r)
})
