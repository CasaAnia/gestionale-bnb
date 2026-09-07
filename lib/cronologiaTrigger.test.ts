// Pezzo 2 (07/09/2026): la proposta 0042 VERA (SQL letto dal file) dentro
// PGlite: i trigger scrivono in booking_events per camera, date, totale,
// sconto, annullamento, cambio cliente, pagamento aggiunto ed eliminato;
// un update che non tocca quei campi non scrive niente. Nessuna rete.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const SCHEMA = `
create schema auth;
create function auth.uid() returns uuid language sql as 'select ''cccccccc-0000-4000-8000-000000000000''::uuid';
create schema private;
create function private.is_app_member() returns boolean language sql as 'select true';
create role authenticated; create role anon;
create table public.rooms (id uuid primary key, name text not null);
create table public.guests (id uuid primary key default gen_random_uuid(), phone text not null unique, full_name text);
create table public.bookings (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id), guest_id uuid not null references public.guests(id),
  check_in date not null, check_out date not null, total_amount numeric(10,2) not null default 0,
  discount_type text, discount_value numeric, status text not null default 'confermata', cancelled_reason text, group_id uuid, notes text, updated_at timestamptz default now());
create table public.payments (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, amount numeric not null, method text not null default 'contanti', paid_on date not null default current_date);
`
const AMBRA = '33333333-3333-4333-8333-333333333333', LENA = '44444444-4444-4444-8444-444444444444'

// Tutto il file tranne le select di verifica in fondo (che restano per Ania)
function sqlProposta(): string {
  const file = readFileSync(new URL('../supabase/proposte/0042_cronologia_prenotazioni.BOZZA.sql', import.meta.url), 'utf8')
  const fine = file.indexOf('-- VERIFICA')
  return fine > 0 ? file.slice(0, fine) : file
}

let db: PGlite
let booking = ''
before(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(sqlProposta())
  await db.exec(`insert into public.rooms values ('${AMBRA}', 'Ambra'), ('${LENA}', 'Lena');`)
  await db.exec(`insert into public.guests (id, phone, full_name) values ('aaaaaaaa-0001-4000-8000-000000000001', '390001', 'Anna Rossi'), ('aaaaaaaa-0002-4000-8000-000000000002', '390002', 'Marco Bianchi');`)
  const r = await db.query<{ id: string }>(`insert into public.bookings (room_id, guest_id, check_in, check_out, total_amount) values ('${AMBRA}', 'aaaaaaaa-0001-4000-8000-000000000001', '2026-09-05', '2026-09-07', 160) returning id`)
  booking = r.rows[0].id
})
after(async () => { await db.close() })

const eventi = async () => (await db.query<{ tipo: string; prima: Record<string, unknown> | null; dopo: Record<string, unknown> | null; booking_id: string; soggiorno: string }>('select tipo, prima, dopo, booking_id, soggiorno from public.booking_events order by n')).rows

test('un update che non tocca i campi importanti non scrive niente', async () => {
  await db.exec(`update public.bookings set notes = 'ciao', updated_at = now() where id = '${booking}'`)
  assert.equal((await eventi()).length, 0)
})

test('camera, date, totale e sconto nello stesso update: quattro righe con prima e dopo leggibili', async () => {
  await db.exec(`update public.bookings set room_id = '${LENA}', check_out = '2026-09-08', total_amount = 200.5, discount_type = 'percentage', discount_value = 10 where id = '${booking}'`)
  const e = await eventi()
  assert.deepEqual(e.map(x => x.tipo), ['camera', 'date', 'totale', 'sconto'])
  assert.deepEqual(e[0].prima, { camera: 'Ambra' }); assert.deepEqual(e[0].dopo, { camera: 'Lena' })
  assert.deepEqual(e[1].prima, { check_in: '2026-09-05', check_out: '2026-09-07' }); assert.deepEqual(e[1].dopo, { check_in: '2026-09-05', check_out: '2026-09-08' })
  assert.equal(Number(e[2].prima?.totale), 160); assert.equal(Number(e[2].dopo?.totale), 200.5)
  assert.deepEqual(e[3].prima, { tipo: null, valore: null }); assert.deepEqual(e[3].dopo, { tipo: 'percentage', valore: 10 })
  assert.ok(e.every(x => x.booking_id === booking && x.soggiorno === booking))
})

test('pagamento aggiunto ed eliminato; annullamento col motivo; cambio cliente coi nomi', async () => {
  await db.exec(`insert into public.payments (booking_id, amount, method, paid_on) values ('${booking}', 100, 'contanti', '2026-09-05')`)
  await db.exec(`delete from public.payments where booking_id = '${booking}'`)
  await db.exec(`update public.bookings set status = 'annullata', cancelled_reason = 'Non viene più' where id = '${booking}'`)
  await db.exec(`update public.bookings set guest_id = 'aaaaaaaa-0002-4000-8000-000000000002' where id = '${booking}'`)
  const e = (await eventi()).slice(4)
  assert.deepEqual(e.map(x => x.tipo), ['pagamento_aggiunto', 'pagamento_eliminato', 'annullamento', 'cliente'])
  assert.equal(Number(e[0].dopo?.importo), 100); assert.equal(e[0].dopo?.metodo, 'contanti'); assert.equal(e[0].dopo?.data, '2026-09-05'); assert.equal(e[0].prima, null)
  assert.equal(Number(e[1].prima?.importo), 100); assert.equal(e[1].dopo, null)
  assert.deepEqual(e[2].dopo, { stato: 'annullata', motivo: 'Non viene più' })
  assert.equal(e[3].prima?.cliente, 'Anna Rossi'); assert.equal(e[3].dopo?.cliente, 'Marco Bianchi')
})

test('annullare una prenotazione già annullata non aggiunge righe; il soggiorno segue group_id', async () => {
  const prima = (await eventi()).length
  await db.exec(`update public.bookings set status = 'annullata', cancelled_reason = 'altro' where id = '${booking}'`)
  assert.equal((await eventi()).length, prima)
  const r = await db.query<{ id: string }>(`insert into public.bookings (room_id, guest_id, check_in, check_out, total_amount, group_id) values ('${AMBRA}', 'aaaaaaaa-0001-4000-8000-000000000001', '2026-10-01', '2026-10-03', 100, 'dddddddd-0000-4000-8000-000000000000') returning id`)
  await db.exec(`update public.bookings set total_amount = 120 where id = '${r.rows[0].id}'`)
  const ultimo = (await eventi()).at(-1)!
  assert.equal(ultimo.soggiorno, 'dddddddd-0000-4000-8000-000000000000')
})

test('dal client niente insert: la tabella ha solo select per authenticated e RLS attiva', async () => {
  const g = await db.query<{ privilege_type: string }>(`select privilege_type from information_schema.role_table_grants where table_name = 'booking_events' and grantee = 'authenticated'`)
  assert.deepEqual(g.rows.map(x => x.privilege_type), ['SELECT'])
  const rls = await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname = 'booking_events'`)
  assert.equal(rls.rows[0].relrowsecurity, true)
})
