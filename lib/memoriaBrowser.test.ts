// Parte 3, pezzo 4 (05/09/2026): memoria del browser negata → esito
// esplicito (null / false), mai un'eccezione e mai un catch che nasconde.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leggiMemoria, scriviMemoria } from './memoriaBrowser.ts'

const negata = () => { throw new DOMException('The operation is insecure.', 'SecurityError') }
const piena = () => ({ getItem: () => 'x', setItem: () => { throw new DOMException('QuotaExceededError', 'QuotaExceededError') } })

test('memoria negata: leggi → null, scrivi → false (nessuna eccezione)', () => {
  assert.equal(leggiMemoria(negata, 'k'), null)
  assert.equal(scriviMemoria(negata, 'k', 'v'), false)
})

test('memoria piena: la lettura funziona, la scrittura torna false', () => {
  assert.equal(leggiMemoria(piena, 'k'), 'x')
  assert.equal(scriviMemoria(piena, 'k', 'v'), false)
})

test('memoria che funziona: scrive e rilegge', () => {
  const dati = new Map<string, string>()
  const mem = () => ({ getItem: (k: string) => dati.get(k) ?? null, setItem: (k: string, v: string) => { dati.set(k, v) } })
  assert.equal(leggiMemoria(mem, 'firma'), null)
  assert.equal(scriviMemoria(mem, 'firma', 'a,b'), true)
  assert.equal(leggiMemoria(mem, 'firma'), 'a,b')
})

test('ripiego della finestra richieste: senza memoria la firma è null → la finestra si ripropone', () => {
  const firma = 'a,b'
  const scartata = leggiMemoria(negata, 'ca_webreq_dismissed') === firma
  assert.equal(scartata, false)
})
