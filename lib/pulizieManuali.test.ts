import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confrontaDecisioni, cicloCambio, pulizieAperte, pulizieAutomatiche, conteggioGiorno, type Decisione } from './pulizie.ts'
import { pulizieDiOggi } from './pulizieOggi.ts'

const room = { id: 'camera', name: 'Camera Prova' }
const soggiorno = { id: 'lungo', guest_id: 'ospite', room_id: room.id, num_guests: 3, status: 'confermata', check_in: '2026-09-06', check_out: '2026-10-03' }
const decisione = (id: string, stato: Decisione['stato'], prevista: string, extra: Partial<Decisione>): Decisione => ({ id, room_id: room.id, booking_id: soggiorno.id, tipo: 'soggiorno', stato, data_prevista: prevista, created_at: `2026-09-${id}T10:00:00Z`, ...extra })

test('richiesta 8 settembre: rimandi di uno, due e tre giorni, poi fatta davvero → quattro notti dalla data effettiva', () => {
  for (const ritardo of [1, 2, 3]) {
    const data = `2026-09-${10 + ritardo}`
    const rimando = decisione('10', 'rimandata', '2026-09-10', { prossima_data: data })
    assert.equal(cicloCambio([soggiorno], soggiorno, [rimando]).due, data)
    const fatta = decisione(String(10 + ritardo), 'fatta', data, { data_effettiva: data })
    assert.equal(cicloCambio([soggiorno], soggiorno, [rimando, fatta]).due, `2026-09-${14 + ritardo}`)
  }
})

test('due rinvii e pulizia fatta ancora un giorno dopo: conta il fatto, anche a cavallo del mese', () => {
  const eventi = [decisione('10', 'rimandata', '2026-09-10', { prossima_data: '2026-09-11' }), decisione('11', 'rimandata', '2026-09-11', { prossima_data: '2026-09-13' }), decisione('14', 'fatta', '2026-09-13', { data_effettiva: '2026-09-14' })]
  assert.equal(cicloCambio([soggiorno], soggiorno, eventi).due, '2026-09-18')
  assert.equal(cicloCambio([soggiorno], soggiorno, [decisione('29', 'fatta', '2026-09-28', { data_effettiva: '2026-09-29' })]).due, null)
  const prolungato = { ...soggiorno, check_out: '2026-10-10' }
  assert.equal(cicloCambio([prolungato], prolungato, [decisione('29', 'fatta', '2026-09-28', { data_effettiva: '2026-09-29' })]).due, '2026-10-03')
})

test('arrivo oggi o domani: dopo il nuovo confine si conferma sempre a mano', () => {
  const parte = { ...soggiorno, check_out: '2026-09-08' }
  for (const arrivo of ['2026-09-08', '2026-09-09']) {
    const bookings = [parte, { ...soggiorno, id: 'nuovo', guest_id: 'altro', check_in: arrivo }]
    assert.equal(pulizieAutomatiche(bookings, [], '2026-09-08').length, 0)
    assert.equal(pulizieDiOggi([room], bookings, [], '2026-09-08')[0].stato, 'da_fare')
    assert.equal(conteggioGiorno([room], bookings, [], '2026-09-08', '2026-09-08').daFare, 1)
  }
})

test('due partenze successive non fanno sparire la prima conferma mancante', () => {
  const bookings = [{ ...soggiorno, check_out: '2026-09-08' }, { ...soggiorno, id: 'nuovo', guest_id: 'altro', check_in: '2026-09-08', check_out: '2026-09-10' }]
  assert.equal(pulizieAperte(bookings, room.id, '2026-09-10', []).length, 2)
  assert.equal(conteggioGiorno([room], bookings, [], '2026-09-10', '2026-09-10').daFare, 1)
})

test('secondo esatto e frazioni di microsecondo: ultima conferma dopo il rinvio, anche con ID in ordine inverso', () => {
  const rinvio = { ...decisione('zz', 'rimandata', '2026-09-10', { prossima_data: '2026-09-12' }), created_at: '2026-09-12T10:00:00+00:00' }
  const fatta = { ...decisione('aa', 'fatta', '2026-09-12', { data_effettiva: '2026-09-12' }), created_at: '2026-09-12T10:00:00.000001+00:00' }
  assert.ok(confrontaDecisioni(rinvio, fatta) < 0)
  assert.equal(cicloCambio([soggiorno], soggiorno, [fatta, rinvio]).due, '2026-09-16')
  assert.equal(pulizieDiOggi([room], [soggiorno], [fatta, rinvio], '2026-09-12')[0].ultimaId, 'aa')
})
