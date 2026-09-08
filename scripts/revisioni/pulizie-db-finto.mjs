// Database isolato in memoria per la UI vera. Esegue la proposta SQL vera;
// non accetta URL, credenziali o connessioni a database esterni.
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
export async function databasePulizieFinto(rooms, bookings, cleanings) {
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema private;
    create function private.is_app_member() returns boolean language sql as $$select true$$;
    grant usage on schema private to authenticated;
    create table rooms(id uuid primary key);
    create table bookings(id uuid primary key, room_id uuid, status text, check_in date, check_out date, num_guests integer);`)
  for (const p of ['migrations/0018_pulizie_storico.sql', 'migrations/0039_biancheria_recuperata.sql', 'proposte/0045_pulizie_manuali.BOZZA.sql']) await db.exec(await readFile(new URL(`../../supabase/${p}`, import.meta.url), 'utf8'))
  for (const r of rooms) await db.query('insert into rooms values ($1)', [r.id])
  for (const b of bookings) await db.query('insert into bookings values ($1,$2,$3,$4,$5,$6)', [b.id, b.room_id, b.status, b.check_in, b.check_out, b.num_guests])
  for (const c of cleanings) await db.query(`insert into cleanings(id,room_id,booking_id,tipo,stato,data_prevista,data_effettiva,prossima_data,cambio_biancheria,created_at,persone_servite)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [c.id, c.room_id, c.booking_id, c.tipo, c.stato, c.data_prevista, c.data_effettiva, c.prossima_data, c.cambio_biancheria, c.created_at, bookings.find(b => b.id === c.booking_id)?.num_guests])
  await db.exec('grant select,update on rooms,bookings to authenticated; grant select,insert,update,delete on cleanings to authenticated; set role authenticated;')
  return db
}
