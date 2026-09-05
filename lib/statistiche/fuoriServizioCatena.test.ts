// R12 — catena database → lettura → KPI con la PROPOSTA 0034 (SQL letta dal
// file, applicata solo in PGlite): colonne di servizio sulle camere, periodi
// sovrapposti in room_closures, RLS attiva e permessi, poi le notti
// vendibili e i ricavi per camera con quei dati.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { mappaChiusure, finestraCamera, giorniVendibiliCamera } from './fuoriServizio.ts'
import { nottiVendibili, occupazioneIntervallo } from './intervallo.ts'
import { nottiDisponibili } from './notti.ts'
import { ricaviPerCamera } from './camere.ts'
import type { CameraStat } from './tipi.ts'

const SCHEMA = `
create schema auth;
create function auth.uid() returns uuid language sql as 'select ''cccccccc-0000-4000-8000-000000000000''::uuid';
create role authenticated; create role anon; create role service_role;
create table public.rooms (id uuid primary key, name text not null, active boolean not null default true);
`
const sqlProposta = () => readFileSync(new URL('../../supabase/proposte/0034_room_closures.BOZZA.sql', import.meta.url), 'utf8').split('\n').filter(r => !r.trim().startsWith('--')).join('\n')

const R1 = '11111111-1111-4111-8111-111111111111', R2 = '22222222-2222-4222-8222-222222222222', R5 = '55555555-5555-4555-8555-555555555555'
let db: PGlite
let camere: CameraStat[]
let chiusure: ReturnType<typeof mappaChiusure>

before(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(sqlProposta())
  // Amelia da sempre; Allegra in servizio dal 15/3/2026; Vecchia archiviata dal 1/7/2026 (attiva = false ma con storia)
  await db.query(`insert into public.rooms (id, name, active, in_servizio_dal, fuori_servizio_dal) values ($1, 'Amelia', true, null, null), ($2, 'Allegra', true, '2026-03-15', null), ($3, 'Vecchia', false, null, '2026-07-01')`, [R1, R2, R5])
  await db.query(`insert into public.room_closures (room_id, da, a, motivo) values ($1, '2026-09-10', '2026-09-15', 'lavori'), ($1, '2026-09-12', '2026-09-20', 'lavori'), ($2, '2026-09-01', '2026-09-03', null)`, [R1, R2])
  camere = (await db.query<CameraStat>('select id, name, active, in_servizio_dal::text, fuori_servizio_dal::text from public.rooms order by name')).rows
  chiusure = mappaChiusure((await db.query<{ room_id: string; da: string; a: string; motivo: string | null }>('select room_id, da::text, a::text, motivo from public.room_closures order by da')).rows)
})
after(async () => { await db?.close() })

