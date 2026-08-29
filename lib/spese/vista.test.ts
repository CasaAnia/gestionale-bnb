// Test della logica pura del nuovo guscio (3.1 → 3.2A): contesto come
// confine reale, quote del misto, filtri su INSIEMI, periodi con id stabile.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applicaFiltri, controllaMisto, filtriAttivi, filtriIniziali, perContesto,
  perContestoDocumenti, importoNelContesto, intervalloDelPeriodo, nelMese, eurVista,
  type FiltriSpese, type MovimentoVista, type DocumentoVista, type OpzioniFiltri, type PeriodoVista,
} from './vista.ts'

const PERIODI: PeriodoVista[] = [
  { id: '2026-08', etichetta: 'Agosto 2026', tipo: 'mese', dal: '2026-08-01', al: '2026-08-31' },
  { id: '2026-07', etichetta: 'Luglio 2026', tipo: 'mese', dal: '2026-07-01', al: '2026-07-31' },
  { id: '2026', etichetta: 'Anno 2026', tipo: 'anno', dal: '2026-01-01', al: '2026-12-31' },
  { id: 'intervallo', etichetta: 'Dal–al…', tipo: 'intervallo', dal: '', al: '' },
]

const m = (dati: Partial<MovimentoVista>): MovimentoVista => ({
  id: 'x', titolo: 'Prova', giorno: 'Oggi', data: '2026-08-20', importo: 10,
  categoria: 'Spesa alimentare', contesto: 'mia', persona: 'Casa',
  stato: 'confermato', categorie: ['Spesa alimentare'], sottocategorie: [],
  persone: ['Casa'], camere: [], metodi: [], ...dati,
})

const MOVIMENTI: MovimentoVista[] = [
  m({
    id: 'misto', titolo: 'Supermercato', negozio: 'Esselunga', contesto: 'misto',
    stato: 'da_controllare', importo: 15.47,
    categorie: ['Spesa alimentare', 'Detersivi e pulizia'], persone: ['Casa'],
    camere: ['Generale'], metodi: ['Carta'],
    sorelle: [{ contesto: 'mia', importo: 11.33 }, { contesto: 'ania', importo: 4.14 }],
    righe: [
      { nome: 'Pane', importo: 11.33, contesto: 'mia', categoria: 'Spesa alimentare' },
      { nome: 'Aceto', importo: 4.14, contesto: 'ania', categoria: 'Detersivi e pulizia' },
    ],
  }),
  m({ id: 'bar', titolo: 'Colazione', categorie: ['Mangiare fuori'], persone: ['Ania'], metodi: ['Contanti'] }),
  m({ id: 'teo', titolo: 'Quaderni', data: '2026-07-15', categorie: ['Scuola e formazione'], persone: ['Teo'] }),
  m({ id: 'lenzuola', titolo: 'Lenzuola', contesto: 'ania', stato: 'pagata', persone: [], camere: ['Ambra'], metodi: ['Carta attività'] }),
  m({ id: 'fattura', titolo: 'Fattura idraulico', contesto: 'ania', stato: 'da_pagare', persone: [], camere: ['Generale'], metodi: ['Bonifico'] }),
]

const OPZIONI: OpzioniFiltri = { periodi: PERIODI, categorie: [], metodi: [] }
const f = (dati: Partial<FiltriSpese>): FiltriSpese => ({ ...filtriIniziali(OPZIONI), ...dati })

// ---- il contesto è un confine reale ----
test('Casa Mia esclude i movimenti solo Casa Ania (ma tiene il misto)', () => {
  assert.deepEqual(perContesto(MOVIMENTI, 'mia').map(x => x.id), ['misto', 'bar', 'teo'])
})
test('Casa Ania esclude i movimenti solo Casa Mia (ma tiene il misto)', () => {
  assert.deepEqual(perContesto(MOVIMENTI, 'ania').map(x => x.id), ['misto', 'lenzuola', 'fattura'])
})

// ---- quote del misto e controllo di quadratura ----
test('quota principale del misto per ambito; somma quote = totale (controllaMisto)', () => {
  const misto = MOVIMENTI[0]
  assert.equal(importoNelContesto(misto, 'mia'), 11.33)
  assert.equal(importoNelContesto(misto, 'ania'), 4.14)
  assert.deepEqual(controllaMisto(misto), [])
  const rotto = { ...misto, sorelle: [{ contesto: 'mia' as const, importo: 10 }, { contesto: 'ania' as const, importo: 4.14 }] }
  assert.ok(controllaMisto(rotto).length > 0)
})

