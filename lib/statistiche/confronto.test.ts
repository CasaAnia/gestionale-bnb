// KPI in Statistiche (07/09/2026): intervallo dell'anno prima e testi del confronto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spostaAnni, intervalloAnnoPrima, indiciAnnoPrima, confrontoKpi } from './confronto.ts'
import { indiciIntervallo } from './intervallo.ts'
import type { PrenotazioneStat } from './tipi.ts'

const CAMERE = [{ id: 'r1', name: 'Amelia', active: true }, { id: 'r2', name: 'Lena', active: true }]
const pren = (id: string, room_id: string, check_in: string, check_out: string, total: number, status = 'confermata'): PrenotazioneStat =>
  ({ id, room_id, check_in, check_out, total_amount: total, status, group_id: null })

test('un anno prima: stesso intervallo, il 29 febbraio scala al 28', () => {
  assert.equal(spostaAnni('2026-09-01', -1), '2025-09-01')
  assert.equal(spostaAnni('2028-02-29', -1), '2027-02-28')
  assert.deepEqual(intervalloAnnoPrima({ da: '2026-09-01', a: '2026-10-01' }), { da: '2025-09-01', a: '2025-10-01' })
  assert.deepEqual(intervalloAnnoPrima({ da: '2026-12-29', a: '2027-01-05' }), { da: '2025-12-29', a: '2026-01-05' })
})

test('anno prima senza prenotazioni valide → null, confronto vuoto', () => {
  const attuale = { da: '2026-09-01', a: '2026-10-01' }
  assert.equal(indiciAnnoPrima(attuale, CAMERE, []), null)
  // una prenotazione in attesa o fuori dall'intervallo non fa «dati»
  assert.equal(indiciAnnoPrima(attuale, CAMERE, [pren('x', 'r1', '2025-09-03', '2025-09-05', 100, 'in_attesa'), pren('y', 'r1', '2025-11-03', '2025-11-05', 100)]), null)
  const oggi = indiciIntervallo(attuale.da, attuale.a, CAMERE, [pren('a', 'r1', '2026-09-03', '2026-09-05', 200)])
  assert.deepEqual(confrontoKpi(oggi, null), { occupazione: null, tariffaMedia: null, nottiLibere: null })
})

test('confronto: punti di occupazione, euro di tariffa media, notti libere dell’anno prima', () => {
  const attuale = { da: '2026-09-01', a: '2026-10-01' }   // 2 camere × 30 giorni = 60 vendibili
  // 2026: 12 notti a 100 €/notte → 20 %, ADR 100, libere 48
  const oggi = indiciIntervallo(attuale.da, attuale.a, CAMERE, [pren('a', 'r1', '2026-09-01', '2026-09-13', 1200)])
  // 2025: 6 notti a 88 €/notte → 10 %, ADR 88, libere 54
  const prima = indiciAnnoPrima(attuale, CAMERE, [pren('b', 'r2', '2025-09-10', '2025-09-16', 528)])
  assert.ok(prima)
  assert.equal(prima.percento, 10)
  assert.deepEqual(confrontoKpi(oggi, prima), { occupazione: '+10 punti', tariffaMedia: '+12 €', nottiLibere: 'era 54' })
  // segno meno tipografico e singolare «punto»
  const meno = indiciIntervallo(attuale.da, attuale.a, CAMERE, [pren('c', 'r1', '2026-09-01', '2026-09-06', 400)]) // 5 notti → 8 %, ADR 80
  assert.deepEqual(confrontoKpi(meno, prima), { occupazione: '−2 punti', tariffaMedia: '−8 €', nottiLibere: 'era 54' })
  const unPunto = { ...prima, percento: 7 }
  assert.equal(confrontoKpi(meno, unPunto).occupazione, '+1 punto')
})

test('confronto identico → «come l’anno prima», mai «+0»', () => {
  const attuale = { da: '2026-09-01', a: '2026-10-01' }
  const oggi = indiciIntervallo(attuale.da, attuale.a, CAMERE, [pren('a', 'r1', '2026-09-01', '2026-09-13', 1200)])
  const prima = indiciAnnoPrima(attuale, CAMERE, [pren('b', 'r1', '2025-09-01', '2025-09-13', 1200)])
  assert.deepEqual(confrontoKpi(oggi, prima), { occupazione: 'come l’anno prima', tariffaMedia: 'come l’anno prima', nottiLibere: 'era 48' })
})
