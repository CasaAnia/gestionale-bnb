// ============================================================================
// PROPOSTA 0057 (20/09/2026 sera): il conto atteso dentro la funzione server
// del pagamento. Stesso banco di prova della 0049 (PGlite, SQL sequenziale):
// NON prova la concorrenza vera, che resta un collaudo a parte.
// ============================================================================
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
const id = (n: number) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`
let db: PGlite
before(async () => {
  db = new PGlite()
  await db.exec(`create schema private;
  create function private.is_app_member() returns boolean language sql as $$ select coalesce(current_setting('test.membro',true),'si')='si' $$;
  create role authenticated; create role anon; create role service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create table bookings(id uuid primary key,guest_id uuid,group_id uuid,prenotazione_id uuid,check_in date,check_out date,total_amount numeric,status text,pagato boolean default false,bonifico boolean,accordo_pagamento text,caparra_centesimi bigint,caparra_entro timestamptz);
  create table payments(id uuid primary key default gen_random_uuid(),booking_id uuid references bookings(id),amount numeric,method text,paid_on date,created_at timestamptz default now());`)
  await db.exec(readFileSync(new URL('../supabase/proposte/0049_conto_prenotazione.BOZZA.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../supabase/proposte/0057_conto_atteso_pagamento.BOZZA.sql', import.meta.url), 'utf8'))
})
after(async () => db?.close())
beforeEach(async () => {
  await db.exec("set test.membro='si';delete from payments;delete from bookings;")
  // una prenotazione unica (prenotazione_id 8): Lena 160 + Amelia 180 in cambio camera, Ambra 300 in parallelo,
  // una riga annullata da 80 (il suo prezzo non è dovuto, un suo incasso resta nel conto); a parte una singola da 500
  await db.query(`insert into bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values
  ($1,$6,$7,$8,'2026-08-10','2026-08-12',160,'confermata'),
  ($2,$6,$7,$8,'2026-08-12','2026-08-14',180,'confermata'),
  ($3,$6,$9,$8,'2026-08-10','2026-08-16',300,'confermata'),
  ($4,$6,null,$4,'2026-08-10','2026-08-14',500,'confermata'),
  ($5,$6,null,$8,'2026-08-10','2026-08-12',80,'annullata')`, [id(1), id(2), id(3), id(4), id(5), id(6), id(7), id(8), id(9)])
})
const scalar = async (q: string, args: unknown[] = []) => (await db.query<{ r: Record<string, unknown> }>(q, args)).rows[0].r
const acconto = (b: number, k: number, n: number, totale: number | null, ricevuti: number | null) =>
  scalar("select registra_acconto_prenotazione($1,$2,$3,'contanti','2026-09-10',$4,$5) r", [id(b), id(k), n, totale, ricevuti])
const movimenti = async () => (await db.query<{ n: number; somma: string | null }>('select count(*)::int n, sum(amount) somma from payments')).rows[0]

test('col conto atteso uguale a quello vero il pagamento si scrive: 640 totali, 0 ricevuti', async () => {
  const r = await acconto(1, 10, 400, 640, 0)
  assert.equal(Number(r.importo), 400); assert.equal(r.gia_presente, false); assert.equal(r.contratto, 'prenotazione_v1')
  const m = await movimenti(); assert.equal(m.n, 1); assert.equal(Number(m.somma), 400)
  // il secondo pagamento porta il ricevuto atteso aggiornato
  const s = await acconto(3, 11, 240, 640, 400)
  assert.equal(Number(s.importo), 240)
  assert.equal((await movimenti()).n, 2)
})

test('il totale è cambiato da un altro telefono: CONTO_CAMBIATO e niente scritto', async () => {
  await db.query('update bookings set total_amount = 100 where id = $1', [id(2)])   // 640 → 560
  await assert.rejects(acconto(1, 20, 640, 640, 0), /CONTO_CAMBIATO/)
  assert.equal((await movimenti()).n, 0)
  // con le cifre nuove passa
  const r = await acconto(1, 21, 560, 560, 0)
  assert.equal(Number(r.importo), 560)
})

test('un incasso è arrivato da un altro telefono: CONTO_CAMBIATO e niente scritto; il dettaglio dice le cifre vere', async () => {
  await db.query("insert into payments(booking_id,amount,method,paid_on) values($1,30,'contanti','2026-09-10')", [id(3)])
  try { await acconto(1, 30, 640, 640, 0); assert.fail('doveva fermarsi') } catch (e) {
    const err = e as { message: string; detail?: string }
    assert.match(err.message, /CONTO_CAMBIATO/)
    assert.match(String(err.detail ?? ''), /"totale":\s*640/)
    assert.match(String(err.detail ?? ''), /"ricevuti":\s*30/)
  }
  assert.equal((await movimenti()).n, 1)
})

test('l’incasso di una riga annullata conta nel ricevuto, il suo prezzo no (come contoPrenotazione)', async () => {
  await db.query("insert into payments(booking_id,amount,method,paid_on) values($1,40,'contanti','2026-09-10')", [id(5)])
  await assert.rejects(acconto(1, 40, 600, 720, 40), /CONTO_CAMBIATO/)   // 720 conterebbe la riga annullata
  const r = await acconto(1, 41, 600, 640, 40)
  assert.equal(Number(r.importo), 600)
})

test('la chiave ripetuta dopo una risposta persa ritrova il movimento anche se il conto è cambiato proprio per quello', async () => {
  const a = await acconto(1, 50, 400, 640, 0)
  // stesso tentativo, stesse cifre attese di prima (il foglio non ha visto la risposta): niente doppione
  const b = await acconto(1, 50, 400, 640, 0)
  assert.equal(b.movimento_id, a.movimento_id); assert.equal(b.gia_presente, true)
  assert.equal((await movimenti()).n, 1)
  // chiave nuova con le cifre vecchie: si ferma
  await assert.rejects(acconto(1, 51, 240, 640, 0), /CONTO_CAMBIATO/)
})

test('senza i parametri fa come oggi; con uno solo dei due si ferma; il wrapper vecchio funziona ancora', async () => {
  const r = await scalar("select registra_acconto_prenotazione($1,$2,50,'bonifico','2026-09-10') r", [id(1), id(60)])
  assert.equal(Number(r.importo), 50)
  await assert.rejects(acconto(1, 61, 50, 640, null), /CONTO_ATTESO_INCOMPLETO/)
  await assert.rejects(acconto(1, 62, 50, null, 0), /CONTO_ATTESO_INCOMPLETO/)
  await assert.rejects(acconto(1, 63, 50, -1, 0), /CONTO_ATTESO_NON_VALIDO/)
  const w = await scalar("select registra_acconto($1,$2,20,'contanti','2026-09-10') r", [id(4), id(64)])
  assert.equal(Number(w.importo), 20)
  assert.equal((await movimenti()).n, 2)
})

test('importi non validi e non membri rifiutati; anon senza EXECUTE sulla firma nuova; una sola firma', async () => {
  await assert.rejects(acconto(1, 70, -10, 640, 0), /IMPORTO_NON_VALIDO/)
  const firme = await db.query<{ n: number }>("select count(*)::int n from pg_proc where proname = 'registra_acconto_prenotazione'")
  assert.equal(firme.rows[0].n, 1)
  const grants = await db.query<{ ok: boolean }>("select has_function_privilege('anon','registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric)','execute') ok")
  assert.equal(grants.rows[0].ok, false)
  await db.exec("set test.membro='no'")
  await assert.rejects(acconto(1, 71, 50, 640, 0), /Accesso non consentito/)
})

// ── Rilievo 1: il wrapper registra_acconto (prenotazioni senza prenotazione_id) ──
test('registra_acconto (singola e legata da group_id) passa le cifre attese: CONTO_CAMBIATO sul totale e sull’incasso, chiave riusata', async () => {
  const wrap = (b: number, k: number, n: number, totale: number | null, ricevuti: number | null) =>
    scalar("select registra_acconto($1,$2,$3,'contanti','2026-09-10',$4,$5) r", [id(b), id(k), n, totale, ricevuti])
  // singola (id 4, 500 €)
  const r = await wrap(4, 80, 200, 500, 0); assert.equal(Number(r.importo), 200)
  await assert.rejects(wrap(4, 81, 300, 500, 0), /CONTO_CAMBIATO/)          // ricevuti sono 200, non 0
  await db.query('update bookings set total_amount = 450 where id = $1', [id(4)])
  await assert.rejects(wrap(4, 82, 300, 500, 200), /CONTO_CAMBIATO/)        // totale cambiato
  const s = await wrap(4, 82, 250, 450, 200); assert.equal(Number(s.importo), 250)
  // le camere parallele (due gruppi nella stessa prenotazione) restano fuori dal wrapper (pagina vecchia)
  await assert.rejects(scalar("select registra_acconto($1,$2,10,'contanti','2026-09-10') r", [id(3), id(85)]), /PAGINA_DA_AGGIORNARE/)
  // legata da group_id (senza prenotazione_id): Lena 160 + Amelia 180 con group_id 7
  await db.query('update bookings set prenotazione_id = null where prenotazione_id = $1', [id(8)])
  const g = await wrap(1, 83, 100, 340, 0); assert.equal(Number(g.importo), 100)
  const g2 = await wrap(2, 83, 100, 340, 0); assert.equal(g2.movimento_id, g.movimento_id); assert.equal(g2.gia_presente, true)   // dall'altra camera, stessa chiave
  await assert.rejects(wrap(2, 84, 240, 340, 0), /CONTO_CAMBIATO/)          // ricevuti 100
  const fine = await wrap(2, 84, 240, 340, 100); assert.equal(Number(fine.importo), 240)
})

// ── Rilievo 2: camera aggiunta e «segna pagato» col mancante atteso ────────
test('segna_pagato_prenotazione con p_mancante_atteso = 0: se nel frattempo è arrivata una camera non inventa il saldo', async () => {
  await acconto(1, 70, 640, 640, 0)   // il conto è coperto
  // «Aggiungi camera» dall'altro telefono, fra l'acconto e il bollino
  await db.query("insert into bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values($1,$2,$3,$4,'2026-08-10','2026-08-12',160,'confermata')", [id(10), id(6), id(11), id(8)])
  // com'era prima (senza mancante atteso): il server SCRIVE 160 come incasso — il difetto
  const prima = await movimenti()
  await assert.rejects(scalar("select segna_pagato_prenotazione($1,$2,'contanti','2026-09-10',$3) r", [id(1), id(71), 0]), /CONTO_CAMBIATO/)
  const dopo = await movimenti()
  assert.equal(dopo.n, prima.n, 'CONTO_CAMBIATO non deve scrivere movimenti')
  assert.equal((await db.query<{ n: number }>('select count(*)::int n from bookings where pagato')).rows[0].n, 0, 'niente bollino')
  // il wrapper segna_pagato passa il mancante atteso allo stesso modo (singola)
  await assert.rejects(scalar("select segna_pagato($1,$2,'contanti','2026-09-10',$3) r", [id(4), id(72), 0]), /CONTO_CAMBIATO/)
  // senza il mancante atteso il comportamento resta quello di oggi (ricalcola e scrive)
  const vecchio = await scalar("select segna_pagato_prenotazione($1,$2,'contanti','2026-09-10') r", [id(1), id(73)])
  assert.equal(Number(vecchio.importo), 160)
})

test('il trigger sull’inserimento di una camera esiste e non rompe l’inserimento; l’identità che cambia non rompe la chiave', async () => {
  const t = await db.query<{ n: number }>("select count(*)::int n from pg_trigger where tgname = 'bookings_blocca_soggiorno' and not tgisinternal")
  assert.equal(t.rows[0].n, 1)
  await db.query("insert into bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values($1,$2,null,$3,'2026-08-10','2026-08-12',70,'confermata')", [id(12), id(6), id(8)])
  assert.equal((await db.query<{ n: number }>('select count(*)::int n from bookings')).rows[0].n, 6)
  // prenotazione vecchia (solo group_id): un acconto porta soggiorno = group_id;
  // poi «Aggiungi camera» scrive prenotazione_id su tutte le righe: la stessa
  // chiave, ritentata dopo una risposta persa, ritrova il movimento
  await db.query('update bookings set prenotazione_id = null where prenotazione_id = $1', [id(8)])
  const a = await scalar("select registra_acconto($1,$2,100,'contanti','2026-09-10') r", [id(1), id(74)])
  assert.equal(a.soggiorno, id(7))
  await db.query('update bookings set prenotazione_id = $1 where group_id = $2', [id(8), id(7)])
  const b = await scalar("select registra_acconto_prenotazione($1,$2,100,'contanti','2026-09-10') r", [id(1), id(74)])
  assert.equal(b.movimento_id, a.movimento_id); assert.equal(b.gia_presente, true); assert.equal(b.soggiorno, id(8))
  // e col mancante atteso il bollino guarda il soggiorno nuovo (160 + 180 = 340 − 100 = 240 mancanti)
  await assert.rejects(scalar("select segna_pagato_prenotazione($1,$2,'contanti','2026-09-10',0) r", [id(1), id(75)]), /CONTO_CAMBIATO/)
})

// ── Il ripristino (0057_RIPRISTINO): tornano le quattro firme della 0049, via il trigger ──
test('il ripristino rimette le quattro funzioni con le firme della 0049, identiche alla migrazione, senza trigger e senza anon', async () => {
  const db2 = new PGlite()
  try {
    await db2.exec(`create schema private;
    create function private.is_app_member() returns boolean language sql as $$ select true $$;
    create role authenticated; create role anon; create role service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    create table bookings(id uuid primary key,guest_id uuid,group_id uuid,prenotazione_id uuid,check_in date,check_out date,total_amount numeric,status text,pagato boolean default false,bonifico boolean,accordo_pagamento text,caparra_centesimi bigint,caparra_entro timestamptz);
    create table payments(id uuid primary key default gen_random_uuid(),booking_id uuid references bookings(id),amount numeric,method text,paid_on date,created_at timestamptz default now());`)
    await db2.exec(readFileSync(new URL('../supabase/proposte/0049_conto_prenotazione.BOZZA.sql', import.meta.url), 'utf8'))
    await db2.exec(readFileSync(new URL('../supabase/proposte/0057_conto_atteso_pagamento.BOZZA.sql', import.meta.url), 'utf8'))
    const conTrigger = await db2.query<{ n: number }>("select count(*)::int n from pg_trigger where tgname = 'bookings_blocca_soggiorno'")
    assert.equal(conTrigger.rows[0].n, 1)
    await db2.exec(readFileSync(new URL('../supabase/proposte/0057_RIPRISTINO.BOZZA.sql', import.meta.url), 'utf8'))
    const firme = await db2.query<{ proname: string; args: string }>("select proname, pg_get_function_identity_arguments(oid) args from pg_proc where proname in ('registra_acconto_prenotazione','registra_acconto','segna_pagato_prenotazione','segna_pagato') order by proname")
    assert.deepEqual(firme.rows, [
      { proname: 'registra_acconto', args: 'p_booking_id uuid, p_chiave uuid, p_amount numeric, p_metodo text, p_paid_on date' },
      { proname: 'registra_acconto_prenotazione', args: 'p_booking_id uuid, p_chiave uuid, p_amount numeric, p_metodo text, p_paid_on date' },
      { proname: 'segna_pagato', args: 'p_booking_id uuid, p_chiave uuid, p_metodo text, p_paid_on date' },
      { proname: 'segna_pagato_prenotazione', args: 'p_booking_id uuid, p_chiave uuid, p_metodo text, p_paid_on date' },
    ])
    const senzaTrigger = await db2.query<{ n: number }>("select count(*)::int n from pg_trigger where tgname = 'bookings_blocca_soggiorno'")
    assert.equal(senzaTrigger.rows[0].n, 0)
    await db2.query("insert into bookings(id,check_in,check_out,total_amount,status) values($1,'2026-08-10','2026-08-12',160,'confermata')", [id(1)])
    const r = (await db2.query<{ r: Record<string, unknown> }>("select registra_acconto_prenotazione($1,$2,50,'contanti','2026-09-10') r", [id(1), id(90)])).rows[0].r
    assert.equal(Number(r.importo), 50)
    const s2 = (await db2.query<{ r: Record<string, unknown> }>("select segna_pagato($1,$2,'contanti','2026-09-10') r", [id(1), id(91)])).rows[0].r
    assert.equal(Number(s2.importo), 110)
    const anon = await db2.query<{ ok: boolean }>("select has_function_privilege('anon','registra_acconto_prenotazione(uuid,uuid,numeric,text,date)','execute') ok")
    assert.equal(anon.rows[0].ok, false)
    // i corpi ripristinati sono quelli della migrazione applicata, riga per riga
    const migrazione = readFileSync(new URL('../supabase/migrations/0049_conto_prenotazione.sql', import.meta.url), 'utf8')
    const ripristino = readFileSync(new URL('../supabase/proposte/0057_RIPRISTINO.BOZZA.sql', import.meta.url), 'utf8')
    const corpo = (t: string, inizio: string) => t.slice(t.indexOf(inizio), t.indexOf('$$;', t.indexOf(inizio)) + 3)
    for (const inizio of ['create or replace function public.registra_acconto_prenotazione(', 'create or replace function public.segna_pagato_prenotazione(', 'create or replace function public.registra_acconto(p_booking_id', 'create or replace function public.segna_pagato(p_booking_id']) {
      assert.equal(corpo(ripristino, inizio), corpo(migrazione, inizio), inizio)
    }
  } finally { await db2.close() }
})
