// Test dell'adattatore 3.2A: schema reale → DatiSpese, in sola lettura.
// Copre i casi richiesti dalla revisione: nessun doppio conteggio, misti con
// quote esatte, fatture non pagate fuori dallo Speso, insiemi multi-categoria/
// persona/camera, agosto di anni diversi separato, periodi stabili.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { costruisciDatiSpese, costruisciPeriodi, etichettaPersona, type TabelleGrezze } from './adattatore.ts'
import { applicaFiltri, controllaMisto, filtriIniziali, importoNelContesto, intervalloDelPeriodo } from './vista.ts'

const OGGI = '2026-08-29'

const GRUPPI = [
  { id: 'g-casa', name: 'Casa', ambito: 'personale' },
  { id: 'g-ania', name: 'Ania', ambito: 'personale' },
  { id: 'g-teo', name: 'Matteo', ambito: 'personale' },
  { id: 'g-ma', name: 'Matteo e Ania', ambito: 'personale' },
  { id: 'g-bnb', name: 'Casa Ania', ambito: 'azienda' },
]
const CATEGORIE = [
  { id: 'c-spesa', name: 'Spesa alimentare' },
  { id: 'c-scuola', name: 'Scuola e formazione' },
  { id: 'c-pulizia', name: 'Detersivi e pulizia' },
  { id: 'c-bianco', name: 'Biancheria' },
]
const CAMERE = [
  { id: 'r-ambra', name: 'Ambra' }, { id: 'r-lena', name: 'Lena' },
  { id: 'r-amelia', name: 'Amelia' }, { id: 'r-allegra', name: 'Allegra' },
]

const spesa = (x: Partial<TabelleGrezze['spese'][0]> & { id: string; amount: number }): TabelleGrezze['spese'][0] => ({
  expense_date: '2026-08-10', group_id: 'g-casa', category_id: 'c-spesa',
  subcategory: null, description: null, store: null, product: null,
  receipt_id: null, payment_method: null, room_id: null, ...x,
})
const documento = (x: Partial<TabelleGrezze['documenti'][0]> & { id: string }): TabelleGrezze['documenti'][0] => ({
  kind: 'scontrino', status: 'confermato', doc_total: null, supplier: null,
  document_date: null, due_date: null, upload_ambito: 'personale',
  error_message: null, note: null, created_at: '2026-08-10T10:00:00Z', ...x,
})

