import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lineaSoggiorno } from './richiesteImmagine.ts'

const seg = (arrivo: string, partenza: string, camera = 'Amelia') => ({ arrivo, partenza, camera })

test('soggiorno continuo: solo blocchi camera, nessun vuoto', () => {
  const l = lineaSoggiorno([seg('2026-09-13', '2026-09-15')], [])
  assert.deepEqual(l.map(b => b.tipo), ['camera'])
  assert.equal(l[0].tipo === 'camera' && l[0].notti, 2)
})

test('notte scoperta in mezzo: camera · vuoto · camera', () => {
  const l = lineaSoggiorno([seg('2026-09-15', '2026-09-16'), seg('2026-09-13', '2026-09-14')], ['2026-09-14'])
  assert.deepEqual(l.map(b => [b.tipo, b.arrivo, b.partenza]), [
    ['camera', '2026-09-13', '2026-09-14'],
    ['vuoto', '2026-09-14', '2026-09-15'],
    ['camera', '2026-09-15', '2026-09-16'],
  ])
  assert.deepEqual(l[1].tipo === 'vuoto' ? l[1].notti : [], ['2026-09-14'])
})

test('due notti scoperte contigue in mezzo formano un solo vuoto; non contigue due vuoti', () => {
  const una = lineaSoggiorno([seg('2026-09-13', '2026-09-14'), seg('2026-09-16', '2026-09-17', 'Allegra')], ['2026-09-14', '2026-09-15'])
  assert.deepEqual(una.map(b => [b.tipo, b.arrivo, b.partenza]), [
    ['camera', '2026-09-13', '2026-09-14'], ['vuoto', '2026-09-14', '2026-09-16'], ['camera', '2026-09-16', '2026-09-17'],
  ])
  const due = lineaSoggiorno([seg('2026-09-14', '2026-09-15')], ['2026-09-13', '2026-09-15'])
  assert.deepEqual(due.map(b => [b.tipo, b.arrivo, b.partenza]), [
    ['vuoto', '2026-09-13', '2026-09-14'], ['camera', '2026-09-14', '2026-09-15'], ['vuoto', '2026-09-15', '2026-09-16'],
  ])
})

test('notte scoperta all\'inizio e alla fine', () => {
  const inizio = lineaSoggiorno([seg('2026-09-14', '2026-09-16')], ['2026-09-13'])
  assert.deepEqual(inizio.map(b => b.tipo), ['vuoto', 'camera'])
  assert.equal(inizio[0].arrivo, '2026-09-13'); assert.equal(inizio[0].partenza, '2026-09-14')
  const fine = lineaSoggiorno([seg('2026-09-13', '2026-09-15')], ['2026-09-15'])
  assert.deepEqual(fine.map(b => b.tipo), ['camera', 'vuoto'])
  assert.equal(fine[1].arrivo, '2026-09-15'); assert.equal(fine[1].partenza, '2026-09-16')
})

test('una notte già coperta non diventa mai un vuoto; i doppioni si ignorano', () => {
  const l = lineaSoggiorno([seg('2026-09-13', '2026-09-15')], ['2026-09-13', '2026-09-14', '2026-09-14'])
  assert.deepEqual(l.map(b => b.tipo), ['camera'])
})
