import { test } from 'node:test'
import assert from 'node:assert/strict'
import { storicoCliente } from './cliente.ts'
import type { PrenotazioneStat } from './tipi.ts'

const pren = (id: string, total: number, status: string, group_id: string | null = null): PrenotazioneStat => ({ id, room_id: 'r1', check_in: '2026-09-01', check_out: '2026-09-03', total_amount: total, status, group_id })

test('storico cliente: i soggiorni contano per group_id (cambio camera = 1), in_attesa esclusa, annullate a parte', () => {
  const s = storicoCliente([pren('a', 160, 'confermata', 'g1'), pren('b', 180, 'confermata', 'g1'), pren('c', 90, 'completata'), pren('d', 500, 'in_attesa'), pren('e', 70, 'annullata')])
  assert.deepEqual(s, { soggiorni: 2, segmenti: 3, totaleSpesoCent: 43000, annullate: 1 })
  assert.deepEqual(storicoCliente([]), { soggiorni: 0, segmenti: 0, totaleSpesoCent: 0, annullate: 0 })
})
