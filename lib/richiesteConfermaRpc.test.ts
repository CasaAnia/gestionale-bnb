// Pezzo 7: la RPC VERA conferma_richiesta (SQL della migrazione 0027, letta dal
// file) eseguita in locale dentro PGlite (Postgres in WebAssembly, solo dev).
// Le tabelle sono una replica minima dello schema di produzione con le colonne
// che la RPC tocca; auth.uid() è un finto utente loggato. La soluzione inviata
// è quella VERA di lib/richiesteProposta.proponiSoluzioni, così il contratto
// JSON fra client e RPC è esercitato davvero. Nessuna rete, nessun dato reale.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { proponiSoluzioni, type Soluzione, type PrenotazioneOccupante } from './richiesteProposta.ts'

const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'   // lo stesso id di produzione (lib/lettiAggiuntivi.LENA_ID)
const AMELIA = { id: '11111111-1111-4111-8111-111111111111', name: 'Amelia', bathroom_type: 'privato_interno', base_price: 70, has_extra_bed: true, extra_bed_price: 5, double_price: null, active: true }
const ALLEGRA = { id: '22222222-2222-4222-8222-222222222222', name: 'Allegra', bathroom_type: 'privato_interno', base_price: 80, has_extra_bed: true, extra_bed_price: 10, double_price: null, active: true }
const AMBRA = { id: '33333333-3333-4333-8333-333333333333', name: 'Ambra', bathroom_type: 'privato_interno', base_price: 80, has_extra_bed: true, extra_bed_price: 10, double_price: null, active: true }
const LENA = { id: LENA_ID, name: 'Lena', bathroom_type: 'privato_esterno', base_price: 80, has_extra_bed: true, extra_bed_price: 10, double_price: 90, active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]

const SCHEMA = `
create schema auth;
create function auth.uid() returns uuid language sql as 'select ''cccccccc-0000-4000-8000-000000000000''::uuid';
create role authenticated; create role anon;
create table public.rooms (id uuid primary key, name text not null, bathroom_type text, base_price numeric(10,2) default 0, has_extra_bed boolean default true, extra_bed_price numeric(10,2) default 0, double_price numeric(10,2), active boolean default true, created_at timestamptz default now());
create table public.guests (id uuid primary key default gen_random_uuid(), phone text not null unique, full_name text, email text, rating text default 'normale', notes text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.bookings (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id), guest_id uuid not null references public.guests(id),
  check_in date not null, check_out date not null, num_guests integer not null default 1, extra_bed boolean not null default false, extra_bed_dates jsonb,
  price_per_night numeric(10,2) not null, extra_bed_total numeric(10,2) not null default 0, total_amount numeric(10,2) not null default 0,
  status text not null check (status in ('confermata', 'in_attesa', 'annullata', 'completata')) default 'confermata', source text default 'diretta', notes text,
  cancelled_at timestamptz, cancelled_reason text, group_id uuid, guest_name text, pagato boolean default false, bonifico boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now());
create table public.richieste (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), nome text not null, cognome text not null,
  arrivo date not null, partenza date not null, persone smallint not null default 1, camera_id uuid references public.rooms(id),
  canale text not null check (canale in ('web', 'telefono', 'whatsapp')), telefono text, note text,
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'proposta_inviata', 'confermata', 'rifiutata')),
  proposta_inviata_at timestamptz, chiusa_at timestamptz, prenotazione_id uuid references public.bookings(id),
  proposta_testo text, proposta_soluzione jsonb, origine text,
  condizione_pagamento text, caparra_centesimi integer, condizione_testo text, amelia_alternativa boolean not null default false,
  constraint richieste_partenza_dopo_arrivo check (partenza > arrivo));
`

// Dalla migrazione 0027 si prende SOLO la definizione della funzione (dalla
// create or replace alla fine del corpo $$;): niente notify, grant o select di verifica.
function sqlFunzione0027(): string {
  const file = readFileSync(new URL('../supabase/migrations/0027_conferma_richiesta.sql', import.meta.url), 'utf8')
  const inizio = file.indexOf('create or replace function public.conferma_richiesta')
  const fine = file.indexOf('$$;', inizio) + 3
  assert.ok(inizio > 0 && fine > inizio, 'funzione non trovata nella 0027')
  return file.slice(inizio, fine)
}

