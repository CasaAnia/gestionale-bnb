// R1 — la RPC segna_pagato della PROPOSTA 0033 (SQL letta dal file, non
// applicata a nessun database vero) eseguita in PGlite: due chiamate con la
// stessa chiave scrivono UN solo movimento; una chiave diversa dopo il saldo
// non scrive nulla (saldo zero); il flag arriva a pagato su tutti i segmenti.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const SCHEMA = `
create schema auth;
create function auth.uid() returns uuid language sql as 'select ''cccccccc-0000-4000-8000-000000000000''::uuid';
create role authenticated; create role anon;
create table public.rooms (id uuid primary key, name text not null);
create table public.guests (id uuid primary key, phone text not null unique, full_name text);
create table public.bookings (
  id uuid primary key, room_id uuid not null references public.rooms(id), guest_id uuid not null references public.guests(id),
  check_in date not null, check_out date not null, total_amount numeric(10,2) not null default 0,
  status text not null default 'confermata', group_id uuid, pagato boolean default false, bonifico boolean default false);
create table public.payments (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric not null, method text not null default 'contanti', paid_on date not null default current_date, created_at timestamptz not null default now());
`
function sqlProposta(): string {
  const file = readFileSync(new URL('../../supabase/proposte/0033_pagamenti_idempotenti.BOZZA.sql', import.meta.url), 'utf8')
  return file.split('\n').filter(r => !r.trim().startsWith('--')).join('\n')
}

let db: PGlite
const R1 = '11111111-1111-4111-8111-111111111111', R4 = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const G = 'aaaaaaaa-0001-4000-8000-000000000001'
const A = 'bbbbbbbb-0001-4000-8000-000000000001', B = 'bbbbbbbb-0002-4000-8000-000000000002', C = 'bbbbbbbb-0003-4000-8000-000000000003'
const GRUPPO = 'dddddddd-0001-4000-8000-000000000001'
const K1 = 'eeeeeeee-0001-4000-8000-000000000001', K2 = 'eeeeeeee-0002-4000-8000-000000000002'

before(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(sqlProposta())
  await db.query('insert into public.rooms values ($1, $2), ($3, $4)', [R1, 'Amelia', R4, 'Lena'])
  await db.query('insert into public.guests values ($1, $2, $3)', [G, '39333', 'Rossi'])
  // cambio camera: 160 + 180 = 340, acconto 100 già registrato sul primo segmento
  await db.query(`insert into public.bookings (id, room_id, guest_id, check_in, check_out, total_amount, status, group_id) values
    ($1, $3, $5, '2026-09-01', '2026-09-03', 160, 'confermata', $6), ($2, $4, $5, '2026-09-03', '2026-09-05', 180, 'confermata', $6),
    ($7, $3, $5, '2026-10-01', '2026-10-03', 200, 'in_attesa', null)`, [A, B, R1, R4, G, GRUPPO, C])
  await db.query(`insert into public.payments (booking_id, amount, method, paid_on) values ($1, 100, 'bonifico', '2026-08-20')`, [A])
})
after(async () => { await db?.close() })

const pagamenti = async () => (await db.query<{ amount: string; chiave_operazione: string | null; origine: string }>('select amount, chiave_operazione, origine from public.payments order by created_at')).rows
const pagato = async (id: string) => (await db.query<{ pagato: boolean }>('select pagato from public.bookings where id = $1', [id])).rows[0].pagato

test('stessa chiave due volte → UN solo movimento da 240, flag pagato su entrambi i segmenti', async () => {
  const r1 = (await db.query<{ r: { movimento_id: string; importo: number; pagato: boolean } }>(`select public.segna_pagato($1, $2, 'contanti', '2026-09-05') as r`, [A, K1])).rows[0].r
  const r2 = (await db.query<{ r: { movimento_id: string; importo: number; pagato: boolean } }>(`select public.segna_pagato($1, $2, 'contanti', '2026-09-05') as r`, [A, K1])).rows[0].r
  assert.equal(r1.movimento_id, r2.movimento_id)
  assert.equal(Number(r1.importo), 240)
  const p = await pagamenti()
  assert.equal(p.length, 2)
  assert.deepEqual(p.map(x => Number(x.amount)), [100, 240])
  assert.equal(p[1].chiave_operazione, K1)
  assert.equal(p[1].origine, 'reale')
  assert.equal(await pagato(A), true)
  assert.equal(await pagato(B), true)
})

test('chiave diversa dopo il saldo → nessun nuovo movimento (saldo zero), flag resta pagato', async () => {
  const r = (await db.query<{ r: { movimento_id: string | null; importo: number } }>(`select public.segna_pagato($1, $2, 'carta', '2026-09-06') as r`, [B, K2])).rows[0].r
  assert.equal(r.movimento_id, null)
  assert.equal(Number(r.importo), 0)
  assert.equal((await pagamenti()).length, 2)
})

test('prenotazione in attesa: il totale non conta (saldo 0), prenotazione inesistente: errore', async () => {
  const r = (await db.query<{ r: { importo: number } }>(`select public.segna_pagato($1, $2, 'contanti', '2026-10-01') as r`, [C, 'eeeeeeee-0003-4000-8000-000000000003'])).rows[0].r
  assert.equal(Number(r.importo), 0)
  await assert.rejects(db.query(`select public.segna_pagato('ffffffff-0000-4000-8000-000000000000', $1)`, ['eeeeeeee-0004-4000-8000-000000000004']), /Prenotazione non trovata/)
})
