import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import type { RispostaPulizia } from './pulizieOperazioni.ts'
import { vuoto } from './biancheria.ts'

test('SQL vera: conferma e recupero atomici, tre ospiti, doppio invio, due modifiche e conflitti', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema private;
      create function private.is_app_member() returns boolean language sql as $$select coalesce(current_setting('test.membro', true),'si')='si'$$;
      grant usage on schema private to authenticated;
      create table rooms(id uuid primary key);
      create table bookings(id uuid primary key, room_id uuid, status text, check_in date, check_out date, num_guests integer);
    `)
    for (const file of ['migrations/0018_pulizie_storico.sql', 'migrations/0039_biancheria_recuperata.sql', 'proposte/0045_pulizie_manuali.BOZZA.sql']) {
      await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), 'utf8'))
    }
    const room = '10000000-0000-4000-8000-000000000001', booking = '20000000-0000-4000-8000-000000000001'
    await db.query('insert into rooms values ($1);', [room])
    await db.query("insert into bookings values ($1,$2,'confermata','2026-01-01','2026-01-30',3)", [booking, room])
    await db.exec('grant select,update on bookings,rooms to authenticated; grant select,insert,update,delete on cleanings to authenticated; set role authenticated;')
    const id = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
    const rpc = async (n: number, richiesta: unknown) => (await db.query<{ r: RispostaPulizia }>('select gestisci_pulizia($1,$2::jsonb) as r', [id(n), JSON.stringify(richiesta)])).rows[0].r
    const pulizia = { room_id: room, booking_id: booking, tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-01-05', data_effettiva: '2026-01-07', persone_servite: 3 }
    const richiesta = { azione: 'registra', ultima_id: null, pulizia, recupero: { ...vuoto(), telo_doccia: 3, asciugamano_viso: 3, asciugamano_mani: 3 } }
    const prima = await rpc(1, richiesta)
    assert.equal(prima.recupero!.telo_doccia, 3)
    assert.equal(prima.pulizia.persone_servite, 3)
    assert.deepEqual(await rpc(1, richiesta), prima)
    assert.equal((await db.query('select * from cleanings')).rows.length, 1)
    await assert.rejects(rpc(2, richiesta), (e: unknown) => (e as { code?: string }).code === 'P0045')
    await assert.rejects(rpc(1, { ...richiesta, recupero: vuoto() }), (e: unknown) => (e as { code?: string }).code === '22023')
    // Orologio fermo/arretrato: anche rispetto a un timestamp futuro ogni
    // modifica deve avere una versione strettamente successiva.
    const futuro = (await db.query<{ r: string }>("update biancheria_recuperata set updated_at='2099-01-01T00:00:00Z' where cleaning_id=$1 returning to_jsonb(updated_at)#>>'{}' as r", [id(1)])).rows[0].r
    const edit = { azione: 'recupero', cleaning_id: id(1), versione: futuro, recupero: { ...richiesta.recupero, federe: 1 } }
    const seconda = await rpc(3, edit)
    assert.equal(seconda.recupero!.federe, 1)
    assert.equal(seconda.recupero!.data, '2026-01-07')
    await assert.rejects(rpc(4, edit), (e: unknown) => (e as { code?: string }).code === 'P0045')
    const terza = await rpc(5, { ...edit, versione: seconda.recupero!.updated_at, recupero: { ...edit.recupero, federe: 2 } })
    assert.equal(terza.recupero!.federe, 2)
    assert.equal((await db.query('select * from biancheria_recuperata')).rows.length, 1)
    // Valore oltre la dotazione: anche l'inserimento della pulizia si annulla.
    await assert.rejects(rpc(6, { ...richiesta, ultima_id: id(1), recupero: { ...vuoto(), telo_doccia: 4 } }), (e: unknown) => (e as { code?: string }).code === '22023')
    assert.equal((await db.query('select * from cleanings')).rows.length, 1)
    // Pulita senza recuperi, aggiunta in seguito: sempre data effettiva.
    const zero = await rpc(7, { ...richiesta, ultima_id: id(1), pulizia: { ...pulizia, data_prevista: '2026-01-11', data_effettiva: '2026-01-12' }, recupero: null })
    assert.equal(zero.recupero, null)
    const tardi = await rpc(8, { azione: 'recupero', cleaning_id: id(7), versione: null, recupero: { ...vuoto(), asciugamano_mani: 2 } })
    assert.equal(tardi.recupero!.data, '2026-01-12')
    await assert.rejects(rpc(9, {}), (e: unknown) => (e as { code?: string }).code === '22023')
    await db.exec("set test.membro='no'")
    await assert.rejects(rpc(10, richiesta), (e: unknown) => (e as { code?: string }).code === '42501')
  } finally { await db.close() }
})
