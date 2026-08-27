// Test di caratterizzazione del modulo spese (Fase 0, 27/08/2026).
// Gira con `npm test`. Dati SINTETICI e anonimi: nessun dato reale del backup.
//
// Parte A: fotografa il comportamento attuale di SpeseTracker.tsx — quando la
// Fase 1 estrarrà la logica, questi test devono continuare a passare.
// Parte B: fissa le regole approvate per il nuovo modulo (fasi 3–5).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cent, vociDi, monthRange, weekRange, yearRange, intervalloRange, nelPeriodo,
  aggregaVoci, sommaQty, totaliPerAmbito, speseAziendaHomeCent, speseFisseMese,
  raggruppaPerDocumento, quadratura, rigaCoerente, contaNelloSpeso, scadenzario,
  possibileDuplicato, type Spesa, type Riga, type Gruppo,
} from './caratterizzazione.ts'

// ---- mondo sintetico ----
const GRUPPI: Gruppo[] = [
  { id: 'g-casa', name: 'Casa', ambito: 'personale' },
  { id: 'g-anna', name: 'Anna', ambito: 'personale' },
  { id: 'g-bnb', name: 'Casa Ania', ambito: 'azienda' },
]
const CATEGORIE = new Map([
  ['c-spesa', 'Spesa alimentare'], ['c-det', 'Detersivi'], ['c-forn', 'Forniture'], ['c-auto', 'Auto'],
])
const nomeCat = (id: string | null | undefined) => (id && CATEGORIE.get(id)) || ''
const nomeGruppo = (id: string | null) => GRUPPI.find(g => g.id === id)?.name || '—'

let n = 0
const spesa = (over: Partial<Spesa>): Spesa => ({
  id: `e${++n}`, expense_date: '2026-08-10', amount: 10, group_id: 'g-casa',
  category_id: 'c-spesa', recurring: false, receipt_id: null, ...over,
})

// ============================================================
// A) Comportamento attuale
// ============================================================

test('scontrino solo Casa Mia: righe con categoria propria o della madre', () => {
  const e = spesa({ id: 'e-mia', amount: 12.5, receipt_id: 'doc1', subcategory: 'Frutta' })
  const righe: Riga[] = [
    { expense_id: 'e-mia', name: 'Mele', amount: 3.5, qty: 2 },                              // eredita categoria e sottocategoria
    { expense_id: 'e-mia', name: 'Sgrassatore', amount: 9, qty: 1, category_id: 'c-det', subcategory: 'Casa' }, // le sue
  ]
  const v = vociDi([e], righe, nomeCat, nomeGruppo)
  assert.equal(v.length, 2)
  assert.deepEqual([v[0].cat, v[0].sott], ['Spesa alimentare', 'Frutta'])
  assert.deepEqual([v[1].cat, v[1].sott], ['Detersivi', 'Casa'])
  assert.equal(sommaQty(v), 3)
  assert.equal(totaliPerAmbito([e], GRUPPI).personale, cent(12.5))
  assert.equal(totaliPerAmbito([e], GRUPPI).azienda, 0)
})

test('scontrino solo Casa Ania: entra solo nei totali azienda (Home compresa)', () => {
  const e = spesa({ group_id: 'g-bnb', category_id: 'c-forn', amount: 9.88, receipt_id: 'doc2' })
  assert.equal(totaliPerAmbito([e], GRUPPI).azienda, 988)
  assert.equal(totaliPerAmbito([e], GRUPPI).personale, 0)
  assert.equal(speseAziendaHomeCent([e], GRUPPI), 988)
})

test('scontrino misto: due spese sorelle, un movimento, ambiti mai mescolati', () => {
  // Un documento (doc3) con prodotti di casa (11,33 €) e del B&B (4,14 €):
  // salvato come due spese sorelle collegate allo stesso receipt_id.
  const sorelle = [
    spesa({ id: 'e-fam', amount: 11.33, receipt_id: 'doc3' }),
    spesa({ id: 'e-bnb', amount: 4.14, group_id: 'g-bnb', category_id: 'c-det', receipt_id: 'doc3' }),
  ]
  const movimenti = raggruppaPerDocumento(sorelle)
  assert.equal(movimenti.length, 1)                          // un unico acquisto nella vista
  assert.equal(movimenti[0].totCent, 1133 + 414)             // col totale del documento
  const tot = totaliPerAmbito(sorelle, GRUPPI)
  assert.equal(tot.personale, 1133)                          // ogni ambito SOLO il suo
  assert.equal(tot.azienda, 414)
  assert.equal(tot.personale + tot.azienda, movimenti[0].totCent) // niente doppia contabilizzazione
  assert.equal(speseAziendaHomeCent(sorelle, GRUPPI), 414)   // Home: solo la parte azienda
})

