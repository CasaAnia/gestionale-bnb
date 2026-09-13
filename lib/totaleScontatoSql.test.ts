// La proposta 0050 su un database vero (PGlite): sistema il totale salvato
// delle prenotazioni scontate, senza toccare i prezzi concordati.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const id = (n: number) => `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`
let db: PGlite

before(async () => {
  db = new PGlite()
  await db.exec(`create table bookings(
    id uuid primary key, check_in date, check_out date, price_per_night numeric,
    extra_bed_total numeric, total_amount numeric, discount_type text, discount_value numeric,
    status text, updated_at timestamptz);`)
  await db.query(`insert into bookings values
    -- 4 notti × 70 = 280, sconto 10% → 252 (il difetto: era rimasto 280)
    ($1,'2026-12-20','2026-12-24',70,0,280,'percentage',10,'confermata',now()),
    -- già giusta: non si tocca (updated_at resta quello di prima)
    ($2,'2026-12-20','2026-12-24',70,0,252,'percentage',10,'confermata','2020-01-01'),
    -- totale concordato 300 su 320 di pieno → 300
    ($3,'2026-12-20','2026-12-24',80,0,320,'target_total',300,'confermata',now()),
    -- col letto: 2 notti × 90 + 20 = 200, sconto 10% → 180
    ($4,'2026-12-20','2026-12-22',90,20,200,'percentage',10,'confermata',now()),
    -- senza sconto: non si tocca
    ($5,'2026-12-20','2026-12-24',70,0,280,null,null,'confermata','2020-01-01'),
    -- annullata: non si tocca
    ($6,'2026-12-20','2026-12-24',70,0,280,'percentage',10,'annullata','2020-01-01'),
    -- «totale concordato» più alto del pieno: non è uno sconto, non si tocca
    ($7,'2026-12-20','2026-12-24',70,0,280,'target_total',400,'confermata','2020-01-01')`,
    [id(1), id(2), id(3), id(4), id(5), id(6), id(7)])
  await db.exec(readFileSync(new URL('../supabase/proposte/0050_totale_scontato.BOZZA.sql', import.meta.url), 'utf8'))
})
after(async () => db?.close())

const riga = async (n: number) => (await db.query<{ total_amount: string; price_per_night: string; discount_value: string; anno: number; quando: string }>(
  "select total_amount, price_per_night, discount_value, extract(year from updated_at)::int as anno, updated_at::text as quando from bookings where id=$1", [id(n)])).rows[0]

test('la percentuale: il totale salvato diventa quello che la cliente paga', async () => {
  assert.equal(Number((await riga(1)).total_amount), 252)
  assert.equal(Number((await riga(4)).total_amount), 180, 'col letto in più il conto parte dal pieno, letto compreso')
})

test('il totale concordato diventa il totale concordato', async () => {
  assert.equal(Number((await riga(3)).total_amount), 300)
})

test('quello che non va toccato resta intatto', async () => {
  for (const n of [2, 5, 6, 7]) {
    const r = await riga(n)
    assert.equal(r.anno, 2020, `la riga ${n} è stata toccata`)
  }
  assert.equal(Number((await riga(5)).total_amount), 280, 'una prenotazione senza sconto è cambiata')
  assert.equal(Number((await riga(6)).total_amount), 280, 'una prenotazione annullata è cambiata')
  assert.equal(Number((await riga(7)).total_amount), 280, 'un «totale concordato» più alto del pieno è stato preso per uno sconto')
})

test('i prezzi concordati non si toccano: cambia solo il totale', async () => {
  const r = await riga(1)
  assert.equal(Number(r.price_per_night), 70)
  assert.equal(Number(r.discount_value), 10)
})

test('applicarla due volte non cambia più niente', async () => {
  const prima = await riga(1)
  await db.exec(readFileSync(new URL('../supabase/proposte/0050_totale_scontato.BOZZA.sql', import.meta.url), 'utf8'))
  const dopo = await riga(1)
  assert.equal(Number(dopo.total_amount), Number(prima.total_amount))
  assert.equal(dopo.quando, prima.quando, 'la seconda applicazione ha riscritto la riga')
})