// il set di prova: un misto multi-tutto, una manuale, una fattura non pagata,
// una fattura pagata, un agosto 2025, un documento senza foto
function tabelle(): TabelleGrezze {
  return {
    gruppi: GRUPPI, categorie: CATEGORIE, camere: CAMERE,
    documenti: [
      documento({ id: 'd-misto', doc_total: 20 }),
      documento({ id: 'd-fatt-aperta', kind: 'fattura', status: 'approvata_da_pagare', doc_total: 300, supplier: 'Elettricista', due_date: '2026-09-12', upload_ambito: 'azienda' }),
      documento({ id: 'd-fatt-pagata', kind: 'fattura', status: 'confermato', doc_total: 220, supplier: 'Idraulico', upload_ambito: 'azienda' }),
      documento({ id: 'd-vecchio', doc_total: 30 }),
      documento({ id: 'd-inrev', status: 'in_revisione', doc_total: 12.5 }),
    ],
    ponte: [
      { expense_id: 's-m1', document_id: 'd-misto' },
      { expense_id: 's-m2', document_id: 'd-misto' },
      { expense_id: 's-m3', document_id: 'd-misto' },
      { expense_id: 's-pag', document_id: 'd-fatt-pagata' },
      { expense_id: 's-2025', document_id: 'd-vecchio' },
    ],
    spese: [
      // documento MISTO: due spese personali (Casa e Teo) + due aziendali su camere diverse
      spesa({ id: 's-m1', amount: 8.5, group_id: 'g-casa', category_id: 'c-spesa', store: 'Esselunga' }),
      spesa({ id: 's-m2', amount: 4.5, group_id: 'g-teo', category_id: 'c-scuola', store: 'Esselunga' }),
      spesa({ id: 's-m3', amount: 7, group_id: 'g-bnb', category_id: 'c-pulizia', store: 'Esselunga', room_id: 'r-ambra', payment_method: 'carta' }),
      // fattura pagata (azienda, denaro uscito)
      spesa({ id: 's-pag', amount: 220, group_id: 'g-bnb', category_id: 'c-bianco', expense_date: '2026-08-25', payment_method: 'bonifico', paid_at: '2026-08-25' }),
      // agosto di un ALTRO anno
      spesa({ id: 's-2025', amount: 30, group_id: 'g-casa', expense_date: '2025-08-10' }),
      // manuale senza documento (M e A)
      spesa({ id: 's-man', amount: 60, group_id: 'g-ma', expense_date: '2026-08-27', description: 'Benzina' }),
      // aziendale senza camera → Generale (senza documento)
      spesa({ id: 's-gen', amount: 9.9, group_id: 'g-bnb', expense_date: '2026-08-23', description: 'Capsule caffè' }),
    ],
    righe: [
      { id: 'r1', expense_id: 's-m1', name: 'Pane', amount: 5, category_id: 'c-spesa', subcategory: 'Pane' },
      { id: 'r2', expense_id: 's-m1', name: 'Latte', amount: 3.5, category_id: 'c-spesa', subcategory: 'Latte' },
      { id: 'r3', expense_id: 's-m2', name: 'Quaderni', amount: 4.5, category_id: 'c-scuola', subcategory: 'Cartoleria' },
      { id: 'r4', expense_id: 's-m3', name: 'Sgrassatore', amount: 7, category_id: 'c-pulizia', subcategory: 'Detersivi' },
    ],
    ricevute: [
      { id: 'f1', document_id: 'd-misto' }, { id: 'f2', document_id: 'd-misto' }, // foto multiple
      { id: 'f3', document_id: 'd-fatt-pagata' },
      // d-vecchio e d-fatt-aperta SENZA foto
    ],
    bozze: [], righeBozza: [], categorieCanoniche: [], sottocategorieCanoniche: [],
  }
}

const dati = costruisciDatiSpese(tabelle(), OGGI)
const misto = dati.movimenti.find(m => m.id === 'doc-d-misto')!

test('ogni spesa storica compare esattamente una volta (nessun doppio conteggio)', () => {
  // 5 documenti-movimento (misto, fattura aperta, fattura pagata, 2025,
  // in revisione) + 2 manuali
  assert.equal(dati.movimenti.length, 7)
  // ogni movimento compare una volta sola
  assert.equal(new Set(dati.movimenti.map(m => m.id)).size, dati.movimenti.length)
  // la somma dei movimenti che rappresentano denaro USCITO = somma di TUTTE
  // le spese (20 + 220 + 30 + 60 + 9,90): se una spesa fosse contata due
  // volte (o persa), i totali non tornerebbero; da_pagare e da_controllare
  // NON sono denaro uscito
  const cent = (n: number) => Math.round(n * 100)
  const usciti = dati.movimenti
    .filter(m => m.stato === 'confermato' || m.stato === 'pagata' || m.stato === 'senza_documento')
    .reduce((s, m) => s + cent(m.importo), 0)
  assert.equal(usciti, cent(20 + 220 + 30 + 60 + 9.9))
  // e la fattura aperta resta l'unico movimento senza spese dietro
  assert.deepEqual(dati.movimenti.filter(m => m.stato === 'da_pagare').map(m => m.id), ['doc-d-fatt-aperta'])
})

test('scontrino misto: una voce sola, quote per ambito, somma quote = totale, righe complete', () => {
  assert.equal(dati.movimenti.filter(m => m.id === 'doc-d-misto').length, 1)
  assert.equal(misto.contesto, 'misto')
  assert.deepEqual(controllaMisto(misto), [])
  assert.equal(importoNelContesto(misto, 'mia'), 13)          // 8,50 + 4,50
  assert.equal(importoNelContesto(misto, 'ania'), 7)
  assert.equal(misto.importo, 20)
  assert.equal(misto.righe!.length, 4)                        // divisione riga per riga conservata
  assert.ok(misto.righe!.every(r => r.categoria && r.contesto))
})

