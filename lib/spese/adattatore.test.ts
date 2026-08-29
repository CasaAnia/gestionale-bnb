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
    bozze: [],
  }
}

const dati = costruisciDatiSpese(tabelle(), OGGI)
const misto = dati.movimenti.find(m => m.id === 'doc-d-misto')!

test('ogni spesa storica compare esattamente una volta (nessun doppio conteggio)', () => {
  // 4 documenti-movimento (misto, fattura aperta, fattura pagata, 2025) + 2 manuali
  assert.equal(dati.movimenti.length, 6)
  // ogni movimento compare una volta sola
  assert.equal(new Set(dati.movimenti.map(m => m.id)).size, dati.movimenti.length)
  // la somma dei movimenti che rappresentano denaro USCITO = somma di TUTTE
  // le spese (20 + 220 + 30 + 60 + 9,90): se una spesa fosse contata due
  // volte (o persa), i totali non tornerebbero
  const cent = (n: number) => Math.round(n * 100)
  const usciti = dati.movimenti.filter(m => m.stato !== 'da_pagare')
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
