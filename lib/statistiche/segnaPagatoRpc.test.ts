// R8/R9/R10 — le RPC della PROPOSTA 0033 (SQL letta dal file, mai applicata a
// un database vero) eseguite in PGlite, IN SEQUENZA: identità della chiave,
// rifiuti, ricalcolo lato server, tutto-o-niente. Le prove con sessioni
// realmente concorrenti stanno in scripts/collaudo-0033 (PostgreSQL vero).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const SCHEMA = `
create schema auth;
create function auth.uid() returns uuid language sql as 'select ''cccccccc-0000-4000-8000-000000000000''::uuid';
create role authenticated; create role anon; create role service_role;
-- come su Supabase: i privilegi predefiniti dello schema public danno EXECUTE anche ad anon
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
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
const A = 'bbbbbbbb-0001-4000-8000-000000000001', B = 'bbbbbbbb-0002-4000-8000-000000000002'
const C = 'bbbbbbbb-0003-4000-8000-000000000003', D = 'bbbbbbbb-0004-4000-8000-000000000004'
const E = 'bbbbbbbb-0005-4000-8000-000000000005', F = 'bbbbbbbb-0006-4000-8000-000000000006'
const GRUPPO = 'dddddddd-0001-4000-8000-000000000001'
const K = (n: number) => `eeeeeeee-${String(n).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`

before(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(sqlProposta())
  await db.query('insert into public.rooms values ($1, $2), ($3, $4)', [R1, 'Amelia', R4, 'Lena'])
  await db.query('insert into public.guests values ($1, $2, $3)', [G, '39333', 'Rossi'])
  await db.query(`insert into public.bookings (id, room_id, guest_id, check_in, check_out, total_amount, status, group_id) values
    ($1, $3, $5, '2026-06-01', '2026-06-03', 160, 'confermata', $6),   -- A: cambio camera con B (gruppo)
    ($2, $4, $5, '2026-06-03', '2026-06-05', 180, 'confermata', $6),
    ($7, $3, $5, '2026-10-01', '2026-10-03', 200, 'in_attesa', null),   -- C: in attesa
    ($8, $3, $5, '2026-06-10', '2026-06-12', 100, 'completata', null),  -- D: concluso, pagato = false
    ($9, $4, $5, '2026-07-01', '2026-07-03', 200, 'confermata', null),  -- E: concluso, R9
    ($10, $4, $5, '2099-01-01', '2099-01-03', 300, 'confermata', null)  -- F: futuro
  `, [A, B, R1, R4, G, GRUPPO, C, D, E, F])
  await db.query(`insert into public.payments (booking_id, amount, method, paid_on) values ($1, 100, 'bonifico', '2026-05-20')`, [A])
})
after(async () => { await db?.close() })

const pagamenti = async (booking?: string) => (await db.query<{ booking_id: string; amount: string; chiave_operazione: string | null; soggiorno: string | null; origine: string }>(
  `select booking_id, amount, chiave_operazione, soggiorno, origine from public.payments ${booking ? 'where booking_id = $1' : ''} order by created_at`, booking ? [booking] : [])).rows
const pagato = async (id: string) => (await db.query<{ pagato: boolean }>('select pagato from public.bookings where id = $1', [id])).rows[0].pagato
const segna = async (booking: string, chiave: string | null, metodo = 'contanti') =>
  (await db.query<{ r: Record<string, unknown> }>(`select public.segna_pagato($1, $2, $3, '2026-09-05') as r`, [booking, chiave, metodo])).rows[0].r

test('R8: stessa chiave due volte sullo stesso soggiorno → un movimento (240), flag su entrambi i segmenti; la chiave è legata al soggiorno', async () => {
  const r1 = await segna(A, K(1))
  const r2 = await segna(B, K(1))    // stesso soggiorno (gruppo), altro segmento
  assert.equal(r1.movimento_id, r2.movimento_id)
  assert.equal(Number(r1.importo), 240)
  assert.equal(r1.soggiorno, GRUPPO)
  assert.equal(r1.segmenti_aggiornati, 2)
  const p = await pagamenti()
  assert.equal(p.length, 2)
  assert.deepEqual([p[1].chiave_operazione, p[1].soggiorno, p[1].origine, Number(p[1].amount)], [K(1), GRUPPO, 'reale', 240])
  assert.equal(await pagato(A), true)
  assert.equal(await pagato(B), true)
})

test('R8 riproduzione: la stessa chiave su un ALTRO soggiorno → CHIAVE_RIUSATA, zero effetti (D resta non pagata, nessun movimento)', async () => {
  await assert.rejects(segna(D, K(1)), /CHIAVE_RIUSATA/)
  assert.equal(await pagato(D), false)
  assert.equal((await pagamenti(D)).length, 0)
})

test('R8: chiave nulla, metodo sconosciuto, prenotazione in attesa → errore, nessun effetto, mai «pagato»', async () => {
  await assert.rejects(segna(D, null), /CHIAVE_NULLA/)
  await assert.rejects(segna(D, K(2), 'assegno'), /METODO_SCONOSCIUTO/)
  await assert.rejects(segna(C, K(3)), /PRENOTAZIONE_NON_MODIFICABILE/)
  assert.equal(await pagato(C), false)
  assert.equal(await pagato(D), false)
  assert.equal((await pagamenti()).length, 2)
  await assert.rejects(segna('ffffffff-0000-4000-8000-000000000000', K(4)), /PRENOTAZIONE_NON_TROVATA/)
})

test('R8: chiavi diverse in sequenza dallo stesso soggiorno → la seconda ricalcola il saldo (0) e non scrive', async () => {
  const r = await segna(D, K(5))
  assert.equal(Number(r.importo), 100)
  const r2 = await segna(D, K(6))
  assert.equal(r2.movimento_id, null)
  assert.equal(Number(r2.importo), 0)
  assert.equal((await pagamenti(D)).length, 1)
})

