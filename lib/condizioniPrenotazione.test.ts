import { test } from 'node:test'
import assert from 'node:assert/strict'
import { caparraDefault, esitoCancellazione, preavvisoSufficiente, GIORNI_PREAVVISO_CANCELLAZIONE, CAPARRA_PERCENTO_DEFAULT } from './condizioniPrenotazione.ts'

const ARRIVO = new Date('2026-09-20T15:00:00+02:00')   // orario previsto di arrivo
const giorniPrima = (g: number, ms = 0) => new Date(ARRIVO.getTime() - g * 86400000 + ms)

test('costanti: 7 giorni di preavviso, caparra 50%', () => {
  assert.equal(GIORNI_PREAVVISO_CANCELLAZIONE, 7)
  assert.equal(CAPARRA_PERCENTO_DEFAULT, 50)
  assert.equal(caparraDefault(14000), 7000)
  assert.equal(caparraDefault(14500), 7250)
  assert.equal(caparraDefault(14501), 7251)   // 72,505 → 72,51 al centesimo
})

test('confine dei 7 giorni: 7 giorni esatti bastano, un minuto in meno no', () => {
  assert.equal(preavvisoSufficiente(ARRIVO, giorniPrima(7)), true)
  assert.equal(preavvisoSufficiente(ARRIVO, giorniPrima(8)), true)
  assert.equal(preavvisoSufficiente(ARRIVO, giorniPrima(7, 60000)), false)
  assert.equal(preavvisoSufficiente(ARRIVO, giorniPrima(6)), false)
  assert.equal(preavvisoSufficiente(ARRIVO, giorniPrima(0)), false)
  assert.equal(preavvisoSufficiente(ARRIVO, giorniPrima(-1)), false)   // mancato arrivo
})

test('esito della cancellazione per condizione', () => {
  assert.equal(esitoCancellazione('caparra', ARRIVO, giorniPrima(7)), 'restituzione_integrale')
  assert.equal(esitoCancellazione('caparra', ARRIVO, giorniPrima(7, 1)), 'caparra_trattenuta')
  assert.equal(esitoCancellazione('caparra', ARRIVO, giorniPrima(-1)), 'caparra_trattenuta')
  assert.equal(esitoCancellazione('completo', ARRIVO, giorniPrima(10)), 'restituzione_integrale')
  assert.equal(esitoCancellazione('completo', ARRIVO, giorniPrima(2)), 'nessuna_promessa')
  assert.equal(esitoCancellazione('arrivo', ARRIVO, giorniPrima(1)), 'nulla_da_restituire')
  assert.equal(esitoCancellazione('personalizzata', ARRIVO, giorniPrima(30)), 'nessuna_promessa')
})
