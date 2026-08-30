// Test 3.2B.1 delle ANALISI trasferite: proiezione per riga coerente con
// l'adattatore (item.group vince, canoniche con ripiego), Domanda che
// rispetta persona e periodo selezionati, expense_nature che prevale su
// recurring.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vociEstese, itemsPerSpesa, fisseMese, type RisolutoriVoce, type ItemEsteso, type FxEsteso } from './voci.ts'
import { rispondiNelContesto } from './domandaContesto.ts'
import type { Group, Category, Subcat } from './types.ts'

const GRUPPI = new Map([['g-casa', 'Casa'], ['g-teo', 'Matteo'], ['g-bnb', 'Casa Ania']])
const CATEGORIE = new Map([['c-spesa', 'Spesa alimentare'], ['c-scuola', 'Scuola e formazione']])
const CANONICHE = new Map([['cc-alim', 'Alimentari (canonica)']])
const risolutori: RisolutoriVoce = {
  gruppo: id => (id ? GRUPPI.get(id) : undefined) ?? '—',
  categoria: (r, m) =>
    (r.canonical_category_id ? CANONICHE.get(r.canonical_category_id) : undefined)
      ?? (r.category_id ? CATEGORIE.get(r.category_id) : undefined)
      ?? (m.canonical_category_id ? CANONICHE.get(m.canonical_category_id) : undefined)
      ?? (m.category_id ? CATEGORIE.get(m.category_id) : undefined) ?? 'Senza categoria',
  sottocategoria: (r, m) => r.subcategory ?? m.subcategory ?? '',
}

const spesa = (x: Partial<FxEsteso> & { id: string; amount: number }): FxEsteso => ({
  expense_date: '2026-08-20', group_id: 'g-casa', category_id: 'c-spesa',
  store: null, product: null, description: null, recurring: false, source: '',
  receipt_id: null, subcategory: null, ...x,
})
const riga = (x: Partial<ItemEsteso> & { id: string; expense_id: string; name: string; amount: number }): ItemEsteso =>
  ({ qty: 1, category_id: null, subcategory: null, ...x })

test('riga di Teo dentro una spesa di Casa: il filtro Teo la TROVA (gruppo della riga)', () => {
  const spese = [spesa({ id: 's1', amount: 10 })]
  const items = itemsPerSpesa([
    riga({ id: 'r1', expense_id: 's1', name: 'Pane', amount: 8 }),
    riga({ id: 'r2', expense_id: 's1', name: 'Quaderno', amount: 2, group_id: 'g-teo', category_id: 'c-scuola' }),
  ]) as Record<string, ItemEsteso[]>
  const voci = vociEstese(spese, items, risolutori)
  const diTeo = voci.filter(v => v.g === 'Matteo')
  assert.deepEqual(diTeo.map(v => [v.n, v.a]), [['Quaderno', 2]])
  // e la categoria della riga di Teo è la SUA (Scuola), non quella della madre
  assert.equal(diTeo[0].cat, 'Scuola e formazione')
})

test('categorie canoniche con ripiego storico, come nell\'adattatore', () => {
  const spese = [spesa({ id: 's1', amount: 5, canonical_category_id: 'cc-alim' })]
  const items = itemsPerSpesa([riga({ id: 'r1', expense_id: 's1', name: 'Latte', amount: 5 })]) as Record<string, ItemEsteso[]>
  assert.equal(vociEstese(spese, items, risolutori)[0].cat, 'Alimentari (canonica)')
})

test('viste equivalenti, stessi numeri: somma delle voci = somma delle spese', () => {
  const spese = [spesa({ id: 's1', amount: 10 }), spesa({ id: 's2', amount: 4.5, group_id: 'g-teo' })]
  const items = itemsPerSpesa([
    riga({ id: 'r1', expense_id: 's1', name: 'Pane', amount: 8 }),
    riga({ id: 'r2', expense_id: 's1', name: 'Quaderno', amount: 2, group_id: 'g-teo' }),
  ]) as Record<string, ItemEsteso[]>
  const voci = vociEstese(spese, items, risolutori)
  const cent = (n: number) => Math.round(n * 100)
  assert.equal(voci.reduce((s, v) => s + cent(v.a), 0), cent(10 + 4.5))
})

