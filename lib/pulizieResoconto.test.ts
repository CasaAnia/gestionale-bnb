import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resocontoPulizie, raggruppaRinvii, confrontoPeriodoPulizie, periodoPulizie, csvPulizie } from './pulizieResoconto.ts'
import { vuoto } from './biancheria.ts'
import type { Decisione } from './pulizie.ts'

const rooms = [{ id: 'r', name: 'Amelia', active: true }]
const b = { id: 'b', guest_id: 'g', room_id: 'r', check_in: '2026-08-15', check_out: '2026-10-01', num_guests: 3, status: 'confermata' }
const e = (id: string, stato: Decisione['stato'], prevista: string, prossima: string | null, effettiva: string | null = null): Decisione => ({ id, room_id: 'r', booking_id: 'b', tipo: 'soggiorno', stato, data_prevista: prevista, prossima_data: prossima, data_effettiva: effettiva, created_at: `${prevista}T12:00:00Z`, persone_servite: 3 })

test('il rinvio di agosto non altera la media di settembre; due rinvii sono una pulizia spostata', () => {
  const events = [e('1', 'rimandata', '2026-08-20', '2026-08-29'), e('2', 'fatta', '2026-08-29', null, '2026-08-29'), e('3', 'rimandata', '2026-09-04', '2026-09-05'), e('4', 'rimandata', '2026-09-05', '2026-09-07'), e('5', 'fatta', '2026-09-07', null, '2026-09-08')]
  const r = resocontoPulizie(rooms, [b], events, [], '2026-09-01', '2026-10-01', '2026-09-30')
  assert.equal(r.rinvioMedio, 3)
  assert.equal(r.spostate.length, 1)
  assert.equal(r.numeroRinvii, 2)
  assert.equal(r.fatte.length, 1)
  assert.equal(r.pezzi, 0)
  assert.equal(raggruppaRinvii(events).length, 2)
})

test('recupero aggiunto a ottobre resta nella pulizia e nel mese di settembre, nove pezzi più due federe', () => {
  const events = [e('1', 'fatta', '2026-09-30', null, '2026-09-30')]
  const rec = { ...vuoto(), cleaning_id: '1', room_id: 'r', booking_id: 'b', data: '2026-09-30', telo_doccia: 3, asciugamano_viso: 3, asciugamano_mani: 3, federe: 2, updated_at: '2026-10-02T10:00:00Z' }
  const r = resocontoPulizie(rooms, [b], events, [rec], '2026-09-01', '2026-10-01', '2026-10-02')
  assert.equal(r.pezzi, 11); assert.equal(r.conRecuperi, 1); assert.equal(r.perCamera[0].pezzi, 11)
  assert.equal(r.perVoce?.find(v => v.chiave === 'telo_doccia')?.n, 3)
  assert.equal(resocontoPulizie(rooms, [b], events, [rec], '2026-10-01', '2026-11-01', '2026-10-02').pezzi, 0)
  const csv = csvPulizie(r, rooms)
  assert.match(csv, /2026-10-02T10:00:00Z/); assert.match(csv, /"2026-09-30"/)
})

test('lettura recuperi mancante = non disponibile; Pulita letta senza recuperi = zero, senza anomalie', () => {
  const events = [e('1', 'fatta', '2026-09-04', null, '2026-09-04')]
  const r = resocontoPulizie(rooms, [b], events, null, '2026-09-01', '2026-10-01', '2026-09-30')
  assert.equal(r.pezzi, null); assert.equal(r.perCamera[0].pezzi, null); assert.equal(r.righe[0].pezzi, null)
  const letto = resocontoPulizie(rooms, [b], events, [], '2026-09-01', '2026-10-01', '2026-09-30')
  assert.equal(letto.pezzi, 0); assert.deepEqual(letto.avvisi, [])
})

test('cadenza solo tra cambi del medesimo soggiorno, anche prolungato; il cambio ospite non fa media', () => {
  const bookings = [{ ...b, check_out: '2026-09-06' }, { ...b, id: 'prolungato', check_in: '2026-09-06', check_out: '2026-09-20' }, { ...b, id: 'altro', guest_id: 'altro', check_in: '2026-09-20' }]
  const events = [e('1', 'fatta', '2026-09-04', null, '2026-09-04'), { ...e('2', 'fatta', '2026-09-08', null, '2026-09-10'), booking_id: 'prolungato' }, { ...e('3', 'fatta', '2026-09-24', null, '2026-09-24'), booking_id: 'altro' }]
  const r = resocontoPulizie(rooms, bookings, events, [], '2026-09-01', '2026-10-01', '2026-09-30')
  assert.equal(r.cadenza, 6); assert.equal(r.intervalli.length, 1)
})

test('mese in corso con stessi giorni, mese completo con mese completo, confine anno e febbraio', () => {
  assert.deepEqual(confrontoPeriodoPulizie('mese', 0, '2026-09-08'), { da: '2026-08-01', a: '2026-09-01', fino: '2026-08-09' })
  assert.deepEqual(confrontoPeriodoPulizie('mese', -1, '2026-09-08'), { da: '2026-07-01', a: '2026-08-01', fino: '2026-08-01' })
  assert.equal(periodoPulizie('mese', -1, '2026-01-08').da, '2025-12-01')
  assert.equal(confrontoPeriodoPulizie('mese', 0, '2026-03-31').fino, '2026-03-01')
})

test('stima del passato distinta dalle conferme e camera disattivata resta nello storico', () => {
  const bookings = [{ ...b, check_in: '2026-08-10', check_out: '2026-08-12' }]
  const r = resocontoPulizie([{ ...rooms[0], active: false }], bookings, [], [], '2026-08-01', '2026-09-01', '2026-09-08')
  assert.equal(r.fatte.length, 0); assert.equal(r.stime.length, 1); assert.equal(r.perCamera.length, 1)
})

test('rinvii dello stesso soggiorno prolungato restano una pulizia anche passando al segmento successivo', () => {
  const bookings = [{ ...b, check_out: '2026-09-06' }, { ...b, id: 'prolungato', check_in: '2026-09-06' }]
  const events = [e('1', 'rimandata', '2026-09-04', '2026-09-07'), { ...e('2', 'rimandata', '2026-09-07', '2026-09-08'), booking_id: 'prolungato' }]
  const r = resocontoPulizie(rooms, bookings, events, [], '2026-09-01', '2026-10-01', '2026-09-30')
  assert.equal(r.spostate.length, 1); assert.equal(r.numeroRinvii, 2); assert.equal(r.rinvioMedio, 4)
})
