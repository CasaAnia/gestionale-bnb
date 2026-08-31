// ============================================================================
// Test LOCALI degli strumenti del collaudo (nessuna rete, query finte):
//   node --test scripts/collaudo-contratto/strumenti.test.mjs
// Coprono ciò che il revisore ha chiesto di dimostrare PRIMA del
// collaudo: arresto prima degli effetti successivi, quiescenza vera,
// falsa presenza di Y, concorrenza non valida, fixture con squadratura,
// fase B in un'unica transazione, recupero della pulizia interrotta.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ErroreCollaudo, creaContatore, attendiQuiescenza, attesaSuTabella,
  costruisciFaseB, sqlFixtureDocumento, pianoPulizia, eseguiPiano, confrontaFotografie,
} from './strumenti.mjs'
import { provaValida } from '../fase4/concorrenza.mjs'

const muto = { log: () => {}, error: () => {} }
const subito = () => Promise.resolve()

// ---- contatore: STOP vero ---------------------------------------------------
test('esigi fallito LANCIA: gli effetti successivi non partono', () => {
  const v = creaContatore('t', muto)
  let dopo = false
  assert.throws(() => { v.esigi('cancello', false); dopo = true }, ErroreCollaudo)
  assert.equal(dopo, false)
})
test('attesa fallita non lancia ma chiudi() poi fallisce', () => {
  const v = creaContatore('t', muto)
  assert.equal(v.attesa('rossa', false), false)
  v.attesa('verde', true)
  assert.throws(() => v.chiudi(), ErroreCollaudo)
})
test('chiudi() con ZERO verifiche non è mai verde', () => {
  const v = creaContatore('t', muto)
  assert.throws(() => v.chiudi(), /ZERO verifiche/)
})
test('chiudi() con sole verifiche passate è verde', () => {
  const v = creaContatore('t', muto)
  v.attesa('a', true); v.esigi('b', true)
  v.chiudi()
})

// ---- quiescenza -------------------------------------------------------------
const queryQuiescenza = ({ pregresse, xmin }) => async q =>
  q.includes('pg_stat_activity') ? pregresse : [{ xmin }]

test('quiescenza: transazioni pregresse presenti → timeout con i pid', async () => {
  const r = await attendiQuiescenza(queryQuiescenza({ pregresse: [{ pid: 41 }, { pid: 42 }], xmin: 999 }),
    { taglio: 't', xidTaglio: 10, tentativi: 3, pausaMs: 0, pausa: subito })
  assert.equal(r.esito, 'timeout')
  assert.deepEqual(r.pregresse.map(p => p.pid), [41, 42])
})
test('quiescenza: nessuna pregressa ma orizzonte NON superato → timeout', async () => {
  const r = await attendiQuiescenza(queryQuiescenza({ pregresse: [], xmin: 10 }),
    { taglio: 't', xidTaglio: 10, tentativi: 2, pausaMs: 0, pausa: subito })
  assert.equal(r.esito, 'timeout')
})
test('quiescenza: pulita e orizzonte oltre il taglio → ok', async () => {
  const r = await attendiQuiescenza(queryQuiescenza({ pregresse: [], xmin: 11 }),
    { taglio: 't', xidTaglio: 10, tentativi: 2, pausaMs: 0, pausa: subito })
  assert.equal(r.esito, 'ok')
})
test('quiescenza: si sblocca quando la pregressa conclude', async () => {
  let giri = 0
  const query = async q => q.includes('pg_stat_activity')
    ? (giri++ < 2 ? [{ pid: 7 }] : []) : [{ xmin: 99 }]
  const r = await attendiQuiescenza(query, { taglio: 't', xidTaglio: 10, tentativi: 10, pausaMs: 0, pausa: subito })
  assert.equal(r.esito, 'ok')
})

// ---- falsa presenza di Y ----------------------------------------------------
test('attesaSuTabella: Y assente (o non su quella tabella) → trovato:false', async () => {
  const r = await attesaSuTabella(async () => [], { pid: 123, tabella: 'app_members', funzione: 'conferma_documento', tentativi: 2, pausaMs: 0, pausa: subito })
  assert.equal(r.trovato, false)
  assert.match(r.dettaglio, /123/)
})
test('attesaSuTabella: la query pretende PID, lock NON concesso, tabella e funzione', async () => {
  let vista = ''
  await attesaSuTabella(async q => { vista = q; return [{ pid: 123 }] },
    { pid: 123, tabella: 'app_members', funzione: 'conferma_documento', tentativi: 1, pausaMs: 0, pausa: subito })
  assert.match(vista, /a\.pid = 123/)
  assert.match(vista, /granted = false/)
  assert.match(vista, /'public\.app_members'::regclass/)
  assert.match(vista, /conferma_documento/)
})
test('attesaSuTabella: Y davvero in attesa → trovato:true', async () => {
  const r = await attesaSuTabella(async () => [{ pid: 123 }], { pid: 123, tabella: 'app_members', funzione: 'x', tentativi: 1, pausaMs: 0, pausa: subito })
  assert.equal(r.trovato, true)
})

