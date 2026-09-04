import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daControllare } from './daControllare.ts'

const OGGI = '2026-09-15'
const b = (id: string, room_id: string, check_in: string, check_out: string, total: number, extra: Partial<{ status: string; pagato: boolean }> = {}) =>
  ({ id, room_id, check_in, check_out, total_amount: total, status: 'confermata', ...extra })

test('da controllare: ferme, arrivi e partenze a 3 giorni, pagamenti, sovrapposizioni, fatture scadute; in attesa mai contate', () => {
  const stato = {
    oggi: OGGI, adesso: new Date('2026-09-15T12:00:00Z'),
    richieste: [
      { id: 'r1', stato: 'in_attesa' as const, arrivo: '2026-09-20', created_at: '2026-09-13T08:00:00Z', proposta_inviata_at: null },   // ferma da 2 giorni
      { id: 'r2', stato: 'in_attesa' as const, arrivo: '2026-09-20', created_at: '2026-09-15T08:00:00Z', proposta_inviata_at: null },   // fresca
      { id: 'r3', stato: 'proposta_inviata' as const, arrivo: '2026-09-10', created_at: '2026-09-01T08:00:00Z', proposta_inviata_at: '2026-09-02T08:00:00Z' },   // arrivo passato
      { id: 'r4', stato: 'confermata' as const, arrivo: '2026-09-01', created_at: '2026-08-01T08:00:00Z', proposta_inviata_at: null },   // chiusa: mai
    ],
    prenotazioni: [
      b('a', 'amelia', '2026-09-15', '2026-09-17', 140),                       // arriva oggi, parte il 17
      b('b', 'ambra', '2026-09-17', '2026-09-20', 240),                        // arriva il 17
      b('c', 'lena', '2026-09-18', '2026-09-20', 180),                         // arriva il 18: fuori dai 3 giorni
      b('d', 'amelia', '2026-09-16', '2026-09-18', 140),                       // SOVRAPPOSTA ad a in Amelia la notte del 16
      b('e', 'allegra', '2026-09-16', '2026-09-17', 80, { status: 'in_attesa' }),   // mai
      b('f', 'allegra', '2026-09-10', '2026-09-12', 160),                      // conclusa, né pagata né righe → pagamento mancante
      b('g', 'allegra', '2026-09-01', '2026-09-03', 160, { pagato: true }),    // pagata senza righe → incoerenza
    ],
    pagamenti: [{ booking_id: 'a', amount: 140, paid_on: '2026-09-15' }],
    documenti: [
      { id: 'f1', kind: 'fattura', status: 'approvata_da_pagare', due_date: '2026-09-10', doc_total: 95.5 },
      { id: 'f2', kind: 'fattura', status: 'approvata_da_pagare', due_date: '2026-09-20', doc_total: 300 },
      { id: 'f3', kind: 'fattura', status: 'confermato', due_date: '2026-09-01', doc_total: 220 },
      { id: 'f4', kind: 'scontrino', status: 'in_revisione', due_date: null, doc_total: 12 },
    ],
  }
  const d = daControllare(stato)
  assert.deepEqual(d.richiesteFerme, [{ id: 'r1', avviso: 'ferma da 2 giorni' }, { id: 'r3', avviso: 'arrivo passato' }])
  assert.deepEqual(d.arrivi.map(x => x.id), ['a', 'd', 'b'])
  assert.deepEqual(d.partenze.map(x => x.id), ['a'])
  assert.deepEqual(d.pagamenti.map(x => [x.tipo, x.soggiorno]), [['saldato_ma_non_segnato', 'a'], ['pagato_senza_righe', 'g']])
  assert.deepEqual(d.pagamentiMancanti.map(x => x.id), ['f'])
  assert.equal(d.sovrapposizioni.length, 1); assert.equal(d.sovrapposizioni[0].room_id, 'amelia'); assert.deepEqual(d.sovrapposizioni[0].notti, ['2026-09-16'])
  assert.deepEqual(d.fattureScadute.map(x => x.id), ['f1'])
})

test('da controllare: stato vuoto → tutte le liste vuote', () => {
  const d = daControllare({ oggi: OGGI, richieste: [], prenotazioni: [], pagamenti: [], documenti: [] })
  assert.deepEqual(d, { richiesteFerme: [], arrivi: [], partenze: [], pagamenti: [], pagamentiMancanti: [], sovrapposizioni: [], fattureScadute: [] })
})
