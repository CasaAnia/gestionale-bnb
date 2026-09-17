// «Con lei» dalla scheda (17/09/2026): la logica pura del foglio
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personeDaPrenotazione, campiConLeiCompleti, senzaChiE2, stessePersone } from './conLeiScheda.ts'

const riga = { id: 'a', extra_phone_1_name: 'Marco Riva', extra_phone_1: '3334567890', chi_e: 'il figlio', extra_phone_2: '3339876543', extra_phone_2_name: null, chi_e_2: null }

test('le persone salvate si rileggono nella forma dell’inserimento; chi non ha né nome né numero non c’è', () => {
  assert.deepEqual(personeDaPrenotazione(riga), [
    { id: 'uno', nome: 'Marco Riva', chiE: 'il figlio', telefono: '3334567890' },
    { id: 'due', nome: '', chiE: '', telefono: '3339876543' },
  ])
  assert.deepEqual(personeDaPrenotazione({ id: 'b' }), [])
  assert.deepEqual(personeDaPrenotazione(null), [])
})

test('si riscrivono tutte e sei le colonne: chi viene tolta lascia null, la seconda persona porta chi_e_2', () => {
  assert.deepEqual(campiConLeiCompleti([{ id: 'x', nome: 'Anna Bruni', chiE: 'Sorella', telefono: '333 111 2222' }]), {
    extra_phone_1_name: 'Anna Bruni', extra_phone_1: '3331112222', chi_e: 'Sorella',
    extra_phone_2_name: null, extra_phone_2: null, chi_e_2: null,
  })
  assert.deepEqual(campiConLeiCompleti([]), {
    extra_phone_1_name: null, extra_phone_1: null, chi_e: null, extra_phone_2_name: null, extra_phone_2: null, chi_e_2: null,
  })
  const due = campiConLeiCompleti([{ id: '1', nome: 'A', chiE: 'Mamma', telefono: '' }, { id: '2', nome: 'B', chiE: 'Figlia', telefono: '' }, { id: '3', nome: 'C', chiE: '', telefono: '' }])
  assert.equal(due.chi_e_2, 'Figlia')
  assert.equal(due.extra_phone_2_name, 'B')
  // la terza non entra (le colonne sono due: lo dice il foglio)
  assert.equal(Object.values(due).includes('C'), false)
  // senza la 0056
  assert.equal('chi_e_2' in senzaChiE2(due), false)
  assert.equal(senzaChiE2(due).chi_e, 'Mamma')
})

test('niente da salvare se le persone sono le stesse della riga', () => {
  assert.equal(stessePersone(personeDaPrenotazione(riga), riga), true)
  assert.equal(stessePersone([], riga), false)
  assert.equal(stessePersone([{ id: 'uno', nome: 'Marco Riva', chiE: 'il figlio', telefono: '3334567890' }], riga), false)
})
