// I rifiuti del database detti con parole: la camera appena presa (0051) e i
// due letti di casa già impegnati (0054, secondo controllo del 15/09/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  messaggioSovrapposizione, eSovrapposizione, eLettiFiniti,
  CAMERA_APPENA_PRESA, LETTI_APPENA_PRESI,
} from './erroreSovrapposizione.ts'

test('la camera appena presa si riconosce dal codice o dal nome del vincolo', () => {
  assert.equal(eSovrapposizione({ code: '23P01' }), true)
  assert.equal(eSovrapposizione({ message: 'conflicting key value violates exclusion constraint "bookings_camera_non_due_volte"' }), true)
  assert.equal(eSovrapposizione({ code: '23505', message: 'duplicate key' }), false)
  assert.equal(eSovrapposizione(null), false)
  assert.equal(messaggioSovrapposizione({ code: '23P01' }), CAMERA_APPENA_PRESA)
})

test('i letti finiti si riconoscono dal messaggio del controllo, vecchio o nuovo', () => {
  assert.equal(eLettiFiniti({ message: 'LETTI_FINITI: la notte del 20 novembre i letti in più sono già presi' }), true)
  assert.equal(eLettiFiniti({ message: 'Letti aggiuntivi esauriti la notte del 3 ottobre (camera Ambra)' }), true, 'anche quello della 0027')
  assert.equal(eLettiFiniti({ message: 'altro errore' }), false)
  assert.equal(messaggioSovrapposizione({ message: 'LETTI_FINITI: la notte del 20 novembre' }), LETTI_APPENA_PRESI)
})

test('un errore qualunque non si traveste da rifiuto', () => {
  assert.equal(messaggioSovrapposizione({ code: '23505', message: 'duplicate key' }), null)
  assert.equal(messaggioSovrapposizione(undefined), null)
})
