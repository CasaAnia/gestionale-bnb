// Proposta 0064 su database isolato in memoria (PGlite), sopra 0059: colonne
// dei bagagli e della partenza, «altro» e «cosa» negli spazi comuni, ora
// corretta e «togli» delle pulizie, prezzi della lavanderia. Nessuna
// connessione esterna. node --test scripts/revisioni/pulizie-0064.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databasePulizieFinto } from './pulizie-db-finto.mjs'

const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const giorno = n => new Date(Date.parse(`${oggiRoma()}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

async function ambiente(con0064 = true) {
  const b = { id: randomUUID(), room_id: randomUUID(), status: 'confermata', check_in: giorno(-3), check_out: giorno(0), num_guests: 2 }
  const db = await databasePulizieFinto([{ id: b.room_id }], [b], [], { con0059: true, con0064 })
  const chiama = async (q, p) => { try { return { data: (await db.query(q, p)).rows[0].r, error: null } } catch (e) { return { data: null, error: { code: e.code, message: e.message } } } }
  const tempo = r => chiama('select gestisci_tempo_pulizie($1::jsonb) as r', [JSON.stringify(r)])
  const ritocca = r => chiama('select ritocca_pulizia($1::jsonb) as r', [JSON.stringify(r)])
  const pulizia = r => chiama('select gestisci_pulizia($1,$2::jsonb) as r', [randomUUID(), JSON.stringify(r)])
  const sql = async (q, p = []) => (await db.query(q, p)).rows
  return { db, b, tempo, ritocca, pulizia, sql }
}

test('0064: le due colonne nascono vuote, senza default, e accettano un orario', async () => {
  const { db, b, sql } = await ambiente()
  try {
    const [r] = await sql('select bagagli_alle, check_out_time from bookings where id=$1', [b.id])
    assert.deepEqual(r, { bagagli_alle: null, check_out_time: null })
    await db.query("update bookings set bagagli_alle='11:00', check_out_time='10:30' where id=$1", [b.id])
    const [s] = await sql("select to_char(bagagli_alle,'HH24:MI') a, to_char(check_out_time,'HH24:MI') p from bookings where id=$1", [b.id])
    assert.deepEqual(s, { a: '11:00', p: '10:30' })
  } finally { await db.close() }
})

test('0064: «altro» con «cosa», timer «altro», e la richiesta di prima non cancella il «cosa»', async () => {
  const { db, tempo, sql } = await ambiente()
  try {
    const oggi = giorno(0)
    let r = await tempo({ azione: 'avvia', chiave: `fuori:${oggi}:altro` })
    assert.equal(r.error, null, r.error?.message)
    r = await tempo({ azione: 'pausa', chiave: `fuori:${oggi}:altro` })
    const trascorsi = r.data.timer.find(t => t.chiave === `fuori:${oggi}:altro`).trascorsi
    r = await tempo({ azione: 'salva_fuori', data: oggi, attivita: 'altro', minuti: 20, versione: null, timer_trascorsi: trascorsi, cosa: "vetri dell'ingresso" })
    assert.equal(r.error, null, r.error?.message)
    assert.equal(r.data.fuori.cosa, "vetri dell'ingresso")
    // stessa riga, richiesta senza «cosa» (app di prima): il testo resta
    r = await tempo({ azione: 'salva_fuori', data: oggi, attivita: 'altro', minuti: 25, versione: r.data.fuori.versione, timer_trascorsi: 0 })
    assert.equal(r.error, null, r.error?.message)
    assert.equal(r.data.fuori.cosa, "vetri dell'ingresso")
    assert.equal(r.data.fuori.minuti, 25)
    // «cosa» su un'altra attività o troppo lungo: rifiutato
    r = await tempo({ azione: 'salva_fuori', data: oggi, attivita: 'corridoio', minuti: 5, versione: null, timer_trascorsi: 0, cosa: 'no' })
    assert.equal(r.error?.code, '22023')
    r = await tempo({ azione: 'salva_fuori', data: oggi, attivita: 'altro', minuti: 5, versione: 2, timer_trascorsi: 0, cosa: 'x'.repeat(61) })
    assert.equal(r.error?.code, '22023')
    // i minuti già salvati di area_comune restano dove sono
    r = await tempo({ azione: 'salva_fuori', data: oggi, attivita: 'area_comune', minuti: 12, versione: null, timer_trascorsi: 0 })
    assert.equal(r.error, null)
    const righe = await sql('select attivita, minuti from pulizie_fuori_camera order by attivita')
    assert.deepEqual(righe, [{ attivita: 'altro', minuti: 25 }, { attivita: 'area_comune', minuti: 12 }])
  } finally { await db.close() }
})

test('senza 0064 «altro» è rifiutato dal database (per questo l\'app lo nasconde)', async () => {
  const { db, tempo } = await ambiente(false)
  try {
    const r = await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'altro', minuti: 5, versione: null, timer_trascorsi: 0 })
    assert.equal(r.error?.code, '22023')
    const c = await db.query("select column_name from information_schema.columns where table_name='bookings' and column_name in ('bagagli_alle','check_out_time')")
    assert.equal(c.rows.length, 0)
  } finally { await db.close() }
})

test('0064: ritocca_pulizia «ora» con la versione, poi «togli» cancella pulizia, recupero e timer chiuso', async () => {
  const { db, b, pulizia, ritocca, tempo, sql } = await ambiente()
  try {
    const chiave = `pulizia:${b.id}:fine_soggiorno:${giorno(0)}`
    await tempo({ azione: 'avvia', chiave }); const p = await tempo({ azione: 'pausa', chiave })
    const t = p.data.timer.find(x => x.chiave === chiave)
    const recupero = { sotto_matrimoniale: 0, sopra_matrimoniale: 0, sotto_singolo: 0, sopra_singolo: 0, federe: 1, telo_doccia: 0, asciugamano_viso: 0, asciugamano_mani: 0, tappeto_bagno: 0, scendidoccia: 0, lenzuolo_sotto: 0, lenzuolo_sopra: 0 }
    const r = await pulizia({ azione: 'registra', ultima_id: null, recupero, pulizia: { room_id: b.room_id, booking_id: b.id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: giorno(0), data_effettiva: giorno(0), prossima_data: null, persone_servite: 2,
      assetto: { matrimoniali: 1, singoli: 0, ospiti: 2, federe_matrimoniale: 4 }, minuti: 1, timer: { versione: t.versione, trascorsi: t.trascorsi } } })
    assert.equal(r.error, null, r.error?.message)
    const id = r.data.pulizia.id
    // versione sbagliata: niente
    let x = await ritocca({ azione: 'ora', cleaning_id: id, versione: '2000-01-01T00:00:00Z', ora: '09:02' })
    assert.equal(x.error?.code, 'P0045')
    x = await ritocca({ azione: 'ora', cleaning_id: id, versione: r.data.pulizia.aggiornata_at, ora: '25:00' })
    assert.equal(x.error?.code, '22023')
    // aggiornata_at della 0059 nasce vuota: la versione è null
    x = await ritocca({ azione: 'ora', cleaning_id: id, versione: r.data.pulizia.aggiornata_at, ora: '09:02' })
    assert.equal(x.error, null, x.error?.message)
    assert.equal(x.data.pulizia.ora_effettiva, '09:02:00')
    const versione = x.data.pulizia.aggiornata_at
    assert.ok(versione)
    // «togli» con la versione vecchia: rifiutato e niente toccato
    x = await ritocca({ azione: 'togli', cleaning_id: id, versione: r.data.pulizia.aggiornata_at })
    assert.equal(x.error?.code, 'P0045')
    assert.equal((await sql('select count(*)::int n from cleanings where id=$1', [id]))[0].n, 1)
    x = await ritocca({ azione: 'togli', cleaning_id: id, versione })
    assert.equal(x.error, null, x.error?.message)
    assert.equal((await sql('select count(*)::int n from cleanings where id=$1', [id]))[0].n, 0)
    assert.equal((await sql('select count(*)::int n from biancheria_recuperata where cleaning_id=$1', [id]))[0].n, 0)
    assert.equal((await sql('select count(*)::int n from pulizie_timer where chiave=$1', [chiave]))[0].n, 0)
    // dopo «togli» la stessa pulizia si può segnare di nuovo (ultima_id torna nulla)
    const di_nuovo = await pulizia({ azione: 'registra', ultima_id: null, recupero: null, pulizia: { room_id: b.room_id, booking_id: b.id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: giorno(0), data_effettiva: giorno(0), prossima_data: null, persone_servite: 2 } })
    assert.equal(di_nuovo.error, null, di_nuovo.error?.message)
  } finally { await db.close() }
})

test('0064: prezzi_lavanderia accetta solo i pezzi previsti e prezzi da 0 in su; nessun prezzo precaricato', async () => {
  const { db, sql } = await ambiente()
  try {
    assert.equal((await sql('select count(*)::int n from prezzi_lavanderia'))[0].n, 0)
    await sql("insert into prezzi_lavanderia(pezzo,prezzo) values ('federe',0.5),('tappetini',0)")
    await assert.rejects(sql("insert into prezzi_lavanderia(pezzo,prezzo) values ('calzini',1)"))
    await assert.rejects(sql("insert into prezzi_lavanderia(pezzo,prezzo) values ('teli_doccia',-1)"))
    assert.deepEqual(await sql('select pezzo, prezzo::text from prezzi_lavanderia order by pezzo'), [{ pezzo: 'federe', prezzo: '0.50' }, { pezzo: 'tappetini', prezzo: '0.00' }])
  } finally { await db.close() }
})
