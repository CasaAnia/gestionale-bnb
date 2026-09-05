import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numeriOggi, testoOccupate } from './numeriOggi.ts'
import { oggiARoma } from './spese/adattatore.ts'

const OGGI = '2026-09-05'
const b = (id: string, room_id: string, check_in: string, check_out: string, extra: Partial<{ status: string; group_id: string; guest_id: string }> = {}) =>
  ({ id, room_id, check_in, check_out, status: 'confermata', ...extra })
const camere = [{ id: 'amelia', active: true }, { id: 'allegra', active: true }, { id: 'ambra', active: true }, { id: 'lena', active: true }, { id: 'archiviata', active: false }]

test('tre numeri: arrivi e partenze di oggi, camere occupate stanotte su quelle attive', () => {
  const n = numeriOggi([
    b('a', 'amelia', '2026-09-05', '2026-09-08'),      // arriva oggi, dorme stanotte
    b('p', 'allegra', '2026-09-02', '2026-09-05'),     // parte oggi: stanotte libera
    b('d', 'ambra', '2026-09-03', '2026-09-07'),       // in casa
    b('f', 'lena', '2026-09-06', '2026-09-08'),        // arriva domani
    b('att', 'lena', '2026-09-05', '2026-09-07', { status: 'in_attesa' }),   // esclusa
    b('ann', 'lena', '2026-09-05', '2026-09-07', { status: 'annullata' }),   // esclusa
  ], camere, OGGI)
  assert.deepEqual(n, { arriviOggi: 1, partenzeOggi: 1, camereOccupate: 2, camereTotali: 4 })
  assert.equal(testoOccupate(n), '2 su 4')
})

test('tre numeri: un cambio camera di oggi non è né un arrivo né una partenza, e la camera si conta una volta', () => {
  const n = numeriOggi([
    b('s1', 'ambra', '2026-09-03', '2026-09-05', { group_id: 'g' }),
    b('s2', 'lena', '2026-09-05', '2026-09-07', { group_id: 'g' }),      // stesso soggiorno: cambio camera oggi
    b('x', 'amelia', '2026-09-05', '2026-09-06'),                        // vero arrivo
    // due prenotazioni sulla stessa camera stanotte (dato sporco): la camera conta una volta
    b('y1', 'allegra', '2026-09-04', '2026-09-06'), b('y2', 'allegra', '2026-09-05', '2026-09-06'),
  ], camere, OGGI)
  assert.equal(n.arriviOggi, 2)      // x e y2; s2 no
  assert.equal(n.partenzeOggi, 0)    // s1 parte oggi ma è un cambio camera
  assert.equal(n.camereOccupate, 3)  // lena (s2), amelia, allegra
  assert.equal(n.camereTotali, 4)
})

test('tre numeri: cambio camera riconosciuto anche dal solo cliente (guest_id) come nella riga «⇄ CAMBIO»', () => {
  const n = numeriOggi([
    b('s1', 'ambra', '2026-09-03', '2026-09-05', { guest_id: 'c' }),
    b('s2', 'lena', '2026-09-05', '2026-09-07', { guest_id: 'c' }),
  ], camere, OGGI)
  assert.deepEqual([n.arriviOggi, n.partenzeOggi, n.camereOccupate], [0, 0, 1])
})

test('tre numeri: il giorno è quello di Roma, non quello in UTC', () => {
  const istante = new Date('2026-09-04T22:30:00Z')     // 00:30 del 5 settembre a Roma
  const oggi = oggiARoma(istante)
  assert.equal(oggi, '2026-09-05')
  const n = numeriOggi([b('a', 'amelia', '2026-09-05', '2026-09-08'), b('p', 'ambra', '2026-09-02', '2026-09-04')], camere, oggi)
  assert.deepEqual([n.arriviOggi, n.partenzeOggi, n.camereOccupate], [1, 0, 1])
})

test('tre numeri: senza prenotazioni tutto a zero ma le camere restano', () => {
  assert.deepEqual(numeriOggi([], camere, OGGI), { arriviOggi: 0, partenzeOggi: 0, camereOccupate: 0, camereTotali: 4 })
})