test('fattura approvata NON pagata: movimento da pagare, esclusa dallo Speso', () => {
  const aperta = dati.movimenti.find(m => m.id === 'doc-d-fatt-aperta')!
  assert.equal(aperta.stato, 'da_pagare')
  assert.equal(aperta.contesto, 'ania')
  // Speso azienda del mese = fattura pagata 220 + quota misto 7 + generale 9,90 (NON i 300)
  assert.equal(dati.ania.speso, 236.9)
  assert.equal(dati.ania.impegnato.tot, 300)
  assert.equal(dati.ania.impegnato.n, 1)
})

test('totali per ambito del mese: Casa Mia = spese personali, senza doppioni', () => {
  // mia agosto 2026: 8,50 + 4,50 (quote misto) + 60 manuale = 73
  assert.equal(dati.mia.speso, 73)
})

test('documento con più categorie/persone/camere: trovato da OGNI valore presente', () => {
  assert.deepEqual([...misto.categorie].sort(), ['Detersivi e pulizia', 'Scuola e formazione', 'Spesa alimentare'])
  assert.deepEqual([...misto.persone].sort(), ['Casa', 'Teo'])
  assert.deepEqual(misto.camere, ['Ambra'])
  const p = dati.opzioni.mia.periodi
  const f = filtriIniziali(dati.opzioni.mia)
  for (const c of misto.categorie) {
    assert.ok(applicaFiltri(dati.movimenti, { ...f, categoria: c }, 'mia', p).some(m => m.id === misto.id)
      || applicaFiltri(dati.movimenti, { ...f, categoria: c }, 'ania', p).some(m => m.id === misto.id), c)
  }
  for (const persona of misto.persone) {
    assert.ok(applicaFiltri(dati.movimenti, { ...f, persona }, 'mia', p).some(m => m.id === misto.id), persona)
  }
  const fA = filtriIniziali(dati.opzioni.ania)
  assert.ok(applicaFiltri(dati.movimenti, { ...fA, camera: 'Ambra' }, 'ania', p).some(m => m.id === misto.id))
  // camera Generale trova l'aziendale senza camera, non il misto (che ha Ambra)
  const generale = applicaFiltri(dati.movimenti, { ...fA, camera: 'Generale' }, 'ania', p.map(x => x.id === p[0].id ? { ...x } : x))
  assert.ok(generale.some(m => m.id === 'spesa-s-gen'))
  assert.ok(!generale.some(m => m.id === misto.id))
})

test('agosto 2025 e agosto 2026 non si confondono', () => {
  const p = dati.opzioni.mia.periodi
  const f = filtriIniziali(dati.opzioni.mia)
  const ago26 = applicaFiltri(dati.movimenti, { ...f, periodo: '2026-08' }, 'mia', p)
  const anno25 = applicaFiltri(dati.movimenti, { ...f, periodo: '2025' }, 'mia', p)
  assert.ok(!ago26.some(m => m.id === 'doc-d-vecchio'))
  assert.deepEqual(anno25.map(m => m.id), ['doc-d-vecchio'])
})

test('periodi: Mese, Anno, Settimana e Dal–al con id stabili e etichette separate', () => {
  const p = costruisciPeriodi(OGGI, [2025, 2026])
  assert.equal(p[0].id, '2026-08')
  assert.equal(p[0].etichetta, 'Agosto 2026')
  assert.deepEqual([p[0].dal, p[0].al], ['2026-08-01', '2026-08-31'])
  assert.equal(p[1].id, '2026-07')
  const settimana = p.find(x => x.tipo === 'settimana')!
  assert.deepEqual([settimana.dal, settimana.al], ['2026-08-24', '2026-08-30']) // lun–dom del 29/08/2026
  assert.ok(p.some(x => x.id === '2025' && x.etichetta === 'Anno 2025'))
  const intervallo = p.find(x => x.tipo === 'intervallo')!
  const f = { ...filtriIniziali({ periodi: p, categorie: [], metodi: [] }), periodo: intervallo.id, dal: '2026-08-25', al: '2026-08-28' }
  assert.deepEqual(intervalloDelPeriodo(f, p), { dal: '2026-08-25', al: '2026-08-28' })
  const trovati = applicaFiltri(dati.movimenti, f, 'mia', p)
  assert.deepEqual(trovati.map(m => m.id), ['spesa-s-man'])
})

