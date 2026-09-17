// «Togli camera» (17/09/2026): la logica pura
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { siPuoTogliere, domandaTogliCamera, campiTogliCamera, schedaDopo, MOTIVO_TOGLI_CAMERA } from './togliCamera.ts'

test('si toglie una camera solo se ne resta almeno un’altra; con una sola si annulla la prenotazione', () => {
  assert.equal(siPuoTogliere(2), true)
  assert.equal(siPuoTogliere(1), false)
  assert.equal(siPuoTogliere(0), false)
})

test('la domanda e i campi: annullata come «Annulla la prenotazione», col suo motivo', () => {
  assert.equal(domandaTogliCamera('Allegra · 29 → 30 nov'), 'Togliere Allegra · 29 → 30 nov?')
  assert.deepEqual(campiTogliCamera('2026-09-17T10:00:00.000Z'), { status: 'annullata', cancelled_at: '2026-09-17T10:00:00.000Z', cancelled_reason: MOTIVO_TOGLI_CAMERA })
})

test('se la riga aperta era fra quelle tolte, la scheda passa alla prima delle altre linee', () => {
  const altre = [{ id: 'b', check_in: '2026-11-05' }, { id: 'a', check_in: '2026-11-03' }]
  assert.equal(schedaDopo('x', ['x', 'y'], altre), 'a')
  assert.equal(schedaDopo('a', ['x'], altre), null)
  assert.equal(schedaDopo('x', ['x'], []), null)
})
