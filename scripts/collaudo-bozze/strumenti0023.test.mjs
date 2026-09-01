// Test LOCALI degli strumenti del collaudo 0023: nessuna rete, nessun
// database. Devono essere VERDI prima di toccare il progetto di prova.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  BOZZA_0023, FUNZIONE_0023, corpoRpc0023, pianoPulizia0023, problemiBozza,
  problemiStruttura, sqlFixture0023, validaFotografia0023, verificaAutorizzazione,
} from './strumenti0023.mjs'

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('cancello: senza COLLAUDO_0023_AUTORIZZATO=1 ogni passo si rifiuta', () => {
  assert.throws(() => verificaAutorizzazione({}), /NON autorizzato/)
  assert.equal(verificaAutorizzazione({ COLLAUDO_0023_AUTORIZZATO: '1' }), true)
})

test('la bozza 0023 nel repository rispetta ANCORA i vincoli della revisione R6', () => {
  const testo = readFileSync(resolve(RADICE, BOZZA_0023), 'utf8')
  assert.deepEqual(problemiBozza(testo), [])
})

test('problemiBozza: una bozza scivolata via dai vincoli viene fermata in locale', () => {
  const rotta = 'create function x() as $$ begin end $$; grant execute to service_role;'
  const problemi = problemiBozza(rotta)
  assert.ok(problemi.some(p => /for update/.test(p)))
  assert.ok(problemi.some(p => /stati elaborabili/.test(p)))
  assert.ok(problemiBozza('... p_stati_ammessi ...').some(p => /p_stati_ammessi/.test(p)))
})

test('problemiStruttura: giudizio giusto su cataloghi buoni e guasti', () => {
  const buona = {
    funzioni: [{ nome: FUNZIONE_0023, tipi: 'uuid, jsonb, text', secdef: true, config: 'search_path=""' }],
    esecuzioni: [{ routine_name: FUNZIONE_0023, grantee: 'service_role' }],
  }
  assert.deepEqual(problemiStruttura(buona), [])
  assert.match(problemiStruttura({ funzioni: [], esecuzioni: [] })[0], /trovate 0/)
  const anonConGrant = {
    ...buona,
    esecuzioni: [...buona.esecuzioni, { routine_name: FUNZIONE_0023, grantee: 'anon' }],
  }
  assert.ok(problemiStruttura(anonConGrant).some(p => /anon/.test(p)))
  const firmaSbagliata = { ...buona, funzioni: [{ ...buona.funzioni[0], tipi: 'uuid, text[], jsonb, text' }] }
  assert.ok(problemiStruttura(firmaSbagliata).some(p => /firma inattesa/.test(p)))
})

test('corpoRpc0023: come lo strumento reale — righe dentro le bozze, MAI p_stati_ammessi', () => {
  const pacchetto = {
    documento: { doc_total: 12.5 },
    bozze: [{ rif: 'sorella-1', group_id: 'g1', confidence: null }, { rif: 'sorella-2', group_id: 'g2', confidence: null }],
    righe: [
      { bozzaRif: 'sorella-1', name: 'A', amount: 1, confidence: null },
      { bozzaRif: 'sorella-2', name: 'B', amount: 2, confidence: null },
      { bozzaRif: 'sorella-1', name: 'C', amount: 3, confidence: null },
    ],
  }
  const corpo = corpoRpc0023('d1', { statiAmmessi: ['da_elaborare'], pacchetto })
  assert.ok(!('p_stati_ammessi' in corpo))
  assert.equal(corpo.p_errore, null)
  assert.equal(corpo.p_pacchetto.doc_total, 12.5)
  assert.deepEqual(corpo.p_pacchetto.bozze.map(b => b.righe.length), [2, 1])
  assert.ok(corpo.p_pacchetto.bozze.every(b => !('rif' in b) && b.righe.every(r => !('bozzaRif' in r))))
  const errore = corpoRpc0023('d1', { statiAmmessi: ['da_elaborare'], errore: 'motivo' })
  assert.deepEqual(errore, { p_document_id: 'd1', p_pacchetto: null, p_errore: 'motivo' })
})

test('fixture e pulizia: id esatti, ordine FK, funzione eliminata per ultima, sentinella con registro vuoto', () => {
  const conBozza = sqlFixture0023({ docId: 'D', stato: 'errore', gruppoId: 'G', bozzaId: 'B', rigaId: 'R' })
  assert.equal(conBozza.length, 3)
  assert.match(conBozza[0], /family_documents/)
  const senza = sqlFixture0023({ docId: 'D', stato: 'da_elaborare', gruppoId: 'G' })
  assert.equal(senza.length, 1)
  const piano = pianoPulizia0023({ docIds: ['D1', 'D2'] })
  assert.match(piano[0], /family_draft_items/)
  assert.match(piano[1], /family_draft_expenses/)
  assert.match(piano[2], /family_documents.*'D1','D2'/s)
  assert.match(piano[3], new RegExp(`drop function if exists public\\.${FUNZIONE_0023}`))
  assert.match(pianoPulizia0023({ docIds: [] })[2], /00000000-0000/)
})

test('validaFotografia0023: base completa sì, monca no', () => {
  const base = { conteggi: { a: 1 }, impronte: { a: 'x' }, legacy: [], permessi: [{}], esecuzioni: [{}] }
  assert.equal(validaFotografia0023(base), true)
  assert.equal(validaFotografia0023({ ...base, permessi: [] }), false)
  assert.equal(validaFotografia0023(null), false)
})
