import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  richiesteAperte, sovrapposizioni, gruppiSovrapposti, unioneIntervalli, giorniDelMese, spostaMese, condividonoGiorni, spostaGiorni, giorniDaInizio, inizioQuindicina, etichettaPeriodo, richiesteNelPeriodo } from './richiesteCalendario.ts'

const ric = (id: string, arrivo: string, partenza: string, camera_id: string | null = 'amelia', stato = 'in_attesa') =>
  ({ id, arrivo, partenza, camera_id, stato: stato as 'in_attesa' })
const pren = (id: string, room_id: string, check_in: string, check_out: string, status = 'confermata') =>
  ({ id, room_id, check_in, check_out, status })

test('mesi e giorni', () => {
  assert.equal(giorniDelMese('2026-09').length, 30)
  assert.equal(giorniDelMese('2026-02')[27], '2026-02-28')
  assert.equal(spostaMese('2026-12', 1), '2027-01')
  assert.equal(spostaMese('2026-01', -1), '2025-12')
  assert.equal(condividonoGiorni({ arrivo: '2026-09-10', partenza: '2026-09-12' }, { arrivo: '2026-09-12', partenza: '2026-09-14' }), false)
})

test('richiesteAperte: solo aperte che toccano il mese', () => {
  const lista = [
    ric('a', '2026-09-29', '2026-10-02'),
    ric('b', '2026-10-10', '2026-10-12'),
    ric('c', '2026-10-05', '2026-10-06', null, 'rifiutata'),
    ric('d', '2026-11-01', '2026-11-03'),
    ric('e', '2026-10-20', '2026-10-22', null, 'proposta_inviata'),
  ]
  assert.deepEqual(richiesteAperte(lista, '2026-10').map(r => r.id), ['a', 'b', 'e'])
})

test('sovrapposizioni: nessun conflitto', () => {
  const r = ric('r', '2026-09-10', '2026-09-12')
  const s = sovrapposizioni(r, [pren('p', 'amelia', '2026-09-12', '2026-09-14')], [ric('x', '2026-09-12', '2026-09-13')])
  assert.deepEqual(s, { prenotazioni: [], richieste: [] })
})

test('sovrapposizioni: conflitto di un giorno, distinto per tipo', () => {
  const r = ric('r', '2026-09-10', '2026-09-12')
  const s = sovrapposizioni(r,
    [pren('p1', 'amelia', '2026-09-11', '2026-09-14'), pren('p2', 'lena', '2026-09-11', '2026-09-14'), pren('p3', 'amelia', '2026-09-11', '2026-09-14', 'annullata')],
    [ric('x', '2026-09-11', '2026-09-13'), ric('y', '2026-09-11', '2026-09-13', 'lena'), ric('z', '2026-09-11', '2026-09-13', 'amelia', 'rifiutata'), r])
  assert.deepEqual(s.prenotazioni.map(p => p.id), ['p1'])
  assert.deepEqual(s.richieste.map(x => x.id), ['x'])
})

test('sovrapposizioni: «qualsiasi camera» conflitta con le confermate solo a casa piena', () => {
  const r = ric('r', '2026-09-10', '2026-09-12', null)
  const camere = [{ id: 'amelia' }, { id: 'lena' }]
  const confermate = [pren('p1', 'amelia', '2026-09-09', '2026-09-13'), pren('p2', 'lena', '2026-09-11', '2026-09-12')]
  assert.deepEqual(sovrapposizioni(r, confermate, [], camere).prenotazioni.map(p => p.id), ['p1', 'p2'])
  assert.deepEqual(sovrapposizioni(r, [confermate[0]], [], camere).prenotazioni, [])
  assert.deepEqual(sovrapposizioni(r, confermate, []).prenotazioni, [])
  assert.deepEqual(sovrapposizioni(r, [], [ric('q', '2026-09-11', '2026-09-15', null)]).richieste.map(x => x.id), ['q'])
})

test('gruppiSovrapposti: catena A-B-C in un gruppo solo, D separata', () => {
  const a = ric('a', '2026-09-01', '2026-09-04')
  const b = ric('b', '2026-09-03', '2026-09-08')
  const c = ric('c', '2026-09-07', '2026-09-10')
  const d = ric('d', '2026-09-10', '2026-09-12')
  assert.equal(condividonoGiorni(a, c), false)
  const gruppi = gruppiSovrapposti([d, c, a, b])
  assert.deepEqual(gruppi.map(g => g.map(r => r.id)), [['a', 'b', 'c'], ['d']])
  assert.deepEqual(unioneIntervalli(gruppi[0]), { arrivo: '2026-09-01', partenza: '2026-09-10' })
  assert.deepEqual(gruppiSovrapposti([]), [])
})

// ── blocco 2 (04/09/2026): vista a 2 settimane ──────────────────────────────
test('quindicina: 14 giorni dall\'inizio, oggi sempre dentro (3 giorni prima), etichette del periodo, richieste nella finestra', () => {
  assert.equal(spostaGiorni('2026-09-30', 2), '2026-10-02')
  assert.equal(spostaGiorni('2026-01-01', -1), '2025-12-31')
  const g = giorniDaInizio('2026-09-01')
  assert.equal(g.length, 14); assert.equal(g[0], '2026-09-01'); assert.equal(g[13], '2026-09-14')
  assert.equal(inizioQuindicina('2026-09-04'), '2026-09-01')
  assert.ok(giorniDaInizio(inizioQuindicina('2026-09-04')).includes('2026-09-04'))
  assert.equal(etichettaPeriodo(giorniDaInizio('2026-09-04')), '4 – 17 set 2026')
  assert.equal(etichettaPeriodo(giorniDaInizio('2026-09-28')), '28 set – 11 ott 2026')
  assert.equal(etichettaPeriodo(giorniDaInizio('2026-12-28')), '28 dic 2026 – 10 gen 2027')
  assert.equal(etichettaPeriodo([]), '')
  const r = (id: string, arrivo: string, partenza: string, stato = 'in_attesa') => ({ id, arrivo, partenza, stato: stato as 'in_attesa' })
  const dentro = richiesteNelPeriodo([r('a', '2026-09-13', '2026-09-15'), r('b', '2026-09-15', '2026-09-16'), r('c', '2026-08-30', '2026-09-01'), r('d', '2026-09-10', '2026-09-12', 'rifiutata')], giorniDaInizio('2026-09-01'))
  assert.deepEqual(dentro.map(x => x.id), ['a'])
})
