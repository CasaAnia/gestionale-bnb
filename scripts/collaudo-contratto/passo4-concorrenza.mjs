#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 4: CONCORRENZA con sessioni pg dedicate e
// allineamento a un ISTANTE ASSOLUTO (stessa tecnica del passo3b della
// 0022): i due rami partono nello stesso momento, non «in fila».
// Casi: due batch IDENTICI stessa chiave → APPLICATA+RIPETUTA (mai
// SUPERATA: è il ricontrollo del giornale dopo il lock); stessa chiave
// su DOCUMENTI diversi → una registrata, l'altra CHIAVE_RIUSATA col
// ramo PERDENTE byte-per-byte identico allo stato iniziale; Salva e
// Conferma in parallelo → serializzati dal lock di riga.
// ============================================================================
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { comeMembro, contatore, fixtureDocumento, fotografiaDocumento, ownerId } from './ambiente.mjs'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 4 · concorrenza')
const UID = await ownerId()

// due connessioni DIRETTE (il pool della Management API non serializza
// due corpi davvero simultanei)
async function sessione() {
  const p = progetto()
  const cli = new pg.Client({
    host: `db.${p.ref}.supabase.co`, port: 5432, user: 'postgres',
    database: 'postgres', password: p.db_pass, ssl: { rejectUnauthorized: false },
  })
  await cli.connect()
  return cli
}
const A = await sessione(), B = await sessione()

// allineamento: entrambe le sessioni dormono fino allo STESSO istante
// del server, poi eseguono il corpo — differenza di partenza in µs
const allineato = (cli, istante, corpo) => cli.query(
  `begin; ${comeMembro(UID)}
   select pg_sleep(greatest(0, extract(epoch from ('${istante}'::timestamptz - clock_timestamp()))));
   ${corpo}; commit;`)
const prossimoIstante = async () => {
  const [r] = await sql(`select (date_trunc('second', now()) + interval '2 seconds')::text as t`)
  return r.t
}
const salva = (op, doc, rev, modifiche) =>
  `select public.salva_revisione('${op}'::uuid,'${doc}'::uuid,${rev},'${JSON.stringify(modifiche).replaceAll("'", "''")}'::jsonb) as r`
const esiti = ris => ris.map(x => (Array.isArray(x) ? x : [x]).flatMap(y => y.rows ?? []).find(y => y?.r)?.r)

// ---- 1) IDENTICI, stessa chiave e stesso documento ------------------------
{
  const f = await fixtureDocumento(UID)
  const op = randomUUID()
  const b = { bozze: { [f.bozzaId]: { store: 'Concorrente' } }, righe: {}, nuove: [{ client_ref: 'c1', draft_id: f.bozzaId, name: 'Voce', qty: 1, unit_price: null, discount: 0, amount: 1, group_id: null, category_id: null, subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null }] }
  const t = await prossimoIstante()
  const [ra, rb] = esiti(await Promise.all([
    allineato(A, t, salva(op, f.docId, 0, b)),
    allineato(B, t, salva(op, f.docId, 0, b)),
  ]))
  const coppia = [ra?.esito, rb?.esito].sort().join('+')
  v.attesa('identici in parallelo → APPLICATA+RIPETUTA (mai SUPERATA)', coppia === 'APPLICATA+RIPETUTA', coppia)
  v.attesa('stessa mappa nei due rami', JSON.stringify(ra?.righe_nuove) === JSON.stringify(rb?.righe_nuove))
  const [conta] = await sql(`select count(*)::int as n from public.family_draft_items where draft_id='${f.bozzaId}' and name='Voce'`)
  v.attesa('UNA sola voce inserita', conta.n === 1)
}

// ---- 2) stessa chiave su DOCUMENTI diversi --------------------------------
{
  const f = await fixtureDocumento(UID)
  const g = await fixtureDocumento(UID)
  const op = randomUUID()
  const fotoPrimaF = await fotografiaDocumento(f.docId)
  const fotoPrimaG = await fotografiaDocumento(g.docId)
  const t = await prossimoIstante()
  const [ra, rb] = esiti(await Promise.all([
    allineato(A, t, salva(op, f.docId, 0, { bozze: { [f.bozzaId]: { store: 'F' } }, righe: {}, nuove: [] })),
    allineato(B, t, salva(op, g.docId, 0, { bozze: { [g.bozzaId]: { store: 'G' } }, righe: {}, nuove: [] })),
  ]))
  const coppia = [ra?.esito, rb?.esito].sort().join('+')
  v.attesa('chiave riusata su documenti diversi → APPLICATA+CHIAVE_RIUSATA', coppia === 'APPLICATA+CHIAVE_RIUSATA', coppia)
  const vincitoreF = ra?.esito === 'APPLICATA'
  const fotoDopoPerdente = await fotografiaDocumento(vincitoreF ? g.docId : f.docId)
  v.attesa('ramo PERDENTE: documento, bozze, righe, spese e giornale IDENTICI allo stato iniziale',
    fotoDopoPerdente === (vincitoreF ? fotoPrimaG : fotoPrimaF))
  const [reg] = await sql(`select count(*)::int as n from public.family_revision_ops where op_key='${op}'`)
  v.attesa('a giornale UNA sola registrazione per la chiave', reg.n === 1)
}

// ---- 3) Salva e Conferma in parallelo sullo stesso documento --------------
{
  const f = await fixtureDocumento(UID)
  const t = await prossimoIstante()
  const [ra, rb] = esiti(await Promise.all([
    allineato(A, t, salva(randomUUID(), f.docId, 0, { doc_total: 5, bozze: { [f.bozzaId]: { store: 'S' } }, righe: {}, nuove: [] })),
    allineato(B, t, `select public.conferma_revisione('${randomUUID()}'::uuid,'${f.docId}'::uuid,0,'[]'::jsonb) as r`),
  ]))
  const insieme = [ra?.esito, rb?.esito].sort().join('+')
  v.attesa('Salva⇄Conferma serializzati dal lock di riga: uno APPLICATA, l\'altro SUPERATA',
    insieme === 'APPLICATA+SUPERATA', insieme)
}

await A.end(); await B.end()
await v.chiudi()
