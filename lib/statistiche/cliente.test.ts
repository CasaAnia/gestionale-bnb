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

// ── Rilievo 4 del 15/09/2026: un soggiorno è quello del conto unico ───────
test('due camere della stessa prenotazione sono UN soggiorno', () => {
  const camera = (id: string, gruppo: string) => ({
    id, prenotazione_id: 'P1', group_id: gruppo, room_id: 'r', check_in: '2026-09-01', check_out: '2026-09-03',
    status: 'confermata', total_amount: 160, guest_name: 'Prova',
  })
  const storico = storicoCliente([camera('a', 'g1'), camera('b', 'g2')])
  assert.equal(storico.soggiorni, 1, 'prima ne contava due')
})

test('due prenotazioni diverse restano due soggiorni', () => {
  const b = (id: string, pren: string) => ({
    id, prenotazione_id: pren, group_id: null, room_id: 'r', check_in: '2026-09-01', check_out: '2026-09-03',
    status: 'confermata', total_amount: 160, guest_name: 'Prova',
  })
  assert.equal(storicoCliente([b('a', 'P1'), b('b', 'P2')]).soggiorni, 2)
})

test('il cambio camera senza prenotazione_id conta ancora una volta sola', () => {
  const b = (id: string) => ({
    id, group_id: 'g1', room_id: 'r', check_in: '2026-09-01', check_out: '2026-09-03',
    status: 'confermata', total_amount: 160, guest_name: 'Prova',
  })
  assert.equal(storicoCliente([b('a'), b('b')]).soggiorni, 1)
})
