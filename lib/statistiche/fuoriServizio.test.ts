// R7 — periodi di fuori servizio per camera: intervalli sovrapposti non
// sottraggono due volte la stessa notte, né nelle notti vendibili a
// intervallo né in quelle del mese.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tratteChiuse, nottiChiuse } from './fuoriServizio.ts'
import { nottiVendibili, occupazioneIntervallo } from './intervallo.ts'
import { nottiDisponibili } from './notti.ts'

const CAMERE = [{ id: 'r1', name: 'Amelia', active: true }, { id: 'r2', name: 'Allegra', active: true }]

test('tratte chiuse: unione degli intervalli sovrapposti e contigui, tagliati sul periodo', () => {
  const fs = [
    { room_id: 'r1', da: '2026-09-10', a: '2026-09-15', motivo: 'lavori' },
    { room_id: 'r1', da: '2026-09-12', a: '2026-09-20' },            // sovrapposto
    { room_id: 'r1', da: '2026-09-20', a: '2026-09-22' },            // contiguo
    { room_id: 'r1', da: '2026-09-28', a: '2026-10-05' },            // sconfina nel mese dopo
    { room_id: 'r2', da: '2026-09-01', a: '2026-09-30' },            // altra camera
    { room_id: 'r1', da: '2026-09-25', a: '2026-09-25' },            // vuoto: ignorato
  ]
  assert.deepEqual(tratteChiuse(fs, 'r1', '2026-09-01', '2026-10-01'), [{ da: '2026-09-10', a: '2026-09-22' }, { da: '2026-09-28', a: '2026-10-01' }])
  assert.equal(nottiChiuse(fs, 'r1', '2026-09-01', '2026-10-01'), 12 + 3)      // NON 5 + 8 + 2 + 3
  assert.equal(nottiChiuse(fs, 'r2', '2026-09-01', '2026-10-01'), 29)
  assert.equal(nottiChiuse(fs, 'r9', '2026-09-01', '2026-10-01'), 0)
  assert.equal(nottiChiuse([], 'r1', '2026-09-01', '2026-10-01'), 0)
})

test('notti vendibili a intervallo e del mese con chiusure sovrapposte: stessa notte sottratta una volta', () => {
  const fs = [{ room_id: 'r1', da: '2026-09-10', a: '2026-09-15' }, { room_id: 'r1', da: '2026-09-12', a: '2026-09-20' }]
  const v = nottiVendibili('2026-09-01', '2026-10-01', CAMERE, fs)
  assert.deepEqual(v.perCamera, { r1: 30 - 10, r2: 30 })
  assert.equal(v.totali, 50)
  const m = nottiDisponibili('2026-09', CAMERE, fs)
  assert.deepEqual([m.perCamera.r1, m.chiuse, m.totali], [20, 10, 50])
  // chiusura più lunga del mese: al massimo tutte le notti del mese
  const tutto = nottiVendibili('2026-09-01', '2026-10-01', CAMERE, [{ room_id: 'r1', da: '2026-08-01', a: '2026-11-01' }, { room_id: 'r1', da: '2026-09-05', a: '2026-09-06' }])
  assert.equal(tutto.perCamera.r1, 0)
  const occ = occupazioneIntervallo('2026-09-01', '2026-10-01', CAMERE, [], fs)
  assert.deepEqual([occ.nottiVendibili, occ.nottiLibere, occ.anomalia], [50, 50, false])
})
