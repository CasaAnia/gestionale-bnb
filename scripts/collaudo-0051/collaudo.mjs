#!/usr/bin/env node
// Collaudo su PostgreSQL VERO delle proposte 0051 (una camera, una
// prenotazione per notte), 0053 (spostare le notti in un colpo solo) e 0054
// (due letti in tutta la casa) — NON tocca produzione: serve un database di
// COLLAUDO vuoto indicato da DATABASE_URL, di cui questo script crea da sé
// lo schema minimo.
//
// Uso: DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo_0051 \
//        node scripts/collaudo-0051/collaudo.mjs
//
// Prove:
//  1. il vincolo rifiuta due prenotazioni sulla stessa camera nelle stesse
//     notti, e lascia passare chi arriva il giorno in cui un altro parte;
//  2. FUSIONE: la prima notte passa nella camera della seconda riusando il
//     tratto vecchio e annullando quello nuovo — con il vincolo immediato
//     l'update sbatteva sulla riga ancora viva, con la 0053 passa;
//  3. SCAMBIO: due tratti si scambiano la camera dentro la stessa chiamata;
//  4. il rinvio non è un condono: se alla fine due tratti si sovrappongono
//     davvero, la transazione non passa;
//  5. DUE SESSIONI sulla stessa camera e le stesse notti: una scrive,
//     l'altra si ferma (23P01), niente doppia prenotazione;
//  6. DUE SESSIONI sull'ultimo letto della stessa notte, in camere diverse:
//     una scrive, l'altra si ferma con LETTI_FINITI;
//  7. il guasto a metà non lascia niente a metà: se la 0053 fallisce dopo
//     aver accorciato un tratto, il tratto torna com'era;
//  8. com'era PRIMA: con il vincolo non differibile la stessa fusione del
//     caso 2 veniva rifiutata pur essendo giusta alla fine.
import pg from 'pg'
import { readFileSync } from 'node:fs'

const url = process.env.DATABASE_URL
if (!url) { console.log('DA COLLAUDARE: nessuna DATABASE_URL — il collaudo non è partito.'); process.exit(2) }

const proposta = (nome) => readFileSync(new URL(`../../supabase/proposte/${nome}`, import.meta.url), 'utf8')

