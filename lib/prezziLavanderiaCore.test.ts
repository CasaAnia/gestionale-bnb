import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prezzoScritto, leggiPrezzi, salvaPrezzo, PREZZO_INCERTO } from './prezziLavanderiaCore.ts'

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
  assert.deepEqual(await salvaPrezzo(c, 'federe', 0.5), { stato: 'salvato', messaggio: null })
  assert.deepEqual(await salvaPrezzo(c, 'tappetini', 0), { stato: 'salvato', messaggio: null })
  assert.deepEqual(await leggiPrezzi(c), { stato: 'si', prezzi: { federe: 0.5, tappetini: 0 } })
  assert.deepEqual(await salvaPrezzo(c, 'federe', null), { stato: 'salvato', messaggio: null })
  assert.equal(c.tabella.has('federe'), false)
})

test('senza tabella = «no» (si lavora senza salvare); rete = errore, non «senza tabella»', async () => {
  assert.deepEqual(await leggiPrezzi(finto('senza')), { stato: 'no' })
  assert.deepEqual(await leggiPrezzi(finto('rete')), { stato: 'errore' })
})

// Rilievo di Codex (01/10/2026): risposta persa ≠ «non salvato»
function conPerdita(modo: 'scritto' | 'non-scritto', rilettura = true) {
  const tabella = new Map<string, number>()
  let letture = 0
  return {
    tabella,
    leggi: async () => { letture++; return rilettura || letture === 1 ? { data: [...tabella].map(([pezzo, prezzo]) => ({ pezzo, prezzo })), error: null } : { data: null, error: { code: '' } } },
    scrivi: async (pezzo: string, prezzo: number) => { if (modo === 'scritto') tabella.set(pezzo, prezzo); throw new Error('Failed to fetch') },
    togli: async (pezzo: string) => { if (modo === 'scritto') tabella.delete(pezzo); return { error: { code: '', message: 'Failed to fetch' } } },
  }
}
test('risposta persa: si rilegge — scritto = salvato; non scritto = incerto (può ancora arrivare), mai «riprova»', async () => {
  assert.deepEqual(await salvaPrezzo(conPerdita('scritto'), 'federe', 0.5), { stato: 'salvato', messaggio: null })
  const e = await salvaPrezzo(conPerdita('non-scritto'), 'federe', 0.5)
  assert.deepEqual(e, { stato: 'incerto', messaggio: PREZZO_INCERTO })
  assert.ok(!/riprova/i.test(PREZZO_INCERTO))
})
test('risposta persa e rilettura impossibile: incerto', async () => {
  const c = conPerdita('scritto', false)
  await c.leggi() // la prima lettura (apertura) va
  assert.equal((await salvaPrezzo(c, 'federe', 0.5)).stato, 'incerto')
})
test('cancellazione con risposta persa: riletta tolta = salvato; ancora lì = incerto', async () => {
  const a = conPerdita('scritto'); a.tabella.set('federe', 0.5)
  assert.equal((await salvaPrezzo(a, 'federe', null)).stato, 'salvato')
  const b = conPerdita('non-scritto'); b.tabella.set('federe', 0.5)
  assert.equal((await salvaPrezzo(b, 'federe', null)).stato, 'incerto')
})
test('errore certo del server: non salvato', async () => {
  const c = { leggi: async () => ({ data: [], error: null }), scrivi: async () => ({ data: null, error: { code: '42501' } }), togli: async () => ({ error: { code: '42501' } }) }
  assert.equal((await salvaPrezzo(c, 'federe', 1)).stato, 'non_salvato')
})
