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
import pg from 'pg'
import { sql } from '../fase2b/api.mjs'
import { ErroreCollaudo, LEGACY, TABELLE_FOTOGRAFATE, sqlFixtureDocumento } from './strumenti.mjs'

const QUI = dirname(fileURLToPath(import.meta.url))
export const RADICE = join(QUI, '..', '..')
export { LEGACY }

export const sha256 = t => createHash('sha256').update(t, 'utf8').digest('hex')

export function vettoriComuni() {
  const testo = readFileSync(join(RADICE, 'lib/spese/contrattoVettori.ts'), 'utf8')
  // l'array JSON comincia dopo «= [»: la prima «[» del file sta
  // nell'annotazione di tipo (}[] =), non nei dati
  const da = testo.indexOf('= [')
  if (da < 0) throw new ErroreCollaudo('contrattoVettori.ts senza l\'array «= [» dei vettori')
  const vettori = JSON.parse(testo.slice(da + 2))
  if (!Array.isArray(vettori) || vettori.length < 8)
    throw new ErroreCollaudo(`vettori comuni inattesi: ${Array.isArray(vettori) ? vettori.length : 'non un array'}`)
  return vettori
}
export const bozzaSql = nome => readFileSync(join(RADICE, 'proposte', nome), 'utf8')

export async function ownerId() {
  const r = await sql(`select user_id from public.app_members where role='owner' limit 1`)
  if (!r[0]?.user_id) throw new ErroreCollaudo('nessun owner in app_members (fixture della 2B mancanti)')
  return r[0].user_id
}
// sessione pg DEDICATA (i passi 4/5 hanno bisogno di UN backend per
// connessione: pid stabile, lock che restano). L'host diretto db.<ref>
// può non esistere in DNS: stessi candidati del pool di api.mjs, ma
// SOLO in session mode (porta 5432) — mai il transaction pooler 6543,
// che non garantisce lo stesso backend fra una query e l'altra.
export async function connessionePg(p, opzioni = {}) {
  const candidati = [
    { host: `db.${p.ref}.supabase.co`, port: 5432, user: 'postgres' },
    { host: 'aws-1-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${p.ref}` },
    { host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${p.ref}` },
  ]
  let ultimo
  for (const c of candidati) {
    const cli = new pg.Client({ ...c, database: 'postgres', password: p.db_pass,
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000, ...opzioni })
    try { await cli.connect(); return cli } catch (e) { ultimo = e; await cli.end().catch(() => {}) }
  }
  throw new ErroreCollaudo(`nessun host pg raggiungibile in session mode: ${String(ultimo?.message ?? ultimo)}`)
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

// fotografia di BASE del progetto (obbligatoria all'inizio, VALIDATA
// da validaFotografia e confrontata alla fine): conteggi E IMPRONTE
// dei dati per tabella (un valore cambiato si vede, non solo una riga
// in più o in meno), definizioni legacy con i TIPI dal catalogo,
// privilegi per colonna con identità ESATTA (tabella, colonna,
// privilegio — mai un conteggio) e privilegi EXECUTE per ruolo
export async function fotografiaBase() {
  const [conteggi] = await sql(`select ${TABELLE_FOTOGRAFATE.map(t =>
    `(select count(*)::int from public.${t}) as ${t}`).join(', ')}`)
  const [impronte] = await sql(`select ${TABELLE_FOTOGRAFATE.map(t =>
    `(select coalesce(md5(string_agg(md5(t::text), '' order by t.id)), 'vuota') from public.${t} t) as ${t}`).join(', ')}`)
  const legacy = await sql(`select p.proname as nome, md5(pg_get_functiondef(p.oid)) as impronta,
      pg_get_function_identity_arguments(p.oid) as firma, oidvectortypes(p.proargtypes) as tipi
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})
    order by p.proname`)
  const permessi = await sql(`select table_name, column_name, privilege_type
    from information_schema.column_privileges
    where grantee='authenticated' and table_schema='public'
      and table_name in ('family_documents','family_draft_expenses','family_draft_items')
    order by 1, 2, 3`)
  const esecuzioni = await sql(`select routine_schema, routine_name, grantee
    from information_schema.routine_privileges
    where privilege_type='EXECUTE' and routine_schema in ('public','private')
      and grantee in ('authenticated','anon','service_role')
    order by 1, 2, 3`)
  return { conteggi, impronte, legacy, permessi, esecuzioni }
}