test('R10: registra_acconto idempotente per chiave; importo non valido e chiave riusata rifiutati', async () => {
  const a1 = (await db.query<{ r: Record<string, unknown> }>(`select public.registra_acconto($1, $2, 50, 'bonifico', '2026-06-20') as r`, [E, K(7)])).rows[0].r
  const a2 = (await db.query<{ r: Record<string, unknown> }>(`select public.registra_acconto($1, $2, 50, 'bonifico', '2026-06-20') as r`, [E, K(7)])).rows[0].r
  assert.equal(a1.movimento_id, a2.movimento_id)
  assert.deepEqual([a1.gia_presente, a2.gia_presente], [false, true])
  assert.equal((await pagamenti(E)).length, 1)
  await assert.rejects(db.query(`select public.registra_acconto($1, $2, 0, 'contanti')`, [E, K(8)]), /IMPORTO_NON_VALIDO/)
  await assert.rejects(db.query(`select public.registra_acconto($1, $2, 10, 'contanti')`, [D, K(7)]), /CHIAVE_RIUSATA/)
  await assert.rejects(db.query(`select public.registra_acconto($1, $2, 10, 'contanti')`, [C, K(9)]), /PRENOTAZIONE_NON_MODIFICABILE/)
})

test('R9 riproduzione: piano preparato a 200 €, acconto da 50 arrivato prima del tocco → il server scrive 150 (ricalcolo), totale 200 non 250', async () => {
  // E: totale 200, acconto 50 (registrato nel test R10 «prima del tocco»)
  const piano = JSON.stringify([{ soggiorno: E, chiave: K(10) }])
  const r = (await db.query<{ r: { scritti: number; saltati: number; nulla: number; esiti: { esito: string; importo: number }[] } }>('select public.ricostruisci_incassi($1::jsonb) as r', [piano])).rows[0].r
  assert.deepEqual([r.scritti, r.saltati, r.nulla], [1, 0, 0])
  assert.equal(r.esiti[0].esito, 'scritto')
  assert.equal(Number(r.esiti[0].importo), 150)
  const p = await pagamenti(E)
  assert.deepEqual(p.map(x => Number(x.amount)), [50, 150])
  assert.deepEqual([p[1].origine, p[1].soggiorno], ['ricostruito', E])
  assert.equal(await pagato(E), true)
  // seconda esecuzione: stessa chiave → già presente; chiave diversa → nulla da scrivere
  const r2 = (await db.query<{ r: { scritti: number; saltati: number; nulla: number } }>('select public.ricostruisci_incassi($1::jsonb) as r', [piano])).rows[0].r
  assert.deepEqual([r2.scritti, r2.saltati], [0, 1])
  const r3 = (await db.query<{ r: { scritti: number; nulla: number } }>('select public.ricostruisci_incassi($1::jsonb) as r', [JSON.stringify([{ soggiorno: E, chiave: K(11) }])])).rows[0].r
  assert.deepEqual([r3.scritti, r3.nulla], [0, 1])
  assert.equal((await pagamenti(E)).length, 2)
})

test('R9: tutto-o-niente sul batch (soggiorno futuro → nessuna riga scritta), chiave riusata rifiutata, piano non valido', async () => {
  const prima = (await pagamenti()).length
  await assert.rejects(db.query('select public.ricostruisci_incassi($1::jsonb)', [JSON.stringify([{ soggiorno: GRUPPO, chiave: K(12) }, { soggiorno: F, chiave: K(13) }])]), /SOGGIORNO_NON_CONCLUSO/)
  assert.equal((await pagamenti()).length, prima)
  await assert.rejects(db.query('select public.ricostruisci_incassi($1::jsonb)', [JSON.stringify([{ soggiorno: D, chiave: K(1) }])]), /CHIAVE_RIUSATA/)
  await assert.rejects(db.query('select public.ricostruisci_incassi($1::jsonb)', [JSON.stringify([{ soggiorno: C, chiave: K(14) }])]), /SOGGIORNO_NON_VALIDO/)
  await assert.rejects(db.query('select public.ricostruisci_incassi($1::jsonb)', ['{"a":1}']), /PIANO_NON_VALIDO/)
  await assert.rejects(db.query('select public.ricostruisci_incassi($1::jsonb)', [JSON.stringify([{ soggiorno: D }])]), /VOCE_NON_VALIDA/)
})

test('R8: permessi — EXECUTE ad authenticated e service_role, MAI ad anon o PUBLIC anche con i privilegi predefiniti di Supabase; helper non eseguibili dai client', async () => {
  for (const f of ['segna_pagato', 'registra_acconto', 'ricostruisci_incassi']) {
    const r = (await db.query<{ anon: boolean; auth: boolean; pub: boolean }>(`select has_function_privilege('anon', oid, 'execute') as anon, has_function_privilege('authenticated', oid, 'execute') as auth, has_function_privilege('public', oid, 'execute') as pub from pg_proc where proname = $1`, [f])).rows[0]
    assert.deepEqual([f, r.anon, r.auth, r.pub], [f, false, true, false])
  }
  for (const f of ['soggiorno_di', 'blocca_soggiorno', 'metodo_pagamento_valido']) {
    const r = (await db.query<{ anon: boolean; auth: boolean }>(`select has_function_privilege('anon', oid, 'execute') as anon, has_function_privilege('authenticated', oid, 'execute') as auth from pg_proc where proname = $1`, [f])).rows[0]
    assert.deepEqual([f, r.anon, r.auth], [f, false, false])
  }
})
