import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validaRichiestaWeb, mappaCamera, stessaRichiesta, consentiIp } from './richiesteWeb.ts'

const CAMERE = [{ id: 'fed43a69-5e19-4cf9-b1b3-64affa46f9b1', name: 'Amelia' }, { id: '19ae4611-c0a4-42ae-8530-210f9a948e9e', name: 'Lena' }]
const OGGI = '2026-09-02'
const ok = { nome: ' Anna ', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', persone: 2, camera: 'Amelia', telefono: '333 123 4567', email: 'a@b.it', note: 'Arrivo tardi', origine: 'google' }

test('richiesta valida: campi normalizzati, email nelle note, camera mappata', () => {
  const r = validaRichiestaWeb(ok, OGGI, CAMERE)
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.dati.nome, 'Anna')
  assert.equal(r.dati.camera_id, CAMERE[0].id)
  assert.equal(r.dati.telefono, '+393331234567')
  assert.equal(r.dati.telefonoCifre, '393331234567')
  assert.equal(r.dati.note, 'Arrivo tardi\nEmail: a@b.it')
  assert.equal(r.dati.origine, 'google')
})

test('validazione: ogni errore ha il suo messaggio', () => {
  const err = (c: object) => { const r = validaRichiestaWeb({ ...ok, ...c }, OGGI, CAMERE); return r.ok ? 'OK' : r.errore }
  assert.match(err({ nome: '' }), /nome/)
  assert.match(err({ cognome: '  ' }), /cognome/)
  assert.match(err({ arrivo: '13/09/2026' }), /arrivo non valida/)
  assert.match(err({ partenza: '2026-02-30' }), /partenza non valida/)
  assert.match(err({ partenza: '2026-09-13' }), /dopo l/)
  assert.match(err({ arrivo: '2026-09-01', partenza: '2026-09-03' }), /passato/)
  assert.match(err({ persone: 5 }), /Persone/)
  assert.match(err({ persone: 0 }), /Persone/)
  assert.match(err({ persone: 'due' }), /Persone/)
  assert.equal(err({ persone: '2' }), 'OK')   // numero come stringa: accettato
  assert.match(err({ telefono: '12' }), /telefono/)
  assert.match(err({ email: 'nonvalida' }), /Email/)
  assert.equal(validaRichiestaWeb(null, OGGI, CAMERE).ok, false)
  assert.equal(validaRichiestaWeb([], OGGI, CAMERE).ok, false)
})

test('camera: id, nome, slug; sconosciuta o vuota → null', () => {
  assert.equal(mappaCamera('fed43a69-5e19-4cf9-b1b3-64affa46f9b1', CAMERE), CAMERE[0].id)
  assert.equal(mappaCamera('amelia', CAMERE), CAMERE[0].id)
  assert.equal(mappaCamera('singola', CAMERE), CAMERE[0].id)
  assert.equal(mappaCamera('Lena', CAMERE), CAMERE[1].id)
  assert.equal(mappaCamera('Suite', CAMERE), null)
  assert.equal(mappaCamera('', CAMERE), null)
  assert.equal(mappaCamera(undefined, CAMERE), null)
})

test('doppione: stesse date con stesso telefono o stesso nome', () => {
  const nuova = { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', telefonoCifre: '393331234567' }
  assert.equal(stessaRichiesta(nuova, { nome: 'X', cognome: 'Y', arrivo: '2026-09-13', partenza: '2026-09-15', telefono: '+39 333 1234567' }), true)
  assert.equal(stessaRichiesta(nuova, { nome: 'anna', cognome: 'ROSSI', arrivo: '2026-09-13', partenza: '2026-09-15', telefono: null }), true)
  assert.equal(stessaRichiesta(nuova, { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-14', partenza: '2026-09-15', telefono: '+393331234567' }), false)
  assert.equal(stessaRichiesta(nuova, { nome: 'Luca', cognome: 'Bianchi', arrivo: '2026-09-13', partenza: '2026-09-15', telefono: '+393330000000' }), false)
})

test('limite per IP: 10 in 10 minuti, poi la finestra scorre', () => {
  const reg = new Map<string, number[]>()
  const t0 = 1_000_000
  for (let i = 0; i < 10; i++) assert.equal(consentiIp(reg, '1.2.3.4', t0 + i), true)
  assert.equal(consentiIp(reg, '1.2.3.4', t0 + 11), false)
  assert.equal(consentiIp(reg, '5.6.7.8', t0 + 11), true)
  assert.equal(consentiIp(reg, '1.2.3.4', t0 + 10 * 60000 + 1), true)
})
