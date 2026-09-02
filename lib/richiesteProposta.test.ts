import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proponiSoluzioni, capienzaCamera, segmento } from './richiesteProposta.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const LENA = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, active: true }
const CAMERE = [LENA, AMBRA, AMELIA, ALLEGRA]
const occ = (room_id: string, check_in: string, check_out: string, status = 'confermata') => ({ room_id, check_in, check_out, status })
const ric = (persone = 1, camera_id: string | null = null) => ({ arrivo: '2026-09-13', partenza: '2026-09-16', persone, camera_id })

test('capienza e prezzo del segmento seguono le tariffe della conferma', () => {
  assert.equal(capienzaCamera(AMELIA), 2)
  assert.equal(capienzaCamera(ALLEGRA), 3)
  assert.equal(capienzaCamera(LENA), 4)
  assert.equal(capienzaCamera({ ...ALLEGRA, has_extra_bed: false }), 2)
  const s = segmento(ALLEGRA, '2026-09-13', '2026-09-15', 3)
  assert.equal(s.notti, 2)
  assert.equal(s.prezzoNotte, 80)
  assert.equal(s.lettoTotale, 20)
  assert.equal(s.totale, 180)
  // Lena a 3: tripla tutto compreso, letto non addebitato
  const l = segmento(LENA, '2026-09-13', '2026-09-15', 3)
  assert.equal(l.prezzoNotte, 90)
  assert.equal(l.lettoTotale, 0)
  assert.equal(l.totale, 180)
})

test('A completa: la camera richiesta per prima, poi le altre libere; le in_attesa non contano', () => {
  const sol = proponiSoluzioni(ric(2, 'ambra'), CAMERE, [
    occ('amelia', '2026-09-14', '2026-09-15'),
    occ('lena', '2026-09-10', '2026-09-20', 'in_attesa'),
    occ('allegra', '2026-09-10', '2026-09-20', 'annullata'),
  ])
  assert.equal(sol[0].caso, 'completa')
  assert.deepEqual(sol.filter(s => s.caso === 'completa').map(s => s.segmenti[0].camera.name), ['Ambra', 'Allegra', 'Lena'])
  assert.equal(sol[0].prezzoTotale, 240)
  assert.equal(sol[0].nottiCoperte, 3)
  assert.deepEqual(sol[0].nottiMancanti, [])
})

test('B cambio camera: tiene la camera richiesta più a lungo, poi meno notti nella seconda', () => {
  // Amelia (richiesta) libera 13,14; Allegra libera 14,15; Ambra libera solo 15; Lena occupata
  const sol = proponiSoluzioni(ric(1, 'amelia'), CAMERE, [
    occ('amelia', '2026-09-15', '2026-09-16'),
    occ('allegra', '2026-09-13', '2026-09-14'),
    occ('ambra', '2026-09-13', '2026-09-15'),
    occ('lena', '2026-09-13', '2026-09-16'),
  ])
  assert.equal(sol[0].caso, 'cambio')
  assert.deepEqual(sol[0].segmenti.map(s => [s.camera.name, s.arrivo, s.partenza]), [['Amelia', '2026-09-13', '2026-09-15'], ['Allegra', '2026-09-15', '2026-09-16']])
  assert.equal(sol[0].prezzoTotale, 70 * 2 + 80)
  assert.equal(sol[0].nottiCoperte, 3)
  assert.ok(sol.length <= 5)
})

test('C manca in mezzo: inizio e fine coperti, la notte centrale scoperta', () => {
  const sol = proponiSoluzioni(ric(1, null), CAMERE, [
    occ('amelia', '2026-09-14', '2026-09-15'),
    occ('allegra', '2026-09-14', '2026-09-15'),
    occ('ambra', '2026-09-14', '2026-09-15'),
    occ('lena', '2026-09-14', '2026-09-15'),
  ])
  assert.equal(sol[0].caso, 'manca_mezzo')
  assert.deepEqual(sol[0].nottiMancanti, ['2026-09-14'])
  assert.equal(sol[0].nottiCoperte, 2)
  assert.equal(sol[0].segmenti.length, 2)
  assert.equal(sol[0].segmenti[0].camera.id, sol[0].segmenti[1].camera.id, 'stessa camera preferita a parità')
})

test('D manca inizio: prima notte occupata ovunque, poi Amelia libera', () => {
  const sol = proponiSoluzioni(ric(1, null), CAMERE, [
    occ('amelia', '2026-09-12', '2026-09-14'),
    occ('allegra', '2026-09-12', '2026-09-16'),
    occ('ambra', '2026-09-12', '2026-09-16'),
    occ('lena', '2026-09-12', '2026-09-16'),
  ])
  assert.equal(sol[0].caso, 'manca_estremo')
  assert.deepEqual(sol[0].nottiMancanti, ['2026-09-13'])
  assert.deepEqual(sol[0].segmenti.map(s => [s.camera.name, s.arrivo, s.partenza]), [['Amelia', '2026-09-14', '2026-09-16']])
  assert.equal(sol[0].prezzoTotale, 140)
})

test('E completo: meno della metà delle notti coperte', () => {
  const sol = proponiSoluzioni(ric(1, null), CAMERE, [
    occ('amelia', '2026-09-12', '2026-09-15'),
    occ('allegra', '2026-09-12', '2026-09-16'),
    occ('ambra', '2026-09-12', '2026-09-16'),
    occ('lena', '2026-09-12', '2026-09-16'),
  ])
  assert.equal(sol.length, 1)
  assert.equal(sol[0].caso, 'completo')
  assert.deepEqual(sol[0].segmenti, [])
  assert.deepEqual(sol[0].nottiMancanti, ['2026-09-13', '2026-09-14', '2026-09-15'])
})

test('capienza: con 4 persone resta solo Lena; con 3 Amelia è esclusa', () => {
  const quattro = proponiSoluzioni(ric(4, null), CAMERE, [])
  assert.deepEqual(quattro.map(s => s.segmenti[0].camera.name), ['Lena'])
  assert.equal(quattro[0].prezzoTotale, 3 * (90 + 10))
  const tre = proponiSoluzioni(ric(3, null), CAMERE, [])
  assert.deepEqual(tre.filter(s => s.caso === 'completa').map(s => s.segmenti[0].camera.name), ['Allegra', 'Ambra', 'Lena'])
})
