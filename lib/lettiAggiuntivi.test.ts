import test from 'node:test'
import assert from 'node:assert/strict'
import { LENA_ID, lettiPoolPrenotazione } from './lettiAggiuntivi.ts'
import { tariffaCamera } from './tariffe.ts'

test('il pool conta zero senza letto, uno per un extra normale e due per la quadrupla Lena', () => {
  assert.equal(lettiPoolPrenotazione({ room_id: 'allegra', num_guests: 2, extra_bed: false }), 0)
  assert.equal(lettiPoolPrenotazione({ room_id: 'allegra', num_guests: 3, extra_bed: true }), 1)
  assert.equal(lettiPoolPrenotazione({ room_id: LENA_ID, num_guests: 3, extra_bed: true }), 1)
  assert.equal(lettiPoolPrenotazione({ room_id: LENA_ID, num_guests: 4, extra_bed: true }), 2)
  assert.equal(lettiPoolPrenotazione({ room_id: LENA_ID, num_guests: 4, extra_bed: true, extra_bed_dates: [] }), 2)
})

test('le date del letto sono sufficienti a dichiarare l’occupazione del pool', () => {
  assert.equal(lettiPoolPrenotazione({ room_id: LENA_ID, num_guests: 4, extra_bed_dates: ['2026-09-01'] }), 2)
})

test('calendario e tariffa usano la stessa regola per Lena da uno a quattro ospiti', () => {
  const lena = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true }

  for (const ospiti of [1, 2, 3, 4]) {
    const attesi = tariffaCamera(lena, ospiti).lettiPool
    assert.equal(
      lettiPoolPrenotazione({ room_id: LENA_ID, num_guests: ospiti, extra_bed: attesi > 0 }),
      attesi,
    )
  }
})
