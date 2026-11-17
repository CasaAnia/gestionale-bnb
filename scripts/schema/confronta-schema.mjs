#!/usr/bin/env node
// SCHEMA DEL REPO CONTRO SCHEMA VERO (17/11/2026). Solo letture.
//
// 1. su un PostgreSQL di COLLAUDO (mai produzione) crea un database vuoto e ci applica gli stub di
//    Supabase (ruoli, auth, storage) e TUTTE le migrazioni di supabase/migrations, nell'ordine;
// 2. legge colonne, tipi e funzioni di quel database;
// 3. le confronta con la descrizione delle tabelle di produzione (il documento OpenAPI di PostgREST,
//    scaricato con una GET e salvato in un file JSON);
// 4. stampa le differenze e esce con 1 se ce ne sono.
//
// Limite dichiarato: la descrizione di PostgREST dice tabelle, colonne, tipi, «obbligatoria» (NOT NULL), chiavi primarie ed esterne e le funzioni chiamabili (RPC). NON dice vincoli CHECK, indici,
// policy RLS, trigger né il corpo delle funzioni: per quelli serve un'estrazione del catalogo
// (supabase/strumenti/leggi-catalogo.sql, da lanciare nell'editor SQL: sono solo SELECT).
//
// Uso: DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres node scripts/schema/confronta-schema.mjs <openapi.json> [--catalogo catalogo-produzione.json] [--salva-catalogo-locale uscita.json]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const [, , percorsoOpenApi, ...flag] = process.argv
const dopo = nome => { const i = flag.indexOf(nome); return i >= 0 ? flag[i + 1] : null }
const percorsoCatalogo = dopo('--catalogo'), salvaCatalogo = dopo('--salva-catalogo-locale')
const url = process.env.DATABASE_URL
if (!url || !percorsoOpenApi) { console.log('Uso: DATABASE_URL=… node scripts/schema/confronta-schema.mjs <openapi.json>'); process.exit(2) }
const radice = new URL('../../supabase/', import.meta.url)

