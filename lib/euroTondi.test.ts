// «1.360 €»: euro tondi col punto delle migliaia (12/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { euroTondi } from './euroTondi.ts'

test('euroTondi: euro interi, punto delle migliaia', () => {
  assert.equal(euroTondi(136000), '1.360 €')
  assert.equal(euroTondi(8000), '80 €')
  assert.equal(euroTondi(0), '0 €')
  // i centesimi si arrotondano all'euro
  assert.equal(euroTondi(8049), '80 €')
  assert.equal(euroTondi(8050), '81 €')
  // anche i numeri lunghi si leggono
  assert.equal(euroTondi(1234567), '12.346 €')
  assert.equal(euroTondi(100000000), '1.000.000 €')
  // valori storti: mai «NaN €»
  assert.equal(euroTondi(Number.NaN), '0 €')
  assert.equal(euroTondi(-136000), '-1.360 €')
})
