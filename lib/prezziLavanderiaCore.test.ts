import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prezzoScritto, leggiPrezzi, salvaPrezzo } from './prezziLavanderiaCore.ts'

function finto(stato: 'ok' | 'senza' | 'rete' = 'ok') {
  const tabella = new Map<string, number>()
  const errore = stato === 'senza' ? { code: 'PGRST205' } : stato === 'rete' ? { code: '' } : null
  return {
    tabella,
    leggi: async () => ({ data: errore ? null : [...tabella].map(([pezzo, prezzo]) => ({ pezzo, prezzo: prezzo.toFixed(2) })), error: errore }),
    scrivi: async (pezzo: string, prezzo: number) => { if (errore) return { data: null, error: errore }; tabella.set(pezzo, prezzo); return { data: [{ pezzo, prezzo }], error: null } },
    togli: async (pezzo: string) => { tabella.delete(pezzo); return { error: errore } },
  }
}

test('prezzo scritto: virgola, punto, zero esplicito; vuoto = da inserire', () => {
  assert.equal(prezzoScritto('1,90'), 1.9); assert.equal(prezzoScritto('0'), 0); assert.equal(prezzoScritto(' '), null)
  assert.ok(Number.isNaN(prezzoScritto('abc'))); assert.ok(Number.isNaN(prezzoScritto('1,999')))
})

test('nessun prezzo precaricato; salvato e riletto; vuoto toglie la riga (mai zero)', async () => {
  const c = finto()
  assert.deepEqual(await leggiPrezzi(c), { stato: 'si', prezzi: {} })
  assert.deepEqual(await salvaPrezzo(c, 'federe', 0.5), { errore: null })
  assert.deepEqual(await salvaPrezzo(c, 'tappetini', 0), { errore: null })
  assert.deepEqual(await leggiPrezzi(c), { stato: 'si', prezzi: { federe: 0.5, tappetini: 0 } })
  assert.deepEqual(await salvaPrezzo(c, 'federe', null), { errore: null })
  assert.equal(c.tabella.has('federe'), false)
})

test('senza tabella = «no» (si lavora senza salvare); rete = errore, non «senza tabella»', async () => {
  assert.deepEqual(await leggiPrezzi(finto('senza')), { stato: 'no' })
  assert.deepEqual(await leggiPrezzi(finto('rete')), { stato: 'errore' })
})