test('spesa senza gruppo: personale per il tracker, invisibile per Home', () => {
  const e = spesa({ group_id: null, amount: 60 })
  assert.equal(totaliPerAmbito([e], GRUPPI).personale, 6000)
  assert.equal(speseAziendaHomeCent([e], GRUPPI), 0)
})

test('più quantità dello stesso prodotto: qty = pezzi, sommati', () => {
  const e = spesa({ id: 'e-q', amount: 6, receipt_id: 'doc4' })
  const righe: Riga[] = [
    { expense_id: 'e-q', name: 'Acqua', amount: 2.4, qty: 6 },
    { expense_id: 'e-q', name: 'Acqua', amount: 1.2, qty: 3 },
    { expense_id: 'e-q', name: 'Pane', amount: 2.4 },        // qty assente ⇒ 1
  ]
  const v = vociDi([e], righe, nomeCat, nomeGruppo)
  assert.equal(sommaQty(v.filter(x => x.n === 'Acqua')), 9)
  assert.equal(sommaQty(v), 10)
})

test('spesa manuale senza documento: voce unica, resta un movimento singolo', () => {
  const e = spesa({ id: 'e-man', amount: 60, category_id: 'c-auto', subcategory: 'Benzina', description: 'Benzina' })
  const v = vociDi([e], [], nomeCat, nomeGruppo)
  assert.equal(v.length, 1)
  assert.deepEqual([v[0].n, v[0].q, v[0].cat, v[0].sott], ['Benzina', 1, 'Auto', 'Benzina'])
  const mov = raggruppaPerDocumento([e])
  assert.equal(mov.length, 1)
  assert.equal(mov[0].receiptId, null)
  assert.equal(mov[0].totCent, 6000)
})

test('senza descrizione la voce prende il prodotto, poi il nome categoria', () => {
  const v1 = vociDi([spesa({ description: null, product: 'Caffè' })], [], nomeCat, nomeGruppo)
  assert.equal(v1[0].n, 'Caffè')
  const v2 = vociDi([spesa({ description: null, product: null })], [], nomeCat, nomeGruppo)
  assert.equal(v2[0].n, 'Spesa alimentare')
  const v3 = vociDi([spesa({ description: null, product: null, category_id: null })], [], nomeCat, nomeGruppo)
  assert.equal(v3[0].n, 'Senza categoria')
})

test('periodi: mese, settimana (7 giorni dalla data), anno, Dal–al', () => {
  assert.deepEqual(monthRange('2026-02'), ['2026-02-01', '2026-02-28']) // febbraio non bisestile
  assert.deepEqual(monthRange('2024-02'), ['2024-02-01', '2024-02-29']) // bisestile
  assert.deepEqual(weekRange('2026-08-28'), ['2026-08-28', '2026-09-03']) // scavalca il mese
  assert.deepEqual(yearRange('2026'), ['2026-01-01', '2026-12-31'])
  assert.deepEqual(intervalloRange('', '2026-08-15'), ['0000-01-01', '2026-08-15'])
  const e = spesa({ expense_date: '2026-08-01' })
  assert.ok(nelPeriodo(e, monthRange('2026-08')))     // estremi compresi
  assert.ok(!nelPeriodo(e, monthRange('2026-07')))
})

test('aggregazioni per gruppo, categoria, sottocategoria e negozio', () => {
  const spese = [
    spesa({ id: 'a1', amount: 10, store: 'Negozio A', subcategory: 'S1' }),
    spesa({ id: 'a2', amount: 5, store: 'Negozio A', group_id: 'g-anna', category_id: 'c-det', subcategory: 'S2' }),
    spesa({ id: 'a3', amount: 2.5, store: 'Negozio B' }),
  ]
  const v = vociDi(spese, [], nomeCat, nomeGruppo)
  assert.equal(aggregaVoci(v, x => x.g).get('Casa'), 1250)
  assert.equal(aggregaVoci(v, x => x.g).get('Anna'), 500)
  assert.equal(aggregaVoci(v, x => x.cat).get('Detersivi'), 500)
  assert.equal(aggregaVoci(v, x => x.sott).get('S1'), 1000)
  assert.equal(aggregaVoci(v, x => x.store).get('Negozio A'), 1500)
})

