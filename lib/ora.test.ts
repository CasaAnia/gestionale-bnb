import test from 'node:test'
import assert from 'node:assert/strict'
import { oraDigitata, oraCompleta } from './ora.ts'

test('i due punti li mette la pagina, scrivendo solo le cifre', () => {
  assert.equal(oraDigitata('0'), '0')
  assert.equal(oraDigitata('03'), '03')
  assert.equal(oraDigitata('030'), '03:0')
  assert.equal(oraDigitata('0300'), '03:00')
  assert.equal(oraDigitata('1530'), '15:30')
})

test('ore e minuti impossibili rientrano da soli', () => {
  assert.equal(oraDigitata('2599'), '23:59')
  assert.equal(oraDigitata('9900'), '23:00')
  assert.equal(oraDigitata('15:30'), '15:30')
})

test('un\'ora a metà non è completa', () => {
  assert.equal(oraCompleta('03:00'), true)
  assert.equal(oraCompleta('03:'), false)
  assert.equal(oraCompleta('3:00'), false)
})
