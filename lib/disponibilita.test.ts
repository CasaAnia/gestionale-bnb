import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notti, camereLibere, frasiDisponibilita, elencoNomi } from './disponibilita.ts'

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
