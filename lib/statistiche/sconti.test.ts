import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scontiPeriodo } from './sconti.ts'

test('sconti nel periodo: pro-quota sulle notti del periodo; senza discount_type sconto zero; in_attesa esclusa', () => {
  const lista = [
    { id: 'a', room_id: 'r1', check_in: '2026-08-30', check_out: '2026-09-02', status: 'confermata', total_amount: 270, price_per_night: 100, extra_bed_total: 0, discount_type: 'percentage', discount_value: 10 },
    { id: 'b', room_id: 'r1', check_in: '2026-09-10', check_out: '2026-09-12', status: 'confermata', total_amount: 150, price_per_night: 80, extra_bed_total: 0, discount_type: null, discount_value: null },
    { id: 'c', room_id: 'r1', check_in: '2026-09-10', check_out: '2026-09-12', status: 'in_attesa', total_amount: 150, price_per_night: 80, extra_bed_total: 0, discount_type: 'percentage', discount_value: 50 },
  ]
  const s = scontiPeriodo(lista, '2026-09-01', '2026-10-01')
  // a: 1 notte su 3 nel periodo → valore 90, sconto 10, pieno 100; b: intero → 150 senza sconto
  assert.deepEqual(s, { pienoCent: 10000 + 15000, scontiCent: 1000, valoreCent: 9000 + 15000 })
  assert.deepEqual(scontiPeriodo(lista, '2027-01-01', '2027-02-01'), { pienoCent: 0, scontiCent: 0, valoreCent: 0 })
})
