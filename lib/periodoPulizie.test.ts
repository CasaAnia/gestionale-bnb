import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodoIniziale, sposta, giorniContati, precedente, testoConfronto, etichettaPeriodo, mesiInteri, giorniFra } from './periodoPulizie.ts'

const OGGI = '2026-10-01'

test('predefinito il mese corrente; settimana da lunedì a domenica; dal–al gli ultimi tre mesi interi', () => {
  assert.deepEqual(periodoIniziale(OGGI), { modo: 'mese', dal: '2026-10-01', al: '2026-10-31' })
  assert.deepEqual(periodoIniziale(OGGI, 'sett'), { modo: 'sett', dal: '2026-09-28', al: '2026-10-04' })
  assert.deepEqual(periodoIniziale(OGGI, 'dal_al'), { modo: 'dal_al', dal: '2026-07-01', al: '2026-09-30' })
})

test('etichette come nel riferimento', () => {
  assert.equal(etichettaPeriodo(periodoIniziale(OGGI)), 'ottobre 2026')
  assert.equal(etichettaPeriodo(periodoIniziale(OGGI, 'sett')), '28 set – 4 ott')
  assert.equal(etichettaPeriodo(periodoIniziale(OGGI, 'dal_al')), 'lug – set 2026')
  assert.equal(etichettaPeriodo({ modo: 'dal_al', dal: '2026-07-03', al: '2026-09-20' }), '3 lug – 20 set 2026')
})

test('frecce: una settimana, un mese, tre mesi', () => {
  assert.deepEqual(sposta(periodoIniziale(OGGI), -1), { modo: 'mese', dal: '2026-09-01', al: '2026-09-30' })
  assert.deepEqual(sposta(periodoIniziale(OGGI, 'sett'), 1), { modo: 'sett', dal: '2026-10-05', al: '2026-10-11' })
  assert.deepEqual(sposta(periodoIniziale(OGGI, 'dal_al'), -1), { modo: 'dal_al', dal: '2026-04-01', al: '2026-06-30' })
  assert.deepEqual(sposta({ modo: 'mese', dal: '2026-01-01', al: '2026-01-31' }, -1), { modo: 'mese', dal: '2025-12-01', al: '2025-12-31' })
})

test('giorni inclusi; il periodo in corso conta fino a oggi; il confronto ha gli stessi giorni', () => {
  assert.equal(giorniFra('2026-09-01', '2026-09-30'), 30)
  assert.deepEqual(giorniContati(periodoIniziale(OGGI), OGGI), { dal: '2026-10-01', al: '2026-10-01', giorni: 1 })
  assert.deepEqual(precedente(periodoIniziale(OGGI), OGGI), { dal: '2026-09-01', al: '2026-09-01' })
  assert.equal(testoConfronto(periodoIniziale(OGGI), OGGI), 'rispetto agli stessi giorni di settembre')
  const settembre = { modo: 'mese' as const, dal: '2026-09-01', al: '2026-09-30' }
  assert.deepEqual(precedente(settembre, OGGI), { dal: '2026-08-01', al: '2026-08-30' })
  assert.equal(testoConfronto(settembre, OGGI), 'rispetto ad agosto')
  // marzo (31) contro febbraio (28): il precedente finisce a fine febbraio
  assert.deepEqual(precedente({ modo: 'mese', dal: '2026-03-01', al: '2026-03-31' }, '2026-05-01'), { dal: '2026-02-01', al: '2026-02-28' })
  assert.deepEqual(precedente(periodoIniziale(OGGI, 'dal_al'), OGGI), { dal: '2026-04-01', al: '2026-06-30' })
  assert.equal(testoConfronto(periodoIniziale(OGGI, 'dal_al'), OGGI), 'rispetto ai tre mesi prima')
  assert.equal(testoConfronto({ modo: 'dal_al', dal: '2026-09-11', al: '2026-09-30' }, OGGI), 'rispetto ai 20 giorni prima')
  assert.deepEqual(precedente({ modo: 'dal_al', dal: '2026-09-11', al: '2026-09-30' }, OGGI), { dal: '2026-08-22', al: '2026-09-10' })
  assert.equal(giorniContati({ dal: '2026-11-01', al: '2026-11-30' }, OGGI), null)
  assert.equal(mesiInteri({ dal: '2026-07-01', al: '2026-09-30' }), 3)
})