// ---- documenti separati per ambito ----
test('documenti: personali, aziendali e misti separati correttamente', () => {
  const d = (dati: Partial<DocumentoVista>): DocumentoVista =>
    ({ id: 'd', titolo: 'Doc', tipo: 'scontrino', contesto: 'mia', stato: 'confermato', ...dati })
  const DOCS = [d({ id: 'p' }), d({ id: 'a', contesto: 'ania', tipo: 'fattura' }), d({ id: 'x', contesto: 'misto' })]
  assert.deepEqual(perContestoDocumenti(DOCS, 'mia').map(x => x.id), ['p', 'x'])
  assert.deepEqual(perContestoDocumenti(DOCS, 'ania').map(x => x.id), ['a', 'x'])
})

// ---- filtri su insiemi, dipendenti dall'ambito ----
test('filtro persona: sugli insiemi, solo in Casa Mia', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: '2026', persona: 'Teo' }), 'mia', PERIODI).map(x => x.id), ['teo'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: '2026', persona: 'Teo' }), 'ania', PERIODI).map(x => x.id), ['misto', 'lenzuola', 'fattura'])
})
test('filtro camera: sugli insiemi, solo in Casa Ania', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ camera: 'Ambra' }), 'ania', PERIODI).map(x => x.id), ['lenzuola'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ camera: 'Generale' }), 'ania', PERIODI).map(x => x.id), ['misto', 'fattura'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ camera: 'Ambra' }), 'mia', PERIODI).map(x => x.id), ['misto', 'bar'])
})
test('filtro categoria: il documento passa se ALMENO una riga corrisponde', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ categoria: 'Detersivi e pulizia' }), 'mia', PERIODI).map(x => x.id), ['misto'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ categoria: 'Spesa alimentare' }), 'mia', PERIODI).map(x => x.id), ['misto'])
})
test('soloMisti e stato', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ soloMisti: true }), 'ania', PERIODI).map(x => x.id), ['misto'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Da pagare' }), 'ania', PERIODI).map(x => x.id), ['fattura'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Confermati' }), 'ania', PERIODI).map(x => x.id), ['lenzuola'])
})

// ---- periodi ----
test('periodo per id stabile e Dal–al', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: '2026-07' }), 'mia', PERIODI).map(x => x.id), ['teo'])
  assert.deepEqual(intervalloDelPeriodo(f({ periodo: 'intervallo', dal: '2026-08-01', al: '2026-08-31' }), PERIODI),
    { dal: '2026-08-01', al: '2026-08-31' })
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: 'intervallo', dal: '2026-07-01', al: '2026-07-31' }), 'mia', PERIODI).map(x => x.id), ['teo'])
})

// ---- stato dei filtri ----
test('filtriAttivi: differenze con etichette leggibili (periodo per etichetta)', () => {
  const iniziali = filtriIniziali(OPZIONI)
  assert.deepEqual(filtriAttivi(iniziali, iniziali, PERIODI), [])
  assert.deepEqual(filtriAttivi(f({ periodo: '2026', camera: 'Lena', soloMisti: true }), iniziali, PERIODI),
    [['periodo', 'Anno 2026'], ['camera', 'Lena'], ['soloMisti', 'Solo documenti misti']])
})

// ---- ricerca e testi ----
test('ricerca su titolo, negozio e categorie', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({}), 'mia', PERIODI, 'esselunga').map(x => x.id), ['misto'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({}), 'mia', PERIODI, 'MANGIARE').map(x => x.id), ['bar'])
})
test('nelMese: la d eufonica solo davanti a vocale', () => {
  assert.equal(nelMese('Agosto'), 'ad agosto')
  assert.equal(nelMese('Settembre'), 'a settembre')
})
test('eurVista: interi asciutti, decimali completi', () => {
  assert.equal(eurVista(1500), '1.500 €')
  assert.equal(eurVista(15.47), '15,47 €')
  assert.equal(eurVista(15.4), '15,40 €')
})