test('documenti: stati, foto multiple e senza fotografia', () => {
  const doc = (id: string) => dati.documenti.find(d => d.id === id)!
  assert.equal(doc('d-misto').pagine, 2)
  assert.equal(doc('d-misto').senzaFoto, false)
  assert.equal(doc('d-fatt-aperta').stato, 'da_pagare')
  assert.equal(doc('d-fatt-aperta').senzaFoto, true)
  assert.equal(doc('d-fatt-pagata').stato, 'pagata')
  assert.equal(doc('d-inrev').stato, 'da_controllare')
  assert.equal(doc('d-vecchio').stato, 'confermato')
})

test('etichette persone: Matteo→Teo, Matteo e Ania→M e A', () => {
  assert.equal(etichettaPersona('Matteo'), 'Teo')
  assert.equal(etichettaPersona('Matteo e Ania'), 'M e A')
  assert.equal(etichettaPersona('Casa'), 'Casa')
  const man = dati.movimenti.find(m => m.id === 'spesa-s-man')!
  assert.deepEqual(man.persone, ['M e A'])
})

test('opzioni dai dati: camere con Generale, persone solo Casa Mia', () => {
  assert.deepEqual(dati.opzioni.ania.camere, ['Generale', 'Ambra', 'Lena', 'Amelia', 'Allegra'])
  assert.ok(dati.opzioni.mia.persone!.includes('Teo') && dati.opzioni.mia.persone!.includes('M e A'))
  assert.equal(dati.opzioni.ania.persone, undefined)
  assert.equal(dati.opzioni.mia.camere, undefined)
})

test('costi per camera del mese: Ambra dal misto, Generale dal resto', () => {
  assert.deepEqual(dati.ania.costiCamere, [
    { nome: 'Generale', tot: 229.9 },   // 220 fattura pagata + 9,90
    { nome: 'Ambra', tot: 7 },
  ])
})

// ============================================================================
// 3.2A.1 — documenti in revisione dalle BOZZE, righe escluse/aggiunte,
// anomalie strutturali, stati esaustivi, fuso di Roma e settimana stabile.
// ============================================================================
import { lunediDella, oggiARoma, statoDocumentoVista, tipoDocumentoVista, type GrezzaBozza, type GrezzaRigaBozza } from './adattatore.ts'

const bozza = (x: Partial<GrezzaBozza> & { id: string; document_id: string }): GrezzaBozza => ({
  status: 'da_controllare', expense_date: '2026-08-29', group_id: 'g-casa',
  category_id: 'c-spesa', subcategory: null, canonical_category_id: null,
  canonical_subcategory_id: null, store: 'Mercato', description: null,
  payment_method: null, room_id: null, expense_nature: null,
  confidence: {}, arrotondamento_cent: 0, expense_id: null, ...x,
})
const rigaBozza = (x: Partial<GrezzaRigaBozza> & { id: string; draft_id: string; amount: number }): GrezzaRigaBozza => ({
  raw_name: null, name: 'Riga', qty: 1, unit_price: null, discount: 0,
  group_id: null, category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null,
  necessity: null, planning: null, confidence: {}, excluded: false, user_added: false, ...x,
})

function tabelleConRevisione(): TabelleGrezze {
  const t = tabelle()
  t.documenti.push(documento({ id: 'd-rev', status: 'in_revisione', doc_total: 10 }))
  t.bozze = [
    bozza({ id: 'b-mia', document_id: 'd-rev', confidence: { store: { confidence: 0.5, doubt_reason: 'negozio poco leggibile' } } }),
    bozza({ id: 'b-bnb', document_id: 'd-rev', group_id: 'g-bnb', category_id: 'c-pulizia', room_id: 'r-lena' }),
    bozza({ id: 'b-scartata', document_id: 'd-rev', status: 'scartata', group_id: 'g-bnb' }),
  ]
  t.righeBozza = [
    rigaBozza({ id: 'rb1', draft_id: 'b-mia', name: 'Frutta', amount: 4, category_id: 'c-spesa' }),
    rigaBozza({ id: 'rb2', draft_id: 'b-mia', name: 'Pane', amount: 2, category_id: 'c-spesa', confidence: { amount: { confidence: 0.6, doubt_reason: 'importo poco leggibile' } } }),
    rigaBozza({ id: 'rb3', draft_id: 'b-mia', name: 'Pane doppio', amount: 2, excluded: true }),
    rigaBozza({ id: 'rb4', draft_id: 'b-mia', name: 'Sacchetto', amount: 1, user_added: true }),
    rigaBozza({ id: 'rb5', draft_id: 'b-bnb', name: 'Aceto ×2', amount: 3, category_id: 'c-pulizia' }),
  ]
  return t
}

