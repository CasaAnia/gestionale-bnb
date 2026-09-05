import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saldoMancanteCent, movimentoSaldo, incongruenzePagamenti } from './pagato.ts'
import type { PrenotazioneStat } from './tipi.ts'

const pren = (id: string, total: number, extra: Partial<PrenotazioneStat> = {}): PrenotazioneStat => ({ id, room_id: 'r1', check_in: '2026-09-01', check_out: '2026-09-03', total_amount: total, status: 'confermata', ...extra })

test('saldo mancante: totale del soggiorno (tutti i segmenti) meno i movimenti; acconto + saldo', () => {
  const seg = [pren('a', 160, { group_id: 'g' }), pren('b', 180, { group_id: 'g' })]
  assert.equal(saldoMancanteCent(seg, []), 34000)
  assert.equal(saldoMancanteCent(seg, [{ booking_id: 'a', amount: 100, paid_on: '2026-08-20' }]), 24000)
  assert.equal(saldoMancanteCent(seg, [{ booking_id: 'a', amount: 100, paid_on: '2026-08-20' }, { booking_id: 'b', amount: 240, paid_on: '2026-09-01' }]), 0)
  assert.equal(saldoMancanteCent(seg, [{ booking_id: 'a', amount: 400, paid_on: '2026-08-20' }]), 0)   // oltre il totale: niente negativo
})

test('movimento del saldo: importo mancante, data di oggi, metodo scelto; null se già coperto', () => {
  const seg = [pren('a', 160)]
  assert.deepEqual(movimentoSaldo(seg, [{ booking_id: 'a', amount: 60, paid_on: '2026-08-20' }], '2026-09-05', 'bonifico', 'a'), { booking_id: 'a', amount: 100, method: 'bonifico', paid_on: '2026-09-05' })
  assert.equal(movimentoSaldo(seg, [{ booking_id: 'a', amount: 160, paid_on: '2026-08-20' }], '2026-09-05', 'contanti', 'a'), null)
})

test('incongruenze: pagato senza movimenti, movimenti sopra il totale, saldato ma non segnato; in_attesa ignorate', () => {
  const lista = [pren('a', 160, { pagato: true }), pren('b', 100), pren('c', 200), pren('d', 500, { status: 'in_attesa', pagato: true })]
  const pag = [{ booking_id: 'b', amount: 150, paid_on: '2026-09-01' }, { booking_id: 'c', amount: 200, paid_on: '2026-09-01' }]
  const tipi = incongruenzePagamenti(lista, pag).map(i => [i.tipo, i.soggiorno])
  assert.deepEqual(tipi.sort(), [['pagamenti_oltre_il_totale', 'b'], ['pagato_senza_righe', 'a'], ['saldato_ma_non_segnato', 'c']])
  assert.deepEqual(incongruenzePagamenti([pren('x', 100, { pagato: true })], [{ booking_id: 'x', amount: 100, paid_on: '2026-09-01' }]), [])
})
