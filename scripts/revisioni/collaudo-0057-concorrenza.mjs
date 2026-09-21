#!/usr/bin/env node
// ============================================================================
// COLLAUDO CONCORRENTE DELLA PROPOSTA 0057 su PostgreSQL VERO (20/09/2026).
//
// Due connessioni distinte, dati sintetici in uno SCHEMA ISOLATO creato
// apposta (le funzioni 0049 + 0057 vengono caricate con i riferimenti
// spostati nello schema di prova e il controllo membro sostituito da uno
// stub): nessuna tabella dell'applicazione viene toccata. Alla fine lo
// schema si cancella (--tieni per lasciarlo).
//
// Uso:
//   DATABASE_URL=postgres://postgres@127.0.0.1:54390/collaudo0057 node scripts/revisioni/collaudo-0057-concorrenza.mjs
// Su un server NON locale serve --consento-remoto (autorizzazione esplicita
// di Ania: il collaudo scrive uno schema nuovo su quel database).
//
// Casi (ognuno stampa OK/KO e il perché):
//   1. totale cambiato da un'altra sessione MENTRE si registra: la funzione
//      aspetta il lock di riga, poi si ferma con CONTO_CAMBIATO, niente scritto
//   2. ordine inverso: la registrazione ha il blocco, l'altra sessione aspetta
//      e il suo cambio di totale passa DOPO il pagamento (modifica successiva)
//   3. incasso concorrente da un'altra sessione (stessa funzione, senza cifre
//      attese): la nostra si mette in fila e poi si ferma con CONTO_CAMBIATO
//   4. chiave riusata dopo risposta persa: stesso movimento, nessun doppione;
//      chiave nuova con le cifre vecchie: CONTO_CAMBIATO
//   5. «togli pagamento» concorrente (DELETE diretto): la registrazione aspetta
//      la cancellazione e poi si ferma con CONTO_CAMBIATO; variante con lo
//      stallo (DELETE + UPDATE bookings in ordine inverso): una delle due
//      transazioni viene annullata da Postgres, niente scritto a metà
//   6. compatibilità: chiamate a 5 argomenti, posizionali e con nome (come
//      PostgREST), wrapper registra_acconto e segna_pagato_prenotazione
//   7. accesso: anon senza EXECUTE sulla firma nuova; una sola firma
//   8. (rilievo 1) prenotazioni SENZA prenotazione_id, via il wrapper
//      registra_acconto: singola e legata da group_id, totale cambiato durante
//      → CONTO_CAMBIATO, stessa chiave dall'altra camera → stesso movimento
//   9. (rilievo 2) «Aggiungi camera» (INSERT bookings con prenotazione_id, come
//      lo fa /nuova-prenotazione) e il pagamento: a) camera prima del conto →
//      CONTO_CAMBIATO; b) pagamento prima, camera dopo, poi il bollino con
//      mancante atteso 0 → CONTO_CAMBIATO senza saldo inventato (e la prova
//      che SENZA il mancante atteso il server scriveva 160 € dal nulla);
//      c) camera in corso (non confermata) mentre si registra: il trigger la
//      mette in fila, poi CONTO_CAMBIATO; c') l'inverso, la camera aspetta il
//      pagamento; d) la sequenza dell'app: acconto, camera, bollino → niente
//      movimento inventato, niente bollino
//  10. (rilievo 2) «Aggiungi camera» su una prenotazione VECCHIA: l'identità
//      passa da group_id a prenotazione_id mentre un pagamento aspetta: la
//      funzione rilegge l'identità sotto lock, scrive col soggiorno nuovo, e
//      la stessa chiave ritentata lo ritrova
//  11. (21/09/2026) risposta persa con la SCRITTURA ANCORA IN CORSO: la
//      transazione della prima richiesta non è confermata, «Verifica pagamento»
//      non vede niente, «Riprova lo stesso pagamento» (stessa chiave) aspetta
//      sul lock e ritrova lo stesso movimento; l'ordine inverso; la controprova
//      con l'importo cambiato (chiave nuova → doppione senza cifre attese);
//      gruppo e singola via wrapper; il saldo con il bollino a mancante 0
// ============================================================================
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('Serve DATABASE_URL (es. postgres://postgres@127.0.0.1:54390/collaudo0057)'); process.exit(2) }
const host = new URL(url).hostname
const locale = ['127.0.0.1', 'localhost', '::1'].includes(host)
if (!locale && !process.argv.includes('--consento-remoto')) { console.error(`Host ${host} non locale: serve --consento-remoto (autorizzazione esplicita)`); process.exit(2) }
const tieni = process.argv.includes('--tieni')
const SCHEMA = `collaudo_0057_${Date.now().toString(36)}`
const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const id = n => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`

// Il SQL di produzione e la proposta, spostati nello schema di prova
function adatta(sql) {
  return sql
    .replace(/\bpublic\./g, `${SCHEMA}.`)
    .replace(/private\.is_app_member\(\)/g, `${SCHEMA}.is_app_member()`)
    .replace(/table_schema\s*=\s*'public'/g, `table_schema='${SCHEMA}'`)   // il guardiano della 0049 («Manca 0047»)
    .replace(/^\s*(begin|commit);\s*$/gim, '')
}

const esiti = []
const segna = (n, ok, nota) => { esiti.push({ n, ok, nota }); console.log(`${ok ? 'OK' : 'KO'}  ${n}${nota ? ' — ' + nota : ''}`) }
const attesa = ms => new Promise(r => setTimeout(r, ms))
const errore = e => String(e?.message ?? e)

async function conn() { const c = new pg.Client({ connectionString: url }); await c.connect(); await c.query(`set search_path to ${SCHEMA}, public`); return c }

async function prepara(admin) {
  await admin.query(`create schema ${SCHEMA}`)
  await admin.query(`set search_path to ${SCHEMA}, public`)
  for (const r of ['authenticated', 'anon', 'service_role']) {
    const c = await admin.query('select 1 from pg_roles where rolname = $1', [r])
    if (!c.rowCount) await admin.query(`create role ${r}`)
  }
  await admin.query(`create function ${SCHEMA}.is_app_member() returns boolean language sql as $$ select coalesce(current_setting('collaudo.membro', true), 'si') = 'si' $$`)
  await admin.query(`create table ${SCHEMA}.bookings(id uuid primary key, guest_id uuid, group_id uuid, prenotazione_id uuid, check_in date, check_out date, total_amount numeric, status text, pagato boolean default false, bonifico boolean, accordo_pagamento text, caparra_centesimi bigint, caparra_entro timestamptz)`)
  await admin.query(`create table ${SCHEMA}.payments(id uuid primary key default gen_random_uuid(), booking_id uuid references ${SCHEMA}.bookings(id), amount numeric, method text, paid_on date, note text, created_at timestamptz default now())`)
  await admin.query(adatta(readFileSync(path.join(radice, 'supabase/migrations/0049_conto_prenotazione.sql'), 'utf8')))
  await admin.query(adatta(readFileSync(path.join(radice, 'supabase/proposte/0057_conto_atteso_pagamento.BOZZA.sql'), 'utf8')))
}
async function semina(admin) {
  await admin.query(`delete from ${SCHEMA}.payments; delete from ${SCHEMA}.bookings`)
  // prenotazione unica (prenotazione_id 8): Lena 160 + Amelia 180 (cambio camera), Ambra 300 in parallelo = 640; una singola da 500
  await admin.query(`insert into ${SCHEMA}.bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values
    ($1,$5,$6,$7,'2026-08-10','2026-08-12',160,'confermata'),
    ($2,$5,$6,$7,'2026-08-12','2026-08-14',180,'confermata'),
    ($3,$5,$8,$7,'2026-08-10','2026-08-16',300,'confermata'),
    ($4,$5,null,$4,'2026-08-10','2026-08-14',500,'confermata')`, [id(1), id(2), id(3), id(4), id(6), id(7), id(8), id(9)])
}
const movimenti = async c => (await c.query(`select count(*)::int n, coalesce(sum(amount),0)::numeric somma from ${SCHEMA}.payments`)).rows[0]
const registra = (c, b, k, importo, totale, ricevuti) =>
  c.query(`select ${SCHEMA}.registra_acconto_prenotazione($1,$2,$3::numeric,'contanti','2026-09-10',$4::numeric,$5::numeric) r`, [id(b), id(k), importo, totale, ricevuti]).then(x => x.rows[0].r)

async function main() {
  const admin = await conn()
  const inizio = Date.now()
  try {
    await prepara(admin)
    const A = await conn(), B = await conn()
    const a = await A.query('select pg_backend_pid() p'), b = await B.query('select pg_backend_pid() p')
    console.log(`schema ${SCHEMA}, backend A ${a.rows[0].p}, backend B ${b.rows[0].p}`)

    // 1. totale cambiato da B mentre A registra: A aspetta il lock di riga, poi CONTO_CAMBIATO
    await semina(admin)
    await B.query('begin'); await B.query(`update ${SCHEMA}.bookings set total_amount = 100 where id = $1`, [id(2)])
    const t1 = Date.now()
    const pA = registra(A, 1, 10, 640, 640, 0).then(r => ({ r }), e => ({ e }))
    await attesa(400)
    const inAttesa = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [a.rows[0].p])).rows[0].n === 1
    await B.query('commit')
    const esitoA = await pA
    const m1 = await movimenti(admin)
    segna('1. totale cambiato durante la registrazione → CONTO_CAMBIATO, niente scritto', inAttesa && !!esitoA.e && /CONTO_CAMBIATO/.test(errore(esitoA.e)) && m1.n === 0,
      `A ha aspettato il lock: ${inAttesa}; esito A: ${esitoA.e ? errore(esitoA.e) : 'scritto?!'}; movimenti ${m1.n}; ${Date.now() - t1} ms`)

    // 2. ordine inverso: A ha il blocco (transazione aperta), B aspetta; il pagamento passa, il cambio di B arriva dopo
    await semina(admin)
    await A.query('begin')
    const rA = await registra(A, 1, 11, 640, 640, 0)
    const pB = B.query(`update ${SCHEMA}.bookings set total_amount = 100 where id = $1`, [id(2)]).then(() => 'fatto', e => 'errore ' + errore(e))
    await attesa(400)
    const bAspetta = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [b.rows[0].p])).rows[0].n === 1
    await A.query('commit')
    const esitoB = await pB
    const m2 = await movimenti(admin)
    const tot2 = (await admin.query(`select total_amount from ${SCHEMA}.bookings where id = $1`, [id(2)])).rows[0].total_amount
    segna('2. ordine inverso: la registrazione passa, il cambio di totale aspetta e arriva dopo', bAspetta && Number(rA.importo) === 640 && esitoB === 'fatto' && m2.n === 1 && Number(tot2) === 100,
      `B ha aspettato: ${bAspetta}; pagamento ${rA.importo}; poi totale ${tot2}; movimenti ${m2.n}`)

    // 3. incasso concorrente: B registra 30 (senza cifre attese) in una transazione aperta; A con le cifre attese si mette in fila → CONTO_CAMBIATO
    await semina(admin)
    await B.query('begin'); await B.query(`select ${SCHEMA}.registra_acconto_prenotazione($1,$2,30,'contanti','2026-09-10') r`, [id(3), id(20)])
    const pA3 = registra(A, 1, 21, 640, 640, 0).then(r => ({ r }), e => ({ e }))
    await attesa(400)
    const aInFila = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [a.rows[0].p])).rows[0].n === 1
    await B.query('commit')
    const esitoA3 = await pA3
    const m3 = await movimenti(admin)
    segna('3. incasso concorrente da un’altra sessione → in fila sul lock, poi CONTO_CAMBIATO', aInFila && !!esitoA3.e && /CONTO_CAMBIATO/.test(errore(esitoA3.e)) && m3.n === 1 && Number(m3.somma) === 30,
      `A in fila: ${aInFila}; esito A: ${esitoA3.e ? errore(esitoA3.e) : 'scritto?!'}; movimenti ${m3.n} (${m3.somma} €)`)

    // 4. chiave riusata dopo risposta persa
    await semina(admin)
    const k1 = await registra(A, 1, 30, 400, 640, 0)
    const k2 = await registra(B, 1, 30, 400, 640, 0)   // stessa chiave, stesse cifre attese di prima (la risposta si era persa)
    const m4 = await movimenti(admin)
    let nuovaChiave = null
    try { await registra(A, 1, 31, 240, 640, 0) } catch (e) { nuovaChiave = errore(e) }
    segna('4. chiave riusata dopo risposta persa → stesso movimento; chiave nuova con cifre vecchie → CONTO_CAMBIATO',
      k1.movimento_id === k2.movimento_id && k2.gia_presente === true && m4.n === 1 && /CONTO_CAMBIATO/.test(nuovaChiave ?? ''),
      `movimento ${String(k1.movimento_id).slice(0, 8)} = ${String(k2.movimento_id).slice(0, 8)}, gia_presente ${k2.gia_presente}, movimenti ${m4.n}; chiave nuova: ${nuovaChiave}`)

    // 5. «togli pagamento» concorrente (DELETE diretto, senza lock consultivo)
    await semina(admin)
    const x = await registra(A, 1, 40, 400, 640, 0)
    await B.query('begin'); await B.query(`delete from ${SCHEMA}.payments where id = $1`, [x.movimento_id])
    const pA5 = registra(A, 1, 41, 240, 640, 400).then(r => ({ r }), e => ({ e }))
    await attesa(400)
    const aAspetta5 = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [a.rows[0].p])).rows[0].n === 1
    await B.query('commit')
    const esitoA5 = await pA5
    const m5 = await movimenti(admin)
    segna('5a. «togli» in corso: la registrazione aspetta la cancellazione, poi CONTO_CAMBIATO', aAspetta5 && !!esitoA5.e && /CONTO_CAMBIATO/.test(errore(esitoA5.e)) && m5.n === 0,
      `A ha aspettato: ${aAspetta5}; esito A: ${esitoA5.e ? errore(esitoA5.e) : 'scritto?!'}; movimenti ${m5.n}`)
    // 5b. lo stallo: B cancella (lock sul movimento) e poi tocca bookings; A ha bookings e vuole il movimento
    await semina(admin)
    const y = await registra(A, 1, 42, 400, 640, 0)
    await A.query('begin'); await A.query(`select ${SCHEMA}.blocca_soggiorno($1)`, [id(8)])   // A come dentro la funzione: bookings bloccate
    await B.query('begin'); await B.query(`delete from ${SCHEMA}.payments where id = $1`, [y.movimento_id])
    const pA5b = A.query(`select p.id from ${SCHEMA}.payments p where p.booking_id in (select id from ${SCHEMA}.bookings where prenotazione_id = $1) for update`, [id(8)]).then(() => 'ok', e => 'errore ' + (e.code || errore(e)))
    await attesa(300)
    const pB5b = B.query(`update ${SCHEMA}.bookings set pagato = false where id = $1`, [id(1)]).then(() => 'ok', e => 'errore ' + (e.code || errore(e)))
    const [eA, eB] = await Promise.all([pA5b, pB5b])
    for (const c of [A, B]) { try { await c.query('rollback') } catch { /* già annullata */ } }
    const m5b = await movimenti(admin)
    const stallo = [eA, eB].filter(e => e.includes('40P01')).length
    segna('5b. stallo DELETE+UPDATE contro il blocco: Postgres annulla una transazione (40P01), niente scritto a metà', stallo === 1 && m5b.n === 1,
      `A: ${eA}; B: ${eB}; movimenti ${m5b.n} (il 400 è ancora lì: il «togli» è stato annullato o mai confermato)`)

    // 6. compatibilità con le chiamate esistenti
    await semina(admin)
    const c5 = (await A.query(`select ${SCHEMA}.registra_acconto_prenotazione($1,$2,50,'bonifico','2026-09-10') r`, [id(1), id(50)])).rows[0].r
    const cNome5 = (await A.query(`select ${SCHEMA}.registra_acconto_prenotazione(p_booking_id => $1, p_chiave => $2, p_amount => 20, p_metodo => 'contanti', p_paid_on => '2026-09-10') r`, [id(3), id(51)])).rows[0].r
    const cNome7 = (await A.query(`select ${SCHEMA}.registra_acconto_prenotazione(p_booking_id => $1, p_chiave => $2, p_amount => 10, p_metodo => 'contanti', p_paid_on => '2026-09-10', p_totale_atteso => 640, p_ricevuti_attesi => 70) r`, [id(3), id(52)])).rows[0].r
    const w = (await A.query(`select ${SCHEMA}.registra_acconto($1,$2,15,'contanti','2026-09-10') r`, [id(4), id(53)])).rows[0].r
    const s = (await A.query(`select ${SCHEMA}.segna_pagato_prenotazione($1,$2,'contanti','2026-09-10') r`, [id(2), id(54)])).rows[0].r
    const m6 = await movimenti(admin)
    segna('6. compatibilità: 5 argomenti posizionali e con nome (PostgREST), 7 con nome, wrapper registra_acconto, segna_pagato_prenotazione',
      Number(c5.importo) === 50 && Number(cNome5.importo) === 20 && Number(cNome7.importo) === 10 && Number(w.importo) === 15 && Number(s.importo) === 560 && m6.n === 5 && Number(m6.somma) === 655,
      `importi 50/20/10/15, saldo ${s.importo}, movimenti ${m6.n} = ${m6.somma} €`)

    // 7. permessi e firma unica
    const firme = (await admin.query(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = $1 and p.proname = 'registra_acconto_prenotazione'`, [SCHEMA])).rows[0].n
    const anon = (await admin.query(`select has_function_privilege('anon', '${SCHEMA}.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric)', 'execute') ok`)).rows[0].ok
    const auth = (await admin.query(`select has_function_privilege('authenticated', '${SCHEMA}.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric)', 'execute') ok`)).rows[0].ok
    await A.query("set collaudo.membro = 'no'")
    let nonMembro = null
    try { await registra(A, 1, 60, 5, 640, 0) } catch (e) { nonMembro = errore(e) }
    segna('7. una sola firma; anon senza EXECUTE, authenticated con; non membro rifiutato', firme === 1 && anon === false && auth === true && /Accesso non consentito/.test(nonMembro ?? ''),
      `firme ${firme}; anon ${anon}; authenticated ${auth}; non membro: ${nonMembro}`)
    await A.query("set collaudo.membro = 'si'")   // reset lascerebbe la stringa vuota, non il default

    // ── Rilievo 1: prenotazioni senza prenotazione_id (wrapper registra_acconto) ──
    const seminaVecchia = async () => { await semina(admin); await admin.query(`update ${SCHEMA}.bookings set prenotazione_id = null`) }   // 1+2 legate da group_id 7 (340), 3 sola (300), 4 sola (500)
    const wrap = (c, b, k, importo, totale, ricevuti) =>
      c.query(`select ${SCHEMA}.registra_acconto($1,$2,$3::numeric,'contanti','2026-09-10',$4::numeric,$5::numeric) r`, [id(b), id(k), importo, totale, ricevuti]).then(x => x.rows[0].r)
    await seminaVecchia()
    await B.query('begin'); await B.query(`update ${SCHEMA}.bookings set total_amount = 100 where id = $1`, [id(2)])
    const pA8 = wrap(A, 1, 80, 340, 340, 0).then(r => ({ r }), e => ({ e }))
    await attesa(400)
    const aAspetta8 = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [a.rows[0].p])).rows[0].n === 1
    await B.query('commit')
    const esitoA8 = await pA8
    const r8 = await wrap(A, 1, 81, 100, 260, 0)
    const r8b = await wrap(B, 2, 81, 100, 260, 0)   // stessa chiave dall'altra camera del gruppo
    const r8s = await wrap(A, 4, 82, 500, 500, 0)   // la singola
    const m8 = await movimenti(admin)
    segna('8. wrapper registra_acconto (group_id e singola): totale cambiato durante → CONTO_CAMBIATO; stessa chiave → stesso movimento',
      aAspetta8 && !!esitoA8.e && /CONTO_CAMBIATO/.test(errore(esitoA8.e)) && Number(r8.importo) === 100 && r8b.movimento_id === r8.movimento_id && r8b.gia_presente === true && Number(r8s.importo) === 500 && m8.n === 2,
      `A ha aspettato: ${aAspetta8}; esito: ${esitoA8.e ? errore(esitoA8.e) : 'scritto?!'}; poi 100 (gruppo) e 500 (singola), movimenti ${m8.n}`)

    // ── Rilievo 2: «Aggiungi camera» = INSERT in bookings con prenotazione_id (come /nuova-prenotazione) ──
    const camera = (c, n = 10, totale = 160) => c.query(`insert into ${SCHEMA}.bookings(id,guest_id,group_id,prenotazione_id,check_in,check_out,total_amount,status) values($1,$2,$3,$4,'2026-08-10','2026-08-12',$5,'confermata')`, [id(n), id(6), id(n + 20), id(8), totale])
    const bollino = (c, b, k, mancante) => c.query(`select ${SCHEMA}.segna_pagato_prenotazione($1,$2,'contanti','2026-09-10',$3::numeric) r`, [id(b), id(k), mancante]).then(x => x.rows[0].r)
    const stato = async () => {
      const t = (await admin.query(`select coalesce(sum(total_amount),0)::numeric t from ${SCHEMA}.bookings where prenotazione_id = $1 and status in ('confermata','completata')`, [id(8)])).rows[0].t
      const m = await movimenti(admin)
      const f = (await admin.query(`select count(*)::int n from ${SCHEMA}.bookings where prenotazione_id = $1 and pagato`, [id(8)])).rows[0].n
      return { totale: Number(t), ricevuti: Number(m.somma), movimenti: m.n, pagati: f }
    }
    // 9a. camera prima del conto
    await semina(admin); await camera(B)
    let e9a = null; try { await registra(A, 1, 90, 640, 640, 0) } catch (e) { e9a = errore(e) }
    const ok9a = await registra(A, 1, 91, 800, 800, 0)
    segna('9a. camera aggiunta PRIMA: le cifre vecchie → CONTO_CAMBIATO; con le nuove passa', /CONTO_CAMBIATO/.test(e9a ?? '') && Number(ok9a.importo) === 800, `${e9a}; poi ${ok9a.importo}`)
    // 9b. pagamento prima, camera dopo, poi il bollino: col mancante atteso 0 niente saldo inventato; SENZA (com'era) il server scrive 160 dal nulla
    await semina(admin); await registra(A, 1, 92, 640, 640, 0); await camera(B)
    let e9b = null; try { await bollino(A, 1, 93, 0) } catch (e) { e9b = errore(e) }
    const s9b = await stato()
    const vecchio = await A.query(`select ${SCHEMA}.segna_pagato_prenotazione($1,$2,'contanti','2026-09-10') r`, [id(1), id(94)]).then(x => x.rows[0].r)
    const s9bVecchio = await stato()
    segna('9b. pagamento, poi camera, poi bollino con mancante atteso 0 → CONTO_CAMBIATO, 1 movimento, 0 bollini; senza il mancante atteso il server INVENTAVA 160 €',
      /CONTO_CAMBIATO/.test(e9b ?? '') && s9b.movimenti === 1 && s9b.pagati === 0 && s9b.totale === 800 && Number(vecchio.importo) === 160 && s9bVecchio.movimenti === 2,
      `con atteso: ${e9b}, stato ${JSON.stringify(s9b)}; senza atteso: movimento ${vecchio.importo}, stato ${JSON.stringify(s9bVecchio)}`)
    // 9c. camera in corso (non confermata) mentre si registra: il trigger la mette in fila
    await semina(admin)
    await B.query('begin'); await camera(B)
    const pA9c = registra(A, 1, 95, 640, 640, 0).then(r => ({ r }), e => ({ e }))
    await attesa(400)
    const aAspetta9c = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [a.rows[0].p])).rows[0].n === 1
    await B.query('commit')
    const esitoA9c = await pA9c
    const s9c = await stato()
    segna('9c. camera in corso mentre si registra: la registrazione aspetta il trigger, poi CONTO_CAMBIATO, niente scritto', aAspetta9c && !!esitoA9c.e && /CONTO_CAMBIATO/.test(errore(esitoA9c.e)) && s9c.movimenti === 0 && s9c.totale === 800,
      `A ha aspettato: ${aAspetta9c}; esito: ${esitoA9c.e ? errore(esitoA9c.e) : 'scritto?!'}; stato ${JSON.stringify(s9c)}`)
    // 9c'. l'inverso: la registrazione ha il lock, la camera aspetta e arriva dopo
    await semina(admin)
    await A.query('begin'); const rA9 = await registra(A, 1, 96, 640, 640, 0)
    const pB9 = camera(B).then(() => 'inserita', e => 'errore ' + errore(e))
    await attesa(400)
    const bAspetta9 = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [b.rows[0].p])).rows[0].n === 1
    await A.query('commit'); const esitoB9 = await pB9
    let e9d = null; try { await bollino(A, 1, 97, 0) } catch (e) { e9d = errore(e) }   // la sequenza dell'app: acconto → (camera) → bollino
    const s9d = await stato()
    segna("9c'/9d. la camera aspetta il pagamento in corso; poi la sequenza dell'app (acconto → camera → bollino 0) non inventa niente e non mette bollini",
      bAspetta9 && Number(rA9.importo) === 640 && esitoB9 === 'inserita' && /CONTO_CAMBIATO/.test(e9d ?? '') && s9d.movimenti === 1 && s9d.pagati === 0 && s9d.totale === 800 && s9d.ricevuti === 640,
      `B ha aspettato: ${bAspetta9}; camera ${esitoB9}; bollino: ${e9d}; stato ${JSON.stringify(s9d)}`)

    // ── Rilievo 2: l'identità che cambia (Aggiungi camera su una prenotazione vecchia) ──
    await seminaVecchia()
    await B.query('begin'); await B.query(`update ${SCHEMA}.bookings set prenotazione_id = $1 where group_id = $2`, [id(8), id(7)])   // il legame scritto dalla scheda, non ancora confermato
    const pA10 = wrap(A, 1, 100, 340, 340, 0).then(r => ({ r }), e => ({ e }))
    await attesa(400)
    const aAspetta10 = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [a.rows[0].p])).rows[0].n === 1
    await B.query('commit')
    const esitoA10 = await pA10
    const di_nuovo = await registra(A, 2, 100, 340, 340, 0).then(r => ({ r }), e => ({ e }))   // stessa chiave, dall'identità nuova
    const s10 = await stato()
    const sogg = (await admin.query(`select soggiorno from ${SCHEMA}.payments`)).rows.map(r => r.soggiorno)
    segna('10. identità che cambia (group_id → prenotazione_id) mentre un pagamento aspetta: rilettura sotto lock, scritto col soggiorno nuovo, stessa chiave ritrovata',
      aAspetta10 && !!esitoA10.r && Number(esitoA10.r.importo) === 340 && esitoA10.r.soggiorno === id(8) && !!di_nuovo.r && di_nuovo.r.gia_presente === true && s10.movimenti === 1 && sogg[0] === id(8),
      `A ha aspettato: ${aAspetta10}; esito: ${esitoA10.r ? `${esitoA10.r.importo} su soggiorno …${String(esitoA10.r.soggiorno).slice(-2)}` : errore(esitoA10.e)}; chiave ritentata: ${di_nuovo.r ? 'gia_presente ' + di_nuovo.r.gia_presente : errore(di_nuovo.e)}; movimenti ${s10.movimenti}`)

    // ── 21/09/2026: risposta persa con la SCRITTURA ANCORA IN CORSO ──
    // A = la prima richiesta dell'app: la funzione ha scritto ma la transazione
    // non è confermata (il gateway ha già risposto 503 al telefono). B = l'app
    // che «verifica» (non vede niente) e poi «riprova lo stesso pagamento» con
    // la STESSA chiave: si mette in fila sul lock, e quando A conferma trova
    // il movimento (gia_presente). Un solo movimento, importo giusto.
    const tardiva = async (nome, avvia, stessaChiave, verifica) => {
      await A.query('begin'); const rA = await avvia(A)
      const vistiPrima = await verifica(B)                                    // «Verifica pagamento» mentre A è in corso: niente
      const pB = stessaChiave(B).then(r => ({ r }), e => ({ e }))            // «Riprova lo stesso pagamento»
      await attesa(400)
      const bAspetta = (await admin.query(`select count(*)::int n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`, [b.rows[0].p])).rows[0].n === 1
      await A.query('commit'); const esitoB = await pB
      const m = await movimenti(admin)
      const trovatoDopo = await verifica(B)
      segna(nome, vistiPrima === 0 && bAspetta && !!esitoB.r && esitoB.r.gia_presente === true && esitoB.r.movimento_id === rA.movimento_id && m.n === 1 && trovatoDopo === 1,
        `verifica durante: ${vistiPrima} righe; B in fila: ${bAspetta}; riprova: ${esitoB.r ? `gia_presente ${esitoB.r.gia_presente}, stesso id ${esitoB.r.movimento_id === rA.movimento_id}` : errore(esitoB.e)}; movimenti ${m.n} (${m.somma} €); verifica dopo: ${trovatoDopo} riga`)
    }
    const conChiave = (c, k) => c.query(`select count(*)::int n from ${SCHEMA}.payments where chiave_operazione = $1`, [id(k)]).then(x => x.rows[0].n)
    // 11a. prenotazione con prenotazione_id
    await semina(admin)
    await tardiva('11a. scrittura tardiva (prenotazione_id): verifica non vede, riprova con la stessa chiave aspetta A e ritrova lo stesso movimento',
      c => registra(c, 1, 110, 20, 640, 0), c => registra(c, 1, 110, 20, 640, 0), c => conChiave(c, 110))
    // 11b. l'ordine inverso: la riprova arriva PRIMA che la richiesta originale tocchi il database; l'originale poi trova la chiave
    await semina(admin)
    const r11b = await registra(B, 1, 111, 20, 640, 0)
    const o11b = await registra(A, 1, 111, 20, 640, 0)
    const m11b = await movimenti(admin)
    segna('11b. riprova arrivata prima dell’originale: l’originale trova la chiave (gia_presente), un solo movimento',
      r11b.gia_presente === false && o11b.gia_presente === true && o11b.movimento_id === r11b.movimento_id && m11b.n === 1, `riprova scritta, originale gia_presente ${o11b.gia_presente}, movimenti ${m11b.n}`)
    // 11c. la CONTROPROVA: riprovare con importo cambiato (= chiave nuova) mentre A è in corso → DUE movimenti.
    //      È il difetto che l'app evita tenendo fermi i dati del tentativo finché l'esito non è risolto.
    await semina(admin)
    await A.query('begin'); const rA11c = await registra(A, 1, 112, 20, 640, 0)
    const pB11c = registra(B, 1, 113, 30, 640, 0).then(r => ({ r }), e => ({ e }))
    await attesa(300); await A.query('commit'); const eB11c = await pB11c
    const m11c = await movimenti(admin)
    segna('11c. controprova: importo cambiato durante il recupero (chiave nuova) → con la 0057 CONTO_CAMBIATO (ricevuti 20 ≠ 0), senza cifre attese sarebbero due movimenti',
      Number(rA11c.importo) === 20 && !!eB11c.e && /CONTO_CAMBIATO/.test(errore(eB11c.e)) && m11c.n === 1, `originale 20; chiave nuova: ${eB11c.e ? errore(eB11c.e) : 'scritto: ' + eB11c.r.importo}; movimenti ${m11c.n}`)
    const senza11c = await A.query(`select ${SCHEMA}.registra_acconto_prenotazione($1,$2,30,'contanti','2026-09-10') r`, [id(1), id(114)]).then(x => x.rows[0].r)
    const m11c2 = await movimenti(admin)
    segna('11c’. la stessa chiave nuova SENZA cifre attese (pagine vecchie): secondo movimento — perciò l’app non lascia cambiare i dati del tentativo',
      Number(senza11c.importo) === 30 && m11c2.n === 2 && Number(m11c2.somma) === 50, `movimenti ${m11c2.n} = ${m11c2.somma} €`)
    // 11d/11e. gli stessi percorsi senza prenotazione_id: gruppo (group_id) e singola, via il wrapper registra_acconto
    await seminaVecchia()
    await tardiva('11d. scrittura tardiva (group_id, wrapper registra_acconto): verifica non vede, riprova con la stessa chiave dall’altra camera del gruppo ritrova lo stesso movimento',
      c => wrap(c, 1, 115, 20, 340, 0), c => wrap(c, 2, 115, 20, 340, 0), c => conChiave(c, 115))
    await seminaVecchia()
    await tardiva('11e. scrittura tardiva (singola, wrapper registra_acconto): stessa sequenza',
      c => wrap(c, 4, 116, 20, 500, 0), c => wrap(c, 4, 116, 20, 500, 0), c => conChiave(c, 116))
    // 11f. dopo la conferma: il saldo con la stessa sequenza (registrazione tardiva del residuo, poi il bollino con mancante atteso 0)
    await semina(admin)
    await A.query('begin'); const rA11f = await registra(A, 1, 117, 640, 640, 0)
    const pB11f = registra(B, 1, 117, 640, 640, 0).then(r => ({ r }), e => ({ e }))
    await attesa(300); await A.query('commit'); const eB11f = await pB11f
    const boll = await bollino(B, 1, 118, 0)
    const s11f = await stato()
    segna('11f. saldo con scrittura tardiva: riprova stessa chiave → gia_presente; poi il bollino con mancante atteso 0 mette «pagato» senza inventare niente',
      !!eB11f.r && eB11f.r.gia_presente === true && Number(rA11f.importo) === 640 && boll.pagato === true && boll.movimento_id === null && s11f.movimenti === 1 && s11f.pagati === 3,
      `riprova ${eB11f.r ? 'gia_presente ' + eB11f.r.gia_presente : errore(eB11f.e)}; bollino: pagato ${boll.pagato}, movimento ${boll.movimento_id}; stato ${JSON.stringify(s11f)}`)

    // 12. la nota del movimento ritrovato: l'app la scrive con un UPDATE condizionato (note is null), come
    //     supabase.from('payments').update({note}).eq('id',…).is('note',null): una nota scritta nel frattempo non si sovrascrive
    await semina(admin)
    const r12 = await registra(A, 1, 120, 20, 640, 0)
    const n1 = (await B.query(`update ${SCHEMA}.payments set note = 'scritta da un altro telefono' where id = $1 and note is null returning id`, [r12.movimento_id])).rowCount
    const n2 = (await A.query(`update ${SCHEMA}.payments set note = 'la nostra' where id = $1 and note is null returning id`, [r12.movimento_id])).rowCount
    const nota12 = (await admin.query(`select note from ${SCHEMA}.payments where id = $1`, [r12.movimento_id])).rows[0].note
    segna('12. nota condizionata (note is null): la prima scrittura passa, la seconda tocca 0 righe e la nota resta quella di prima',
      n1 === 1 && n2 === 0 && nota12 === 'scritta da un altro telefono', `prima ${n1} riga, seconda ${n2} righe, nota «${nota12}»`)

    await A.end(); await B.end()
  } finally {
    if (!tieni) { try { await admin.query(`drop schema ${SCHEMA} cascade`) } catch (e) { console.error('pulizia fallita:', errore(e)) } }
    await admin.end()
  }
  const ko = esiti.filter(e => !e.ok).length
  console.log(`\n${esiti.length} casi, ${esiti.length - ko} OK, ${ko} KO — ${Date.now() - inizio} ms — schema ${tieni ? 'tenuto' : 'cancellato'}: ${SCHEMA}`)
  process.exit(ko ? 1 : 0)
}
main().catch(e => { console.error('errore del collaudo:', errore(e)); process.exit(1) })
