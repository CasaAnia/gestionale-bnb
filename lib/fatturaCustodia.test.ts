import { test } from 'node:test'
import assert from 'node:assert/strict'
import { custodisciFattura, leggiTentativoFattura, dimenticaFattura, fattureInSospeso, aggiungiFattureInSospeso, type TentativoFattura } from './fatturaCustodia.ts'
const t: TentativoFattura = { fattura: { documentoId: 'd1', stato: 'in_revisione', importoCent: 12500, nome: 'Bolletta prova', gruppoId: 'g1' }, scelta: { importo: '127,95', giorno: '2026-09-30', metodo: 'contanti' } }
function memoria() {
  const dati = new Map<string, string>()
  return { getItem: (k: string) => dati.get(k) ?? null, setItem: (k: string, v: string) => { dati.set(k, v) }, removeItem: (k: string) => { dati.delete(k) }, key: (i: number) => [...dati.keys()][i] ?? null, get length() { return dati.size } }
}
test('chiudi, riapri e seconda riapertura ritrovano stessi dati; Home conserva fattura già sparita dalla lettura', () => {
  const m = memoria(), deposito = () => m
  assert.equal(custodisciFattura(t, deposito), true)
  assert.deepEqual(leggiTentativoFattura('d1', deposito), t)
  assert.deepEqual(leggiTentativoFattura('d1', deposito), t)
  const home = aggiungiFattureInSospeso([], fattureInSospeso(deposito))
  assert.equal(home.length, 1); assert.equal(home[0].bottone, 'Verifica salvataggio')
  assert.equal(home[0].fattura?.documentoId, 'd1')
  assert.equal(dimenticaFattura(t, deposito), true)
  assert.deepEqual(aggiungiFattureInSospeso([], fattureInSospeso(deposito)), [])
})
test('memoria negata o che non conserva: nessuna custodia dichiarata riuscita', () => {
  assert.equal(custodisciFattura(t, () => { throw Error('negata') }), false)
  assert.equal(custodisciFattura(t, () => ({ ...memoria(), setItem() {} })), false)
})
test('altro tentativo sullo stesso documento non sovrascrive o cancella il primo', () => {
  const m = memoria(), deposito = () => m
  assert.equal(custodisciFattura(t, deposito), true)
  const altro = { ...t, scelta: { ...t.scelta, importo: '130' } }
  assert.equal(custodisciFattura(altro, deposito), false)
  assert.equal(dimenticaFattura(altro, deposito), false)
  assert.deepEqual(leggiTentativoFattura('d1', deposito), t)
})