test('documento in revisione: una voce da_controllare costruita dalle bozze sorelle', () => {
  const d = costruisciDatiSpese(tabelleConRevisione(), OGGI)
  const rev = d.movimenti.find(m => m.id === 'doc-d-rev')!
  assert.equal(rev.stato, 'da_controllare')
  assert.equal(d.movimenti.filter(m => m.id === 'doc-d-rev').length, 1)
  // contesto dalle bozze ATTIVE (mista: Casa + B&B), non da upload_ambito
  assert.equal(rev.contesto, 'misto')
  // righe complete (anche la scartata NON c'è; l'esclusa sì, marcata)
  assert.equal(rev.righe!.length, 5)
  // quote per ambito SENZA la riga esclusa: mia 4+2+1=7, ania 3
  assert.deepEqual(rev.sorelle, [{ contesto: 'mia', importo: 7 }, { contesto: 'ania', importo: 3 }])
  // insiemi dalle bozze; camera della bozza aziendale
  assert.ok(rev.categorie.includes('Detersivi e pulizia') && rev.categorie.includes('Spesa alimentare'))
  assert.deepEqual(rev.camere, ['Lena'])
  // fuori dallo Speso: i totali del mese non cambiano rispetto al set base
  assert.equal(d.mia.speso, dati.mia.speso)
  assert.equal(d.ania.speso, dati.ania.speso)
})

test('confidence sotto 0,8 su bozza e riga: conteggio dubbi e motivo sul dettaglio', () => {
  const d = costruisciDatiSpese(tabelleConRevisione(), OGGI)
  const rev = d.movimenti.find(m => m.id === 'doc-d-rev')!
  assert.equal(rev.dubbio, '2 campi dubbi')     // store della bozza + amount della riga
  const pane = rev.righe!.find(r => r.nome === 'Pane')!
  assert.equal(pane.dubbio, 'importo poco leggibile')
  const doc = d.documenti.find(x => x.id === 'd-rev')!
  assert.equal(doc.dubbi, 2)
})

test('riga esclusa: conservata come audit ma fuori da quote e quadratura', () => {
  const d = costruisciDatiSpese(tabelleConRevisione(), OGGI)
  const rev = d.movimenti.find(m => m.id === 'doc-d-rev')!
  const esclusa = rev.righe!.find(r => r.esclusa)!
  assert.equal(esclusa.nome, 'Pane doppio')
  // il totale attivo (7+3=10) quadra col doc_total: nessun avviso
  assert.equal(rev.avviso, undefined)
  assert.deepEqual(controllaMisto(rev), [])
})

test('riga aggiunta dall\'utente: distinguibile', () => {
  const d = costruisciDatiSpese(tabelleConRevisione(), OGGI)
  const rev = d.movimenti.find(m => m.id === 'doc-d-rev')!
  assert.equal(rev.righe!.find(r => r.aggiuntaUtente)?.nome, 'Sacchetto')
})

test('documento in revisione che NON quadra: avviso bloccante sul documento, non errore di pagina', () => {
  const t = tabelleConRevisione()
  t.documenti.find(x => x.id === 'd-rev')!.doc_total = 12   // le righe attive sommano 10
  const d = costruisciDatiSpese(t, OGGI)                    // NON deve lanciare
  const rev = d.movimenti.find(m => m.id === 'doc-d-rev')!
  assert.ok(rev.avviso && rev.avviso.includes('10 €') && rev.avviso.includes('12 €'))
})