// ---- Domanda nel contesto visibile ----
const GRUPPI_LISTA: Group[] = [
  { id: 'g-casa', name: 'Casa', emoji: null, sort: 0, ambito: 'personale' },
  { id: 'g-teo', name: 'Matteo', emoji: null, sort: 0, ambito: 'personale' },
]
const CATS: Category[] = [{ id: 'c-spesa', group_id: 'g-casa', name: 'Spesa alimentare', sort: 0 }]
const SUBCATS: Subcat[] = []
const ROWS = [
  spesa({ id: 's-ago', amount: 10, description: 'Spesa di agosto' }),
  spesa({ id: 's-teo', amount: 4, group_id: 'g-teo', description: 'Quaderni', expense_date: '2026-08-22' }),
  spesa({ id: 's-lug', amount: 7, description: 'Spesa di luglio', expense_date: '2026-07-10' }),
]
const ctx = {
  rows: ROWS, month: '2026-08', groups: GRUPPI_LISTA, cats: CATS, subcats: SUBCATS,
  vociDi: (spese: FxEsteso[]) => vociEstese(spese, {}, risolutori),
}

test('Domanda: rispetta la PERSONA selezionata (e lo dice)', () => {
  const sel = { isMese: true, periodStart: '2026-08-01', periodEnd: '2026-08-31', periodLabel: 'ad agosto', personaNome: 'Matteo' }
  const risposta = rispondiNelContesto('quanto abbiamo speso?', ctx, sel)
  assert.ok(risposta.includes('4'))            // solo la spesa di Teo
  assert.ok(!risposta.includes('14'))
  // 3.2B.2: la nota usa l'ETICHETTA mostrata a schermo (Matteo → "Teo")
  assert.ok(risposta.includes('sto guardando solo Teo'))
})

test('Domanda: rispetta l\'INTERVALLO selezionato (e lo indica)', () => {
  const sel = { isMese: false, periodStart: '2026-07-01', periodEnd: '2026-07-31', periodLabel: 'dal 1 al 31 luglio', personaNome: null }
  const risposta = rispondiNelContesto('quanto abbiamo speso?', ctx, sel)
  assert.ok(risposta.includes('7'))
  assert.ok(risposta.includes('Nel periodo scelto'))
})

test('Domanda: un mese nominato NELLA domanda vince sul periodo selezionato', () => {
  const sel = { isMese: false, periodStart: '2026-08-01', periodEnd: '2026-08-31', periodLabel: 'settimana', personaNome: null }
  const risposta = rispondiNelContesto('quanto a luglio?', ctx, sel)
  assert.ok(risposta.toLowerCase().includes('luglio'))
  assert.ok(risposta.includes('7'))
})

test('Domanda: una persona nominata NELLA domanda vince sul filtro selezionato', () => {
  // filtro selezionato = Matteo, ma la domanda nomina Casa: vince Casa
  // (capacità del motore INVARIATA dalla Fase 1: serve la forma che conosce)
  const sel = { isMese: true, periodStart: '2026-08-01', periodEnd: '2026-08-31', periodLabel: 'ad agosto', personaNome: 'Matteo' }
  const risposta = rispondiNelContesto('dove ha speso di più Casa?', ctx, sel)
  assert.ok(risposta.includes('10'))                       // il totale di Casa, non di Matteo
  assert.ok(!risposta.includes('sto guardando solo'))      // nessuna nota: la persona è esplicita
})

// ---- expense_nature prevale su recurring ----
test('spese fisse: expense_nature ordinaria SPEGNE il vecchio recurring true', () => {
  // l'armonizzazione fatta dalla pagina: nature != null ? nature==='ricorrente' : recurring
  const armonizza = (r: { recurring: boolean; expense_nature?: string | null }) =>
    r.expense_nature != null ? r.expense_nature === 'ricorrente' : r.recurring
  assert.equal(armonizza({ recurring: true, expense_nature: 'ordinaria' }), false)  // niente OR
  assert.equal(armonizza({ recurring: true, expense_nature: null }), true)          // ripiego storico
  assert.equal(armonizza({ recurring: false, expense_nature: 'ricorrente' }), true)
  const righe = [spesa({ id: 's1', amount: 30, description: 'Palestra', recurring: armonizza({ recurring: true, expense_nature: 'ordinaria' }), expense_date: '2026-08-05' })]
  assert.equal(fisseMese(righe, '2026-08').length, 0)
})
