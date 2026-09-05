import { test } from 'node:test'
import assert from 'node:assert/strict'
import { valutazioneDi, vuoleRicevuta, migraValutazione, payloadValutazione, colonnaRicevutaPresente, VALUTAZIONI } from './valutazione.ts'

test('valutazione a tre voci e ricevuta separata: non si escludono più', () => {
  assert.deepEqual(VALUTAZIONI.map(v => v.chiave), ['ottimo', 'normale', 'problematico'])
  const ottimoConRicevuta = { rating: 'ottimo', vuole_ricevuta: true }
  assert.equal(valutazioneDi(ottimoConRicevuta), 'ottimo')
  assert.equal(vuoleRicevuta(ottimoConRicevuta), true)
  assert.equal(vuoleRicevuta({ rating: 'ottimo', vuole_ricevuta: false }), false)
  // forma vecchia (prima della 0038): «vuole_ricevuta» come voce della valutazione
  assert.equal(vuoleRicevuta({ rating: 'vuole_ricevuta' }), true)
  assert.equal(valutazioneDi({ rating: 'vuole_ricevuta' }), 'normale')
  assert.equal(vuoleRicevuta(null), false)
  assert.equal(valutazioneDi({ rating: null }), 'normale')
})

test('migrazione 0038: chi aveva «Vuole ricevuta» → ricevuta sì e valutazione normale; gli altri invariati', () => {
  assert.deepEqual(migraValutazione({ rating: 'vuole_ricevuta' }), { rating: 'normale', vuole_ricevuta: true })
  assert.deepEqual(migraValutazione({ rating: 'ottimo' }), { rating: 'ottimo', vuole_ricevuta: false })
  assert.deepEqual(migraValutazione({ rating: 'problematico', vuole_ricevuta: true }), { rating: 'problematico', vuole_ricevuta: true })
  assert.deepEqual(migraValutazione({ rating: null }), { rating: 'normale', vuole_ricevuta: false })
})

test('cosa si scrive: dopo la 0038 le due colonne; prima la forma vecchia, così la scheda funziona come oggi', () => {
  assert.deepEqual(payloadValutazione('ottimo', true, true), { rating: 'ottimo', vuole_ricevuta: true })
  assert.deepEqual(payloadValutazione('ottimo', true, false), { rating: 'vuole_ricevuta' })
  assert.deepEqual(payloadValutazione('problematico', false, false), { rating: 'problematico' })
  assert.equal(colonnaRicevutaPresente({ rating: 'ottimo', vuole_ricevuta: false }), true)
  assert.equal(colonnaRicevutaPresente({ rating: 'ottimo' }), false)
})
