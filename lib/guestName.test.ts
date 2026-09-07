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
  assert.equal(nomeCompleto({ nome: null, cognome: undefined }), '')
})

test('nomeCompleto: scheda cliente col campo unico full_name (già «Nome Cognome»), ripulito', () => {
  assert.equal(nomeCompleto({ full_name: '  Mario   Rossi ' }), 'Mario Rossi')
  assert.equal(nomeCompleto({ full_name: null }), '')
  // nome e cognome separati vincono sul campo unico
  assert.equal(nomeCompleto({ nome: 'Anna', cognome: 'Rossi', full_name: 'Rossi Anna' }), 'Anna Rossi')
  assert.equal(nomeCompleto({ nome: '', cognome: '', full_name: 'Luca Bianchi' }), 'Luca Bianchi')
})

test('nomeBreve: «Nome C.» per le barre strette', () => {
  assert.equal(nomeBreve({ nome: 'Anna', cognome: 'Rossi' }), 'Anna R.')
  assert.equal(nomeBreve({ nome: ' Marek ', cognome: ' Kowalski' }), 'Marek K.')
  assert.equal(nomeBreve({ nome: 'Anna', cognome: '' }), 'Anna')
  assert.equal(nomeBreve({ nome: '', cognome: 'Rossi' }), 'Rossi')
  assert.equal(nomeBreve({ nome: '', cognome: '' }), '')
})
