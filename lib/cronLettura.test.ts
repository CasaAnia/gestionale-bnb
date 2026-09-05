// Parte 3, pezzo 3 (05/09/2026): le route cron non rispondono mai 200 su
// una lettura fallita.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pretendi, rispostaErroreCron, statoPerEsitoInvio, ErroreLetturaCron } from './cronLettura.ts'

test('lettura con error → ErroreLetturaCron con il motivo; la route risponde 500, non 200', () => {
  let risposta: ReturnType<typeof rispostaErroreCron> = null
  try {
    pretendi({ data: null, error: { message: 'permission denied for table bookings' } }, 'leggere gli arrivi di domani')
    assert.fail('doveva lanciare')
  } catch (e) {
    assert.ok(e instanceof ErroreLetturaCron)
    risposta = rispostaErroreCron(e)
  }
  assert.deepEqual(risposta, { status: 500, body: { ok: false, error: 'Non riesco a leggere gli arrivi di domani: permission denied for table bookings' } })
})

test('data null senza error è comunque una lettura fallita; data valida torna com\'è', () => {
  assert.throws(() => pretendi({ data: null, error: null }, 'leggere le camere'), /nessun dato/)
  assert.deepEqual(pretendi({ data: [{ id: 1 }], error: null }, 'leggere le camere'), [{ id: 1 }])
  assert.deepEqual(pretendi({ data: [], error: null }, 'leggere le camere'), [])
})

test('un\'eccezione diversa non diventa una risposta: la route la rilancia', () => {
  assert.equal(rispostaErroreCron(new Error('altro')), null)
  assert.equal(rispostaErroreCron('stringa'), null)
})

test('esito invio: 500 solo se non è partito niente e ci sono errori', () => {
  assert.equal(statoPerEsitoInvio({ inviate: 0, errori: ['lettura sottoscrizioni: relation does not exist'] }), 500)
  assert.equal(statoPerEsitoInvio({ inviate: 2, errori: ['410: sottoscrizione scaduta ma non cancellata (x)'] }), 200)
  assert.equal(statoPerEsitoInvio({ inviate: 0, errori: [] }), 200)
})
