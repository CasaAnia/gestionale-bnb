import { test } from 'node:test'
import assert from 'node:assert/strict'
import { altriInCamera, nomeConAltri, nomeConAltriCorto, nomeOspite } from './guestName.ts'

const luca = { guests: { full_name: 'Luca Tassone' }, extra_phone_1_name: 'Massimo Tassone', chi_e: 'Fratello' }
const sola = { guests: { full_name: 'Anna Rossi' } }

test('chi altro dorme in camera: nomi ripuliti, i vuoti non contano', () => {
  assert.deepEqual(altriInCamera(luca), ['Massimo Tassone'])
  assert.deepEqual(altriInCamera(sola), [])
  assert.deepEqual(altriInCamera({ extra_phone_1_name: '  ', extra_phone_2_name: 'Patty' }), ['Patty'])
  assert.deepEqual(altriInCamera(null), [])
})

test('i due nomi attaccati: prima chi ha prenotato, poi chi dorme davvero', () => {
  assert.equal(nomeConAltri(luca), 'Luca Tassone / Massimo Tassone')
  assert.equal(nomeConAltri({ ...luca, extra_phone_2_name: 'Patty' }), 'Luca Tassone / Massimo Tassone / Patty')
})

test('senza altre persone non cambia niente: il nome di sempre', () => {
  assert.equal(nomeConAltri(sola), nomeOspite(sola))
  assert.equal(nomeConAltriCorto(sola), nomeOspite(sola))
  assert.equal(nomeConAltri({ guest_name: 'Rita Bianchi' }), 'Rita Bianchi')
})

test('forma corta per le barre del calendario: «Luca T. / Massimo T.»', () => {
  assert.equal(nomeConAltriCorto(luca), 'Luca T. / Massimo T.')
  assert.equal(nomeConAltriCorto({ guest_name: 'Maria Lipari', extra_phone_1_name: 'Pietro Maltese' }), 'Maria L. / Pietro M.')
})

test('nomi di una parola sola e numeri di telefono restano interi', () => {
  assert.equal(nomeConAltriCorto({ guest_name: 'Gerardo', extra_phone_1_name: 'Rita' }), 'Gerardo / Rita')
  assert.equal(nomeConAltriCorto({ guests: { phone: '3331234567' }, extra_phone_1_name: 'Moglie Brasiliana' }), '3331234567 / Moglie B.')
})
