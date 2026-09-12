// La camera chiesta che non basta: si avvisa, non si blocca (Ania, 12/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avvisoCameraPersone, camereCheBastano } from './cameraPerPersone.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', has_extra_bed: true, active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', has_extra_bed: true, active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', has_extra_bed: true, active: true }
const LENA = { id: LENA_ID, name: 'Lena', has_extra_bed: true, active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]

test('le camere che bastano sono quelle della capienza di sempre', () => {
  // Amelia 2 (singola + letto), Allegra e Ambra 3, Lena 4
  assert.deepEqual(camereCheBastano(CAMERE, 2).map(c => c.name), ['Amelia', 'Allegra', 'Ambra', 'Lena'])
  assert.deepEqual(camereCheBastano(CAMERE, 3).map(c => c.name), ['Allegra', 'Ambra', 'Lena'])
  assert.deepEqual(camereCheBastano(CAMERE, 4).map(c => c.name), ['Lena'])
  assert.deepEqual(camereCheBastano(CAMERE, 5).map(c => c.name), [])
  // una camera spenta non si propone
  assert.deepEqual(camereCheBastano([{ ...LENA, active: false }], 4).map(c => c.name), [])
})

test('il caso di Ania: Ambra con 4 persone', () => {
  assert.equal(avvisoCameraPersone(AMBRA, 4, CAMERE), 'Ambra non basta per 4 persone: in quattro va solo Lena')
})

test('più camere adatte: si elencano', () => {
  assert.equal(avvisoCameraPersone(AMELIA, 3, CAMERE), 'Amelia non basta per 3 persone: in tre vanno Allegra, Ambra e Lena')
  assert.equal(avvisoCameraPersone(AMELIA, 4, CAMERE), 'Amelia non basta per 4 persone: in quattro va solo Lena')
})

test('nessuna camera adatta', () => {
  assert.equal(avvisoCameraPersone(LENA, 5, CAMERE), 'Nessuna camera basta per 5 persone')
  assert.equal(avvisoCameraPersone(AMBRA, 6, CAMERE), 'Nessuna camera basta per 6 persone')
})

test('quando la camera basta non si dice niente', () => {
  assert.equal(avvisoCameraPersone(AMBRA, 3, CAMERE), null)
  assert.equal(avvisoCameraPersone(LENA, 4, CAMERE), null)
  assert.equal(avvisoCameraPersone(AMELIA, 2, CAMERE), null)
  // nessuna camera chiesta: «qualsiasi» non si avvisa mai
  assert.equal(avvisoCameraPersone(null, 4, CAMERE), null)
  assert.equal(avvisoCameraPersone(undefined, 4, CAMERE), null)
  // persone non ancora scritte
  assert.equal(avvisoCameraPersone(AMBRA, 0, CAMERE), null)
})
