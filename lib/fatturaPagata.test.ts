import { test } from 'node:test'
import assert from 'node:assert/strict'
import { segnaFatturaPagata, idCommissione, notaCommissione, importoIniziale, commissioneCent, METODI_FATTURA,
  FATTURA_INCERTA, FATTURA_DIVERSA, COMMISSIONE_DIVERSA, type ClienteFattura, type FatturaDaPagare, type SceltaFattura, type SpesaFattura } from './fatturaPagata.ts'

const fattura: FatturaDaPagare = { documentoId: 'doc-test', stato: 'in_revisione', importoCent: 12500, nome: 'Bolletta prova', numero: 'TEST', gruppoId: 'casa' }
const scelta: SceltaFattura = { giorno: '2026-09-30', metodo: 'contanti', importo: '127,95' }
function finto() {
  let pagata = false, senzaEffetto = false, rispostaPersa = false, letturaGuasta = false, spesaGuasta = false, spesaPersa = false
  let datiRpc: unknown = ['e1']
  const commissioni = new Map<string, SpesaFattura>()
  const spesa: SpesaFattura = { id: 'e1', amount: 125, expense_date: scelta.giorno, paid_at: scelta.giorno, payment_method: scelta.metodo, group_id: 'casa' }
  const chiamate = { rpc: 0, inserimenti: 0, letture: 0, nome: '' }
  const client: ClienteFattura = {
    async rpc(nome) { chiamate.rpc++; chiamate.nome = nome; if (!senzaEffetto) pagata = true; if (rispostaPersa) throw Error('rete'); return { data: datiRpc, error: null } },
    async leggiFattura() {
      chiamate.letture++
      return letturaGuasta ? { data: null, error: { message: 'rete' } } : { error: null, data: {
        documento: { id: fattura.documentoId, kind: 'fattura', status: pagata ? 'confermato' : 'in_revisione', doc_total: 125 },
        bozze: [{ id: 'b1', status: pagata ? 'confermata' : 'da_controllare', expense_id: pagata ? 'e1' : null, group_id: 'casa' }], spese: pagata ? [spesa] : [],
      } }
    },
    async categoriaCommissione() { return { id: 'servizi', error: null } },
    async leggiCommissione(id, nota) { return { data: [...commissioni.values()].filter(r => r.id === id || r.notes === nota), error: null } },
    async inserisciSpesa(riga) {
      chiamate.inserimenti++
      if (spesaGuasta) throw Error('rete')
      const id = String(riga.id)
      if (commissioni.has(id)) return { data: null, error: { code: '23505' } }
      commissioni.set(id, riga as SpesaFattura)
      if (spesaPersa) throw Error('rete dopo commit')
      return { data: [riga], error: null }
    },
  }
  return { client, chiamate, commissioni, spesa,
    configura(o: { senzaEffetto?: boolean; rispostaPersa?: boolean; letturaGuasta?: boolean; spesaGuasta?: boolean; spesaPersa?: boolean; pagata?: boolean; datiRpc?: unknown }) {
      senzaEffetto = o.senzaEffetto ?? senzaEffetto; rispostaPersa = o.rispostaPersa ?? rispostaPersa
      letturaGuasta = o.letturaGuasta ?? letturaGuasta; spesaGuasta = o.spesaGuasta ?? spesaGuasta
      spesaPersa = o.spesaPersa ?? spesaPersa; pagata = o.pagata ?? pagata
      if ('datiRpc' in o) datiRpc = o.datiRpc
    },
  }
}
test('metodi e importo iniziale, niente parziali', () => {
  assert.deepEqual(METODI_FATTURA.map(m => m.chiave), ['contanti', 'bonifico'])
  assert.equal(importoIniziale(33088), '330,88'); assert.equal(commissioneCent('127,95', 12500), 295)
  assert.equal(commissioneCent('120', 12500), null); assert.equal(commissioneCent('abc', 12500), null)
})
test('salva bolletta e commissione: risposta e rilettura completa prima di ok', async () => {
  const f = finto()
  assert.deepEqual(await segnaFatturaPagata(f.client, fattura, scelta), { ok: true, commissioneCent: 295 })
  assert.equal(f.chiamate.nome, 'conferma_fattura_pagata'); assert.equal(f.chiamate.letture, 1)
  const c = [...f.commissioni.values()][0]
  assert.equal(c.amount, 2.95); assert.equal(c.notes, notaCommissione(fattura)); assert.equal(c.id, await idCommissione(fattura.documentoId))
})
test('approvata usa paga_fattura; importo esatto non crea commissioni', async () => {
  const f = finto()
  assert.deepEqual(await segnaFatturaPagata(f.client, { ...fattura, stato: 'approvata_da_pagare' }, { ...scelta, importo: '125' }), { ok: true, commissioneCent: 0 })
  assert.equal(f.chiamate.nome, 'paga_fattura'); assert.equal(f.chiamate.inserimenti, 0)
})
test('risposta vuota senza effetto non significa salvato', async () => {
  const f = finto(); f.configura({ senzaEffetto: true, datiRpc: null })
  const e = await segnaFatturaPagata(f.client, fattura, scelta)
  assert.equal(e.ok, false); if (!e.ok) { assert.equal(e.incerto, true); assert.equal(e.errore, FATTURA_INCERTA) }
  assert.equal(f.chiamate.inserimenti, 0)
})
test('risposta persa dopo commit: lettura completa recupera, commissione una volta', async () => {
  const f = finto(); f.configura({ rispostaPersa: true, spesaPersa: true })
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta)).ok, true)
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta)).ok, true)
  assert.equal(f.commissioni.size, 1); assert.equal(f.chiamate.inserimenti, 1)
})
test('lettura fallita resta incerto, nessuna commissione', async () => {
  const f = finto(); f.configura({ letturaGuasta: true })
  const e = await segnaFatturaPagata(f.client, fattura, scelta)
  assert.equal(e.ok, false); if (!e.ok) assert.equal(e.incerto, true)
  assert.equal(f.chiamate.inserimenti, 0)
})
test('data, metodo, importo o gruppo difformi non sono una conferma', async () => {
  for (const modifica of [{ amount: 124 }, { paid_at: '2026-09-29' }, { payment_method: 'bonifico' }, { group_id: 'altro' }]) {
    const f = finto(); Object.assign(f.spesa, modifica)
    const e = await segnaFatturaPagata(f.client, fattura, scelta)
    assert.equal(e.ok, false); if (!e.ok) assert.equal(e.errore, FATTURA_DIVERSA)
    assert.equal(f.chiamate.inserimenti, 0)
  }
})
test('id restituito diverso da spese rilette resta incerto', async () => {
  const f = finto(); f.configura({ datiRpc: ['altra-spesa'] })
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta)).ok, false)
})
test('verifica non scrive; recupero dopo commissione non riuscita e seconda riapertura', async () => {
  const f = finto(); f.configura({ spesaGuasta: true })
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta)).ok, false)
  const prima = { ...f.chiamate }
  const e = await segnaFatturaPagata(f.client, fattura, scelta, true)
  assert.equal(e.ok, false); if (!e.ok) assert.equal(e.riprovabile, true)
  assert.equal(f.chiamate.rpc, prima.rpc); assert.equal(f.chiamate.inserimenti, prima.inserimenti)
  f.configura({ spesaGuasta: false })
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta)).ok, true)
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta, true)).ok, true)
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta, true)).ok, true)
  assert.equal(f.commissioni.size, 1)
})
test('due telefoni simultanei, chiave primaria: una commissione e due conferme verificate', async () => {
  const f = finto()
  const esiti = await Promise.all([segnaFatturaPagata(f.client, fattura, scelta), segnaFatturaPagata(f.client, fattura, scelta)])
  assert.ok(esiti.every(e => e.ok)); assert.equal(f.commissioni.size, 1)
})
test('collisione di chiave con commissione diversa non è successo', async () => {
  const f = finto()
  const esiti = await Promise.all([segnaFatturaPagata(f.client, fattura, scelta), segnaFatturaPagata(f.client, fattura, { ...scelta, importo: '129' })])
  assert.equal(esiti.filter(e => e.ok).length, 1)
  const e = esiti.find(e => !e.ok)!; if (!e.ok) assert.equal(e.errore, COMMISSIONE_DIVERSA)
  assert.equal(f.commissioni.size, 1)
})
test('commissione legacy completa viene riconosciuta per nota', async () => {
  const f = finto(); await segnaFatturaPagata(f.client, fattura, scelta)
  const r = [...f.commissioni.values()][0]; f.commissioni.clear(); f.commissioni.set('legacy', { ...r, id: 'legacy' })
  assert.equal((await segnaFatturaPagata(f.client, fattura, scelta)).ok, true); assert.equal(f.chiamate.inserimenti, 1)
})
test('importo invalido non chiama il servizio', async () => {
  const f = finto()
  for (const importo of ['', '100', 'abc']) assert.equal((await segnaFatturaPagata(f.client, fattura, { ...scelta, importo })).ok, false)
  assert.equal(f.chiamate.rpc, 0)
})
test('rifiuto certo prima della scrittura permette di liberare la custodia', async () => {
  const f = finto()
  f.client.rpc = async () => ({ data: null, error: { code: 'P0001', message: 'Quadratura non esatta' } })
  const e = await segnaFatturaPagata(f.client, fattura, scelta)
  assert.equal(e.ok, false)
  if (!e.ok) { assert.equal(e.rifiutata, true); assert.equal(e.pagata, false); assert.equal(e.incerto, undefined) }
  assert.equal(f.chiamate.inserimenti, 0)
})
test('gruppo mancante con commissione viene fermato prima di pagare', async () => {
  const f = finto()
  const e = await segnaFatturaPagata(f.client, { ...fattura, gruppoId: null }, scelta)
  assert.equal(e.ok, false); if (!e.ok) assert.equal(e.rifiutata, true)
  assert.equal(f.chiamate.rpc, 0)
})
test('conflitto già registrato viene distinto dall’incertezza per chiudere solo il promemoria', async () => {
  const f = finto(); f.spesa.payment_method = 'bonifico'
  const e = await segnaFatturaPagata(f.client, fattura, scelta)
  assert.equal(e.ok, false); if (!e.ok) { assert.equal(e.conflitto, true); assert.equal(e.incerto, undefined) }
})
