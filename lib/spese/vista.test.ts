// Test della logica pura del nuovo guscio (Fase 3.1 + correzioni 3.1.1):
// contesto come confine reale, quote del misto, filtri per ambito.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applicaFiltri, filtriAttivi, filtriIniziali, perContesto, perContestoDocumenti,
  importoNelContesto, nelMese, eurVista,
  type FiltriSpese, type MovimentoVista, type DocumentoVista, type OpzioniFiltri,
} from './vista.ts'

const m = (dati: Partial<MovimentoVista>): MovimentoVista => ({
  id: 'x', titolo: 'Prova', giorno: 'Oggi', mese: 'Agosto', importo: 10,
  categoria: 'Spesa alimentare', contesto: 'mia', persona: 'Casa',
  stato: 'confermato', ...dati,
})

const MOVIMENTI: MovimentoVista[] = [
  m({ id: 'misto', titolo: 'Supermercato', negozio: 'Esselunga', contesto: 'misto', stato: 'da_controllare', metodo: 'Carta', importo: 15.47, sorelle: [{ contesto: 'mia', importo: 11.33 }, { contesto: 'ania', importo: 4.14 }] }),
  m({ id: 'bar', titolo: 'Colazione', categoria: 'Mangiare fuori', persona: 'Ania', metodo: 'Contanti' }),
  m({ id: 'teo', titolo: 'Quaderni', categoria: 'Scuola e formazione', persona: 'Teo', mese: 'Luglio' }),
  m({ id: 'lenzuola', titolo: 'Lenzuola', contesto: 'ania', stato: 'pagata', metodo: 'Carta attività', camera: 'Ambra' }),
  m({ id: 'fattura', titolo: 'Fattura idraulico', contesto: 'ania', stato: 'da_pagare', metodo: 'Bonifico' }),
]

const OPZIONI: OpzioniFiltri = { periodi: ['Agosto', 'Luglio', 'Anno'], categorie: [], metodi: [] }
const f = (dati: Partial<FiltriSpese>): FiltriSpese => ({ ...filtriIniziali(OPZIONI), ...dati })

// ---- il contesto è un confine reale ----
test('Casa Mia esclude i movimenti solo Casa Ania (ma tiene il misto)', () => {
  assert.deepEqual(perContesto(MOVIMENTI, 'mia').map(x => x.id), ['misto', 'bar', 'teo'])
})
test('Casa Ania esclude i movimenti solo Casa Mia (ma tiene il misto)', () => {
  assert.deepEqual(perContesto(MOVIMENTI, 'ania').map(x => x.id), ['misto', 'lenzuola', 'fattura'])
})
test('il misto appare UNA sola volta in ciascun ambito', () => {
  for (const c of ['mia', 'ania'] as const) {
    assert.equal(perContesto(MOVIMENTI, c).filter(x => x.id === 'misto').length, 1)
  }
})

// ---- quota principale del misto per ambito ----
test('la quota principale del misto cambia con l\'ambito; il totale resta sul documento', () => {
  const misto = MOVIMENTI[0]
  assert.equal(importoNelContesto(misto, 'mia'), 11.33)
  assert.equal(importoNelContesto(misto, 'ania'), 4.14)
  assert.equal(misto.importo, 15.47)
  assert.equal(importoNelContesto(MOVIMENTI[3], 'ania'), 10) // non misto: importo pieno
})

// ---- documenti separati per ambito ----
test('documenti: personali, aziendali e misti separati correttamente', () => {
  const d = (dati: Partial<DocumentoVista>): DocumentoVista =>
    ({ id: 'd', titolo: 'Doc', tipo: 'scontrino', contesto: 'mia', stato: 'confermato', ...dati })
  const DOCS = [d({ id: 'p' }), d({ id: 'a', contesto: 'ania', tipo: 'fattura' }), d({ id: 'x', contesto: 'misto' })]
  assert.deepEqual(perContestoDocumenti(DOCS, 'mia').map(x => x.id), ['p', 'x'])
  assert.deepEqual(perContestoDocumenti(DOCS, 'ania').map(x => x.id), ['a', 'x'])
})

// ---- filtri dipendenti dall'ambito ----
test('filtro persona: agisce in Casa Mia, ignorato in Casa Ania', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: 'Anno', persona: 'Teo' }), 'mia').map(x => x.id), ['teo'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: 'Anno', persona: 'Teo' }), 'ania').map(x => x.id), ['misto', 'lenzuola', 'fattura'])
})
test('filtro camera: agisce in Casa Ania (Generale = senza camera), ignorato in Casa Mia', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ camera: 'Ambra' }), 'ania').map(x => x.id), ['lenzuola'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ camera: 'Generale' }), 'ania').map(x => x.id), ['misto', 'fattura'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ camera: 'Ambra' }), 'mia').map(x => x.id), ['misto', 'bar'])
})
test('soloMisti: l\'unica scelta d\'ambito nel pannello', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ soloMisti: true }), 'mia').map(x => x.id), ['misto'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ soloMisti: true }), 'ania').map(x => x.id), ['misto'])
})

// ---- filtri classici ----
test('periodo, stato, metodo e ricerca', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: 'Anno' }), 'mia').map(x => x.id), ['misto', 'bar', 'teo'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Da pagare' }), 'ania').map(x => x.id), ['fattura'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Confermati' }), 'ania').map(x => x.id), ['lenzuola'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ metodo: 'Carta attività' }), 'ania').map(x => x.id), ['lenzuola'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({}), 'mia', 'ESSELUNGA').map(x => x.id), ['misto'])
})

// ---- stato dei filtri ----
test('filtriIniziali parte dal primo periodo delle opzioni', () => {
  assert.equal(filtriIniziali(OPZIONI).periodo, 'Agosto')
  assert.equal(filtriIniziali({ periodi: [], categorie: [], metodi: [] }).periodo, 'Anno')
})
test('filtriAttivi elenca solo le differenze, con etichetta leggibile per i misti', () => {
  const iniziali = filtriIniziali(OPZIONI)
  assert.deepEqual(filtriAttivi(iniziali, iniziali), [])
  assert.deepEqual(filtriAttivi(f({ camera: 'Lena', soloMisti: true }), iniziali),
    [['camera', 'Lena'], ['soloMisti', 'Solo documenti misti']])
})

// ---- testi ----
test('nelMese: la d eufonica solo davanti a vocale', () => {
  assert.equal(nelMese('Agosto'), 'ad agosto')
  assert.equal(nelMese('Ottobre'), 'ad ottobre')
  assert.equal(nelMese('Settembre'), 'a settembre')
  assert.equal(nelMese('Luglio'), 'a luglio')
})
test('eurVista: interi asciutti, decimali completi', () => {
  assert.equal(eurVista(1500), '1.500 €')
  assert.equal(eurVista(15.47), '15,47 €')
  assert.equal(eurVista(15.4), '15,40 €')
})
