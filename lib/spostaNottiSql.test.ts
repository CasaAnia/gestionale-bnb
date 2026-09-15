// ============================================================================
// Le proposte 0051 (una camera, una prenotazione per notte), 0053 (spostare le
// notti in un colpo solo) e 0054 (due letti in tutta la casa) eseguite in
// PGlite — PostgreSQL vero, una sessione sola. Qui si prova che la SEQUENZA
// funziona: fusione, scambio, sovrapposizione vera rifiutata, letti contati.
// Le prove con due sessioni davvero concorrenti stanno in
// scripts/collaudo-0051/collaudo.mjs (PostgreSQL con più connessioni).
//
// Il SQL si legge dai file delle proposte: se cambiano, cambia la prova.
// ============================================================================
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

const AMBRA = '11111111-1111-4111-8111-111111111111'
const ALLEGRA = '22222222-2222-4222-8222-222222222222'
const LENA = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const AMELIA = '33333333-3333-4333-8333-333333333333'
const OSPITE = 'aaaaaaaa-0001-4000-8000-000000000001'

const SCHEMA = `
create role authenticated;
create table public.rooms (id uuid primary key, name text not null);
create table public.guests (id uuid primary key, full_name text);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests(id), guest_name text,
  prenotazione_id uuid, group_id uuid,
  room_id uuid not null references public.rooms(id),
  check_in date not null, check_out date not null,
  num_guests int default 1, status text not null default 'confermata',
  bonifico boolean default false, pagato boolean default false,
  extra_bed boolean default false, extra_bed_dates jsonb,
  price_per_night numeric, extra_bed_total numeric, total_amount numeric default 0,
  discount_type text, discount_value numeric,
  extra_bed_importo numeric, extra_bed_criterio text,
  check_in_time text, shuttle text,
  cancelled_at timestamptz, cancelled_reason text,
  created_at timestamptz default now(), updated_at timestamptz default now());
`

const proposta = (nome: string) =>
  readFileSync(new URL(`../supabase/proposte/${nome}`, import.meta.url), 'utf8')
    .split('\n').filter(r => !r.trim().startsWith('--')).join('\n')

let db: PGlite

before(async () => {
  db = new PGlite({ extensions: { btree_gist } })
  await db.exec(SCHEMA)
  await db.exec(`insert into public.rooms (id, name) values ('${AMBRA}','Ambra'),('${ALLEGRA}','Allegra'),('${LENA}','Lena'),('${AMELIA}','Amelia')`)
  await db.exec(`insert into public.guests (id, full_name) values ('${OSPITE}','Cliente di prova')`)
  for (const nome of ['0051_camera_non_due_volte.BOZZA.sql', '0053_notti_in_un_colpo.BOZZA.sql', '0054_due_letti_in_tutto.BOZZA.sql']) {
    await db.exec(proposta(nome))
  }
})
after(async () => { await db.close() })

type Riga = { room: string; dal: string; al: string; ospiti?: number; letto?: boolean; nottiLetto?: string[]; stato?: string }

const inserisci = async (x: Riga): Promise<string> => {
  const r = await db.query<{ id: string }>(
    `insert into public.bookings (guest_id, room_id, check_in, check_out, num_guests, status, extra_bed, extra_bed_dates)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id`,
    [OSPITE, x.room, x.dal, x.al, x.ospiti ?? 2, x.stato ?? 'confermata', x.letto ?? false, JSON.stringify(x.nottiLetto ?? [])])
  return r.rows[0].id
}

const campi = (x: Riga) => ({
  guest_id: OSPITE, guest_name: 'Prova', status: 'confermata',
  room_id: x.room, check_in: x.dal, check_out: x.al, num_guests: x.ospiti ?? 2,
  extra_bed: x.letto ?? false, extra_bed_dates: x.nottiLetto ?? [],
  price_per_night: 80, extra_bed_total: 0, total_amount: 80,
})

const sposta = (aggiorna: unknown[], crea: unknown[], annulla: string[]) =>
  db.query('select public.sposta_notti($1::jsonb, $2::jsonb, $3::uuid[], $4) as esito',
    [JSON.stringify(aggiorna), JSON.stringify(crea), annulla, 'prova'])

const pulisci = () => db.exec('delete from public.bookings')
const vive = async () => (await db.query<{ n: number }>(
  `select count(*)::int as n from public.bookings where status <> 'annullata'`)).rows[0].n