const STUB = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean not null default false, created_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, created_at timestamptz default now(), metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
insert into storage.buckets (id, name, public) values ('scontrini', 'scontrini', false), ('documenti', 'documenti', false) on conflict do nothing;
insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-000000000000', 'collaudo@locale') on conflict do nothing;
`

const base = new pg.Client({ connectionString: url })
await base.connect()
await base.query('drop database if exists collaudo_schema')
await base.query('create database collaudo_schema')
await base.end()
const db = new pg.Client({ connectionString: url.replace(/\/[^/]*$/, '/collaudo_schema') })
await db.connect()
const esiti = []
async function esegui(nome, sql) {
  try { await db.query('begin'); await db.query(sql); await db.query('commit'); esiti.push(['OK', nome]); return true }
  catch (e) { await db.query('rollback'); esiti.push(['ERRORE', nome, e.message.split('\n')[0]]); return false }
}
await esegui('stub Supabase', STUB)
const migrazioni = readdirSync(new URL('migrations/', radice)).filter(f => f.endsWith('.sql')).sort()
for (const f of migrazioni) {
  let sql = readFileSync(new URL(`migrations/${f}`, radice), 'utf8')
  // pg_cron e pg_net esistono solo su Supabase: la parte che programma il controllo ogni 5 minuti non si prova qui
  if (f.startsWith('0040_')) sql = sql.split('create extension if not exists pg_cron')[0]
  await esegui(f, sql)
  if (f.startsWith('0020_')) await esegui('bootstrap_owner.sql', readFileSync(new URL('bootstrap_owner.sql', radice), 'utf8'))
}
const errori = esiti.filter(e => e[0] === 'ERRORE')
console.log(`Migrazioni applicate: ${migrazioni.length}; errori: ${errori.length}`)
for (const e of errori) console.log(`  ERRORE ${e[1]} — ${e[2]}`)

// ---- lo schema del database di collaudo ----
const col = (await db.query(`
  select table_name, column_name, data_type, udt_name, is_nullable, column_default
  from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`)).rows
const viste = new Set((await db.query(`select table_name from information_schema.views where table_schema = 'public'`)).rows.map(r => r.table_name))
const funzioni = (await db.query(`
  select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prorettype::regtype::text as ritorno
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- non quelle delle estensioni (btree_gist)
  order by 1`)).rows
const catalogoLocale = (await db.query(readFileSync(new URL('strumenti/leggi-catalogo.sql', radice), 'utf8'))).rows[0].catalogo
await db.end()
if (salvaCatalogo) writeFileSync(salvaCatalogo, JSON.stringify(catalogoLocale, null, 1))
const locale = new Map()
for (const c of col) {
  if (viste.has(c.table_name)) continue
  if (!locale.has(c.table_name)) locale.set(c.table_name, new Map())
  locale.get(c.table_name).set(c.column_name, c)
}

// ---- lo schema di produzione (OpenAPI di PostgREST) ----
const api = JSON.parse(readFileSync(percorsoOpenApi, 'utf8'))
const prod = new Map(Object.entries(api.definitions).map(([t, d]) => [t, d]))
const rpcProd = new Set(Object.keys(api.paths).filter(p => p.startsWith('/rpc/')).map(p => p.slice(5)))
// i tipi di PostgREST (format) contro quelli di PostgreSQL
const TIPO = { 'timestamp with time zone': 'timestamptz', 'timestamp without time zone': 'timestamp', 'character varying': 'varchar', 'double precision': 'float8', 'integer': 'int4', 'bigint': 'int8', 'smallint': 'int2', 'real': 'float4', 'boolean': 'bool', 'character': 'bpchar', 'time without time zone': 'time', 'time with time zone': 'timetz' }
const norm = t => { t = String(t).replace(/\[\]$/, '[]'); const m = t.match(/^(.*?)(\(.*\))?(\[\])?$/); return (TIPO[m[1]] ?? m[1]) + (m[3] ?? '') }
const tipoLocale = c => c.data_type === 'ARRAY' ? c.udt_name.replace(/^_/, '') + '[]' : norm(c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type)

const diff = { soloProd: [], soloRepo: [], tipo: [], obbligatoria: [] }
for (const [t, d] of prod) {
  if (!locale.has(t)) { diff.soloProd.push(`tabella ${t} (${Object.keys(d.properties).length} colonne)`); continue }
  const l = locale.get(t)
  const richieste = new Set(d.required ?? [])
  for (const [c, p] of Object.entries(d.properties)) {
    if (!l.has(c)) { diff.soloProd.push(`colonna ${t}.${c} (${p.format ?? p.type})`); continue }
    const lc = l.get(c)
    if (norm(p.format ?? p.type) !== tipoLocale(lc)) diff.tipo.push(`${t}.${c}: produzione ${norm(p.format ?? p.type)}, migrazioni ${tipoLocale(lc)}`)
    const obbl = lc.is_nullable === 'NO'
    if (obbl !== richieste.has(c)) diff.obbligatoria.push(`${t}.${c}: produzione ${richieste.has(c) ? 'NOT NULL' : 'può essere nulla'}, migrazioni ${obbl ? 'NOT NULL' : 'può essere nulla'}`)
  }
}
for (const [t, l] of locale) {
  if (!prod.has(t)) { diff.soloRepo.push(`tabella ${t} (${l.size} colonne)`); continue }
  for (const c of l.keys()) if (!(c in prod.get(t).properties)) diff.soloRepo.push(`colonna ${t}.${c}`)
}
const fLocali = new Set(funzioni.map(f => f.proname))
const funzSoloProd = [...rpcProd].filter(f => !fLocali.has(f))
// le funzioni del repo chiamabili con RPC sono quelle che restituiscono qualcosa di diverso da trigger
const funzSoloRepo = funzioni.filter(f => f.ritorno !== 'trigger' && !rpcProd.has(f.proname)).map(f => f.proname)

const stampa = (titolo, righe) => { console.log(`\n${titolo}: ${righe.length}`); for (const r of righe) console.log(`  - ${r}`) }
stampa('In produzione e non nelle migrazioni (tabelle e colonne)', diff.soloProd)
stampa('Nelle migrazioni e non in produzione (tabelle e colonne)', diff.soloRepo)
stampa('Tipo diverso', diff.tipo)
stampa('NOT NULL diverso', diff.obbligatoria)
stampa('Funzioni (RPC) in produzione e non nelle migrazioni', funzSoloProd)
stampa('Funzioni chiamabili nelle migrazioni e non in produzione', [...new Set(funzSoloRepo)])
// ---- il catalogo (solo se c'è l'estrazione di produzione) ----
let diffCatalogo = 0
if (percorsoCatalogo) {
  const prodCat = JSON.parse(readFileSync(percorsoCatalogo, 'utf8'))
    const confronta = (titolo, a, b, chiave, valore) => {
    const ma = new Map(a.map(x => [chiave(x), valore(x)])), mb = new Map(b.map(x => [chiave(x), valore(x)]))
    const righe = []
    for (const [k, v] of ma) if (!mb.has(k)) righe.push(`${k}: in produzione, non nelle migrazioni`); else if (mb.get(k) !== v) righe.push(`${k}: diverso (produzione: ${String(v).slice(0, 90)} · migrazioni: ${String(mb.get(k)).slice(0, 90)})`)
    for (const k of mb.keys()) if (!ma.has(k)) righe.push(`${k}: nelle migrazioni, non in produzione`)
    stampa(titolo, righe); diffCatalogo += righe.length
  }
  confronta('Vincoli', prodCat.vincoli, catalogoLocale.vincoli, x => `${x.tabella}|${x.nome}`, x => x.definizione)
  confronta('Indici', prodCat.indici, catalogoLocale.indici, x => `${x.tabella}|${x.nome}`, x => x.definizione)
  confronta('RLS attiva', prodCat.rls, catalogoLocale.rls, x => x.tabella, x => `${x.attiva}/${x.forzata}`)
  confronta('Policy', prodCat.policy, catalogoLocale.policy, x => `${x.tabella}|${x.nome}`, x => [x.comando, x.ruoli, x.using, x.with_check].join(' | '))
  confronta('Trigger', prodCat.trigger, catalogoLocale.trigger, x => `${x.tabella}|${x.nome}`, x => x.definizione)
  confronta('Funzioni (firma e impronta del corpo)', prodCat.funzioni, catalogoLocale.funzioni, x => `${x.nome}(${x.argomenti})`, x => `${x.ritorno} · definer=${x.security_definer} · ${x.impronta}`)
} else console.log('\nVincoli, indici, policy RLS, trigger e corpi delle funzioni: NON confrontati (serve --catalogo, vedi supabase/strumenti/leggi-catalogo.sql)')
const tot = diffCatalogo + diff.soloProd.length + diff.soloRepo.length + diff.tipo.length + diff.obbligatoria.length + funzSoloProd.length + new Set(funzSoloRepo).size + errori.length
console.log(`\nDifferenze totali: ${tot}`)
process.exit(tot ? 1 : 0)
