import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idsViste, nuoveRichieste, segnaRichiestaSitoVista, CHIAVE_VISTE } from './richiesteSitoViste.ts'
test('viste: dati assenti, danneggiati o estranei non nascondono richieste', () => {
  for (const testo of [null, '{', '{}', 'null']) assert.deepEqual(idsViste(testo), [])
  assert.deepEqual(idsViste('["a",3,null]'), ['a'])
})
test('dopo apertura resta la seconda; dopo riapertura resta vista; una nuova ricompare', () => {
  const dati = [{ id: 'a' }, { id: 'b' }]
  const archivio = new Map<string, string>()
  const eventi: Event[] = []
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => archivio.get(k) ?? null, setItem: (k: string, v: string) => archivio.set(k, v) } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (e: Event) => eventi.push(e) } })
  segnaRichiestaSitoVista('a'); segnaRichiestaSitoVista('a')
  assert.deepEqual(idsViste(archivio.get(CHIAVE_VISTE)!), ['a'])
  assert.deepEqual(nuoveRichieste(dati, idsViste(archivio.get(CHIAVE_VISTE)!)), [{ id: 'b' }])
  assert.deepEqual(nuoveRichieste([...dati, { id: 'c' }], idsViste(archivio.get(CHIAVE_VISTE)!)), [{ id: 'b' }, { id: 'c' }])
  assert.equal(eventi.length, 2)
  delete (globalThis as Record<string, unknown>).window
  delete (globalThis as Record<string, unknown>).localStorage
})
test('memoria negata: nessuna eccezione e nessuna richiesta persa', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('negata') } })
  assert.doesNotThrow(() => segnaRichiestaSitoVista('a'))
  assert.deepEqual(nuoveRichieste([{ id: 'a' }], []), [{ id: 'a' }])
  delete (globalThis as Record<string, unknown>).localStorage
})
