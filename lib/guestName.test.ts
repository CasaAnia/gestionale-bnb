import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeCompleto, nomeBreve } from './guestName.ts'

// «Nome Cognome» ovunque, mai «Cognome Nome»
test('nomeCompleto: nome e cognome, nell\'ordine giusto e senza spazi doppi', () => {
  assert.equal(nomeCompleto({ nome: 'Anna', cognome: 'Rossi' }), 'Anna Rossi')
  assert.equal(nomeCompleto({ nome: ' Anna ', cognome: '  Rossi ' }), 'Anna Rossi')
  assert.equal(nomeCompleto({ nome: 'Maria Luisa', cognome: 'De  Santis' }), 'Maria Luisa De Santis')
})

test('nomeCompleto: solo nome, solo cognome, niente', () => {
  assert.equal(nomeCompleto({ nome: 'Anna', cognome: '' }), 'Anna')
  assert.equal(nomeCompleto({ nome: '', cognome: 'Rossi' }), 'Rossi')
  assert.equal(nomeCompleto({ nome: ' ', cognome: null }), '')
  assert.equal(nomeCompleto({}), '')
})

test('nomeBreve: «Nome C.» per le barre strette', () => {
  assert.equal(nomeBreve({ nome: 'Anna', cognome: 'Rossi' }), 'Anna R.')
  assert.equal(nomeBreve({ nome: ' Marek ', cognome: ' Kowalski' }), 'Marek K.')
  assert.equal(nomeBreve({ nome: 'Anna', cognome: '' }), 'Anna')
  assert.equal(nomeBreve({ nome: '', cognome: 'Rossi' }), 'Rossi')
  assert.equal(nomeBreve({ nome: '', cognome: '' }), '')
})
