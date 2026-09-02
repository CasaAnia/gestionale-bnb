import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notti, camereLibere, frasiDisponibilita, elencoNomi } from './disponibilita.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const camere = [
  { id: 'lena', name: 'Lena', active: true },
  { id: 'amelia', name: 'Amelia', active: true },
  { id: 'ambra', name: 'Ambra', active: true },
  { id: 'allegra', name: 'Allegra', active: true },
  { id: 'vecchia', name: 'Camera 1', active: false },
]

test('notti: solo intervalli validi', () => {
  assert.equal(notti('2026-09-13', '2026-09-15'), 2)
  assert.equal(notti('2026-09-13', '2026-09-13'), 0)
  assert.equal(notti('2026-09-15', '2026-09-13'), 0)
  assert.equal(notti('', '2026-09-13'), 0)
  assert.equal(notti('2026-10-31', '2026-11-01'), 1)
})

test('contano solo confermate e completate; il giorno di partenza è libero', () => {
  const pren = [
    { room_id: 'amelia', check_in: '2026-09-12', check_out: '2026-09-14', status: 'confermata' },
    { room_id: 'ambra', check_in: '2026-09-14', check_out: '2026-09-16', status: 'completata' },
    { room_id: 'allegra', check_in: '2026-09-13', check_out: '2026-09-15', status: 'in_attesa' },
    { room_id: 'lena', check_in: '2026-09-13', check_out: '2026-09-15', status: 'annullata' },
    { room_id: 'lena', check_in: '2026-09-10', check_out: '2026-09-13', status: 'confermata' }, // parte il giorno dell'arrivo
  ]
  const { libere, occupate } = camereLibere(camere, pren, '2026-09-13', '2026-09-15')
  assert.deepEqual(libere.map(c => c.name), ['Allegra', 'Lena'])
  assert.deepEqual(occupate.map(c => c.name), ['Amelia', 'Ambra'])
})

test('frase indicativa in ordine fisso, camere disattivate escluse', () => {
  const pren = [
    { room_id: 'amelia', check_in: '2026-09-12', check_out: '2026-09-14', status: 'confermata' },
    { room_id: 'ambra', check_in: '2026-09-14', check_out: '2026-09-16', status: 'confermata' },
    { room_id: 'lena', check_in: '2026-09-14', check_out: '2026-09-16', status: 'confermata' },
  ]
  assert.equal(frasiDisponibilita(camere, pren, '2026-09-13', '2026-09-15'),
    '2 notti · Allegra libera, Amelia, Ambra e Lena occupate')
  assert.equal(frasiDisponibilita(camere, [], '2026-09-13', '2026-09-14'), '1 notte · tutte le camere libere')
  assert.equal(frasiDisponibilita(camere, pren, '2026-09-13', '2026-09-13'), '')
  assert.equal(frasiDisponibilita([], pren, '2026-09-13', '2026-09-15'), '2 notti · camere non caricate')
})

test('elenco nomi con la e finale', () => {
  assert.equal(elencoNomi([]), '')
  assert.equal(elencoNomi(['Lena']), 'Lena')
  assert.equal(elencoNomi(['Amelia', 'Lena']), 'Amelia e Lena')
  assert.equal(elencoNomi(['Amelia', 'Ambra', 'Lena']), 'Amelia, Ambra e Lena')
})

test('riga indicativa con persone e letti aggiuntivi condivisi', () => {
  const camereComplete = [
    { id: 'amelia', name: 'Amelia', active: true, has_extra_bed: true, base_price: 70 },
    { id: 'allegra', name: 'Allegra', active: true, has_extra_bed: true, base_price: 80 },
    { id: 'ambra', name: 'Ambra', active: true, has_extra_bed: true, base_price: 80 },
    { id: LENA_ID, name: 'Lena', active: true, has_extra_bed: true, base_price: 80, double_price: 90 },
  ]
  const quadrupla = { room_id: LENA_ID, check_in: '2026-09-13', check_out: '2026-09-15', status: 'confermata', num_guests: 4, extra_bed: true, extra_bed_dates: ['2026-09-13', '2026-09-14'] }
  assert.equal(frasiDisponibilita(camereComplete, [quadrupla], '2026-09-13', '2026-09-15', 3),
    '2 notti · Lena occupata, Amelia, Allegra e Ambra senza posto per 3')
  // Amelia parte da 1 posto: per 2 persone le serve un letto, e non ce n'è
  assert.equal(frasiDisponibilita(camereComplete, [quadrupla], '2026-09-13', '2026-09-15', 2),
    '2 notti · Allegra e Ambra libere, Lena occupata, Amelia senza posto per 2')
  assert.equal(frasiDisponibilita(camereComplete, [], '2026-09-13', '2026-09-15', 2), '2 notti · tutte le camere libere')
  assert.equal(frasiDisponibilita(camereComplete, [], '2026-09-13', '2026-09-15', 5), '2 notti · Amelia, Allegra, Ambra e Lena senza posto per 5')
})
