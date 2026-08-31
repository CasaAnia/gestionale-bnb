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
  ErroreCollaudo, LEGACY, TABELLE_FOTOGRAFATE, creaContatore, attendiQuiescenza, attesaSuTabella,
  costruisciFaseB, sqlFixtureDocumento, pianoPulizia, eseguiPiano, confrontaFotografie,
  tipiTimestampTesto, validaFotografia, provaNegativaFaseA,
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
const NOMI_LEGACY = Object.keys(firmeFinte)

test('costruisciFaseB: UNA sola transazione, barriera, revoche con firme fornite, involucri ripuntati', () => {
  const sql = costruisciFaseB({ bozzaContratto: bozzaFinta, firme: firmeFinte, legacy: NOMI_LEGACY })
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
  assert.throws(() => costruisciFaseB({ bozzaContratto: 'niente', firme: firmeFinte, legacy: NOMI_LEGACY }), ErroreCollaudo)
})
test('costruisciFaseB: firma mancante → STOP (mai revoche a metà)', () => {
  const senza = { ...firmeFinte }
  delete senza.paga_fattura
  assert.throws(() => costruisciFaseB({ bozzaContratto: bozzaFinta, firme: senza, legacy: NOMI_LEGACY }), /paga_fattura/)
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

// ---- pulizia: FK della 0020 e trigger della 0021 rispettati -----------------
// SIMULATORE dello schema (non un esecutore che registra e basta): un
// documento con status CONFERMATO, spesa, ponte, righe definitive e
// correzioni. Vengono FATTI RISPETTARE sia le FK ON DELETE RESTRICT
// (spesa referenziata da ponte o bozza, documento referenziato dal
// ponte) sia il trigger della 0021 private.blocca_spese_documentate:
// DELETE su family_expenses o family_expense_items è respinto finché il
// ponte collega la spesa a un documento con status 'confermato' (vale
// anche per postgres: l'eccezione dipende dal claim service_role, e il
// collaudo NON disabilita protezioni).
function baseConfermata() {
  return {
    documents: [{ id: 'doc1', status: 'confermato' }, { id: 'doc-altrui', status: 'confermato' }],
    drafts: [
      { id: 'bz1', document_id: 'doc1', expense_id: 'sp1' },
      { id: 'bz-altrui', document_id: 'doc-altrui', expense_id: 'sp-altrui' },
    ],
    items: [{ id: 'r1', draft_id: 'bz1' }, { id: 'r-altrui', draft_id: 'bz-altrui' }],
    expenses: [{ id: 'sp1' }, { id: 'sp-altrui' }],
    ponte: [
      { id: 'p1', expense_id: 'sp1', document_id: 'doc1' },
      { id: 'p-altrui', expense_id: 'sp-altrui', document_id: 'doc-altrui' },
    ],
    voci: [{ id: 'v1', expense_id: 'sp1' }, { id: 'v-altrui', expense_id: 'sp-altrui' }],
    correzioni: [{ id: 'c1', document_id: 'doc1', expense_id: 'sp1', draft_id: 'bz1' }],
    oggetti: new Set(['salva_revisione', 'esito_revisione', 'conferma_revisione', 'scarta_revisione',
      'impronta_canonica', 'canonico', 'family_revision_ops', 'proteggi_giornale_revisione', 'revisione_rev']),
  }
}
function esecutore0020(db) {
  // trigger 0021: la spesa è «documentata» se il ponte la collega a un
  // documento con status confermato
  const documentata = expenseId => db.ponte.some(pp => pp.expense_id === expenseId
    && db.documents.some(d => d.id === pp.document_id && d.status === 'confermato'))
  return async stmt => {
    const ids = [...stmt.matchAll(/'([^']+)'/g)].map(m => m[1])
    const bozzeDei = docs => db.drafts.filter(b => docs.includes(b.document_id)).map(b => b.id)
    if (stmt.startsWith('drop function') || stmt.startsWith('drop table')) {
      for (const o of [...db.oggetti]) if (stmt.includes(o)) db.oggetti.delete(o)
      return []
    }
    if (stmt.startsWith('alter table')) { db.oggetti.delete('revisione_rev'); return [] }
    if (stmt.includes('delete from public.family_corrections')) {
      const bozze = bozzeDei(ids)
      db.correzioni = db.correzioni.filter(c =>
        !(ids.includes(c.document_id) || ids.includes(c.expense_id) || bozze.includes(c.draft_id)))
      return []
    }
    if (stmt.includes('delete from public.family_expense_items')) {
      for (const vv of db.voci.filter(x => ids.includes(x.expense_id))) {
        if (documentata(vv.expense_id))
          throw new Error(`TRIGGER 0021: riga definitiva ${vv.id} di una spesa collegata a un documento confermato`)
      }
      db.voci = db.voci.filter(vv => !ids.includes(vv.expense_id)); return []
    }
    if (stmt.includes('delete from public.family_draft_items')) {
      const bozze = bozzeDei(ids)
      db.items = db.items.filter(r => !bozze.includes(r.draft_id)); return []
    }
    if (stmt.includes('delete from public.family_expense_documents')) {
      db.ponte = db.ponte.filter(pp => !ids.includes(pp.document_id)); return []
    }
    if (stmt.includes('delete from public.family_draft_expenses')) {
      db.drafts = db.drafts.filter(b => !ids.includes(b.document_id)); return []
    }
    if (stmt.includes('delete from public.family_expenses ')) {
      for (const sp of db.expenses.filter(x => ids.includes(x.id))) {
        if (documentata(sp.id))
          throw new Error(`TRIGGER 0021: spesa ${sp.id} collegata a un documento confermato`)
        if (db.ponte.some(pp => pp.expense_id === sp.id))
          throw new Error(`FK RESTRICT: family_expense_documents.expense_id referenzia ancora ${sp.id}`)
        if (db.drafts.some(b => b.expense_id === sp.id))
          throw new Error(`FK RESTRICT: family_draft_expenses.expense_id referenzia ancora ${sp.id}`)
      }
      db.voci = db.voci.filter(vv => !ids.includes(vv.expense_id)) // 0012: cascade
      db.expenses = db.expenses.filter(x => !ids.includes(x.id)); return []
    }
    if (stmt.includes('delete from public.family_documents')) {
      for (const d of db.documents.filter(x => ids.includes(x.id))) {
        if (db.ponte.some(pp => pp.document_id === d.id))
          throw new Error(`FK RESTRICT: family_expense_documents.document_id referenzia ancora ${d.id}`)
      }
      db.documents = db.documents.filter(x => !ids.includes(x.id)); return []
    }
    throw new Error(`istruzione non riconosciuta dal simulatore: ${stmt}`)
  }
}

test('pulizia con documento CONFERMATO: il piano passa le FK RESTRICT e rimuove solo il registrato', async () => {
  const db = baseConfermata()
  const piano = pianoPulizia({ docIds: ['doc1'], expenseIds: ['sp1'] })
  await eseguiPiano(esecutore0020(db), piano)
  assert.deepEqual(db.documents.map(d => d.id), ['doc-altrui'])
  assert.deepEqual(db.expenses.map(x => x.id), ['sp-altrui'])
  assert.deepEqual(db.drafts.map(b => b.id), ['bz-altrui'])
  assert.deepEqual(db.items.map(r => r.id), ['r-altrui'])
  assert.deepEqual(db.ponte.map(pp => pp.id), ['p-altrui'])
  assert.deepEqual(db.voci.map(vv => vv.id), ['v-altrui'])
  assert.equal(db.correzioni.length, 0)
  assert.equal(db.oggetti.size, 0, 'anche la funzione del trigger e la colonna vanno via')
})
test("CONTROPROVA: eliminare le spese PRIMA dei riferimenti viene respinto (trigger 0021, poi FK)", async () => {
  const db = baseConfermata()
  const piano = pianoPulizia({ docIds: ['doc1'], expenseIds: ['sp1'] })
  const spese = piano.find(x => x.includes('delete from public.family_expenses '))
  await assert.rejects(esecutore0020(db)(spese), /TRIGGER 0021/)
  db.documents[0].status = 'in_revisione'   // senza la 0021 resta comunque la FK
  await assert.rejects(esecutore0020(db)(spese), /FK RESTRICT/)
})
test('CONTROPROVA 0021: righe definitive PRIMA del ponte → respinte dal trigger; dopo il ponte passano', async () => {
  const db = baseConfermata()
  const piano = pianoPulizia({ docIds: ['doc1'], expenseIds: ['sp1'] })
  const righe = piano.find(x => x.includes('delete from public.family_expense_items'))
  const ponte = piano.find(x => x.includes('delete from public.family_expense_documents'))
  await assert.rejects(esecutore0020(db)(righe), /TRIGGER 0021/)
  assert.ok(piano.indexOf(ponte) < piano.indexOf(righe), 'il piano toglie il ponte PRIMA delle righe definitive')
  await esecutore0020(db)(ponte)
  await esecutore0020(db)(righe)
  assert.deepEqual(db.voci.map(vv => vv.id), ['v-altrui'])
})
test('pianoPulizia: id ESATTI (mai nomi), DROP del giornale e della funzione del trigger', () => {
  const piano = pianoPulizia({ docIds: ['aaa'], expenseIds: ['sss'] })
  const testo = piano.join('\n')
  assert.ok(!/delete from public\.family_revision_ops/.test(testo))
  assert.match(testo, /drop table if exists public\.family_revision_ops/)
  assert.match(testo, /drop function if exists private\.proteggi_giornale_revisione\(\)/)
  assert.ok(!/like/.test(testo))
  assert.match(testo, /delete from public\.family_expenses where id in \('sss'\)/)
  for (const d of piano.filter(x => x.startsWith('delete'))) assert.match(d, /'aaa'|'sss'/)
})
test('pianoPulizia senza id: le DELETE sono no-op (sentinella), niente selezioni per nome', () => {
  const testo = pianoPulizia({ docIds: [], expenseIds: [] }).join('\n')
  assert.match(testo, /'00000000-0000-0000-0000-000000000000'/)
  assert.ok(!/like/.test(testo))
})
test('eseguiPiano interrotto a metà: si RIPRENDE da dove era arrivato e completa', async () => {
  const piano = pianoPulizia({ docIds: ['aaa'], expenseIds: ['sss'] })
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
  await eseguiPiano(async x => { eseguite.push(x) }, piano.slice(daCapo), i => { arrivataA = daCapo + i })
  assert.equal(arrivataA, piano.length - 1)
  assert.deepEqual(eseguite, piano)                 // tutte, una volta, in ordine
})
test('anche la RIPRESA rispetta le FK: interruzione a metà, poi il simulatore completa', async () => {
  const db = baseConfermata()
  const piano = pianoPulizia({ docIds: ['doc1'], expenseIds: ['sp1'] })
  const vero = esecutore0020(db)
  let arrivataA = -1, contate = 0
  const rompeA = 10
  const acaduta = async stmt => { if (contate++ === rompeA) throw new Error('interrotta'); return vero(stmt) }
  await assert.rejects(eseguiPiano(acaduta, piano, i => { arrivataA = i }), /interrotta/)
  await eseguiPiano(vero, piano.slice(arrivataA + 1))
  assert.deepEqual(db.documents.map(d => d.id), ['doc-altrui'])
  assert.equal(db.oggetti.size, 0)
})

// ---- prove negative della guardia di fase A --------------------------------
const bozzaFaseAFinta = `-- intestazione (non applicare)
begin;
create table if not exists private.transizione_backup (nome text);
do $do$ begin raise exception 'FASE_A_STOP: prova'; end $do$;
commit;
-- runbook in coda`
test('provaNegativaFaseA: transazione del COLLAUDO — un solo begin, NESSUN commit, rollback finale', () => {
  const sql = provaNegativaFaseA({ bozza: bozzaFaseAFinta, sonda: `create function sonda();` })
  assert.ok(!sql.includes('commit;'), 'il commit della bozza deve sparire: concluderebbe anche la sonda')
  assert.equal((sql.match(/begin;/g) ?? []).length, 1)
  assert.match(sql.trim(), /rollback;$/)
  assert.ok(sql.indexOf('begin;') < sql.indexOf('create function sonda();'))
  assert.ok(sql.indexOf('create function sonda();') < sql.indexOf('transizione_backup'))
  assert.match(sql, /FASE_A_STOP: prova/)
})
test('provaNegativaFaseA: anche se la guardia ACCETTASSE per errore, il rollback è già nel testo', () => {
  // bozza che NON respinge la sonda (guardia sbagliata simulata): il
  // testo generato termina comunque con rollback, mai con commit
  const permissiva = `begin;\ncreate table if not exists private.transizione_backup (nome text);\ncommit;`
  const sql = provaNegativaFaseA({ bozza: permissiva, sonda: `create function sonda();` })
  assert.ok(!sql.includes('commit;'))
  assert.match(sql.trim(), /rollback;$/)
})
test('provaNegativaFaseA: bozza senza begin/commit o con commit INTERNO → STOP', () => {
  assert.throws(() => provaNegativaFaseA({ bozza: 'niente', sonda: 'x' }), ErroreCollaudo)
  assert.throws(() => provaNegativaFaseA({ bozza: 'begin;\na;\ncommit;\nb;\ncommit;', sonda: 'x' }), /interno/)
})

// ---- parser dei timestamp (punto perso dal driver pg) ----------------------
test('tipiTimestampTesto: timestamp/timestamptz restano TESTO, il resto delega al driver', () => {
  const deleghe = []
  const finto = { getTypeParser: (oid, f) => { deleghe.push([oid, f]); return x => `delegato:${x}` } }
  const t = tipiTimestampTesto(finto)
  const grezzo = '2026-08-31 10:00:00.123456+00'
  assert.equal(t.getTypeParser(1184, 'text')(grezzo), grezzo)
  assert.equal(t.getTypeParser(1114, 'text')(grezzo), grezzo)
  assert.equal(t.getTypeParser(23, 'text')('7'), 'delegato:7')
  assert.deepEqual(deleghe, [[23, 'text']])
})
test('conversione intera: col TESTO la sovrapposizione al microsecondo regge, con le Date del driver si perderebbe', () => {
  // finestre sovrapposte DENTRO lo stesso millisecondo: solo i
  // microsecondi le distinguono
  const a = { pid: 1, prima: '2026-08-31 10:00:00.100100+00', dopo: '2026-08-31 10:00:00.100500+00' }
  const b = { pid: 2, prima: '2026-08-31 10:00:00.100200+00', dopo: '2026-08-31 10:00:00.100900+00' }
  assert.equal(provaValida(a, b).valida, true)
  // ciò che farebbe il driver senza il parser: Date al millisecondo
  const data = ts => new Date(ts.replace(' ', 'T').replace('+00', 'Z'))
  const rotto = provaValida(
    { pid: 1, prima: data(a.prima), dopo: data(a.dopo) },
    { pid: 2, prima: data(b.prima), dopo: data(b.dopo) })
  assert.equal(rotto.valida, false)
})

// ---- validazione della fotografia ------------------------------------------
const fotoCompleta = () => ({
  conteggi: Object.fromEntries(TABELLE_FOTOGRAFATE.map(t => [t, 0])),
  impronte: Object.fromEntries(TABELLE_FOTOGRAFATE.map(t => [t, 'vuota'])),
  legacy: LEGACY.map(n => ({ nome: n, impronta: 'h', firma: 'p_document_id uuid', tipi: 'uuid' })),
  permessi: [{ table_name: 'family_documents', column_name: 'doc_total', privilege_type: 'UPDATE' }],
  esecuzioni: [{ routine_schema: 'public', routine_name: 'conferma_documento', grantee: 'authenticated' }],
})
test('validaFotografia: quella completa passa, {} e null NO (prima dei DROP, non al confronto finale)', () => {
  validaFotografia(fotoCompleta())
  assert.throws(() => validaFotografia({}), ErroreCollaudo)
  assert.throws(() => validaFotografia(null), ErroreCollaudo)
})
test('validaFotografia: impronta di una tabella mancante → rifiutata', () => {
  const f = fotoCompleta(); delete f.impronte.family_expenses
  assert.throws(() => validaFotografia(f), /family_expenses/)
})
test('validaFotografia: legacy non cinque o incompleta → rifiutata', () => {
  const quattro = fotoCompleta(); quattro.legacy.pop()
  assert.throws(() => validaFotografia(quattro), /cinque/)
  const monca = fotoCompleta(); delete monca.legacy[0].tipi
  assert.throws(() => validaFotografia(monca), ErroreCollaudo)
})
test('validaFotografia: permessi a CONTEGGI (senza colonna) o EXECUTE assenti → rifiutati', () => {
  const conteggi = fotoCompleta()
  conteggi.permessi = [{ table_name: 'family_documents', privilege_type: 'UPDATE', colonne: 12 }]
  assert.throws(() => validaFotografia(conteggi), /identità esatta/)
  const senzaExec = fotoCompleta(); delete senzaExec.esecuzioni
  assert.throws(() => validaFotografia(senzaExec), /EXECUTE/)
})

// ---- fotografie -------------------------------------------------------------
test('confrontaFotografie: identiche → uguali; una differenza → elencata', () => {
  const base = { conteggi: { documenti: 3 }, legacy: [{ nome: 'x', impronta: 'h' }] }
  assert.equal(confrontaFotografie(base, JSON.parse(JSON.stringify(base))).uguali, true)
  const diversa = confrontaFotografie(base, { ...base, conteggi: { documenti: 4 } })
  assert.equal(diversa.uguali, false)
  assert.match(diversa.differenze.join(), /documenti/)
})
