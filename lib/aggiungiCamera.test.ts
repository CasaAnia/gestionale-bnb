// «Aggiungi camera» (17/09/2026): il legame fra le camere e il suo controllo
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { legameDaScrivere, hrefAggiungiCamera, legameConfermato } from './aggiungiCamera.ts'

test('il legame va su TUTTE le righe che non ce l’hanno, annullate comprese (l’incasso del tratto annullato resta nel conto)', () => {
  const nuovo = () => 'nuovo-id'
  const righe = [{ id: 'a', status: 'confermata', prenotazione_id: null }, { id: 'z', status: 'annullata', prenotazione_id: null }]
  assert.deepEqual(legameDaScrivere(righe, nuovo), { prenotazioneId: 'nuovo-id', ids: ['a', 'z'] })
  const misto = [{ id: 'a', status: 'confermata', prenotazione_id: 'P' }, { id: 'z', status: 'annullata', prenotazione_id: null }]
  assert.deepEqual(legameDaScrivere(misto, nuovo), { prenotazioneId: 'P', ids: ['z'] })
  assert.deepEqual(legameDaScrivere([{ id: 'a', status: 'confermata', prenotazione_id: 'P' }], nuovo), { prenotazioneId: 'P', ids: [] })
  assert.equal(legameDaScrivere([{ id: 'z', status: 'annullata', prenotazione_id: null }], nuovo), null)
})

test('l’indirizzo dell’inserimento porta cliente, legame e date', () => {
  assert.equal(hrefAggiungiCamera({ guestId: 'g1', prenotazioneId: 'P', arrivo: '2026-11-03', partenza: '2026-11-07' }), '/nuova-prenotazione?guest_id=g1&prenotazione=P&check_in=2026-11-03&check_out=2026-11-07')
  assert.equal(hrefAggiungiCamera({ guestId: null, prenotazioneId: 'P', arrivo: '', partenza: '' }), '/nuova-prenotazione?prenotazione=P')
})

test('il legame si conferma solo se esiste, ha camere attive ed è tutto della stessa cliente', () => {
  assert.equal(legameConfermato([{ guest_id: 'g1', status: 'confermata' }, { guest_id: 'g1', status: 'annullata' }], 'g1'), true)
  assert.equal(legameConfermato([{ guest_id: 'g1', status: 'confermata' }, { guest_id: 'g2', status: 'confermata' }], 'g1'), false)
  assert.equal(legameConfermato([{ guest_id: 'g1', status: 'annullata' }], 'g1'), false)
  assert.equal(legameConfermato([], 'g1'), false)
  assert.equal(legameConfermato(null, 'g1'), false)
})
