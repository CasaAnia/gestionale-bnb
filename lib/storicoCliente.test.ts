import { test } from 'node:test'
import assert from 'node:assert/strict'
import { righeStorico, testoCamere } from './storicoCliente.ts'

const s = (id: string, camera: string, check_in: string, check_out: string, extra: Record<string, unknown> = {}) =>
  ({ id, rooms: { name: `Camera ${camera}` }, check_in, check_out, status: 'confermata', total_amount: 100, ...extra })

test('storico: una riga per soggiorno, cambio camera = riga sola con le camere in ordine, dal più recente, apre il primo segmento', () => {
  const righe = righeStorico([
    s('b2', 'Lena', '2026-08-03', '2026-08-06', { group_id: 'g', total_amount: 300 }),
    s('b1', 'Ambra', '2026-08-01', '2026-08-03', { group_id: 'g', total_amount: 200 }),
    s('a', 'Amelia', '2026-09-01', '2026-09-03', { extra_bed: true }),
    s('x', 'Allegra', '2026-07-01', '2026-07-02', { status: 'annullata', cancelled_reason: 'Prova' }),
  ])
  assert.deepEqual(righe.map(r => [r.chiave, r.prenotazioneId, testoCamere(r), r.check_in, r.check_out, r.totaleCent, r.status, r.extra_bed]), [
    ['a', 'a', 'Amelia', '2026-09-01', '2026-09-03', 10000, 'confermata', true],
    ['g', 'b1', 'Ambra → Lena', '2026-08-01', '2026-08-06', 50000, 'confermata', false],
    ['x', 'x', 'Allegra', '2026-07-01', '2026-07-02', 10000, 'annullata', false],
  ])
  assert.equal(righe[2].cancelled_reason, 'Prova')
  assert.equal(righe[1].segmenti.length, 2)
})

test('storico: un soggiorno con un segmento annullato e uno valido resta valido (le camere e il totale solo dai validi)', () => {
  const [r] = righeStorico([
    s('v', 'Ambra', '2026-08-01', '2026-08-03', { group_id: 'g', total_amount: 200 }),
    s('ann', 'Lena', '2026-08-03', '2026-08-05', { group_id: 'g', status: 'annullata', total_amount: 999 }),
  ])
  assert.deepEqual([r.status, testoCamere(r), r.totaleCent, r.prenotazioneId], ['confermata', 'Ambra', 20000, 'v'])
})
