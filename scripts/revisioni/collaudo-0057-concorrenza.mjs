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
  await admin.query(`create table ${SCHEMA}.payments(id uuid primary key default gen_random_uuid(), booking_id uuid references ${SCHEMA}.bookings(id), amount numeric, method text, paid_on date, created_at timestamptz default now())`)
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