const SCHEMA = `
drop schema if exists public cascade;
create schema public;
drop role if exists authenticated;
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

const AMBRA = '11111111-1111-4111-8111-111111111111'
const ALLEGRA = '22222222-2222-4222-8222-222222222222'
const LENA = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const AMELIA = '33333333-3333-4333-8333-333333333333'
const OSPITE = 'aaaaaaaa-0001-4000-8000-000000000001'

// nessuna prova deve restare appesa: se un'attesa non si scioglie si vede
const pool = new pg.Pool({ connectionString: url, max: 6, options: '-c statement_timeout=15s' })
let falliti = 0
const esito = (ok, testo) => { if (!ok) falliti += 1; console.log(`${ok ? 'OK  ' : 'NO  '} ${testo}`) }
const senzaCommenti = (sql) => sql.split('\n').filter(r => !r.trim().startsWith('--')).join('\n')

// una riga di prenotazione, in forma di campi per la 0053
const campi = (x) => ({
  guest_id: OSPITE, guest_name: 'Prova', group_id: x.group_id ?? null, status: 'confermata',
  room_id: x.room, check_in: x.dal, check_out: x.al, num_guests: x.ospiti ?? 2,
  extra_bed: x.letto ?? false, extra_bed_dates: x.nottiLetto ?? [],
  price_per_night: 80, extra_bed_total: 0, total_amount: 80,
})

async function prepara() {
  await pool.query(SCHEMA)
  await pool.query(`insert into public.rooms (id, name) values ($1,'Ambra'),($2,'Allegra'),($3,'Lena'),($4,'Amelia')`, [AMBRA, ALLEGRA, LENA, AMELIA])
  await pool.query(`insert into public.guests (id, full_name) values ($1, 'Cliente di prova')`, [OSPITE])
  for (const nome of ['0051_camera_non_due_volte.BOZZA.sql', '0053_notti_in_un_colpo.BOZZA.sql', '0054_due_letti_in_tutto.BOZZA.sql']) {
    await pool.query(senzaCommenti(proposta(nome)))
  }
}

const pulisci = () => pool.query('delete from public.bookings')

const inserisci = async (x, client = pool) => (await client.query(
  `insert into public.bookings (guest_id, room_id, check_in, check_out, num_guests, status, extra_bed, extra_bed_dates)
   values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id`,
  [OSPITE, x.room, x.dal, x.al, x.ospiti ?? 2, x.stato ?? 'confermata', x.letto ?? false, JSON.stringify(x.nottiLetto ?? [])])).rows[0].id

const sposta = (client, aggiorna, crea, annulla) => client.query(
  'select public.sposta_notti($1::jsonb, $2::jsonb, $3::uuid[], $4) as esito',
  [JSON.stringify(aggiorna), JSON.stringify(crea), annulla, 'prova di collaudo'])

async function prova1() {
  await pulisci()
  await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' })
  let rifiutata = false
  try { await inserisci({ room: AMBRA, dal: '2026-10-11', al: '2026-10-13' }) } catch (e) { rifiutata = e.code === '23P01' }
  esito(rifiutata, '1a · due prenotazioni sovrapposte nella stessa camera: rifiutata (23P01)')
  let attaccata = true
  try { await inserisci({ room: AMBRA, dal: '2026-10-12', al: '2026-10-14' }) } catch { attaccata = false }
  esito(attaccata, '1b · chi arriva il giorno in cui l’altro parte: passa')
  await pulisci()
  await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12', stato: 'annullata' })
  let sopraAnnullata = true
  try { await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' }) } catch { sopraAnnullata = false }
  esito(sopraAnnullata, '1c · una riga annullata non occupa la camera')
}

// FUSIONE: notte 10 in Ambra, notte 11 in Allegra. Si porta tutto in Allegra
// riusando il tratto di Ambra (che diventa Allegra 10→12) e annullando quello
// di Allegra. L'update passa sopra una riga ancora viva: senza il rinvio del
// vincolo la 0053 non poteva riuscire.
async function prova2() {
  await pulisci()
  const ambra = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-11' })
  const allegra = await inserisci({ room: ALLEGRA, dal: '2026-10-11', al: '2026-10-12' })
  const client = await pool.connect()
  let riuscita = false, errore = null
  try {
    await client.query('begin')
    await sposta(client, [{ id: ambra, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) }], [], [allegra])
    await client.query('commit')
    riuscita = true
  } catch (e) { errore = `${e.code} ${e.message}`; await client.query('rollback') } finally { client.release() }
  esito(riuscita, `2 · fusione in una camera sola riusando il tratto vecchio${riuscita ? '' : ` — ${errore}`}`)
  const righe = (await pool.query(`select room_id, check_in, check_out from public.bookings where status <> 'annullata'`)).rows
  esito(righe.length === 1 && righe[0].room_id === ALLEGRA, '2b · resta un tratto solo, in Allegra')
}

// SCAMBIO: due tratti si scambiano la camera nella stessa chiamata.
async function prova3() {
  await pulisci()
  const a = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' })
  const b = await inserisci({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' })
  const client = await pool.connect()
  let riuscito = false, errore = null
  try {
    await client.query('begin')
    await sposta(client, [
      { id: a, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) },
      { id: b, campi: campi({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' }) },
    ], [], [])
    await client.query('commit')
    riuscito = true
  } catch (e) { errore = `${e.code} ${e.message}`; await client.query('rollback') } finally { client.release() }
  esito(riuscito, `3 · scambio di camera fra due tratti${riuscito ? '' : ` — ${errore}`}`)
}

// Il rinvio non è un condono: se alla fine due tratti si sovrappongono, no.
async function prova4() {
  await pulisci()
  const a = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-12' })
  await inserisci({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' })
  const client = await pool.connect()
  let fermata = false, come = null
  try {
    await client.query('begin')
    await sposta(client, [{ id: a, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) }], [], [])
    await client.query('commit')
  } catch (e) { fermata = true; come = e.code === '23P01' ? 'il vincolo' : 'il controllo della 0053'; await client.query('rollback') } finally { client.release() }
  esito(fermata, `4 · sovrapposizione vera alla fine: fermata (${come})`)
  const vive = (await pool.query(`select count(*)::int n from public.bookings where status <> 'annullata' and room_id = $1`, [ALLEGRA])).rows[0].n
  esito(vive === 1, '4b · niente è rimasto a metà')
}

// DUE SESSIONI davvero insieme sulla stessa camera e le stesse notti.
async function prova5() {
  await pulisci()
  const a = await pool.connect(), b = await pool.connect()
  let esiti = []
  try {
    await a.query('begin'); await b.query('begin')
    await inserisci({ room: AMBRA, dal: '2026-11-10', al: '2026-11-12' }, a)
    // la seconda parte mentre la prima è ancora aperta: resta in attesa
    const secondo = inserisci({ room: AMBRA, dal: '2026-11-11', al: '2026-11-13' }, b)
      .then(() => 'passata').catch(e => e.code === '23P01' ? 'fermata' : `errore ${e.code}`)
    await a.query('commit')        // solo adesso la seconda si sveglia
    esiti = ['passata', await secondo]
    await b.query('rollback')
  } finally { a.release(); b.release() }
  esito(esiti[1] === 'fermata', `5 · due sessioni sulla stessa camera: la prima ${esiti[0]}, la seconda ${esiti[1]}`)
  const quante = (await pool.query(`select count(*)::int n from public.bookings where status <> 'annullata'`)).rows[0].n
  esito(quante === 1, '5b · nel calendario è rimasta una sola prenotazione')
}

// DUE SESSIONI sull'ultimo letto della stessa notte, in CAMERE DIVERSE:
// il vincolo della camera non c'entra, deve parlare la 0054.
async function prova6() {
  await pulisci()
  await inserisci({ room: AMELIA, dal: '2026-11-20', al: '2026-11-21', ospiti: 2, letto: true, nottiLetto: ['2026-11-20'] })
  const a = await pool.connect(), b = await pool.connect()
  let esiti = []
  try {
    await a.query('begin'); await b.query('begin')
    const come = (e) => `fermata (${/LETTI_FINITI/.test(e.message) ? 'LETTI_FINITI' : e.code})`
    const primo = inserisci({ room: AMBRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] }, a)
      .then(() => 'passata').catch(come)
    // la seconda parte mentre la prima è ancora aperta: si mette in fila sul
    // lucchetto della notte e conta solo dopo che l'altra ha scritto davvero
    const secondo = inserisci({ room: ALLEGRA, dal: '2026-11-20', al: '2026-11-21', ospiti: 3, letto: true, nottiLetto: ['2026-11-20'] }, b)
      .then(() => 'passata').catch(come)
    esiti = [await primo]
    await a.query('commit')
    esiti.push(await secondo)
    await b.query('commit').catch(() => b.query('rollback'))
  } finally { a.release(); b.release() }
  const passate = esiti.filter(x => x === 'passata').length
  esito(passate === 1 && esiti.some(x => x.includes('LETTI_FINITI')),
    `6 · due sessioni sull’ultimo letto in camere diverse: ${esiti.join(' / ')}`)
  const letti = (await pool.query(
    `select count(*)::int n from public.bookings where status <> 'annullata' and extra_bed_dates ? '2026-11-20'`)).rows[0].n
  esito(letti === 2, `6b · la notte del 20 novembre i letti promessi sono 2 (trovati ${letti})`)
}

// Il guasto a metà: la 0053 fallisce dopo aver accorciato un tratto.
async function prova7() {
  await pulisci()
  const a = await inserisci({ room: AMBRA, dal: '2026-12-10', al: '2026-12-14' })
  const client = await pool.connect()
  try {
    await client.query('begin')
    // si accorcia il tratto e si chiede di annullare un id che non esiste
    await sposta(client, [{ id: a, campi: campi({ room: AMBRA, dal: '2026-12-10', al: '2026-12-12' }) }], [],
      ['99999999-9999-4999-8999-999999999999']).catch(() => {})
    await client.query('rollback')
  } finally { client.release() }
  const r = (await pool.query(`select to_char(check_out, 'YYYY-MM-DD') as al, status from public.bookings where id = $1`, [a])).rows[0]
  esito(r.al === '2026-12-14' && r.status === 'confermata',
    `7 · guasto a metà: il tratto accorciato è tornato com’era (partenza ${r.al})`)
}

// Com'era PRIMA della correzione: vincolo non differibile, stessa fusione.
async function prova8() {
  await pulisci()
  await pool.query('alter table public.bookings drop constraint bookings_camera_non_due_volte')
  await pool.query(`alter table public.bookings add constraint bookings_camera_non_due_volte
    exclude using gist (room_id with =, daterange(check_in, check_out, '[)') with &&)
    where (status <> 'annullata')`)
  const ambra = await inserisci({ room: AMBRA, dal: '2026-10-10', al: '2026-10-11' })
  const allegra = await inserisci({ room: ALLEGRA, dal: '2026-10-11', al: '2026-10-12' })
  const client = await pool.connect()
  let rifiutata = false, motivo = 'è passata'
  try {
    await client.query('begin')
    await sposta(client, [{ id: ambra, campi: campi({ room: ALLEGRA, dal: '2026-10-10', al: '2026-10-12' }) }], [], [allegra])
    await client.query('commit')
  } catch (e) { rifiutata = true; motivo = `${e.code} ${e.message.slice(0, 80)}`; await client.query('rollback') } finally { client.release() }
  esito(rifiutata, `8 · com’era prima: senza DEFERRABLE la stessa fusione non passava — ${motivo}`)
}

try {
  await prepara()
  await prova1(); await prova2(); await prova3(); await prova4(); await prova5(); await prova6(); await prova7(); await prova8()
} catch (e) {
  falliti += 1
  console.log(`NO   collaudo interrotto: ${e.message}`)
} finally {
  await pool.end()
}
console.log(falliti === 0 ? '\nTutte le prove passate.' : `\n${falliti} prove NON passate.`)
process.exit(falliti === 0 ? 0 : 1)
