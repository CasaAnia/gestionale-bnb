// R1 (revisione Codex di f4d5474) — riproduzione obbligatoria: il primo INSERT
// viene applicato dal finto ma la risposta di rete si perde; al secondo tocco
// deve esistere UN solo movimento e il flag deve arrivare a pagato. In più:
// rilettura fallita → ci si ferma (mai «pagamento assente»).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eseguiSegnaPagato, MESSAGGIO_RILETTURA_PAGAMENTI, MESSAGGIO_MOVIMENTO_NON_REGISTRATO, MESSAGGIO_FLAG_NON_SEGNATO, rpcMancante, type MovimentoSaldo } from './pagato.ts'
import type { PagamentoStat, PrenotazioneStat } from './tipi.ts'

const seg: PrenotazioneStat[] = [{ id: 'a', room_id: 'r1', check_in: '2026-09-01', check_out: '2026-09-03', total_amount: 160, status: 'confermata', group_id: 'g' }, { id: 'b', room_id: 'r4', check_in: '2026-09-03', check_out: '2026-09-05', total_amount: 180, status: 'confermata', group_id: 'g' }]

// Finto server: store dei pagamenti e flag; l'INSERT può «perdere la risposta»
function finto(opz: { perdiRispostaAlPrimoInsert?: boolean; rilettureFallite?: number } = {}) {
  const store: PagamentoStat[] = [{ booking_id: 'a', amount: 100, paid_on: '2026-08-20' }]
  let pagato = false, inserimenti = 0, rilettureFallite = opz.rilettureFallite ?? 0
  const deps = {
    rileggiPagamenti: async () => rilettureFallite-- > 0 ? { data: null, error: new TypeError('Failed to fetch') } : { data: [...store], error: null },
    inserisci: async (m: MovimentoSaldo) => {
      inserimenti++
      store.push({ booking_id: m.booking_id, amount: m.amount, paid_on: m.paid_on })   // il server APPLICA l'insert…
      if (opz.perdiRispostaAlPrimoInsert && inserimenti === 1) throw new TypeError('Failed to fetch')   // …ma la risposta si perde
      return { data: store[store.length - 1], error: null }
    },
    segnaFlag: async () => { pagato = true; return { error: null } },
  }
  return { store, deps, get pagato() { return pagato }, get inserimenti() { return inserimenti } }
}

test('R1: risposta persa dopo un INSERT applicato → al secondo tocco un solo movimento e flag pagato', async () => {
  const f = finto({ perdiRispostaAlPrimoInsert: true })
  const primo = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', 'chiave-1', f.deps)
  assert.equal(primo.esito, 'errore')
  assert.equal(primo.esito === 'errore' && primo.fase, 'movimento')
  assert.equal(primo.esito === 'errore' && primo.messaggio, MESSAGGIO_MOVIMENTO_NON_REGISTRATO)
  assert.equal(f.pagato, false)
  assert.equal(f.store.length, 2)   // il server ha già il saldo (240 €)
  const secondo = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', 'chiave-2', f.deps)
  assert.equal(secondo.esito, 'ok')
  assert.equal(f.store.length, 2)   // NESSUN secondo movimento
  assert.equal(f.inserimenti, 1)
  assert.equal(f.pagato, true)
  assert.equal(f.store.filter(p => p.paid_on === '2026-09-05').reduce((s, p) => s + Number(p.amount), 0), 240)
})

test('R1: rilettura fallita → ci si ferma prima di scrivere, con il messaggio (mai «pagamento assente»)', async () => {
  const f = finto({ rilettureFallite: 1 })
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', 'k', f.deps)
  assert.deepEqual([r.esito, r.esito === 'errore' && r.fase, r.esito === 'errore' && r.messaggio], ['errore', 'rilettura', MESSAGGIO_RILETTURA_PAGAMENTI])
  assert.equal(f.inserimenti, 0)
  assert.equal(f.pagato, false)
  const ok = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', 'k', f.deps)
  assert.equal(ok.esito, 'ok')
  assert.equal(f.store.length, 2)
})

test('R1: percorso normale → un movimento del saldo mancante (240 €) con la chiave, poi flag; già coperto → solo flag', async () => {
  const f = finto()
  let chiaveVista = ''
  const deps = { ...f.deps, inserisci: async (m: MovimentoSaldo) => { chiaveVista = m.chiave_operazione; return f.deps.inserisci(m) } }
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'bonifico', 'a', 'chiave-stabile', deps)
  assert.equal(r.esito, 'ok')
  assert.equal(chiaveVista, 'chiave-stabile')
  assert.equal(r.esito === 'ok' && r.movimento?.amount, 240)
  const di_nuovo = await eseguiSegnaPagato(seg, '2026-09-06', 'bonifico', 'a', 'altra', deps)
  assert.equal(di_nuovo.esito === 'ok' && di_nuovo.movimento, null)
  assert.equal(f.store.length, 2)
})

test('R1: flag rifiutato dopo il movimento → messaggio dedicato e pagamenti aggiornati; rpcMancante riconosce PGRST202', async () => {
  const f = finto()
  const deps = { ...f.deps, segnaFlag: async () => ({ error: { message: 'permission denied' } }) }
  const r = await eseguiSegnaPagato(seg, '2026-09-05', 'contanti', 'a', 'k', deps)
  assert.equal(r.esito === 'errore' && r.messaggio, MESSAGGIO_FLAG_NON_SEGNATO)
  assert.equal(r.pagamenti?.length, 2)
  assert.equal(rpcMancante({ code: 'PGRST202', message: 'Could not find the function public.segna_pagato' }), true)
  assert.equal(rpcMancante({ code: '42501', message: 'permission denied' }), false)
})
