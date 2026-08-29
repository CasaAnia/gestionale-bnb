// Test della logica pura dei filtri del nuovo guscio (Fase 3.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applicaFiltri, filtriAttivi, FILTRI_INIZIALI, eurVista,
  type FiltriSpese, type MovimentoVista,
} from './vista.ts'

const m = (dati: Partial<MovimentoVista>): MovimentoVista => ({
  id: 'x', titolo: 'Prova', giorno: 'Oggi', mese: 'Agosto', importo: 10,
  categoria: 'Spesa alimentare', contesto: 'mia', persona: 'Casa',
  stato: 'confermato', ...dati,
})

const MOVIMENTI: MovimentoVista[] = [
  m({ id: 'a', titolo: 'Supermercato', negozio: 'Esselunga', contesto: 'misto', stato: 'da_controllare', metodo: 'Carta' }),
  m({ id: 'b', titolo: 'Colazione', categoria: 'Mangiare fuori', persona: 'Ania', metodo: 'Contanti' }),
  m({ id: 'c', titolo: 'Quaderni', categoria: 'Scuola e formazione', persona: 'Teo', mese: 'Luglio' }),
  m({ id: 'd', titolo: 'Lenzuola', contesto: 'ania', stato: 'pagata', metodo: 'Carta attività' }),
  m({ id: 'e', titolo: 'Fattura idraulico', contesto: 'ania', stato: 'da_pagare', metodo: 'Bonifico' }),
]

const f = (dati: Partial<FiltriSpese>): FiltriSpese => ({ ...FILTRI_INIZIALI, ...dati })

test('filtri iniziali: passa tutto il mese corrente', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, FILTRI_INIZIALI).map(x => x.id), ['a', 'b', 'd', 'e'])
})

test('periodo Anno include anche i mesi passati', () => {
  assert.equal(applicaFiltri(MOVIMENTI, f({ periodo: 'Anno' })).length, 5)
})

test('persona Teo trova solo le spese di Teo (anche in altri mesi con Anno)', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ periodo: 'Anno', persona: 'Teo' })).map(x => x.id), ['c'])
})

test('ambito: il misto appartiene sia a Casa Mia sia a Casa Ania', () => {
  assert.ok(applicaFiltri(MOVIMENTI, f({ ambito: 'Casa Mia' })).some(x => x.id === 'a'))
  assert.ok(applicaFiltri(MOVIMENTI, f({ ambito: 'Casa Ania' })).some(x => x.id === 'a'))
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ ambito: 'Misti' })).map(x => x.id), ['a'])
})

test('stato: etichette leggibili mappate sugli stati veri', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Da controllare' })).map(x => x.id), ['a'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Da pagare' })).map(x => x.id), ['e'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ stato: 'Confermati' })).map(x => x.id), ['b', 'd'])
})

test('metodo di pagamento', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, f({ metodo: 'Carta attività' })).map(x => x.id), ['d'])
})

test('ricerca su titolo, negozio e categoria, senza maiuscole', () => {
  assert.deepEqual(applicaFiltri(MOVIMENTI, FILTRI_INIZIALI, 'esselunga').map(x => x.id), ['a'])
  assert.deepEqual(applicaFiltri(MOVIMENTI, FILTRI_INIZIALI, 'MANGIARE').map(x => x.id), ['b'])
  assert.equal(applicaFiltri(MOVIMENTI, FILTRI_INIZIALI, 'inesistente').length, 0)
})

test('filtriAttivi elenca solo le differenze dai valori iniziali', () => {
  assert.deepEqual(filtriAttivi(FILTRI_INIZIALI), [])
  assert.deepEqual(filtriAttivi(f({ persona: 'Teo', stato: 'Da pagare' })),
    [['persona', 'Teo'], ['stato', 'Da pagare']])
})

test('eurVista: interi asciutti, decimali completi', () => {
  assert.equal(eurVista(1500), '1.500 €')
  assert.equal(eurVista(15.47), '15,47 €')
  assert.equal(eurVista(15.4), '15,40 €')
})
