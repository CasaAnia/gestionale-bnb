import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizzaTelefono, telefonoLeggibile } from './whatsapp.ts'

test('prefisso internazionale con + o 00 resta quello indicato', () => {
  assert.deepEqual(normalizzaTelefono('+44 7700 900123'), { numero: '447700900123', avviso: null })
  assert.deepEqual(normalizzaTelefono('0044 7700 900123'), { numero: '447700900123', avviso: null })
  assert.deepEqual(normalizzaTelefono('+39 333 123-4567'), { numero: '393331234567', avviso: null })
  assert.equal(telefonoLeggibile(normalizzaTelefono('+44 (0) 7700.900123')), '+4407700900123')
})

test('cellulare italiano senza prefisso: si aggiunge 39', () => {
  assert.deepEqual(normalizzaTelefono('333 123 4567'), { numero: '393331234567', avviso: null })
  assert.deepEqual(normalizzaTelefono('333123456'), { numero: '39333123456', avviso: null })
  assert.equal(telefonoLeggibile(normalizzaTelefono('333 123 4567')), '+393331234567')
})

test('fisso o numero strano: resta com\'è con l\'avviso', () => {
  assert.deepEqual(normalizzaTelefono('02 1234567'), { numero: '021234567', avviso: 'Controlla il prefisso' })
  assert.deepEqual(normalizzaTelefono('12345'), { numero: '12345', avviso: 'Controlla il prefisso' })
  assert.deepEqual(normalizzaTelefono(''), { numero: '', avviso: null })
  assert.deepEqual(normalizzaTelefono(null), { numero: '', avviso: null })
})
