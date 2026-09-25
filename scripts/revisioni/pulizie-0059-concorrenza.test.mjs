// Concorrenza della proposta 0059 su PostgreSQL VERO, isolato: un cluster
// temporaneo creato con initdb in una cartella provvisoria, su una porta
// locale, cancellato alla fine. Nessun collegamento a database esterni.
// Se PostgreSQL non è installato sul computer la prova viene saltata (e lo dice).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const BIN = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/lib/postgresql/16/bin'].find(d => existsSync(path.join(d, 'initdb')))
const radice = new URL('../../supabase/', import.meta.url)
const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const pausa = ms => new Promise(r => setTimeout(r, ms))
// senza una lingua valida il server di Homebrew si ferma all'avvio
const ambiente = { ...process.env, LC_ALL: 'C', LANG: 'C' }

test('0059 su PostgreSQL vero: stesso lucchetto per conferma e timer, nessun blocco reciproco', { skip: !BIN && 'PostgreSQL non installato: concorrenza provata solo in sequenza (PGlite)' }, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'pulizie-pg-'))
  const porta = 55000 + Math.floor(Math.random() * 900)
  assert.equal(spawnSync(path.join(BIN, 'initdb'), ['-D', dir, '-U', 'prova', '-A', 'trust'], { stdio: 'ignore', env: ambiente }).status, 0)
  const server = spawn(path.join(BIN, 'postgres'), ['-D', dir, '-p', String(porta), '-k', dir, '-c', 'listen_addresses='], { stdio: 'ignore', env: ambiente })
  const nuovo = async () => { const c = new pg.Client({ host: dir, port: porta, user: 'prova', database: 'postgres' }); await c.connect(); return c }
  let admin
  for (let i = 0; i < 50 && !admin && server.exitCode === null; i++) { try { admin = await nuovo() } catch { await pausa(200) } }
  assert.ok(admin, 'PostgreSQL temporaneo avviato')
  const clienti = []
  try {
    await admin.query(`create role anon; create role authenticated; create schema private;
      create function private.is_app_member() returns boolean language sql as $$select true$$;
      grant usage on schema private to authenticated; grant usage on schema public to authenticated;
      create table rooms(id uuid primary key);
      create table bookings(id uuid primary key, room_id uuid, status text, check_in date, check_out date, num_guests integer);`)
    for (const f of ['migrations/0018_pulizie_storico.sql', 'migrations/0039_biancheria_recuperata.sql', 'proposte/0045_pulizie_manuali.BOZZA.sql', 'proposte/0059_pulizie_dotazione_tempi.BOZZA.sql'])
      await admin.query(readFileSync(new URL(f, radice), 'utf8'))
    await admin.query('grant select,update on rooms,bookings to authenticated; grant select,insert,update,delete on cleanings to authenticated')
    const camere = Array.from({ length: 4 }, () => ({ room: randomUUID(), booking: randomUUID() }))
    for (const c of camere) {
      await admin.query('insert into rooms values ($1)', [c.room])
      await admin.query("insert into bookings values ($1,$2,'confermata',$3::date - 3,$3::date + 5,1)", [c.booking, c.room, oggi])
    }
    const connetti = async () => { const c = await nuovo(); await c.query('set role authenticated'); clienti.push(c); return c }
    const [a, b] = [await connetti(), await connetti()]
    const chiave = c => `pulizia:${c.booking}:soggiorno:${oggi}`
    const conferma = (c, extra = {}) => ({ azione: 'registra', ultima_id: null, recupero: null, pulizia: { room_id: c.room, booking_id: c.booking, tipo: 'soggiorno', stato: 'fatta', data_prevista: oggi, data_effettiva: oggi, persone_servite: 1, minuti: 10, timer: null, ...extra } })
    const errore = p => p.then(() => null, e => e.code)

    // 1) Il timer nasce in una transazione ancora aperta: la conferma aspetta,
    //    poi lo vede e rifiuta (in corso). Niente pulizia salvata.
    const c1 = camere[0]
    await a.query('begin'); await a.query('select gestisci_tempo_pulizie($1::jsonb)', [JSON.stringify({ azione: 'avvia', chiave: chiave(c1) })])
    const inizio = Date.now()
    const attesa = errore(b.query('select gestisci_pulizia($1,$2::jsonb)', [randomUUID(), JSON.stringify(conferma(c1))]))
    await pausa(700); await a.query('commit')
    assert.equal(await attesa, 'P0046')
    assert.ok(Date.now() - inizio >= 650, 'la conferma ha aspettato il lucchetto dei tempi')
    assert.equal((await admin.query('select count(*)::int n from cleanings where room_id=$1', [c1.room])).rows[0].n, 0)
    await a.query('select gestisci_tempo_pulizie($1::jsonb)', [JSON.stringify({ azione: 'pausa', chiave: chiave(c1) })])

    // 2) Conferma aperta (nessun timer visto): un avvio dall'altra scheda
    //    aspetta, poi trova la pulizia confermata e non crea un timer orfano.
    const c2 = camere[1]
    await b.query('begin'); await b.query('select gestisci_pulizia($1,$2::jsonb)', [randomUUID(), JSON.stringify(conferma(c2))])
    const avvio = errore(a.query('select gestisci_tempo_pulizie($1::jsonb)', [JSON.stringify({ azione: 'avvia', chiave: chiave(c2) })]))
    await pausa(500); await b.query('commit')
    assert.equal(await avvio, '22023')
    assert.equal((await admin.query('select count(*)::int n from pulizie_timer where chiave=$1', [chiave(c2)])).rows[0].n, 0)

    // 3) Molte operazioni incrociate su conferme e timer: nessun deadlock,
    //    al massimo un timer in corso, ogni pulizia al più una volta.
    const pool = await Promise.all(Array.from({ length: 6 }, connetti))
    const esiti = await Promise.all(Array.from({ length: 60 }, (_, i) => {
      const c = camere[2 + (i % 2)], k = pool[i % pool.length]
      const q = i % 3 === 0 ? k.query('select gestisci_pulizia($1,$2::jsonb)', [randomUUID(), JSON.stringify(conferma(c, { timer: null }))])
        : k.query('select gestisci_tempo_pulizie($1::jsonb)', [JSON.stringify({ azione: i % 3 === 1 ? 'avvia' : 'pausa', chiave: chiave(c) })])
      return errore(q)
    }))
    assert.ok(!esiti.includes('40P01'), `nessun deadlock: ${[...new Set(esiti)]}`)
    assert.ok(esiti.every(e => e === null || ['P0045', 'P0046', 'P0047', 'P0048', '22023'].includes(e)), `solo rifiuti previsti: ${[...new Set(esiti)]}`)
    assert.ok((await admin.query('select count(*)::int n from pulizie_timer where avviato_at is not null')).rows[0].n <= 1)
    const doppie = (await admin.query("select count(*)::int n from cleanings where stato='fatta' group by booking_id having count(*) > 1")).rows
    assert.equal(doppie.length, 0)
  } finally {
    for (const c of clienti) await c.end().catch(() => {})
    await admin?.end().catch(() => {})
    if (server.exitCode === null) { server.kill('SIGINT'); await new Promise(r => server.on('exit', r)) }
    rmSync(dir, { recursive: true, force: true })
  }
})
