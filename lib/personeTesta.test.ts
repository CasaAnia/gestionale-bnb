// La riga «persone e camera» della testa (12/09/2026, bozza approvata da Ania)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personeTesta, trattiPersone } from './personeTesta.ts'

const testo = (persone: number[]) => personeTesta(persone).map(p => p.testo).join(' ')

test('persone uguali tutte le notti: solo il numero', () => {
  assert.deepEqual(personeTesta([3, 3]), [{ testo: '3', grande: true }])
  assert.deepEqual(personeTesta([1]), [{ testo: '1', grande: true }])
  assert.deepEqual(personeTesta([]), [])
})

test('persone che cambiano: la sequenza dei soli cambi', () => {
  // gli esempi di Ania
  assert.equal(testo([3, 1, 1, 1, 1]), '3 → 1')
  assert.equal(testo([2, 1, 2]), '2 → 1 → 2')
  // le frecce sono piccole, i numeri grandi
  assert.deepEqual(personeTesta([3, 1]), [
    { testo: '3', grande: true },
    { testo: '→', grande: false },
    { testo: '1', grande: true },
  ])
  // le notti uguali di fila non fanno una voce a testa
  assert.deepEqual(trattiPersone([2, 2, 2, 3, 3, 2]), [2, 3, 2])
})

test('più di tre tratti: il più piccolo e il più grande', () => {
  assert.equal(testo([1, 2, 3, 2]), 'da 1 a 3')
  assert.equal(testo([2, 1, 2, 1, 2]), 'da 1 a 2')
  // tre tratti esatti restano una sequenza
  assert.equal(testo([2, 1, 2]), '2 → 1 → 2')
  assert.deepEqual(personeTesta([1, 2, 3, 2]), [
    { testo: 'da', grande: false },
    { testo: '1', grande: true },
    { testo: 'a', grande: false },
    { testo: '3', grande: true },
  ])
})