let db: PGlite
before(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec('alter table public.richieste add column if not exists motivo_rifiuto text;')
  await db.exec(sqlFunzione0027())
  for (const c of CAMERE) {
    await db.query('insert into public.rooms (id, name, bathroom_type, base_price, has_extra_bed, extra_bed_price, double_price) values ($1,$2,$3,$4,$5,$6,$7)',
      [c.id, c.name, c.bathroom_type, c.base_price, c.has_extra_bed, c.extra_bed_price, c.double_price])
  }
})
after(async () => { await db?.close() })

type R = { nome: string; cognome: string; arrivo: string; partenza: string; persone: number; camera_id: string | null; telefono: string }
async function inserisci(r: R, stato: 'in_attesa' | 'proposta_inviata', soluzione: Soluzione | null): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.richieste (nome, cognome, arrivo, partenza, persone, camera_id, canale, telefono, stato, proposta_inviata_at, proposta_testo, proposta_soluzione)
     values ($1,$2,$3,$4,$5,$6,'telefono',$7,$8, case when $8 = 'proposta_inviata' then now() end, case when $8 = 'proposta_inviata' then 'bozza' end, $9) returning id`,
    [r.nome, r.cognome, r.arrivo, r.partenza, r.persone, r.camera_id, r.telefono, stato, soluzione ? JSON.stringify(soluzione) : null])
  return rows[0].id
}
async function prenotazioniConfermate(): Promise<PrenotazioneOccupante[]> {
  const { rows } = await db.query<PrenotazioneOccupante>(`select room_id, check_in::text, check_out::text, status, num_guests, extra_bed, extra_bed_dates from public.bookings`)
  return rows.map(b => ({ ...b, extra_bed_dates: (b.extra_bed_dates ?? null) as string[] | null }))
}
async function conferma(id: string, rifiutaAnche: string[] | null): Promise<string> {
  const { rows } = await db.query<{ conferma_richiesta: string }>('select public.conferma_richiesta($1, $2) as conferma_richiesta', [id, rifiutaAnche])
  return rows[0].conferma_richiesta
}
async function confermaFallisce(id: string, rifiutaAnche: string[] | null): Promise<string> {
  try { await conferma(id, rifiutaAnche) } catch (e) { return (e as Error).message }
  assert.fail('la conferma doveva fallire')
}
const conta = async (tabella: 'bookings' | 'guests' | 'richieste') => Number((await db.query<{ n: string }>(`select count(*)::int as n from public.${tabella}`)).rows[0].n)
const richiesta = async (id: string) => (await db.query<{ stato: string; motivo_rifiuto: string | null; prenotazione_id: string | null }>('select stato, motivo_rifiuto, prenotazione_id from public.richieste where id = $1', [id])).rows[0]

const R1: R = { nome: 'Prova', cognome: 'Uno', arrivo: '2031-10-10', partenza: '2031-10-13', persone: 2, camera_id: LENA_ID, telefono: '+39 333 000 0001' }
const R2: R = { nome: 'Prova', cognome: 'Due', arrivo: '2031-10-11', partenza: '2031-10-13', persone: 2, camera_id: LENA_ID, telefono: '+39 333 000 0002' }

test('a) due richieste sovrapposte su Lena: entrambe ricevono il caso A per Lena (le richieste aperte non si limitano a vicenda)', async () => {
  const occ = await prenotazioniConfermate()
  const s1 = proponiSoluzioni(R1, CAMERE, occ)[0]
  const s2 = proponiSoluzioni(R2, CAMERE, occ)[0]
  assert.equal(s1.caso, 'completa'); assert.equal(s1.segmenti[0].camera.name, 'Lena'); assert.equal(s1.prezzoTotale, 240)
  assert.equal(s2.caso, 'completa'); assert.equal(s2.segmenti[0].camera.name, 'Lena'); assert.equal(s2.prezzoTotale, 160)
  // Anche dopo aver inserito R1 e R2 nel database (aperte) le soluzioni non cambiano: la ricerca guarda solo le prenotazioni
  await inserisci(R1, 'proposta_inviata', s1)
  await inserisci(R2, 'proposta_inviata', s2)
  assert.equal(proponiSoluzioni(R2, CAMERE, await prenotazioniConfermate())[0].caso, 'completa')
})

test('b) conferma di R1 con R2 spuntata: prenotazione creata, R2 rifiutata con «date assegnate a altro cliente»', async () => {
  const [id1, id2] = (await db.query<{ id: string }>(`select id from public.richieste order by cognome desc`)).rows.map(r => r.id)   // Uno, Due
  assert.equal(await conta('bookings'), 0); assert.equal(await conta('guests'), 0)
  const booking = await conferma(id1, [id2])
  const b = (await db.query<{ room_id: string; check_in: string; check_out: string; status: string; num_guests: number; total_amount: string; guest_name: string; source: string }>(
    'select room_id, check_in::text, check_out::text, status, num_guests, total_amount::text, guest_name, source from public.bookings where id = $1', [booking])).rows[0]
  assert.deepEqual(b, { room_id: LENA_ID, check_in: '2031-10-10', check_out: '2031-10-13', status: 'confermata', num_guests: 2, total_amount: '240.00', guest_name: 'Prova Uno', source: 'diretta' })
  assert.deepEqual(await richiesta(id1), { stato: 'confermata', motivo_rifiuto: null, prenotazione_id: booking })
  assert.deepEqual(await richiesta(id2), { stato: 'rifiutata', motivo_rifiuto: 'date assegnate a altro cliente', prenotazione_id: null })
  assert.equal(await conta('guests'), 1)
  const g = (await db.query<{ phone: string; full_name: string }>('select phone, full_name from public.guests')).rows[0]
  assert.deepEqual(g, { phone: '393330000001', full_name: 'Prova Uno' })
  // Ora la ricerca per R2 vede Lena occupata: niente caso A su Lena
  const dopo = proponiSoluzioni(R2, CAMERE, await prenotazioniConfermate())
  assert.ok(dopo.every(s => !s.segmenti.some(x => x.camera.name === 'Lena')))
})

test('d) secondo tocco su «Crea prenotazione» per R1: stessa prenotazione, nessun doppione', async () => {
  const id1 = (await db.query<{ id: string }>(`select id from public.richieste where cognome = 'Uno'`)).rows[0].id
  const prima = (await richiesta(id1)).prenotazione_id
  const bookings = await conta('bookings'), guests = await conta('guests')
  assert.equal(await conferma(id1, null), prima)
  assert.equal(await conferma(id1, [(await db.query<{ id: string }>(`select id from public.richieste where cognome = 'Due'`)).rows[0].id]), prima)
  assert.equal(await conta('bookings'), bookings); assert.equal(await conta('guests'), guests)
})

test('c) R2 NON spuntata: la conferma di R2 dopo R1 si ferma con l\'errore chiaro e non scrive nulla', async () => {
  // Nuovo scenario a novembre: Lena libera 10–13, R1 e R2 come sopra, nessuna spunta
  const r1: R = { ...R1, arrivo: '2031-11-10', partenza: '2031-11-13', telefono: '+39 333 000 0011' }
  const r2: R = { ...R2, arrivo: '2031-11-11', partenza: '2031-11-13', telefono: '+39 333 000 0012' }
  const occ = await prenotazioniConfermate()
  const id1 = await inserisci(r1, 'proposta_inviata', proponiSoluzioni(r1, CAMERE, occ)[0])
  const id2 = await inserisci(r2, 'proposta_inviata', proponiSoluzioni(r2, CAMERE, occ)[0])
  await conferma(id1, null)
  assert.equal((await richiesta(id2)).stato, 'proposta_inviata')
  const bookings = await conta('bookings'), guests = await conta('guests')
  const errore = await confermaFallisce(id2, null)
  assert.match(errore, /Camera Lena non più disponibile la notte del 11 novembre/)
  assert.equal(await conta('bookings'), bookings, 'nessuna prenotazione creata')
  assert.equal(await conta('guests'), guests, 'nessun ospite creato')
  assert.deepEqual(await richiesta(id2), { stato: 'proposta_inviata', motivo_rifiuto: null, prenotazione_id: null })
})

test('e) pool delle 2 brande: camera libera ma brande già assegnate → la conferma si ferma con l\'errore sulle brande e non scrive nulla', async () => {
  // Quadrupla confermata in Lena 20–22 dicembre: prende ENTRAMBE le brande in quelle notti
  const guest = (await db.query<{ id: string }>('select id from public.guests limit 1')).rows[0].id
  await db.query(`insert into public.bookings (room_id, guest_id, check_in, check_out, num_guests, extra_bed, extra_bed_dates, price_per_night, extra_bed_total, total_amount, status, source)
    values ($1, $2, '2031-12-20', '2031-12-22', 4, true, '["2031-12-20","2031-12-21"]'::jsonb, 90, 20, 200, 'confermata', 'diretta')`, [LENA_ID, guest])
  // 3 persone in Allegra (matrimoniale + branda) 20–21: la ricerca del gestionale non la propone…
  const r3: R = { nome: 'Tre', cognome: 'Persone', arrivo: '2031-12-20', partenza: '2031-12-21', persone: 3, camera_id: ALLEGRA.id, telefono: '+39 333 000 0033' }
  const occ = await prenotazioniConfermate()
  assert.equal(proponiSoluzioni(r3, CAMERE, occ)[0].caso, 'completo', 'con il pool esaurito nessuna matrimoniale può ospitare 3 persone')
  // …ma se una proposta con Allegra fosse stata inviata prima (brande allora libere), la RPC la ferma
  const solAllegra = proponiSoluzioni(r3, CAMERE, [])[0]
  assert.equal(solAllegra.segmenti[0].camera.name, 'Allegra')
  const id3 = await inserisci(r3, 'proposta_inviata', solAllegra)
  const bookings = await conta('bookings'), guests = await conta('guests')
  const errore = await confermaFallisce(id3, null)
  assert.match(errore, /Letti aggiuntivi esauriti la notte del 20 dicembre \(camera Allegra\)/)
  assert.equal(await conta('bookings'), bookings); assert.equal(await conta('guests'), guests)
  assert.deepEqual(await richiesta(id3), { stato: 'proposta_inviata', motivo_rifiuto: null, prenotazione_id: null })
  // Variante: prenotazione storica con extra_bed = true SENZA date (vale per tutte le sue notti) in Ambra 27–28 → 1 branda presa;
  // Lena a 4 persone (2 brande) il 27 deve fallire, Allegra a 3 persone (1 branda) deve passare
  await db.query(`insert into public.bookings (room_id, guest_id, check_in, check_out, num_guests, extra_bed, extra_bed_dates, price_per_night, extra_bed_total, total_amount, status, source)
    values ($1, $2, '2031-12-27', '2031-12-28', 3, true, null, 80, 10, 90, 'confermata', 'diretta')`, [AMBRA.id, guest])
  const r4: R = { nome: 'Quattro', cognome: 'Lena', arrivo: '2031-12-27', partenza: '2031-12-28', persone: 4, camera_id: LENA_ID, telefono: '+39 333 000 0044' }
  const id4 = await inserisci(r4, 'proposta_inviata', proponiSoluzioni(r4, CAMERE, [])[0])
  assert.match(await confermaFallisce(id4, null), /Letti aggiuntivi esauriti la notte del 27 dicembre \(camera Lena\)/)
  const r5: R = { nome: 'Tre', cognome: 'Allegra', arrivo: '2031-12-27', partenza: '2031-12-28', persone: 3, camera_id: ALLEGRA.id, telefono: '+39 333 000 0055' }
  const s5 = proponiSoluzioni(r5, CAMERE, await prenotazioniConfermate())[0]
  assert.equal(s5.segmenti[0].camera.name, 'Allegra')
  const id5 = await inserisci(r5, 'proposta_inviata', s5)
  const b5 = await conferma(id5, null)
  const riga = (await db.query<{ extra_bed: boolean; extra_bed_dates: string[]; extra_bed_total: string }>('select extra_bed, extra_bed_dates, extra_bed_total::text from public.bookings where id = $1', [b5])).rows[0]
  assert.deepEqual(riga, { extra_bed: true, extra_bed_dates: ['2031-12-27'], extra_bed_total: '10.00' })
})

test('senza proposta inviata o caso «completo»: nessuna conferma possibile', async () => {
  const r: R = { nome: 'In', cognome: 'Attesa', arrivo: '2032-01-10', partenza: '2032-01-12', persone: 1, camera_id: null, telefono: '+39 333 000 0099' }
  const id = await inserisci(r, 'in_attesa', null)
  assert.equal(await confermaFallisce(id, null), 'Nessuna proposta inviata')
  const completo: Soluzione = { caso: 'completo', segmenti: [], nottiTotali: 2, nottiCoperte: 0, nottiMancanti: ['2032-01-10', '2032-01-11'], prezzoTotale: 0 }
  const idE = await inserisci({ ...r, telefono: '+39 333 000 0098' }, 'proposta_inviata', completo)
  assert.match(await confermaFallisce(idE, null), /non contiene camere/)
})
