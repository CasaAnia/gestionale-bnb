#!/usr/bin/env node
// Collaudo su PostgreSQL VERO (non PGlite) delle RPC della proposta 0033 con
// sessioni realmente concorrenti — revisione Codex di 3248064, R8/R9.
//
// NON tocca produzione: serve un database di collaudo isolato indicato da
// DATABASE_URL (es. un Postgres locale o un progetto Supabase di prova). Senza
// DATABASE_URL il collaudo NON parte e lo dice: resta «da collaudare».
//
// Uso: DATABASE_URL=postgres://... node scripts/collaudo-0033/concorrenza.mjs
//
// Cosa prova:
//  1. due sessioni chiamano segna_pagato nello stesso istante da segmenti
//     diversi dello stesso soggiorno con chiavi diverse: la seconda aspetta il
//     lock e ricalcola il saldo (0) → UN solo movimento;
//  2. due ricostruzioni concorrenti con chiavi diverse sullo stesso soggiorno
//     → una scrive, l'altra «nulla_da_scrivere»;
//  3. la stessa chiave su un altro soggiorno → CHIAVE_RIUSATA senza effetti.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.log('DA COLLAUDARE: nessuna DATABASE_URL — il collaudo concorrente della 0033 non è partito.')
  process.exit(2)
}
const sql = readFileSync(new URL('../../supabase/proposte/0033_pagamenti_idempotenti.BOZZA.sql', import.meta.url), 'utf8')
const schema = `
drop schema if exists public cascade; create schema public;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as 'select ''cccccccc-0000-4000-8000-000000000000''::uuid';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create table public.rooms (id uuid primary key, name text not null);
create table public.guests (id uuid primary key, phone text not null unique, full_name text);
create table public.bookings (id uuid primary key, room_id uuid not null references public.rooms(id), guest_id uuid not null references public.guests(id),
  check_in date not null, check_out date not null, total_amount numeric(10,2) not null default 0, status text not null default 'confermata', group_id uuid, pagato boolean default false, bonifico boolean default false);
create table public.payments (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric not null, method text not null default 'contanti', paid_on date not null default current_date, created_at timestamptz not null default now());
`
const A = 'bbbbbbbb-0001-4000-8000-000000000001', B = 'bbbbbbbb-0002-4000-8000-000000000002', D = 'bbbbbbbb-0004-4000-8000-000000000004'
const G = 'dddddddd-0001-4000-8000-000000000001'
const K = n => `eeeeeeee-${String(n).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`
const pool = new pg.Pool({ connectionString: url, max: 4 })
const esiti = []
const ok = (nome, cond, dettaglio = '') => { esiti.push([cond ? 'OK' : 'FALLITO', nome, dettaglio]); if (!cond) process.exitCode = 1 }
try {
  const c0 = await pool.connect()
  await c0.query(schema); await c0.query(sql)
  await c0.query(`insert into public.rooms values ('11111111-1111-4111-8111-111111111111','Amelia'),('19ae4611-c0a4-42ae-8530-210f9a948e9e','Lena')`)
  await c0.query(`insert into public.guests values ('aaaaaaaa-0001-4000-8000-000000000001','39333','Rossi')`)
  await c0.query(`insert into public.bookings (id, room_id, guest_id, check_in, check_out, total_amount, status, group_id) values
    ($1,'11111111-1111-4111-8111-111111111111','aaaaaaaa-0001-4000-8000-000000000001','2026-06-01','2026-06-03',160,'confermata',$3),
    ($2,'19ae4611-c0a4-42ae-8530-210f9a948e9e','aaaaaaaa-0001-4000-8000-000000000001','2026-06-03','2026-06-05',180,'confermata',$3),
    ($4,'11111111-1111-4111-8111-111111111111','aaaaaaaa-0001-4000-8000-000000000001','2026-06-10','2026-06-12',100,'completata',null)`, [A, B, G, D])
  c0.release()

  // 1) due sessioni, stesso soggiorno, segmenti e chiavi diversi, nello stesso istante
  const [s1, s2] = await Promise.all([pool.connect(), pool.connect()])
  await s1.query('begin'); await s2.query('begin')
  const p1 = s1.query('select public.segna_pagato($1, $2, $3, $4) as r', [A, K(1), 'contanti', '2026-09-05'])
  const p2 = s2.query('select public.segna_pagato($1, $2, $3, $4) as r', [B, K(2), 'contanti', '2026-09-05'])
  const r1 = await p1; await s1.query('commit')
  const r2 = await p2; await s2.query('commit')
  s1.release(); s2.release()
  const importi = [Number(r1.rows[0].r.importo), Number(r2.rows[0].r.importo)].sort((a, b) => a - b)
  const c1 = await pool.connect()
  const n1 = (await c1.query('select count(*)::int as n from public.payments where soggiorno = $1', [G])).rows[0].n
  ok('due segna_pagato concorrenti → un solo movimento', n1 === 1 && importi[0] === 0 && importi[1] === 340, `movimenti=${n1} importi=${importi}`)

  // 2) due ricostruzioni concorrenti con chiavi diverse sullo stesso soggiorno D
  const [s3, s4] = await Promise.all([pool.connect(), pool.connect()])
  await s3.query('begin'); await s4.query('begin')
  const q3 = s3.query('select public.ricostruisci_incassi($1::jsonb) as r', [JSON.stringify([{ soggiorno: D, chiave: K(3) }])])
  const q4 = s4.query('select public.ricostruisci_incassi($1::jsonb) as r', [JSON.stringify([{ soggiorno: D, chiave: K(4) }])])
  const r3 = await q3; await s3.query('commit')
  const r4 = await q4; await s4.query('commit')
  s3.release(); s4.release()
  const scritti = r3.rows[0].r.scritti + r4.rows[0].r.scritti
  const n2 = (await c1.query('select count(*)::int as n from public.payments where soggiorno = $1', [D])).rows[0].n
  ok('due ricostruzioni concorrenti → un solo movimento', scritti === 1 && n2 === 1, `scritti=${scritti} movimenti=${n2}`)

  // 3) chiave riusata su un altro soggiorno
  let riusata = false
  try { await c1.query('select public.segna_pagato($1, $2)', [A, K(3)]) } catch (e) { riusata = /CHIAVE_RIUSATA/.test(String(e.message)) }
  ok('stessa chiave su altro soggiorno → CHIAVE_RIUSATA', riusata)
  c1.release()
} finally {
  await pool.end()
}
for (const [stato, nome, dettaglio] of esiti) console.log(`${stato} — ${nome}${dettaglio ? ` (${dettaglio})` : ''}`)