test('fattura da pagare con bozze: contesto e camera dalle bozze, non da upload_ambito', () => {
  const t = tabelle()
  // la fattura aperta ha upload_ambito=azienda ma la bozza dice camera Lena
  t.bozze = [bozza({ id: 'b-fatt', document_id: 'd-fatt-aperta', group_id: 'g-bnb', category_id: 'c-bianco', room_id: 'r-lena', payment_method: 'bonifico' })]
  t.righeBozza = [rigaBozza({ id: 'rbf', draft_id: 'b-fatt', name: 'Servizio lavanderia', amount: 300, category_id: 'c-bianco' })]
  const d = costruisciDatiSpese(t, OGGI)
  const fatt = d.movimenti.find(m => m.id === 'doc-d-fatt-aperta')!
  assert.equal(fatt.stato, 'da_pagare')
  assert.equal(fatt.contesto, 'ania')
  assert.deepEqual(fatt.camere, ['Lena'])
  assert.deepEqual(fatt.categorie, ['Biancheria'])
  assert.deepEqual(fatt.metodi, ['Bonifico'])
  assert.equal(d.ania.speso, dati.ania.speso)   // sempre fuori dallo Speso
})

test('categoria canonica con ripiego esplicito su quella storica', () => {
  const t = tabelle()
  t.categorieCanoniche = [{ id: 'cc-spesa', name: 'Spesa alimentare (canonica)' }]
  // riga con canonica → vince la canonica; riga senza → ripiego sulla storica
  t.righe[0].canonical_category_id = 'cc-spesa'
  const d = costruisciDatiSpese(t, OGGI)
  const m = d.movimenti.find(x => x.id === 'doc-d-misto')!
  assert.ok(m.categorie.includes('Spesa alimentare (canonica)'))  // dalla canonica
  assert.ok(m.categorie.includes('Spesa alimentare'))             // ripiego storico delle altre righe
})

test('persona Teo ricavata da item.group_id (riga prima, madre come ripiego)', () => {
  const t = tabelle()
  // una riga del misto (spesa di Casa) è in realtà di Teo
  t.righe[1].group_id = 'g-teo'
  const d = costruisciDatiSpese(t, OGGI)
  const m = d.movimenti.find(x => x.id === 'doc-d-misto')!
  const latte = m.righe!.find(r => r.nome === 'Latte')!
  assert.equal(latte.persona, 'Teo')
  // e le analisi di Teo la contano: 3,50 (riga) + 4,50 (spesa di Teo)
  assert.equal(d.mia.teo!.tot, 8)
})

test('righe sotto i 5 €: dagli item, non dalle spese madri; arrotondamenti esclusi', () => {
  const t = tabelle()
  // arrotondamento esplicito: NON entra nella metrica
  t.righe.push({ id: 'r-arr', expense_id: 's-m1', name: 'Arrotondamento', amount: 0.02, category_id: null, subcategory: null, is_adjustment: true })
  t.spese.find(s => s.id === 's-m1')!.amount = 8.52
  t.documenti.find(x => x.id === 'd-misto')!.doc_total = 20.02
  const d = costruisciDatiSpese(t, OGGI)
  // righe personali < 5 € di agosto: Pane 5? no (=5 escluso), Latte 3,50, Quaderni 4,50 → 2 righe
  // (la spesa madre s-man da 60 NON è spezzata: resta 1 riga da 60, fuori)
  assert.equal(d.mia.ripetute!.frase, '2 righe sotto i 5 € nei documenti')
  assert.equal(d.mia.ripetute!.tot, 8)
  assert.ok(!d.mia.ripetute!.frase.includes('spese'))
})

test('categorie del mese basate sulle righe e somma = Speso al centesimo', () => {
  const d = costruisciDatiSpese(tabelle(), OGGI)
  const cent = (n: number) => Math.round(n * 100)
  const sommaCategorie = d.mia.categorie.reduce((s, c) => s + cent(c.tot), 0)
  assert.equal(sommaCategorie, cent(d.mia.speso))
})

