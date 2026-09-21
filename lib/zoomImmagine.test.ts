import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ZOOM_MIN, ZOOM_MAX, ZOOM_DOPPIO_TOCCO, limitaScala, distanzaDita, limitiSpostamento,
  limitaSpostamento, scalaDopoDoppioTocco, scalaDopoPasso,
} from './zoomImmagine.ts'

test('la scala resta fra intera e sei volte, anche con numeri sbagliati', () => {
  assert.equal(limitaScala(0.2), ZOOM_MIN)
  assert.equal(limitaScala(1.7), 1.7)
  assert.equal(limitaScala(99), ZOOM_MAX)
  assert.equal(limitaScala(Number.NaN), ZOOM_MIN)
})

test('distanza fra le due dita', () => {
  assert.equal(distanzaDita({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
  assert.equal(distanzaDita({ x: 10, y: 10 }, { x: 10, y: 10 }), 0)
})

test('immagine intera: non si sposta; ingrandita: metà di quel che esce dai bordi', () => {
  assert.deepEqual(limitiSpostamento(1, 300, 200), { maxX: 0, maxY: 0 })
  assert.deepEqual(limitiSpostamento(2, 300, 200), { maxX: 150, maxY: 100 })
})

test('lo spostamento non porta mai l’immagine fuori dallo schermo', () => {
  assert.deepEqual(limitaSpostamento(500, 500, 2, 300, 200), { x: 150, y: 100 })
  assert.deepEqual(limitaSpostamento(-500, -500, 2, 300, 200), { x: -150, y: -100 })
  assert.deepEqual(limitaSpostamento(40, -30, 2, 300, 200), { x: 40, y: -30 })
  assert.deepEqual(limitaSpostamento(40, 30, 1, 300, 200), { x: 0, y: 0 })
})

test('doppio tocco: ingrandisce se è intera, torna intera se è ingrandita', () => {
  assert.equal(scalaDopoDoppioTocco(1), ZOOM_DOPPIO_TOCCO)
  assert.equal(scalaDopoDoppioTocco(2.5), ZOOM_MIN)
  assert.equal(scalaDopoDoppioTocco(6), ZOOM_MIN)
})

test('i tasti + e − vanno a passi e non superano i limiti', () => {
  assert.equal(scalaDopoPasso(1, 1), 1.6)
  assert.equal(scalaDopoPasso(1, -1), ZOOM_MIN)
  assert.equal(scalaDopoPasso(6, 1), ZOOM_MAX)
  assert.ok(Math.abs(scalaDopoPasso(1.6, -1) - 1) < 1e-9)
})
