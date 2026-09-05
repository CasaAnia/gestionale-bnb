import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daDoveArrivano } from './provenienza.ts'

let n = 0
// telefoni diversi per ogni prenotazione (cifre vere: lettere nell'id non bastano)
const b = (id: string, check_in: string, check_out: string, total: number, extra: Record<string, unknown> = {}) =>
  ({ id, room_id: 'r', check_in, check_out, total_amount: total, status: 'confermata', guests: { full_name: `Ospite ${id}`, phone: `+39 333 000 ${String(++n).padStart(4, '0')}` }, ...extra })

test('da dove arrivano: soggiorni e ricavi per provenienza nel periodo, strutture sotto Altra struttura, già stati a parte, cambio camera una volta', () => {
  const periodo = [
    b('a', '2026-09-01', '2026-09-03', 200, { provenienza: 'google' }),
    b('b1', '2026-09-05', '2026-09-07', 200, { group_id: 'g', provenienza: 'altra_struttura', struttura_nome: 'Nida' }),
    b('b2', '2026-09-07', '2026-09-09', 200, { group_id: 'g', provenienza: 'altra_struttura', struttura_nome: 'Nida' }),   // stesso soggiorno
    b('c', '2026-09-10', '2026-09-12', 300, { provenienza: 'altra_struttura', struttura_nome: 'Umana', guests: { full_name: 'Anna Rossi', phone: '+39 333 123 4567' } }),
    b('d', '2026-09-15', '2026-09-17', 100, { provenienza: 'passaparola' }),
    b('e', '2026-09-20', '2026-09-22', 100, {}),                                   // senza colonna → non so
    b('f', '2026-09-25', '2026-09-27', 100, { provenienza: 'google', status: 'in_attesa' }),   // mai
    b('x', '2026-09-29', '2026-10-03', 400, { provenienza: 'google' }),           // a cavallo: 2 notti su 4 nel periodo (200)
  ]
  const storico = [...periodo, b('vecchia', '2026-07-01', '2026-07-05', 400, { guests: { full_name: 'Anna Rossi', phone: '+39 333 123 4567' } })]
  const out = daDoveArrivano(periodo, storico, '2026-09-01', '2026-10-01')
  const r = Object.fromEntries(out.righe.map(x => [x.chiave, `${x.soggiorni}/${x.ricaviCent}`]))
  assert.equal(r.altra_struttura, '2/70000')      // g (400 €) + c (300 €)
  assert.equal(r.google, '2/40000')               // a (200 €) + x (2 notti da 100 €)
  assert.equal(r.passaparola, '1/10000')
  assert.equal(r.non_so, '1/10000')
  assert.deepEqual(out.righe[0].sotto!.map(s => `${s.label}:${s.soggiorni}/${s.ricaviCent}`), ['Nida:1/40000', 'Umana:1/30000'])
  assert.deepEqual([out.giaStati.soggiorni, out.giaStati.ricaviCent], [1, 30000])   // Anna Rossi (c) era già stata a luglio
  assert.deepEqual([out.totale.soggiorni, out.totale.ricaviCent], [6, 130000])
  assert.equal(out.colonnePresenti, true)
})

test('da dove arrivano: senza colonne (0036 non applicata) tutto in Non so e colonnePresenti = false; periodo vuoto → zeri', () => {
  const out = daDoveArrivano([b('a', '2026-09-01', '2026-09-03', 200)], [], '2026-09-01', '2026-10-01')
  assert.equal(out.colonnePresenti, false)
  assert.equal(out.righe.find(x => x.chiave === 'non_so')!.soggiorni, 1)
  const vuoto = daDoveArrivano([], [], '2026-09-01', '2026-10-01')
  assert.deepEqual(vuoto.righe.map(x => x.soggiorni), [0, 0, 0, 0])
  assert.equal(vuoto.giaStati.soggiorni, 0)
})