test('database: vincoli (a > da, fuori > in), RLS attiva con 4 politiche per authenticated, nessun privilegio ad anon', async () => {
  await assert.rejects(db.query(`insert into public.room_closures (room_id, da, a) values ($1, '2026-09-10', '2026-09-10')`, [R1]), /room_closures_intervallo/)
  await assert.rejects(db.query(`update public.rooms set in_servizio_dal = '2026-08-01' where id = $1`, [R5]), /rooms_servizio_intervallo/)
  const rls = (await db.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname = 'room_closures'`)).rows[0].relrowsecurity
  assert.equal(rls, true)
  const politiche = (await db.query<{ policyname: string; roles: string }>(`select policyname, roles::text as roles from pg_policies where tablename = 'room_closures' order by policyname`)).rows
  assert.deepEqual(politiche.map(p => p.policyname), ['room_closures_cancellazione', 'room_closures_lettura', 'room_closures_modifica', 'room_closures_scrittura'])
  assert.ok(politiche.every(p => p.roles.includes('authenticated')))
  const grantAnon = (await db.query<{ n: number }>(`select count(*)::int as n from information_schema.role_table_grants where table_name = 'room_closures' and grantee in ('anon', 'PUBLIC')`)).rows[0].n
  assert.equal(grantAnon, 0)
  const grantAuth = (await db.query<{ n: number }>(`select count(*)::int as n from information_schema.role_table_grants where table_name = 'room_closures' and grantee = 'authenticated'`)).rows[0].n
  assert.equal(grantAuth, 4)
})

test('lettura → modello: le righe diventano FuoriServizio; le date delle camere danno la finestra in servizio', () => {
  assert.equal(chiusure.length, 3)
  assert.deepEqual(chiusure[0], { room_id: R2, da: '2026-09-01', a: '2026-09-03', motivo: null })
  const allegra = camere.find(c => c.name === 'Allegra')!, vecchia = camere.find(c => c.name === 'Vecchia')!, amelia = camere.find(c => c.name === 'Amelia')!
  assert.deepEqual(finestraCamera(allegra, '2026-03-01', '2026-04-01'), { da: '2026-03-15', a: '2026-04-01' })
  assert.deepEqual(finestraCamera(vecchia, '2026-06-01', '2026-08-01'), { da: '2026-06-01', a: '2026-07-01' })   // archiviata: il passato resta
  assert.equal(finestraCamera(vecchia, '2026-09-01', '2026-10-01'), null)
  assert.deepEqual(finestraCamera(amelia, '2026-09-01', '2026-10-01'), { da: '2026-09-01', a: '2026-10-01' })
  assert.equal(giorniVendibiliCamera(amelia, '2026-09-01', '2026-10-01', chiusure), 30 - 10)     // 10→20 contato una volta
})

test('KPI: notti vendibili di settembre = Amelia 20 + Allegra 28 (Vecchia archiviata a luglio non conta); giugno conta ancora Vecchia', () => {
  const set = nottiVendibili('2026-09-01', '2026-10-01', camere, chiusure)
  assert.deepEqual(set.perCamera, { [R1]: 20, [R2]: 28 })
  assert.equal(set.totali, 48)
  const giu = nottiVendibili('2026-06-01', '2026-07-01', camere, chiusure)
  assert.deepEqual(giu.perCamera, { [R1]: 30, [R2]: 30, [R5]: 30 })
  const mese = nottiDisponibili('2026-09', camere, chiusure)
  assert.deepEqual([mese.totali, mese.chiuse, mese.perCamera[R5]], [48, 12, undefined])
  const marzo = nottiDisponibili('2026-03', camere, chiusure)
  assert.deepEqual([marzo.perCamera[R2], marzo.perCamera[R1], marzo.perCamera[R5]], [17, 31, 31])
  const occ = occupazioneIntervallo('2026-09-01', '2026-10-01', camere, [{ id: 'b', room_id: R1, check_in: '2026-09-01', check_out: '2026-09-11', total_amount: 500, status: 'confermata' }], chiusure)
  assert.deepEqual([occ.nottiVendute, occ.nottiVendibili, occ.percento, occ.anomalia], [10, 48, 21, false])
})

test('KPI: ricavi per camera dell’anno con le date di servizio e le chiusure; senza chiusure il limite resta', () => {
  const lista = [{ id: 'a', room_id: R1, check_in: '2026-09-01', check_out: '2026-09-03', total_amount: 200, status: 'confermata' }, { id: 'v', room_id: R5, check_in: '2026-06-10', check_out: '2026-06-12', total_amount: 100, status: 'completata' }]
  const r = ricaviPerCamera(2026, '2026-09-30', camere, lista, chiusure)!
  const amelia = r.lista.find(x => x.name === 'Amelia')!, vecchia = r.lista.find(x => x.name === 'Vecchia')!
  assert.equal(amelia.giorniVendibili, 273 - 10)          // 1/1 → 1/10 escluso, meno 10 chiuse
  assert.equal(vecchia.giorniVendibili, 181)              // 1/1 → 1/7: la camera archiviata conserva il suo passato
  assert.equal(vecchia.notti, 2)
  assert.equal(r.limite, null)
  assert.match(ricaviPerCamera(2026, '2026-09-30', camere, lista, [])!.limite ?? '', /fuori servizio/)
})
