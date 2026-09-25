import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stimeStoriche } from './pulizieStimeStoriche.ts'
import { resocontoPulizie } from './pulizieResoconto.ts'
import { cicloCambio, type Decisione } from './pulizie.ts'
import { osservaAggiornamentiPulizie } from './aggiornamentiPulizie.ts'
const rooms = [{ id: 'r', name: 'Camera' }]
const b = { id: 'b', room_id: 'r', guest_id: 'g', status: 'confermata', check_in: '2026-08-01', check_out: '2026-08-22' }

test('spostare la prossima scadenza non riscrive le stime dei cambi già passati', () => {
  const attesi = ['2026-08-05', '2026-08-09', '2026-08-13', '2026-08-17', '2026-08-21']
  for (const linen_next_date of [null, '2026-08-10', '2026-08-14']) {
    assert.deepEqual(stimeStoriche(rooms, [{ ...b, linen_next_date }], '2026-09-25').cambi.map(e => e.date), attesi)
  }
})
test('4, 8 e 9 notti: nessun cambio aggiuntivo il giorno della partenza', () => {
  for (const [check_out, cambi] of [['2026-08-05', 0], ['2026-08-09', 1], ['2026-08-10', 2]] as const) {
    const r = stimeStoriche(rooms, [{ ...b, check_out }], '2026-09-25')
    assert.equal(r.cambi.length, cambi); assert.equal(r.pulizie.length, 1)
  }
})
test('richieste e annullamenti non generano pulizie storiche', () => {
  for (const status of ['in_attesa', 'annullata']) assert.deepEqual(stimeStoriche(rooms, [{ ...b, status }], '2026-09-25'), { pulizie: [], cambi: [] })
})
test('prolungamento: quattro notti dal primo arrivo, una sola pulizia finale', () => {
  const r = stimeStoriche(rooms, [{ ...b, check_out: '2026-08-04' }, { ...b, id: 'b2', check_in: '2026-08-04', check_out: '2026-08-10' }], '2026-09-25')
  assert.deepEqual(r.cambi.map(e => e.date), ['2026-08-05', '2026-08-09']); assert.equal(r.pulizie.length, 1)
})
test('cambio rinviato e confermato: nessun secondo calendario teorico nello stesso soggiorno storico', () => {
  const e: Decisione = { id: 'e', room_id: 'r', booking_id: 'b', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-08-05', data_effettiva: '2026-08-06' }
  const r = resocontoPulizie(rooms, [b], [e], [], '2026-08-01', '2026-09-01', '2026-09-25')
  assert.equal(r.fatte.length, 1); assert.equal(r.stime.filter(e => e.tipo === 'soggiorno').length, 0)
  assert.equal(cicloCambio([b], b, [e]).due, '2026-08-10')
})
test('pulizia finale registrata in ritardo non si somma anche alla stima della partenza', () => {
  const e: Decisione = { id: 'e', room_id: 'r', booking_id: 'b', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: b.check_out, data_effettiva: '2026-08-23' }
  const r = resocontoPulizie(rooms, [b], [e], [], '2026-08-01', '2026-09-01', '2026-09-25')
  assert.equal(r.fatte.length, 1); assert.equal(r.stime.filter(e => e.tipo === 'fine_soggiorno').length, 0)
})
test('salvataggio, altra scheda e ritorno alla finestra invalidano i dati; smontaggio rimuove ascoltatori', () => {
  const target = new EventTarget(); let n = 0
  const chiudi = osservaAggiornamentiPulizie(target, () => n++)
  for (const tipo of ['pulizie-salvataggi', 'storage', 'focus']) target.dispatchEvent(new Event(tipo))
  assert.equal(n, 3); chiudi(); target.dispatchEvent(new Event('focus')); assert.equal(n, 3)
})
