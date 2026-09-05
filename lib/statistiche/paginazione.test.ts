import { test } from 'node:test'
import assert from 'node:assert/strict'
import { raccogliPagine, aBlocchi, raccogliBlocchi } from './paginazione.ts'

test('oltre 1.000 righe: chiede più pagine finché ne arrivano meno del limite', async () => {
  const righe = Array.from({ length: 2350 }, (_, i) => ({ i }))
  const chiamate: number[] = []
  const r = await raccogliPagine(async (offset, limite) => { chiamate.push(offset); return { data: righe.slice(offset, offset + limite), error: null } })
  assert.equal(r.data.length, 2350)
  assert.deepEqual(chiamate, [0, 1000, 2000])
  assert.equal(r.pagine, 3)
})

test('esattamente 1.000 righe: una seconda pagina vuota chiude; lista vuota: una sola chiamata', async () => {
  const righe = Array.from({ length: 1000 }, (_, i) => i)
  const r = await raccogliPagine(async (offset, limite) => ({ data: righe.slice(offset, offset + limite), error: null }))
  assert.deepEqual([r.data.length, r.pagine], [1000, 2])
  assert.deepEqual(await raccogliPagine(async () => ({ data: [], error: null })), { data: [], error: null, pagine: 1 })
})

test('errore alla seconda pagina: nessuna lista parziale, errore riportato', async () => {
  const r = await raccogliPagine(async (offset, limite) => offset === 0 ? { data: Array(limite).fill(1), error: null } : { data: null, error: { message: 'timeout' } })
  assert.deepEqual(r.data, [])
  assert.deepEqual(r.error, { message: 'timeout' })
  const ecc = await raccogliPagine(async () => { throw new TypeError('Failed to fetch') })
  assert.equal(ecc.data.length, 0)
  assert.ok(ecc.error instanceof TypeError)
})

test('R5: 501 ID → 6 blocchi da 100, tutti letti, righe deduplicate, nessun taglio', async () => {
  const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`)
  const blocchi = aBlocchi(ids)
  assert.deepEqual(blocchi.map(b => b.length), [100, 100, 100, 100, 100, 1])
  const letti: number[] = []
  const r = await raccogliBlocchi(blocchi, async b => { letti.push(b.length); return { data: [...b.map(id => ({ id })), { id: b[0] }], error: null } }, x => x.id)
  assert.equal(r.error, null)
  assert.equal(r.data.length, 501)
  assert.equal(r.blocchi, 6)
  assert.deepEqual(letti, [100, 100, 100, 100, 100, 1])
})

test('R5: errore nel secondo blocco → nessun risultato parziale presentato come completo', async () => {
  const blocchi = aBlocchi(Array.from({ length: 250 }, (_, i) => i))
  const r = await raccogliBlocchi(blocchi, async b => b[0] === 100 ? { data: null, error: { message: 'timeout' } } : { data: b.map(id => ({ id: String(id) })), error: null }, x => x.id)
  assert.deepEqual(r.data, [])
  assert.deepEqual(r.error, { message: 'timeout' })
  assert.equal(r.blocchi, 2)
  const ecc = await raccogliBlocchi(blocchi, async () => { throw new TypeError('Failed to fetch') }, (x: { id: string }) => x.id)
  assert.deepEqual(ecc.data, [])
  assert.deepEqual(aBlocchi([], 100), [])
})