test('stato o tipo sconosciuto: errore chiaro, mai trasformazione silenziosa', () => {
  assert.throws(() => statoDocumentoVista({ id: 'x', status: 'boh', kind: 'scontrino' }), /sconosciuto "boh"/)
  assert.throws(() => tipoDocumentoVista({ id: 'x', kind: 'ricevuta' }), /sconosciuto "ricevuta"/)
  assert.equal(tipoDocumentoVista({ id: 'x', kind: 'altro' }), 'altro')
  const t = tabelle()
  t.documenti.push(documento({ id: 'd-altro', kind: 'altro', doc_total: 5, supplier: 'Nota spese' }))
  const d = costruisciDatiSpese(t, OGGI)
  assert.equal(d.documenti.find(x => x.id === 'd-altro')!.tipo, 'altro')
  assert.ok(d.documenti.find(x => x.id === 'd-altro')!.titolo.startsWith('Documento'))
})

// ---- anomalie strutturali: mai una vista parziale sui dati definitivi ----
const rompi = (nome: string, modifica: (t: TabelleGrezze) => void, atteso: RegExp) =>
  test(`anomalia: ${nome}`, () => {
    const t = tabelle()
    modifica(t)
    assert.throws(() => costruisciDatiSpese(t, OGGI), atteso)
  })

rompi('ponte verso spesa inesistente', t => { t.ponte.push({ expense_id: 's-fantasma', document_id: 'd-misto' }) }, /spesa "s-fantasma" inesistente/)
rompi('ponte verso documento inesistente', t => { t.ponte.push({ expense_id: 's-man', document_id: 'd-fantasma' }) }, /documento "d-fantasma" inesistente/)
rompi('stessa spesa su più documenti', t => { t.ponte.push({ expense_id: 's-m1', document_id: 'd-vecchio' }) }, /collegata a più documenti/)
rompi('riga definitiva con spesa madre inesistente', t => { t.righe.push({ id: 'r-x', expense_id: 's-fantasma', name: 'X', amount: 1, category_id: null, subcategory: null }) }, /spesa madre "s-fantasma" inesistente/)
rompi('spesa con receipt_id ma senza ponte', t => { t.spese.push(spesa({ id: 's-recluso', amount: 5, receipt_id: 'vecchia-foto' })) }, /receipt_id ma nessun ponte/)
rompi('documento confermato con somma sorelle diversa da doc_total', t => { t.documenti.find(x => x.id === 'd-misto')!.doc_total = 21 }, /somma spese sorelle .* doc_total/)
rompi('misto confermato con righe non quadrate', t => { t.righe[0].amount = 4 }, /somma righe/)
rompi('gruppo sconosciuto', t => { t.spese[0].group_id = 'g-fantasma' }, /gruppo "g-fantasma" inesistente/)
rompi('categoria sconosciuta', t => { t.spese[0].category_id = 'c-fantasma' }, /categoria "c-fantasma" inesistente/)
rompi('camera sconosciuta', t => { t.spese[2].room_id = 'r-fantasma' }, /camera "r-fantasma" inesistente/)

// ---- fuso di Roma e settimana stabile ----
test('oggi a Roma: subito dopo la mezzanotte italiana il giorno è quello nuovo', () => {
  // 31/08/2026 22:30 UTC = 01/09/2026 00:30 a Roma (ora legale): il mese è già settembre
  assert.equal(oggiARoma(new Date('2026-08-31T22:30:00Z')), '2026-09-01')
  // e in pieno giorno coincide
  assert.equal(oggiARoma(new Date('2026-08-29T10:00:00Z')), '2026-08-29')
})

test('settimana stabile: due giorni della stessa settimana → stesso id', () => {
  // 24/08/2026 è lunedì; 29/08 (sabato) e 27/08 (giovedì) sono nella stessa settimana
  assert.equal(lunediDella('2026-08-29'), '2026-08-24')
  assert.equal(lunediDella('2026-08-27'), '2026-08-24')
  const p1 = costruisciPeriodi('2026-08-29', [2026]).find(p => p.tipo === 'settimana')!
  const p2 = costruisciPeriodi('2026-08-27', [2026]).find(p => p.tipo === 'settimana')!
  assert.equal(p1.id, p2.id)
  assert.equal(p1.id, 'settimana-2026-08-24')
  assert.deepEqual([p1.dal, p1.al], ['2026-08-24', '2026-08-30'])
})
