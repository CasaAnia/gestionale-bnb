import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mesiCliccabili } from './mesiCliccabili.ts'

test('mesiCliccabili: 12 mesi da quello corrente, con il cambio d\'anno segnato una volta', () => {
  const m = mesiCliccabili(new Date(2026, 8, 4))   // 4 settembre 2026
  assert.equal(m.length, 12)
  assert.deepEqual(m[0], { iso: '2026-09-01', chiave: '2026-09', label: 'set', anno: 2026, nuovoAnno: false })
  assert.equal(m[3].label, 'dic')
  assert.deepEqual(m[4], { iso: '2027-01-01', chiave: '2027-01', label: 'gen', anno: 2027, nuovoAnno: true })
  assert.equal(m.filter(x => x.nuovoAnno).length, 1)
  assert.equal(m[11].label, 'ago')
})

test('mesiCliccabili: a gennaio nessun cambio d\'anno nei 12 mesi', () => {
  const m = mesiCliccabili(new Date(2027, 0, 15), 12)
  assert.equal(m.filter(x => x.nuovoAnno).length, 0)
  assert.equal(mesiCliccabili(new Date(2027, 0, 15), 4).length, 4)
})
