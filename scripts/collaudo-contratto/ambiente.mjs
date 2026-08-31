// ============================================================================
// Collaudo del CONTRATTO DI REVISIONE — helpers d'orchestrazione (la
// logica decidibile vive in strumenti.mjs, testata in locale).
// PREPARAZIONE: nessun passo va eseguito senza l'autorizzazione al
// collaudo isolato (PIANO-COLLAUDO-CONTRATTO.md).
// ============================================================================
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { sql } from '../fase2b/api.mjs'
import { ErroreCollaudo, sqlFixtureDocumento } from './strumenti.mjs'

const QUI = dirname(fileURLToPath(import.meta.url))
export const RADICE = join(QUI, '..', '..')
export const LEGACY = ['conferma_documento', 'scarta_documento', 'approva_fattura_da_pagare', 'paga_fattura', 'conferma_fattura_pagata']

export const sha256 = t => createHash('sha256').update(t, 'utf8').digest('hex')

export function vettoriComuni() {
  const testo = readFileSync(join(RADICE, 'lib/spese/contrattoVettori.ts'), 'utf8')
  return JSON.parse(testo.slice(testo.indexOf('[')))
}
export const bozzaSql = nome => readFileSync(join(RADICE, 'proposte', nome), 'utf8')

export async function ownerId() {
  const r = await sql(`select user_id from public.app_members where role='owner' limit 1`)
  if (!r[0]?.user_id) throw new ErroreCollaudo('nessun owner in app_members (fixture della 2B mancanti)')
  return r[0].user_id
}
export const comeMembro = uid => `select set_config('request.jwt.claims',
    json_build_object('sub','${uid}','role','authenticated')::text, true);
  set local role authenticated;`

// gruppo ESPLICITO dell'ambito richiesto (mai «il primo che capita»)
export async function gruppoPersonale() {
  const r = await sql(`select id from public.family_groups
    where coalesce(ambito, 'personale') = 'personale' order by name limit 1`)
  if (!r[0]?.id) throw new ErroreCollaudo('nessun gruppo personale nelle fixture')
  return r[0].id
}

// fixture: gli id nascono QUI e finiscono nel REGISTRO prima degli
// INSERT; importoRiga è separato dal totale (prove di quadratura)
export async function fixtureDocumento(registro, { totale = 5, importoRiga = totale, stato = 'in_revisione' } = {}) {
  const ids = { docId: randomUUID(), bozzaId: randomUUID(), rigaId: randomUUID() }
  registro.documento(ids.docId)                        // PRIMA degli effetti
  const gruppoId = await gruppoPersonale()
  for (const stmt of sqlFixtureDocumento({ ...ids, gruppoId, totale, importoRiga, stato })) await sql(stmt)
  return ids
}

// fotografia di UN documento (per l'atomicità e i rami perdenti)
export async function fotografiaDocumento(docId) {
  const [r] = await sql(`select jsonb_build_object(
    'doc', (select to_jsonb(d) from public.family_documents d where id='${docId}'),
    'bozze', (select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.family_draft_expenses b where document_id='${docId}'),
    'righe', (select coalesce(jsonb_agg(to_jsonb(i) order by i.id),'[]') from public.family_draft_items i
              where i.draft_id in (select id from public.family_draft_expenses where document_id='${docId}')),
    'spese', (select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.family_expenses s
              where s.id in (select expense_id from public.family_expense_documents where document_id='${docId}')),
    'giornale', (select coalesce(jsonb_agg(to_jsonb(g) order by g.op_key),'[]')
                 from public.family_revision_ops g where document_id='${docId}')
  ) as foto`)
  return JSON.stringify(r.foto)
}

// fotografia di BASE del progetto (obbligatoria all'inizio, confrontata
// alla fine): conteggi, definizioni legacy, permessi per colonna/funzione
export async function fotografiaBase() {
  const [conteggi] = await sql(`select
    (select count(*)::int from public.family_documents) as documenti,
    (select count(*)::int from public.family_draft_expenses) as bozze,
    (select count(*)::int from public.family_draft_items) as righe,
    (select count(*)::int from public.family_expenses) as spese,
    (select count(*)::int from public.family_expense_documents) as ponte`)
  const legacy = await sql(`select p.proname as nome, md5(pg_get_functiondef(p.oid)) as impronta,
      pg_get_function_identity_arguments(p.oid) as firma
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})
    order by p.proname`)
  const permessi = await sql(`select table_name, privilege_type, count(*)::int as colonne
    from information_schema.column_privileges
    where grantee='authenticated' and table_schema='public'
      and table_name in ('family_documents','family_draft_expenses','family_draft_items')
    group by 1, 2 order by 1, 2`)
  return { conteggi, legacy, permessi }
}