test('il vincolo tiene: stessa camera stesse notti no, chi arriva il giorno della partenza sì', async () => {
  await pulisci()
  await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' })
  await assert.rejects(() => inserisci({ room: AMBRA, dal: '2026-10-11', al: '2026-10-13' }), /esclusione|exclusion/i)
  await inserisci({ room: AMBRA, dal: '2026-10-12', al: '2026-10-14' })
  assert.equal(await vive(), 2)
})

test('fusione: la notte passa nella camera dell’altro tratto, che viene annullato', async () => {
  await pulisci()
  const ambra = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-11' })
  const allegra = await inserisci({ room: ALLEGRA, dal: '2026-10-11', al: '2026-10-12' })
  // il tratto di Ambra diventa Allegra 10→12 mentre quello di Allegra è ancora
  // vivo: senza il rinvio del vincolo l'update veniva rifiutato
  await sposta([{ id: ambra, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) }], [], [allegra])
  const righe = await db.query<{ room_id: string }>(`select room_id from public.bookings where status <> 'annullata'`)
  assert.deepEqual(righe.rows.map(r => r.room_id), [ALLEGRA])
})

test('scambio: due tratti si scambiano la camera nella stessa chiamata', async () => {
  await pulisci()
  const a = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' })
  const b = await inserisci({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' })
  await sposta([
    { id: a, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) },
    { id: b, campi: campi({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' }) },
  ], [], [])
  const dopo = await db.query<{ id: string; room_id: string }>('select id, room_id from public.bookings order by room_id')
  assert.equal(dopo.rows.find(r => r.id === a)?.room_id, ALLEGRA)
  assert.equal(dopo.rows.find(r => r.id === b)?.room_id, AMBRA)
})

test('il rinvio non è un condono: se alla fine due tratti si sovrappongono, niente', async () => {
  await pulisci()
  const a = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' })
  await inserisci({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' })
  await assert.rejects(() => sposta([{ id: a, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) }], [], []))
  const dove = await db.query<{ room_id: string }>('select room_id from public.bookings where id = $1', [a])
  assert.equal(dove.rows[0].room_id, AMBRA, 'il tratto è rimasto dov’era')
})

test('i letti in più sono due in tutta la casa: il terzo non entra', async () => {
  await pulisci()
  await inserisci({ room: AMELIA, dal: '2026-11-20', al: '2026-11-21', letto: true, nottiLetto: ['2026-11-20'] })
  await inserisci({ room: AMBRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] })
  await assert.rejects(
    () => inserisci({ room: ALLEGRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] }),
    /LETTI_FINITI/)
  assert.equal(await vive(), 2)
})

test('Lena con quattro ospiti occupa due letti da sola', async () => {
  await pulisci()
  await inserisci({ room: LENA, dal: '2026-11-20', al: '2026-11-21', ospiti: 4, letto: true, nottiLetto: ['2026-11-20'] })
  await assert.rejects(
    () => inserisci({ room: AMBRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] }),
    /LETTI_FINITI/)
})

test('il letto di un’altra notte non dà fastidio, e la riga annullata non occupa', async () => {
  await pulisci()
  await inserisci({ room: AMELIA, dal: '2026-11-20', al: '2026-11-21', letto: true, nottiLetto: ['2026-11-20'] })
  await inserisci({ room: AMBRA, dal: '2026-11-21', al: '2026-11-22', ospiti: 3, letto: true, nottiLetto: ['2026-11-21'] })
  await inserisci({ room: ALLEGRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'], stato: 'annullata' })
  await inserisci({ room: LENA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] })
  assert.equal(await vive(), 3)
})

test('spostare le notti passa dallo stesso controllo dei letti', async () => {
  await pulisci()
  await inserisci({ room: AMELIA, dal: '2026-11-20', al: '2026-11-21', letto: true, nottiLetto: ['2026-11-20'] })
  await inserisci({ room: AMBRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] })
  const lena = await inserisci({ room: LENA, dal: '2026-11-22', al: '2026-11-23', ospiti: 3, letto: true, nottiLetto: ['2026-11-22'] })
  // si prova a portare la notte col letto di Lena sul 20: i letti sono finiti
  await assert.rejects(
    () => sposta([{ id: lena, campi: campi({ room: LENA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] }) }], [], []),
    /LETTI_FINITI/)
})
