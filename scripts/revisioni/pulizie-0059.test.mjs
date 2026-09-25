// Proposta 0059 su database isolato in memoria (PGlite): dotazione, recuperi
// per misura, correzioni, timer e tempi fuori camera. Nessuna connessione
// esterna; le date sono relative a oggi (l'RPC usa l'orologio di Roma).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databasePulizieFinto } from './pulizie-db-finto.mjs'
import { eseguiOperazionePulizia } from '../../lib/pulizieOperazioni.ts'
import { vuoto } from '../../lib/biancheria.ts'

const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const giorno = n => new Date(Date.parse(`${oggiRoma()}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const pezzi = (extra = {}) => ({ sotto_matrimoniale: 0, sopra_matrimoniale: 0, sotto_singolo: 0, sopra_singolo: 0, federe: 0, telo_doccia: 0, asciugamano_viso: 0, asciugamano_mani: 0, tappeto_bagno: 0, scendidoccia: 0, lenzuolo_sotto: 0, lenzuolo_sopra: 0, ...extra })

async function ambiente({ bookings, cleanings = [], con0059 = true }) {
  const rooms = [...new Set(bookings.map(b => b.room_id))].map(id => ({ id }))
  const db = await databasePulizieFinto(rooms, bookings, cleanings, { con0059 })
  const sql = async (q, p = []) => (await db.query(q, p)).rows
  const rpc = async (id, r) => {
    try { return { data: (await db.query('select gestisci_pulizia($1,$2::jsonb) as r', [id, JSON.stringify(r)])).rows[0].r, error: null } }
    catch (e) { return { data: null, error: { code: e.code, message: e.message, details: e.detail } } }
  }
  const tempo = async r => {
    try { return { data: (await db.query('select gestisci_tempo_pulizie($1::jsonb) as r', [JSON.stringify(r)])).rows[0].r, error: null } }
    catch (e) { return { data: null, error: { code: e.code, message: e.message, details: e.detail } } }
  }
  const memoria = new Map()
  const custodia = { getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k) }
  const invia = (camera, r, trasporto = rpc) => eseguiOperazionePulizia(camera, r, custodia, trasporto, randomUUID)
  const righe = async t => (await db.query(`select row_to_json(r) as r from ${t} r`)).rows.map(x => x.r)
  return { db, sql, rpc, tempo, invia, righe }
}

const soggiorno = (extra = {}) => ({ id: randomUUID(), room_id: randomUUID(), status: 'confermata', check_in: giorno(-6), check_out: giorno(4), num_guests: 2, ...extra })
const decisione = (b, extra = {}) => ({ room_id: b.room_id, booking_id: b.id, tipo: 'soggiorno', stato: 'fatta', data_prevista: giorno(0), data_effettiva: giorno(0), prossima_data: null, persone_servite: b.num_guests, ...extra })

test('0059: la richiesta di prima (app già pubblicata) funziona identica, anche col recupero vecchio', async () => {
  const b = soggiorno({ num_guests: 3 })
  const { db, invia, righe } = await ambiente({ bookings: [b] })
  try {
    const r = await invia(b.room_id, { azione: 'registra', ultima_id: null, pulizia: decisione(b), recupero: { ...vuoto(), federe: 2, lenzuolo_sotto: 1, telo_doccia: 3 } })
    assert.equal(r.errore, null)
    const [c] = await righe('cleanings')
    assert.equal(c.assetto, null); assert.equal(c.dotazione, null); assert.equal(c.minuti, null)
    const [rec] = await righe('biancheria_recuperata')
    assert.equal(rec.lenzuolo_sotto, 1); assert.equal(rec.sotto_matrimoniale, 0)
    // correzione col formato vecchio: stessa riga, versione della pulizia avanzata
    const c2 = await invia(b.room_id, { azione: 'recupero', cleaning_id: c.id, versione: rec.updated_at, recupero: { ...vuoto(), federe: 4, telo_doccia: 3 } })
    assert.equal(c2.errore, null)
    assert.equal((await righe('biancheria_recuperata')).length, 1)
    assert.equal((await righe('biancheria_recuperata'))[0].federe, 4)
    assert.ok((await righe('cleanings'))[0].aggiornata_at)
  } finally { await db.close() }
})

test('0059: Amelia in due, 16 pezzi; recuperi 4 → 12 da lavare, correzione a 5 → 11, sempre una pulizia', async () => {
  const b = soggiorno({ num_guests: 2 })
  const { db, invia, righe } = await ambiente({ bookings: [b] })
  try {
    const assetto = { matrimoniali: 0, singoli: 2, ospiti: 2, federe_matrimoniale: 4 }
    const r = await invia(b.room_id, { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), assetto, minuti: 35 }, recupero: pezzi({ federe: 2, telo_doccia: 1, asciugamano_viso: 1 }) })
    assert.equal(r.errore, null)
    const c = r.risposta.pulizia
    assert.deepEqual(c.dotazione, { sotto_matrimoniale: 0, sopra_matrimoniale: 0, sotto_singolo: 2, sopra_singolo: 2, federe: 4, telo_doccia: 2, asciugamano_viso: 2, asciugamano_mani: 2, tappeto_bagno: 1, scendidoccia: 1 })
    assert.equal(Object.values(c.dotazione).reduce((s, n) => s + n, 0), 16)
    assert.equal(c.minuti, 35)
    // correzione: un pezzo in più (asciugamano mani), stessa pulizia
    const rec = (await righe('biancheria_recuperata'))[0]
    const d = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: c.aggiornata_at, versione_recupero: rec.updated_at, data_effettiva: c.data_effettiva, assetto, minuti: 35, recupero: pezzi({ federe: 2, telo_doccia: 1, asciugamano_viso: 1, asciugamano_mani: 1 }) })
    assert.equal(d.errore, null)
    assert.equal((await righe('cleanings')).length, 1)
    const tot = Object.entries((await righe('biancheria_recuperata'))[0]).filter(([k]) => ['federe', 'telo_doccia', 'asciugamano_viso', 'asciugamano_mani', 'sotto_singolo', 'sopra_singolo', 'tappeto_bagno', 'tappetino_doccia'].includes(k)).reduce((s, [, n]) => s + n, 0)
    assert.equal(tot, 5); assert.equal(16 - tot, 11)
    // stessa correzione con la versione vecchia: rifiutata, niente doppioni
    const vecchia = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: c.aggiornata_at, versione_recupero: rec.updated_at, data_effettiva: c.data_effettiva, assetto, minuti: 40, recupero: null })
    assert.match(vecchia.errore, /cambiata/)
    assert.equal((await righe('cleanings'))[0].minuti, 35)
  } finally { await db.close() }
})

test('0059: quantità bloccate — oltre la dotazione, negative, frazionarie, senza letti confermati', async () => {
  const b = soggiorno({ num_guests: 1 })
  const { db, rpc, righe } = await ambiente({ bookings: [b] })
  try {
    const assetto = { matrimoniali: 1, singoli: 0, ospiti: 1, federe_matrimoniale: 2 }
    const base = { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), assetto } }
    for (const recupero of [pezzi({ federe: 3 }), pezzi({ telo_doccia: -1 }), pezzi({ telo_doccia: 0.5 }), pezzi({ sotto_singolo: 1 }), pezzi({ lenzuolo_sotto: 1 })]) {
      const e = await rpc(randomUUID(), { ...base, recupero })
      assert.equal(e.error?.code, '22023', JSON.stringify(recupero))
    }
    assert.equal((await rpc(randomUUID(), { ...base, pulizia: { ...base.pulizia, assetto: { ...assetto, ospiti: 3 } }, recupero: null })).error?.code, '22023')
    assert.equal((await rpc(randomUUID(), { ...base, pulizia: { ...base.pulizia, assetto: { ...assetto, federe_matrimoniale: 3 } }, recupero: null })).error?.code, '22023')
    assert.equal((await rpc(randomUUID(), { ...base, pulizia: { ...base.pulizia, minuti: 0 } })).error?.code, '22023')
    // recuperi per misura senza letti confermati: rifiutati
    assert.equal((await rpc(randomUUID(), { ...base, pulizia: decisione(b), recupero: pezzi() })).error?.code, '22023')
    assert.equal((await righe('cleanings')).length, 0)
    // rinvio con minuti o dotazione: rifiutato (non è lavoro)
    assert.equal((await rpc(randomUUID(), { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), stato: 'rimandata', data_effettiva: null, prossima_data: giorno(1), minuti: 10 }, recupero: null })).error?.code, '22023')
    // uso singolo con due federe: 2 federe in dotazione, fotografia che resta
    const ok = await rpc(randomUUID(), { ...base, recupero: pezzi({ federe: 2 }) })
    assert.equal(ok.error, null)
    assert.equal(ok.data.pulizia.dotazione.federe, 2)
  } finally { await db.close() }
})

test('0059: storico senza misura — resta, si può solo riportare, mai contare due volte', async () => {
  const b = soggiorno({ num_guests: 2 })
  const { db, invia, righe } = await ambiente({ bookings: [b] })
  try {
    const r = await invia(b.room_id, { azione: 'registra', ultima_id: null, pulizia: decisione(b), recupero: { ...vuoto(), lenzuolo_sotto: 1, lenzuolo_sopra: 1 } })
    const c = r.risposta.pulizia, rec = r.risposta.recupero
    const assetto = { matrimoniali: 1, singoli: 0, ospiti: 2, federe_matrimoniale: 4 }
    // documento i letti, lascio lo storico: salva e lo conserva
    const d1 = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: null, versione_recupero: rec.updated_at, data_effettiva: c.data_effettiva, assetto, minuti: null, recupero: pezzi({ lenzuolo_sotto: 1, lenzuolo_sopra: 1 }) })
    assert.equal(d1.errore, null)
    assert.equal(d1.risposta.recupero.lenzuolo_sotto, 1)
    // aggiungo anche il matrimoniale senza togliere lo storico: rifiutato
    const rec2 = d1.risposta.recupero, c2 = d1.risposta.pulizia
    const doppio = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: c2.aggiornata_at, versione_recupero: rec2.updated_at, data_effettiva: c.data_effettiva, assetto, minuti: null, recupero: pezzi({ lenzuolo_sotto: 1, sotto_matrimoniale: 1 }) })
    assert.ok(doppio.errore)
    // riporto sulla misura: lo storico passa a zero e la misura prende il pezzo
    const giusto = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: c2.aggiornata_at, versione_recupero: rec2.updated_at, data_effettiva: c.data_effettiva, assetto, minuti: null, recupero: pezzi({ sotto_matrimoniale: 1, sopra_matrimoniale: 1 }) })
    assert.equal(giusto.errore, null)
    const finale = (await righe('biancheria_recuperata'))[0]
    assert.equal(finale.lenzuolo_sotto, 0); assert.equal(finale.sotto_matrimoniale, 1)
    // lo storico non si può ricreare aumentando
    const aumento = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: giusto.risposta.pulizia.aggiornata_at, versione_recupero: finale.updated_at, data_effettiva: c.data_effettiva, assetto, minuti: null, recupero: pezzi({ lenzuolo_sotto: 1 }) })
    assert.ok(aumento.errore)
  } finally { await db.close() }
})

test('0059: la dotazione corretta al ribasso non tronca in silenzio i recuperi', async () => {
  const b = soggiorno({ num_guests: 2 })
  const { db, invia } = await ambiente({ bookings: [b] })
  try {
    const assetto = { matrimoniali: 1, singoli: 1, ospiti: 2, federe_matrimoniale: 4 }
    const r = await invia(b.room_id, { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), assetto }, recupero: pezzi({ federe: 6, sotto_singolo: 1 }) })
    assert.equal(r.errore, null)
    assert.equal(Object.values(r.risposta.pulizia.dotazione).reduce((s, n) => s + n, 0), 18)
    const c = r.risposta.pulizia, rec = r.risposta.recupero
    const meno = await invia(b.room_id, { azione: 'dettagli', cleaning_id: c.id, versione: c.aggiornata_at, versione_recupero: rec.updated_at, data_effettiva: c.data_effettiva, assetto: { ...assetto, singoli: 0 }, minuti: null, recupero: null })
    assert.match(meno.errore, /recuper/i)
  } finally { await db.close() }
})

test('0059: timer — avvio, pausa, ripresa, stop ripetuti; uno solo in corso; consumato alla conferma', async () => {
  const b = soggiorno({ num_guests: 2 }), b2 = soggiorno({ num_guests: 1 })
  const { db, tempo, invia, righe, sql } = await ambiente({ bookings: [b, b2] })
  try {
    const chiave = `pulizia:${b.id}:soggiorno:${giorno(0)}`, altra = `pulizia:${b2.id}:soggiorno:${giorno(0)}`
    assert.equal((await tempo({ azione: 'avvia', chiave })).error, null)
    const doppio = await tempo({ azione: 'avvia', chiave })
    assert.equal(doppio.error, null)
    assert.equal((await righe('pulizie_timer')).length, 1)
    const secondo = await tempo({ azione: 'avvia', chiave: altra })
    assert.equal(secondo.error.code, 'P0047'); assert.equal(secondo.error.details, chiave)
    // simula 5 minuti e 30 secondi trascorsi
    await sql(`update pulizie_timer set avviato_at = clock_timestamp() - interval '330 seconds' where chiave = $1`, [chiave])
    await tempo({ azione: 'pausa', chiave })
    const dopoPausa = (await righe('pulizie_timer'))[0]
    assert.ok(dopoPausa.trascorsi >= 330 && dopoPausa.trascorsi <= 332)
    await tempo({ azione: 'pausa', chiave })   // stop ripetuto
    assert.equal((await righe('pulizie_timer'))[0].trascorsi, dopoPausa.trascorsi)
    // in corso → conferma bloccata; in pausa → conferma e timer consumato
    await tempo({ azione: 'avvia', chiave })
    const bloccata = await invia(b.room_id, { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), minuti: 6 }, recupero: null })
    assert.match(bloccata.errore, /timer/i)
    assert.equal((await righe('cleanings')).length, 0)
    await tempo({ azione: 'pausa', chiave })
    const ok = await invia(b.room_id, { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), minuti: 6 }, recupero: null })
    assert.equal(ok.errore, null)
    const t = (await righe('pulizie_timer'))[0]
    assert.equal(t.cleaning_id, ok.risposta.pulizia.id)
    assert.equal((await tempo({ azione: 'avvia', chiave })).error.code, '22023')   // chiuso: non si riapre
    // la prossima pulizia della stessa camera ha una chiave nuova e parte da zero
    const letti = (await tempo({ azione: 'leggi' })).data.timer
    assert.equal(letti.length, 0)
    // rinvio con un timer non risolto: bloccato; azzerato: consentito
    await tempo({ azione: 'avvia', chiave: altra })
    await sql(`update pulizie_timer set avviato_at = clock_timestamp() - interval '120 seconds' where chiave = $1`, [altra])
    await tempo({ azione: 'pausa', chiave: altra })
    const rinvio = await invia(b2.room_id, { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b2), stato: 'rimandata', data_effettiva: null, prossima_data: giorno(1) }, recupero: null })
    assert.match(rinvio.errore, /timer/i)
    const v = (await righe('pulizie_timer')).find(x => x.chiave === altra).versione
    assert.equal((await tempo({ azione: 'azzera', chiave: altra, versione: v - 1 })).error.code, 'P0045')
    assert.equal((await tempo({ azione: 'azzera', chiave: altra, versione: v })).error, null)
    assert.equal((await invia(b2.room_id, { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b2), stato: 'rimandata', data_effettiva: null, prossima_data: giorno(1) }, recupero: null })).errore, null)
  } finally { await db.close() }
})

test('0059: fuori camera — due sessioni, correzione, giorno passato, nessuna duplicazione', async () => {
  const b = soggiorno()
  const { db, tempo, righe, sql } = await ambiente({ bookings: [b] })
  try {
    const chiave = `fuori:${giorno(0)}:area_comune`
    await tempo({ azione: 'avvia', chiave })
    await sql(`update pulizie_timer set avviato_at = clock_timestamp() - interval '600 seconds' where chiave = $1`, [chiave])
    assert.equal((await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'area_comune', minuti: 10, versione: null, timer_trascorsi: 0 })).error.code, 'P0046')
    await tempo({ azione: 'pausa', chiave })
    const t = (await righe('pulizie_timer'))[0]
    // il totale confermato deve dichiarare quanto timer sta consumando
    assert.equal((await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'area_comune', minuti: 10, versione: null, timer_trascorsi: 0 })).error.code, 'P0045')
    const s1 = await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'area_comune', minuti: 10, versione: null, timer_trascorsi: t.trascorsi })
    assert.equal(s1.error, null); assert.equal(s1.data.fuori.minuti, 10)
    assert.equal((await righe('pulizie_timer'))[0].trascorsi, 0)
    // seconda sessione: 10 salvati + 10 dal timer = 20, stessa riga
    await tempo({ azione: 'avvia', chiave })
    await sql(`update pulizie_timer set avviato_at = clock_timestamp() - interval '590 seconds' where chiave = $1`, [chiave])
    await tempo({ azione: 'pausa', chiave })
    const t2 = (await righe('pulizie_timer'))[0]
    const s2 = await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'area_comune', minuti: 20, versione: s1.data.fuori.versione, timer_trascorsi: t2.trascorsi })
    assert.equal(s2.error, null)
    // doppio clic con la stessa versione: rifiutato, niente somma doppia
    assert.equal((await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'area_comune', minuti: 20, versione: s1.data.fuori.versione, timer_trascorsi: t2.trascorsi })).error.code, 'P0045')
    const f = await righe('pulizie_fuori_camera')
    assert.equal(f.length, 1); assert.equal(f[0].minuti, 20)
    // correzione di un giorno passato, poi giorno futuro rifiutato
    assert.equal((await tempo({ azione: 'salva_fuori', data: giorno(-3), attivita: 'piegatura', minuti: 15, versione: null })).error, null)
    assert.equal((await tempo({ azione: 'salva_fuori', data: giorno(1), attivita: 'corridoio', minuti: 5, versione: null })).error.code, '22023')
    assert.equal((await tempo({ azione: 'salva_fuori', data: giorno(0), attivita: 'giardino', minuti: 5, versione: null })).error.code, '22023')
    assert.equal((await righe('pulizie_fuori_camera')).length, 2)
    // il lavoro fuori camera non crea pulizie
    assert.equal((await righe('cleanings')).length, 0)
  } finally { await db.close() }
})

test('0059: risposta persa dopo il salvataggio con dotazione → Riprova non duplica; lettura identica', async () => {
  const b = soggiorno({ num_guests: 4 })
  const { db, invia, rpc, righe } = await ambiente({ bookings: [b] })
  try {
    const assetto = { matrimoniali: 1, singoli: 2, ospiti: 4, federe_matrimoniale: 4 }
    const richiesta = { azione: 'registra', ultima_id: null, pulizia: { ...decisione(b), assetto, minuti: 50 }, recupero: pezzi({ telo_doccia: 2 }) }
    const persa = await invia(b.room_id, richiesta, async (id, r) => { await rpc(id, r); throw new Error('rete') })
    assert.match(persa.errore, /Riprova/)
    const di_nuovo = await invia(b.room_id, null)
    assert.equal(di_nuovo.errore, null)
    const c = await righe('cleanings')
    assert.equal(c.length, 1)
    assert.equal(Object.values(c[0].dotazione).reduce((s, n) => s + n, 0), 28)
    assert.equal(c[0].dotazione.federe, 8)
    assert.deepEqual(di_nuovo.risposta.pulizia.dotazione, c[0].dotazione)
    // errore PRIMA della scrittura: niente righe e il tentativo resta ripetibile
    const b2 = soggiorno()
    const nuovo = await ambiente({ bookings: [b2] })
    try {
      const prima = await nuovo.invia(b2.room_id, { azione: 'registra', ultima_id: null, pulizia: decisione(b2), recupero: null }, async () => ({ data: null, error: { code: '08006', message: 'connessione' } }))
      assert.match(prima.errore, /Riprova/)
      assert.equal((await nuovo.righe('cleanings')).length, 0)
      assert.equal((await nuovo.invia(b2.room_id, null)).errore, null)
      assert.equal((await nuovo.righe('cleanings')).length, 1)
    } finally { await nuovo.db.close() }
  } finally { await db.close() }
})
