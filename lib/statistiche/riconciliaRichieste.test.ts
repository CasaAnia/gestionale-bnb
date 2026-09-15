// Richieste e prenotazioni dicono la stessa cosa? (rilievo 1 del 15/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { incoerenzeRichieste, possibiliConversioniNonRegistrate } from './riconciliaRichieste.ts'

const ric = (x: Partial<Parameters<typeof incoerenzeRichieste>[0][number]> = {}) => ({
  id: 'r1', created_at: '2026-09-07T14:07:00+02:00', stato: 'confermata',
  nome: 'Silvana', cognome: 'Laurino', telefono: '+393496459199', arrivo: '2026-10-12', ...x,
})

test('una confermata senza prenotazione collegata si vede', () => {
  const fuori = incoerenzeRichieste([ric({ prenotazione_id: null })], [{ id: 'b1', status: 'confermata' }])
  assert.equal(fuori.length, 1)
  assert.equal(fuori[0].tipo, 'confermata_senza_prenotazione')
  assert.equal(fuori[0].chi, 'Silvana Laurino')
})

test('una confermata la cui prenotazione è stata annullata si vede', () => {
  const fuori = incoerenzeRichieste([ric({ prenotazione_id: 'b1' })], [{ id: 'b1', status: 'annullata' }])
  assert.equal(fuori.length, 1)
  assert.equal(fuori[0].tipo, 'confermata_con_prenotazione_annullata')
  assert.equal(fuori[0].prenotazione, 'b1')
})

test('una confermata con la sua prenotazione viva non è un problema', () => {
  assert.deepEqual(incoerenzeRichieste([ric({ prenotazione_id: 'b1' })], [{ id: 'b1', status: 'confermata' }]), [])
})

test('una rifiutata che però ha una prenotazione viva si vede', () => {
  const fuori = incoerenzeRichieste(
    [ric({ stato: 'rifiutata', prenotazione_id: 'b1' })], [{ id: 'b1', status: 'confermata' }])
  assert.equal(fuori.length, 1)
  assert.equal(fuori[0].tipo, 'chiusa_con_prenotazione')
})

test('il caso vero: rifiutata, senza collegamento, ma la prenotazione c’è', () => {
  // Cadida Cioffo, 15/09/2026: richiesta del 3 set per il 17→21, chiusa come
  // «rifiutata» il 4 set alle 17:40; la prenotazione è nata il 4 set alle 17:24
  const richiesta = ric({
    id: 'cioffo', stato: 'rifiutata', prenotazione_id: null,
    nome: 'Cadida', cognome: 'Cioffo', telefono: '+393490767094', arrivo: '2026-09-17',
  })
  const prenotazioni = [{ id: '53704e33', status: 'confermata', check_in: '2026-09-17', telefono: '393490767094' }]
  // il collegamento non c'è, quindi il primo controllo non la trova
  assert.deepEqual(incoerenzeRichieste([richiesta], prenotazioni), [])
  // ma il sospetto si vede: stesso numero, stesso giorno d'arrivo
  const sospette = possibiliConversioniNonRegistrate([richiesta], prenotazioni)
  assert.equal(sospette.length, 1)
  assert.equal(sospette[0].chi, 'Cadida Cioffo')
  assert.equal(sospette[0].prenotazione, '53704e33')
})

test('il sospetto non scatta su una prenotazione annullata né su date diverse', () => {
  const richiesta = ric({ stato: 'rifiutata', prenotazione_id: null, arrivo: '2026-09-17', telefono: '393490767094' })
  assert.deepEqual(possibiliConversioniNonRegistrate([richiesta],
    [{ id: 'b1', status: 'annullata', check_in: '2026-09-17', telefono: '393490767094' }]), [])
  assert.deepEqual(possibiliConversioniNonRegistrate([richiesta],
    [{ id: 'b1', status: 'confermata', check_in: '2026-09-20', telefono: '393490767094' }]), [])
})

test('il sospetto non si trasforma mai in un aggiornamento', () => {
  // le due funzioni tornano elenchi: non c'è nessuna scrittura qui dentro
  const fonte = new URL('./riconciliaRichieste.ts', import.meta.url)
  const testo = readFileSync(fonte, 'utf8')
  assert.equal(/supabase|update\(|insert\(/.test(testo), false, 'questo file non deve scrivere niente')
})
