#!/usr/bin/env node
// Applica su un PostgreSQL di COLLAUDO (mai produzione) tutte le migrazioni
// operative del progetto in ordine, poi le proposte 0033 e 0034. Prima crea
// gli oggetti che su Supabase esistono già (ruoli anon/authenticated/
// service_role, schema auth con users e uid() che legge il JWT, schema
// storage con buckets/objects minimi): sono STUB dichiarati, servono solo a
// far girare le migrazioni fuori da Supabase.
//
// Uso: DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo_0033 node scripts/collaudo-0033/applica-migrazioni.mjs
import { readFileSync, readdirSync } from 'node:fs'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.log('Serve DATABASE_URL di un database di COLLAUDO'); process.exit(2) }
const STUB = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
-- Come su Supabase: l'utente viene dal JWT della richiesta (null per anon)
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
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
-- l'unico utente del gestionale (finto): serve al bootstrap dell'owner (0020 → 0021)
insert into auth.users (id, email) values ('cccccccc-0000-4000-8000-000000000000', 'collaudo@locale') on conflict do nothing;
`
const client = new pg.Client({ connectionString: url })
await client.connect()
const esiti = []
async function esegui(nome, sql) {
  try { await client.query('begin'); await client.query(sql); await client.query('commit'); esiti.push(['OK', nome]) }
  catch (e) { await client.query('rollback'); esiti.push(['ERRORE', nome, e.message.split('\n')[0]]); return false }
  return true
}
await esegui('stub Supabase (ruoli, auth, storage)', STUB)
const migrazioni = readdirSync(new URL('../../supabase/migrations/', import.meta.url)).filter(f => f.endsWith('.sql')).sort()
for (const f of migrazioni) {
  const sql = readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')
  if (!(await esegui(f, sql)) && process.env.FERMATI_AL_PRIMO_ERRORE) break
  // Come in produzione: dopo la 0020 e prima della 0021 il bootstrap dell'owner (script manuale del progetto)
  if (f.startsWith('0020_')) await esegui('supabase/bootstrap_owner.sql', readFileSync(new URL('../../supabase/bootstrap_owner.sql', import.meta.url), 'utf8'))
}
// DRIFT DOCUMENTATO (collaudo del 06/09/2026): in produzione queste colonne di
// bookings esistono (le usa il gestionale: pagato, bonifico, nome della
// prenotazione, letto per notte, contatti extra, colore, orario di arrivo) ma
// sono state aggiunte a mano nell'editor SQL senza un file di migrazione. Qui
// si aggiungono con «if not exists» per avere lo stesso schema della
// produzione; da registrare in una migrazione vera (fuori da questo incarico).
await esegui('drift: colonne di bookings presenti in produzione senza migrazione', `
alter table public.bookings add column if not exists pagato boolean not null default false;
alter table public.bookings add column if not exists bonifico boolean not null default false;
alter table public.bookings add column if not exists guest_name text;
alter table public.bookings add column if not exists extra_bed_dates jsonb;
alter table public.bookings add column if not exists extra_phone_1 text;
alter table public.bookings add column if not exists extra_phone_1_name text;
alter table public.bookings add column if not exists extra_phone_2 text;
alter table public.bookings add column if not exists extra_phone_2_name text;
alter table public.bookings add column if not exists color text;
alter table public.bookings add column if not exists check_in_time text;
`)
for (const f of ['0033_pagamenti_idempotenti.BOZZA.sql', '0034_room_closures.BOZZA.sql']) {
  const sql = readFileSync(new URL(`../../supabase/proposte/${f}`, import.meta.url), 'utf8')
  await esegui(`proposta ${f}`, sql)
}
await client.end()
for (const [stato, nome, dettaglio] of esiti) console.log(`${stato} — ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`)
process.exit(esiti.some(e => e[0] === 'ERRORE') ? 1 : 0)
