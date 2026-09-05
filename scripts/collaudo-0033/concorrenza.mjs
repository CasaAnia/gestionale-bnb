#!/usr/bin/env node
// Collaudo su PostgreSQL VERO delle proposte 0033 e 0034 con sessioni
// realmente concorrenti e ruoli simulati — NON tocca produzione: serve un
// database di COLLAUDO indicato da DATABASE_URL su cui sono state applicate le
// migrazioni e le proposte (scripts/collaudo-0033/applica-migrazioni.mjs).
// Le righe di prova vengono cancellate alla fine.
//
// Uso: DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo_0033 node scripts/collaudo-0033/concorrenza.mjs
//
// Prove:
//  1. due sessioni chiamano segna_pagato nello stesso istante da segmenti
//     diversi dello stesso soggiorno con chiavi diverse → UN solo movimento;
//  2. due ricostruzioni concorrenti con chiavi diverse sullo stesso soggiorno
//     → una scrive, l'altra «nulla_da_scrivere»;
//  3. la stessa chiave su un altro soggiorno → CHIAVE_RIUSATA senza effetti;
//  4. ruolo anon (SET ROLE, senza JWT): niente EXECUTE sulle RPC, niente
//     lettura di room_closures;
//  5. ruolo authenticated con JWT: RPC eseguibile, room_closures leggibile e
//     scrivibile; senza JWT → NON_AUTENTICATO.
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.log('DA COLLAUDARE: nessuna DATABASE_URL — il collaudo concorrente della 0033 non è partito.'); process.exit(2) }
const R1 = '11111111-1111-4111-8111-111111111111', R4 = '19ae4611-c0a4-42ae-8530-210f9a948e9e'
const G = 'aaaaaaaa-0001-4000-8000-000000000001'
const A = 'bbbbbbbb-0001-4000-8000-000000000001', B = 'bbbbbbbb-0002-4000-8000-000000000002', D = 'bbbbbbbb-0004-4000-8000-000000000004'
const GRUPPO = 'dddddddd-0001-4000-8000-000000000001'
const UTENTE = 'cccccccc-0000-4000-8000-000000000000'
const K = n => `eeeeeeee-${String(n).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`
const pool = new pg.Pool({ connectionString: url, max: 5 })
const esiti = []
const ok = (nome, cond, dettaglio = '') => { esiti.push([cond ? 'OK' : 'FALLITO', nome, dettaglio]); if (!cond) process.exitCode = 1 }
const pulizia = async c => {
  await c.query('delete from public.payments where booking_id in ($1,$2,$3)', [A, B, D])
  await c.query('delete from public.room_closures where room_id in ($1,$2)', [R1, R4])
  await c.query('delete from public.bookings where id in ($1,$2,$3)', [A, B, D])
  await c.query('delete from public.guests where id = $1', [G])
  await c.query('delete from public.rooms where id in ($1,$2)', [R1, R4])
  await c.query('drop role if exists collaudo_app')
}
try {
  const c0 = await pool.connect()
  await pulizia(c0)
  await c0.query(`insert into public.rooms (id, name, bathroom_type, base_price) values ($1, 'Amelia (collaudo)', 'privato_interno', 70), ($2, 'Lena (collaudo)', 'privato_esterno', 80)`, [R1, R4])
  await c0.query(`insert into public.guests (id, phone, full_name) values ($1, '39333000000', 'Rossi (collaudo)')`, [G])
  await c0.query(`insert into public.bookings (id, room_id, guest_id, check_in, check_out, price_per_night, total_amount, status, group_id) values
    ($1, $3, $5, '2026-06-01', '2026-06-03', 80, 160, 'confermata', $6),
    ($2, $4, $5, '2026-06-03', '2026-06-05', 90, 180, 'confermata', $6),
    ($7, $3, $5, '2026-06-10', '2026-06-12', 50, 100, 'completata', null)`, [A, B, R1, R4, G, GRUPPO, D])
  // ruolo di LOGIN che impersona i ruoli di Supabase (session_user ≠ postgres, come dietro PostgREST)
  await c0.query(`create role collaudo_app login password 'collaudo'`)
  await c0.query('grant anon, authenticated to collaudo_app')
  c0.release()

  // 1) due sessioni, stesso soggiorno, segmenti e chiavi diversi, nello stesso istante
  const [s1, s2] = await Promise.all([pool.connect(), pool.connect()])
  await s1.query('begin'); await s2.query('begin')
  const p1 = s1.query('select public.segna_pagato($1, $2, $3, $4) as r', [A, K(1), 'contanti', '2026-09-05'])
  const p2 = s2.query('select public.segna_pagato($1, $2, $3, $4) as r', [B, K(2), 'contanti', '2026-09-05'])
  // la seconda sessione resta in attesa del lock finché la prima non fa commit:
  // si attende p1, si chiude s1, poi p2 (che a quel punto ricalcola il saldo)
  const r1 = await p1; await s1.query('commit')
  const r2 = await p2; await s2.query('commit')
  s1.release(); s2.release()
  const importi = [Number(r1.rows[0].r.importo), Number(r2.rows[0].r.importo)].sort((a, b) => a - b)
  const c1 = await pool.connect()
  const n1 = (await c1.query('select count(*)::int as n, coalesce(sum(amount),0)::numeric as tot from public.payments where soggiorno = $1', [GRUPPO])).rows[0]
  const flag = (await c1.query('select bool_and(pagato) as p from public.bookings where group_id = $1', [GRUPPO])).rows[0].p
  ok('1. due segna_pagato concorrenti (segmenti diversi, chiavi diverse) → un solo movimento da 340, flag su entrambi', n1.n === 1 && Number(n1.tot) === 340 && importi[0] === 0 && importi[1] === 340 && flag === true, `movimenti=${n1.n} totale=${n1.tot} importi=${importi} flag=${flag}`)

  // 2) due ricostruzioni concorrenti con chiavi diverse sullo stesso soggiorno D (concluso, 100 €)
  const [s3, s4] = await Promise.all([pool.connect(), pool.connect()])
  await s3.query('begin'); await s4.query('begin')
  const q3 = s3.query('select public.ricostruisci_incassi($1::jsonb) as r', [JSON.stringify([{ soggiorno: D, chiave: K(3) }])])
  const q4 = s4.query('select public.ricostruisci_incassi($1::jsonb) as r', [JSON.stringify([{ soggiorno: D, chiave: K(4) }])])
  const r3 = await q3; await s3.query('commit')
  const r4 = await q4; await s4.query('commit')
  s3.release(); s4.release()
  const scritti = r3.rows[0].r.scritti + r4.rows[0].r.scritti, nulla = r3.rows[0].r.nulla + r4.rows[0].r.nulla
  const n2 = (await c1.query('select count(*)::int as n, coalesce(sum(amount),0)::numeric as tot, max(origine) as origine from public.payments where soggiorno = $1', [D])).rows[0]
  ok('2. due ricostruzioni concorrenti (chiavi diverse) → una scrive 100, l’altra «nulla_da_scrivere»', scritti === 1 && nulla === 1 && n2.n === 1 && Number(n2.tot) === 100 && n2.origine === 'ricostruito', `scritti=${scritti} nulla=${nulla} movimenti=${n2.n} totale=${n2.tot}`)

  // 3) chiave riusata su un altro soggiorno
  let riusata = ''
  try { await c1.query('select public.segna_pagato($1, $2)', [A, K(3)]) } catch (e) { riusata = e.message }
  const n3 = (await c1.query('select count(*)::int as n from public.payments where booking_id in ($1,$2,$3)', [A, B, D])).rows[0].n
  ok('3. stessa chiave su altro soggiorno → CHIAVE_RIUSATA, nessun movimento in più', /CHIAVE_RIUSATA/.test(riusata) && n3 === 2, `errore="${riusata}" movimenti=${n3}`)
  c1.release()

  // 4) e 5) ruoli simulati con un login NON superuser (session_user = collaudo_app)
  const app = new pg.Client({ connectionString: url.replace(/\/\/[^@]*@/, '//collaudo_app:collaudo@') })
  await app.connect()
  await app.query('set role anon')
  let anonRpc = '', anonTabella = ''
  try { await app.query('select public.segna_pagato($1, $2)', [A, K(5)]) } catch (e) { anonRpc = e.message }
  try { await app.query('select * from public.room_closures') } catch (e) { anonTabella = e.message }
  ok('4. anon: EXECUTE negato sulle RPC 0033 e lettura negata su room_closures', /permission denied for function/.test(anonRpc) && /permission denied for table/.test(anonTabella), `rpc="${anonRpc}" tabella="${anonTabella}"`)
  await app.query('reset role')
  await app.query('set role authenticated')
  let senzaJwt = ''
  try { await app.query('select public.segna_pagato($1, $2)', [A, K(6)]) } catch (e) { senzaJwt = e.message }
  await app.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: UTENTE, role: 'authenticated' })])
  const conJwt = (await app.query('select public.segna_pagato($1, $2) as r', [A, K(1)])).rows[0].r   // stessa chiave: idempotente
  await app.query(`insert into public.room_closures (room_id, da, a, motivo) values ($1, '2026-09-10', '2026-09-15', 'collaudo')`, [R1])
  const lette = (await app.query('select count(*)::int as n from public.room_closures where room_id = $1', [R1])).rows[0].n
  await app.query('delete from public.room_closures where room_id = $1', [R1])
  ok('5. authenticated: senza JWT → NON_AUTENTICATO; con JWT → RPC ok (stessa chiave → stesso movimento), room_closures scrivibile e leggibile', /NON_AUTENTICATO/.test(senzaJwt) && Number(conJwt.importo) === 340 && lette === 1, `senzaJwt="${senzaJwt}" importo=${conJwt.importo} chiusure=${lette}`)
  await app.end()

  const c2 = await pool.connect(); await pulizia(c2); c2.release()
} finally {
  await pool.end()
}
for (const [stato, nome, dettaglio] of esiti) console.log(`${stato} — ${nome}${dettaglio ? `\n      ${dettaglio}` : ''}`)
