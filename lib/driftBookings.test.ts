// Pezzo 5 (07/09/2026): la proposta 0043 registra le colonne di bookings già
// presenti in produzione senza migrazione. Dentro PGlite: su una bookings
// «solo migrazioni» crea le 10 colonne; applicata di nuovo non fa niente
// (if not exists); su una tabella che le ha già le lascia intatte coi dati.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const COLONNE = ['pagato', 'bonifico', 'guest_name', 'extra_bed_dates', 'extra_phone_1', 'extra_phone_1_name', 'extra_phone_2', 'extra_phone_2_name', 'color', 'check_in_time']

function sqlProposta(): string {
  const file = readFileSync(new URL('../supabase/proposte/0043_drift_bookings.BOZZA.sql', import.meta.url), 'utf8')
  const fine = file.indexOf('-- VERIFICA')
  return file.slice(0, fine).replace(/notify pgrst[^;]*;/g, '')
}

let db: PGlite
before(async () => {
  db = new PGlite()
  await db.exec(`create table public.bookings (id uuid primary key default gen_random_uuid(), check_in date not null, check_out date not null, total_amount numeric(10,2) not null default 0, status text not null default 'confermata');`)
})
after(async () => { await db.close() })

const colonne = async () => (await db.query<{ column_name: string; data_type: string; column_default: string | null }>(`select column_name, data_type, column_default from information_schema.columns where table_name = 'bookings' order by column_name`)).rows

test('la bozza elenca le 10 colonne del drift, tutte con «if not exists»', () => {
  const sql = sqlProposta()
  for (const c of COLONNE) assert.match(sql, new RegExp(`add column if not exists ${c} `), c)
  assert.equal((sql.match(/add column if not exists/g) || []).length, 10)
})

test('applicata a un database ricostruito dalle sole migrazioni crea le colonne coi tipi giusti', async () => {
  await db.exec(sqlProposta())
  const c = await colonne()
  const nomi = c.map(x => x.column_name)
  for (const n of COLONNE) assert.ok(nomi.includes(n), n)
  const tipo = (n: string) => c.find(x => x.column_name === n)!
  assert.equal(tipo('pagato').data_type, 'boolean'); assert.equal(tipo('pagato').column_default, 'false')
  assert.equal(tipo('bonifico').data_type, 'boolean')
  assert.equal(tipo('extra_bed_dates').data_type, 'jsonb')
  assert.equal(tipo('check_in_time').data_type, 'text')
})

test('applicata di nuovo non cambia nulla e i dati restano', async () => {
  await db.exec(`insert into public.bookings (check_in, check_out, pagato, color, check_in_time, extra_bed_dates) values ('2026-09-05', '2026-09-07', true, '#f97316', '14:00', '["2026-09-05"]')`)
  const prima = await colonne()
  await db.exec(sqlProposta())
  assert.deepEqual(await colonne(), prima)
  const r = await db.query<{ pagato: boolean; color: string; check_in_time: string; extra_bed_dates: string[] }>('select pagato, color, check_in_time, extra_bed_dates from public.bookings')
  assert.deepEqual(r.rows[0], { pagato: true, color: '#f97316', check_in_time: '14:00', extra_bed_dates: ['2026-09-05'] })
})
