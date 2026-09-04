import { test } from 'node:test'
import assert from 'node:assert/strict'
import { incassiMese, speseMeseCent, saldoCassa } from './cassa.ts'

const b = (id: string, check_in: string, check_out: string, total: number, extra: Partial<{ pagato: boolean; bonifico: boolean; status: string; group_id: string; guest_name: string }> = {}) =>
  ({ id, room_id: 'ambra', check_in, check_out, total_amount: total, status: 'confermata', ...extra })
const OGGI = '2026-09-15'

test('incassi per cassa: righe di payments nel loro giorno; senza righe il saldo presunto alla consegna delle chiavi; in attesa mai', () => {
  const pren = [
    b('a', '2026-09-03', '2026-09-06', 240, { guest_name: 'Rossi' }),          // 2 acconti: 100 in agosto, 140 in settembre
    b('b', '2026-09-10', '2026-09-12', 160, { pagato: true }),                  // pagata senza righe → presunta al 10/9
    b('c', '2026-09-20', '2026-09-22', 160),                                    // arrivo futuro senza righe → niente
    b('d', '2026-09-12', '2026-09-14', 100, { bonifico: true }),               // bonifico in attesa senza righe → niente
    b('e', '2026-09-01', '2026-09-02', 70, { status: 'in_attesa', pagato: true }),   // MAI
    b('f1', '2026-09-05', '2026-09-06', 80, { group_id: 'g' }), b('f2', '2026-09-06', '2026-09-08', 160, { group_id: 'g' }),   // cambio camera: un soggiorno da 240, pagato 240 il 5/9
  ]
  const pag = [
    { booking_id: 'a', amount: 100, paid_on: '2026-08-20' }, { booking_id: 'a', amount: 140, paid_on: '2026-09-03' },
    { booking_id: 'f1', amount: 240, paid_on: '2026-09-05' },
  ]
  const i = incassiMese('2026-09', pren, pag, OGGI)
  assert.equal(i.registratiCent, 14000 + 24000)
  assert.equal(i.presuntiCent, 16000)
  assert.equal(i.totaleCent, 54000)
  // a e g sono saldati dalle righe ma nessuno ha spuntato «pagato»: segnalati, non corretti
  assert.deepEqual(i.incoerenze.map(x => [x.tipo, x.soggiorno]), [['saldato_ma_non_segnato', 'a'], ['pagato_senza_righe', 'b'], ['saldato_ma_non_segnato', 'g']])
  assert.equal(incassiMese('2026-08', pren, pag, OGGI).registratiCent, 10000)
  // mese senza dati
  assert.deepEqual(incassiMese('2027-01', pren, pag, OGGI), { mese: '2027-01', registratiCent: 0, presuntiCent: 0, totaleCent: 0, incoerenze: incassiMese('2027-01', pren, pag, OGGI).incoerenze })
})

test('incoerenze fra bookings.pagato e le righe reali: segnalate, mai corrette', () => {
  const pren = [b('x', '2026-09-01', '2026-09-03', 200, { pagato: true }), b('y', '2026-09-01', '2026-09-03', 200), b('z', '2026-09-01', '2026-09-03', 200, { pagato: false })]
  const pag = [{ booking_id: 'x', amount: 50, paid_on: '2026-09-01' }, { booking_id: 'y', amount: 250, paid_on: '2026-09-01' }, { booking_id: 'fantasma', amount: 10, paid_on: '2026-09-01' }]
  const i = incassiMese('2026-09', pren, pag, OGGI)
  assert.deepEqual(i.incoerenze.map(x => x.tipo), ['pagato_ma_incompleto', 'pagamenti_oltre_il_totale', 'pagamento_senza_prenotazione'])
  assert.equal(i.registratiCent, 30000)   // le righe contano comunque per cassa
  assert.equal(i.presuntiCent, 20000)     // z: arrivo passato, non bonifico, senza righe
})

test('spese del mese e saldo di cassa', () => {
  const spese = [{ expense_date: '2026-09-02', amount: 35.5 }, { expense_date: '2026-09-30', amount: 100 }, { expense_date: '2026-10-01', amount: 999 }]
  assert.equal(speseMeseCent('2026-09', spese), 13550)
  assert.equal(speseMeseCent('2026-11', spese), 0)
  const pren = [b('a', '2026-09-03', '2026-09-06', 240)]
  const s = saldoCassa('2026-09', pren, [{ booking_id: 'a', amount: 240, paid_on: '2026-09-03' }], spese, OGGI)
  assert.equal(s.incassiCent, 24000); assert.equal(s.speseCent, 13550); assert.equal(s.saldoCent, 10450)
  const vuoto = saldoCassa('2027-02', pren, [], spese, OGGI)
  assert.equal(vuoto.saldoCent, 0); assert.equal(vuoto.incassiCent, 0)
})