// ---- concorrenza NON valida (validazione riusata dalla 0022) ---------------
const ramo = (pid, prima, dopo) => ({ pid, prima, dopo })
test('finestre sequenziali (nessuna sovrapposizione) → prova NON valida', () => {
  const r = provaValida(ramo(1, '2026-08-30T10:00:00.000000Z', '2026-08-30T10:00:01.000000Z'),
    ramo(2, '2026-08-30T10:00:02.000000Z', '2026-08-30T10:00:03.000000Z'))
  assert.equal(r.valida, false)
  assert.match(r.motivo, /sequenziale/)
})
test('finestre sovrapposte su backend diversi → prova valida', () => {
  const r = provaValida(ramo(1, '2026-08-30T10:00:00.000000Z', '2026-08-30T10:00:02.000000Z'),
    ramo(2, '2026-08-30T10:00:01.000000Z', '2026-08-30T10:00:03.000000Z'))
  assert.equal(r.valida, true)
})
test('misura mancante (trasporto fallito senza finestre) → prova NON valida', () => {
  const r = provaValida({ trasporto: 'errore' }, ramo(2, '2026-08-30T10:00:00.000000Z', '2026-08-30T10:00:02.000000Z'))
  assert.equal(r.valida, false)
  assert.match(r.motivo, /misure mancanti/)
})
test('stesso backend (pid uguale) → prova NON valida', () => {
  const r = provaValida(ramo(1, '2026-08-30T10:00:00.000000Z', '2026-08-30T10:00:02.000000Z'),
    ramo(1, '2026-08-30T10:00:01.000000Z', '2026-08-30T10:00:03.000000Z'))
  assert.equal(r.valida, false)
  assert.match(r.motivo, /stesso backend/)
})

// ---- fase B: un'unica transazione ------------------------------------------
const bozzaFinta = `-- contratto
create or replace function public.conferma_revisione(p uuid) as $$
begin perform public.conferma_documento(p, '[]'::jsonb); end $$;
create or replace function public.scarta_revisione(p uuid) as $$
begin perform public.scarta_documento(p, 'm'); end $$;
-- 7) PERMESSI
grant execute ...`
const firmeFinte = {
  conferma_documento: 'uuid, jsonb', scarta_documento: 'uuid, text',
  approva_fattura_da_pagare: 'uuid, jsonb', paga_fattura: 'uuid, date, text, jsonb',
  conferma_fattura_pagata: 'uuid, date, text, jsonb',
}
const LEGACY = Object.keys(firmeFinte)

test('costruisciFaseB: UNA sola transazione, barriera, revoche con firme fornite, involucri ripuntati', () => {
  const sql = costruisciFaseB({ bozzaContratto: bozzaFinta, firme: firmeFinte, legacy: LEGACY })
  assert.equal((sql.match(/^begin;/gm) ?? []).length, 1)
  assert.equal((sql.match(/^commit;/gm) ?? []).length, 1)
  assert.ok(sql.indexOf('begin;') < sql.indexOf('lock table'))
  assert.ok(sql.indexOf('lock table') < sql.indexOf('commit;'))
  assert.match(sql, /lock_timeout/)
  assert.match(sql, /access exclusive mode/)
  assert.match(sql, /revoke execute on function public\.paga_fattura\(uuid, date, text, jsonb\) from authenticated/)
  assert.match(sql, /private\.conferma_documento\(/)
  assert.match(sql, /private\.scarta_documento\(/)
  assert.ok(!sql.slice(sql.indexOf('conferma_revisione')).includes('public.conferma_documento('))
})
test('costruisciFaseB: bozza senza la sezione degli involucri → STOP', () => {
  assert.throws(() => costruisciFaseB({ bozzaContratto: 'niente', firme: firmeFinte, legacy: LEGACY }), ErroreCollaudo)
})
test('costruisciFaseB: firma mancante → STOP (mai revoche a metà)', () => {
  const senza = { ...firmeFinte }
  delete senza.paga_fattura
  assert.throws(() => costruisciFaseB({ bozzaContratto: bozzaFinta, firme: senza, legacy: LEGACY }), /paga_fattura/)
})

// ---- fixture: la squadratura è possibile -----------------------------------
test('fixture: totale e importo della riga SEPARATI (5 ≠ 30) con id espliciti', () => {
  const stmts = sqlFixtureDocumento({ docId: 'D', bozzaId: 'B', rigaId: 'R', gruppoId: 'G', totale: 30, importoRiga: 5 })
  assert.equal(stmts.length, 3)
  assert.match(stmts[0], /'D', 'scontrino', 'in_revisione', 30/)
  assert.match(stmts[1], /'B', 'D', 'da_controllare', '2026-08-29', 'G', 0/)
  assert.match(stmts[2], /'R', 'B', 'Voce collaudo', 1, 0, 5\)/)
})
test('fixture: senza importoRiga la riga pareggia il totale', () => {
  const stmts = sqlFixtureDocumento({ docId: 'D', bozzaId: 'B', rigaId: 'R', gruppoId: 'G', totale: 7 })
  assert.match(stmts[2], /, 7\)/)
})

