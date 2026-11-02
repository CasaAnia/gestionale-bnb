// Prova della logica pura delle richieste in attesa (dati INVENTATI).
// Non fa parte della suite `npm test` (che legge solo lib/**): si lancia a mano
//   node --test app/api/disponibilita/richiesteAttesa.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { richiesteInAttesa, nottiOrdinate, eInAttesa, type RichiestaAttesa } from './richiesteAttesa.ts'

const AMBRA = 'ambra-id', LENA = 'lena-id', AMELIA = 'amelia-id'
const notti = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']
const base = { id: 'x', persone: 2, camera_id: null } as const

test('stati: contano solo in_attesa e proposta_inviata', () => {
  assert.equal(eInAttesa('in_attesa'), true)
  assert.equal(eInAttesa('proposta_inviata'), true)
  for (const s of ['confermata', 'rifiutata', 'chiusa', 'completata', 'annullata']) assert.equal(eInAttesa(s), false, s)
})

test('camera preferita: le notti della richiesta su quella camera, solo dentro l’intervallo', () => {
  const r: RichiestaAttesa = { ...base, id: 'a', stato: 'in_attesa', arrivo: '2026-11-18', partenza: '2026-11-21', camera_id: AMBRA }
  const e = richiesteInAttesa([r], notti)
  assert.deepEqual(nottiOrdinate(e, AMBRA), ['2026-11-18', '2026-11-19'])
  assert.deepEqual(e.senzaCamera, [])
})

test('notti_richieste scelte: solo quelle', () => {
  const r: RichiestaAttesa = { ...base, id: 'b', stato: 'in_attesa', arrivo: '2026-11-15', partenza: '2026-11-19', camera_id: LENA, notti_richieste: ['2026-11-15', '2026-11-17'] }
  assert.deepEqual(nottiOrdinate(richiesteInAttesa([r], notti), LENA), ['2026-11-15', '2026-11-17'])
})

test('proposta inviata con cambio camera e alternativa: camere e periodi dei segmenti, non la camera preferita', () => {
  const r: RichiestaAttesa = {
    ...base, id: 'c', stato: 'proposta_inviata', arrivo: '2026-11-16', partenza: '2026-11-19', camera_id: AMELIA,
    proposta_soluzione: { segmenti: [
      { camera: { id: AMBRA }, arrivo: '2026-11-16', partenza: '2026-11-17' },
      { camera: { id: LENA }, arrivo: '2026-11-17', partenza: '2026-11-19' },
    ] },
    proposta_alternative: [{ segmenti: [{ camera: { id: AMBRA }, arrivo: '2026-11-16', partenza: '2026-11-19' }] }],
  }
  const e = richiesteInAttesa([r], notti)
  assert.deepEqual(nottiOrdinate(e, AMBRA), ['2026-11-16', '2026-11-17', '2026-11-18'])
  assert.deepEqual(nottiOrdinate(e, LENA), ['2026-11-17', '2026-11-18'])
  assert.deepEqual(nottiOrdinate(e, AMELIA), [])
  assert.deepEqual(e.senzaCamera, [])
})

test('senza camera: date e persone della richiesta, se tocca l’intervallo; mai nomi', () => {
  const dentro: RichiestaAttesa = { ...base, id: 'd', stato: 'in_attesa', arrivo: '2026-11-16', partenza: '2026-11-18', persone: '2' }
  const fuori: RichiestaAttesa = { ...base, id: 'e', stato: 'in_attesa', arrivo: '2026-11-19', partenza: '2026-11-22', persone: 1 }
  const chiusa: RichiestaAttesa = { ...base, id: 'f', stato: 'chiusa', arrivo: '2026-11-16', partenza: '2026-11-18' }
  const e = richiesteInAttesa([fuori, dentro, chiusa], ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'])
  assert.deepEqual(e.senzaCamera, [{ dal: '2026-11-16', al: '2026-11-18', persone: 2 }])
  assert.equal(e.perCamera.size, 0)
  assert.deepEqual(Object.keys(e.senzaCamera[0]), ['dal', 'al', 'persone'])
})

test('richiesta fuori dall’intervallo: niente', () => {
  const r: RichiestaAttesa = { ...base, id: 'g', stato: 'in_attesa', arrivo: '2026-12-01', partenza: '2026-12-03', camera_id: AMBRA }
  const e = richiesteInAttesa([r], notti)
  assert.equal(e.perCamera.size, 0)
  assert.deepEqual(e.senzaCamera, [])
})
