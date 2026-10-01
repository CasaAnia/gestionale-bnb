import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catenePrenotazione, scrittureOrari, testoBagagli, testoPartenza, sottotitoloFoglio, giornoBreve, periodoCatena } from './bagagliPartenza.ts'

const riga = (id: string, camera: string, check_in: string, check_out: string, extra: Record<string, unknown> = {}) =>
  ({ id, room_id: camera, rooms: { name: camera }, check_in, check_out, status: 'confermata', group_id: 'g', num_guests: 2, ...extra })

test('una camera sola: bagagli e partenza sulla stessa riga', () => {
  const [c] = catenePrenotazione([riga('a', 'Lena', '2026-10-01', '2026-10-04', { bagagli_alle: '11:00:00', check_in_time: '16:00' })])
  assert.equal(c.rigaArrivo.id, 'a'); assert.equal(c.rigaPartenza.id, 'a')
  assert.equal(testoBagagli(c), 'alle 11:00')
  assert.equal(testoPartenza(c), 'dom 4 ott · da chiedere')
  assert.equal(sottotitoloFoglio(c), 'arriva gio 1 ott alle 16:00 · parte dom 4 ott')
  assert.deepEqual(scrittureOrari(c, '11:00', '10:00'), [{ id: 'a', campi: { check_out_time: '10:00' } }])
  assert.deepEqual(scrittureOrari(c, null, null), [{ id: 'a', campi: { bagagli_alle: null } }])
  assert.deepEqual(scrittureOrari(c, '11:00', null), [])
})

test('cambio camera: bagagli sul primo tratto, partenza sull\'ultimo; il tratto annullato non conta', () => {
  const righe = [
    riga('lena', 'Lena', '2026-10-01', '2026-10-03'),
    riga('amelia', 'Amelia', '2026-10-03', '2026-10-06', { check_out_time: '10:30:00' }),
    riga('vecchia', 'Ambra', '2026-10-06', '2026-10-08', { status: 'annullata', check_out_time: '09:00:00' }),
  ]
  const catene = catenePrenotazione(righe)
  assert.equal(catene.length, 1)
  const [c] = catene
  assert.deepEqual(c.camere, ['Lena', 'Amelia'])
  assert.equal(c.partenza, '2026-10-06')
  assert.equal(c.oraPartenza, '10:30')
  assert.deepEqual(scrittureOrari(c, '12:00', '11:00'), [{ id: 'lena', campi: { bagagli_alle: '12:00' } }, { id: 'amelia', campi: { check_out_time: '11:00' } }])
})

test('due camere contemporanee con partenze diverse: ognuna la sua partenza, mai scambiate', () => {
  const righe = [
    riga('lena', 'Lena', '2026-10-01', '2026-10-04', { group_id: 'g1' }),
    riga('amelia', 'Amelia', '2026-10-01', '2026-10-02', { group_id: 'g2' }),
  ]
  const catene = catenePrenotazione(righe)
  assert.equal(catene.length, 2)
  const lena = catene.find(c => c.camere[0] === 'Lena')!, amelia = catene.find(c => c.camere[0] === 'Amelia')!
  assert.equal(lena.partenza, '2026-10-04'); assert.equal(amelia.partenza, '2026-10-02')
  assert.deepEqual(scrittureOrari(amelia, null, '09:00'), [{ id: 'amelia', campi: { check_out_time: '09:00' } }])
  assert.deepEqual(scrittureOrari(lena, null, '10:00'), [{ id: 'lena', campi: { check_out_time: '10:00' } }])
})

test('stesso gruppo con un buco (va via e torna): due arrivi e due partenze', () => {
  const catene = catenePrenotazione([riga('a', 'Lena', '2026-10-01', '2026-10-03'), riga('b', 'Lena', '2026-10-10', '2026-10-12')])
  assert.equal(catene.length, 2)
  assert.deepEqual(catene.map(c => [c.rigaArrivo.id, c.rigaPartenza.id]), [['a', 'a'], ['b', 'b']])
})

test('giorni brevi', () => {
  assert.equal(giornoBreve('2026-10-04'), 'dom 4 ott')
  assert.equal(periodoCatena('2026-10-13', '2026-10-16'), '13 → 16 ott')
  assert.equal(periodoCatena('2026-09-30', '2026-10-02'), '30 set → 2 ott')
})