test('ricorrenti: pagata questo mese ✓, vista il mese scorso e non ripagata ~', () => {
  const spese = [
    spesa({ description: 'Internet casa', recurring: true, expense_date: '2026-08-05', amount: 30 }),
    spesa({ description: 'Internet casa', recurring: true, expense_date: '2026-07-05', amount: 30 }),
    spesa({ description: 'Palestra', recurring: true, expense_date: '2026-07-12', amount: 45 }),
    spesa({ description: 'Una tantum', recurring: false, expense_date: '2026-08-03', amount: 99 }),
  ]
  const fisse = speseFisseMese(spese, '2026-08', '2026-07')
  assert.deepEqual(fisse.map(f => [f.name, f.totCent, f.paid]), [
    ['Internet casa', 3000, true],   // pagata ad agosto (quella di luglio non raddoppia)
    ['Palestra', 4500, false],       // attesa: vista a luglio, non ancora ad agosto
  ])
})

// ============================================================
// B) Regole approvate per il nuovo modulo
// ============================================================

test('sconto su una riga: incorporato nel prezzo, la quadratura torna', () => {
  // Scontrino da 8,50 €: riga piena 5,00 + riga scontata 3,50 (era 4,00 con 0,50 di sconto)
  const q = quadratura(850, [500, 350])
  assert.ok(q.ok)
  assert.equal(q.diffCent, 0)
  // unit_price pieno 2,00 × 2 pezzi = 4,00; importo netto 3,50 + sconto 0,50 ⇒ coerente
  assert.ok(rigaCoerente(2, 2, 350, 50))
  assert.ok(!rigaCoerente(2, 2, 350, 0))
})

test('arrotondamento di cassa: dichiarato quadra, non dichiarato blocca', () => {
  // Totale 9,99 pagato 10,00 con arrotondamento +0,01
  assert.ok(quadratura(1000, [999], 1).ok)
  assert.ok(quadratura(1000, [999]).ok)          // 1 centesimo rientra nella tolleranza
  assert.ok(!quadratura(1000, [995]).ok)         // 5 centesimi no: da controllare
})

test('differenza tra totale documento e somma righe: rilevata e misurata', () => {
  const q = quadratura(4734, [4000, 700])
  assert.ok(!q.ok)
  assert.equal(q.diffCent, 34)                   // manca una riga da 0,34 €
})

test('fattura non pagata: mai nello Speso, sta in Impegnato/Da pagare', () => {
  const fattura = spesa({
    amount: 250, group_id: 'g-bnb', payment_status: 'non_pagata',
    expense_date: '2026-08-01', due_date: '2026-08-20', paid_at: null,
  })
  assert.ok(!contaNelloSpeso(fattura, monthRange('2026-08')))
  const sc = scadenzario([fattura], '2026-08-27')
  assert.equal(sc.impegnatoCent, 25000)
  assert.equal(sc.scadute.length, 1)             // scaduta = derivato: non pagata + oltre scadenza
  assert.equal(scadenzario([fattura], '2026-08-15').scadute.length, 0)
})

test('fattura pagata: entra nello Speso alla data di pagamento, non del documento', () => {
  const fattura = spesa({
    amount: 250, group_id: 'g-bnb', payment_status: 'pagata',
    expense_date: '2026-07-28', paid_at: '2026-08-03',
  })
  assert.ok(contaNelloSpeso(fattura, monthRange('2026-08')))   // agosto: pagata qui
  assert.ok(!contaNelloSpeso(fattura, monthRange('2026-07')))  // luglio: solo data documento
})

test('le bozze non contano mai nello Speso', () => {
  const bozza = spesa({ amount: 50, review_status: 'da_controllare', expense_date: '2026-08-10' })
  assert.ok(!contaNelloSpeso(bozza, monthRange('2026-08')))
  assert.ok(contaNelloSpeso({ ...bozza, review_status: 'confermata' }, monthRange('2026-08')))
  // una spesa storica senza review_status è confermata per definizione
  assert.ok(contaNelloSpeso(spesa({ amount: 50, expense_date: '2026-08-10' }), monthRange('2026-08')))
})

test('possibile duplicato: certo per file uguale, probabile per negozio+data+totale', () => {
  const a = { date: '2026-08-10', totCent: 4734, store: 'Supermercato Rozzano', sha256: 'abc' }
  assert.equal(possibileDuplicato(a, { ...a, sha256: 'abc' }), 'certo')
  assert.equal(possibileDuplicato(a, { ...a, sha256: 'xyz' }), 'probabile')       // stesso negozio/data/totale
  assert.equal(possibileDuplicato(a, { ...a, sha256: null, store: 'Supermercato' }), 'possibile')
  assert.equal(possibileDuplicato(a, { ...a, sha256: null, totCent: 4735 }), null) // totale diverso: nessun sospetto
  assert.equal(possibileDuplicato(a, { ...a, sha256: null, date: '2026-08-11' }), null)
})