// ---- pulizia: identificativi esatti e recupero dall'interruzione -----------
test('pianoPulizia: prima gli oggetti del contratto (DROP del giornale, mai DELETE), poi figli→genitori sui SOLI docIds', () => {
  const piano = pianoPulizia({ docIds: ['aaa', 'bbb'] })
  const testo = piano.join('\n')
  assert.ok(!/delete from public\.family_revision_ops/.test(testo))
  assert.match(testo, /drop table if exists public\.family_revision_ops/)
  assert.ok(!/like/.test(testo))
  for (const d of piano.filter(s => s.startsWith('delete'))) assert.match(d, /'aaa','bbb'/)
  const posSpese = piano.findIndex(s => s.includes('delete from public.family_expenses '))
  const posPonte = piano.findIndex(s => s.includes('delete from public.family_expense_documents where'))
  const posRighe = piano.findIndex(s => s.includes('delete from public.family_draft_items'))
  const posBozze = piano.findIndex(s => s.includes('delete from public.family_draft_expenses where'))
  const posDocumenti = piano.findIndex(s => s.includes('delete from public.family_documents'))
  assert.ok(posSpese < posPonte && posPonte < posDocumenti)
  assert.ok(posRighe < posBozze && posBozze < posDocumenti)
})
test('pianoPulizia senza docIds: le DELETE sono no-op (id sentinella), niente selezioni per nome', () => {
  const testo = pianoPulizia({ docIds: [] }).join('\n')
  assert.match(testo, /'00000000-0000-0000-0000-000000000000'/)
  assert.ok(!/like/.test(testo))
})
test('eseguiPiano interrotto a metà: si RIPRENDE da dove era arrivato e completa', async () => {
  const piano = pianoPulizia({ docIds: ['aaa'] })
  const eseguite = []
  let arrivataA = -1
  const rompeA = 4
  const fallisce = async stmt => { if (eseguite.length === rompeA) throw new Error('rete caduta'); eseguite.push(stmt) }
  await assert.rejects(
    eseguiPiano(fallisce, piano, i => { arrivataA = i }),
    /rete caduta/)
  assert.equal(arrivataA, rompeA - 1)               // registrato l'ultimo completato
  assert.equal(eseguite.length, rompeA)             // nulla oltre il guasto
  // ripresa: dall'istruzione successiva, come fa il passo 7 col registro
  const daCapo = arrivataA + 1
  await eseguiPiano(async s => { eseguite.push(s) }, piano.slice(daCapo), i => { arrivataA = daCapo + i })
  assert.equal(arrivataA, piano.length - 1)
  assert.deepEqual(eseguite, piano)                 // tutte, una volta, in ordine
})

// ---- fotografie -------------------------------------------------------------
test('confrontaFotografie: identiche → uguali; una differenza → elencata', () => {
  const base = { conteggi: { documenti: 3 }, legacy: [{ nome: 'x', impronta: 'h' }] }
  assert.equal(confrontaFotografie(base, JSON.parse(JSON.stringify(base))).uguali, true)
  const diversa = confrontaFotografie(base, { ...base, conteggi: { documenti: 4 } })
  assert.equal(diversa.uguali, false)
  assert.match(diversa.differenze.join(), /documenti/)
})
