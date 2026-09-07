// Backup locale (07/09/2026, pezzo 3; rivisto per R3): la parte pura di
// scripts/backup-comune.mjs — nome del file, documento, impronta, i TRE
// livelli di verifica (integrità, completezza, confronto), guardia sui segreti.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeFileBackup, componiEsportazione, verificaEsportazione, improntaTabelle, confrontaConteggi, contieneSegreto, serializzaStabile, VERSIONE_ESPORTAZIONE } from '../scripts/backup-comune.mjs'
import { controllaCompletezza, confrontaRighe, chiaviDaOpenApi, tipiDaOpenApi } from '../scripts/backup-lettura.mjs'

const rooms = [{ id: 'r1', name: 'Ambra' }]
const bookings = [{ id: 'b1', room_id: 'r1', total_amount: '160.00' }, { id: 'b2', room_id: 'r1', total_amount: '80.00' }]
const tabelle = { rooms: { righe: rooms, attese: 1, chiave: ['id'] }, bookings: { righe: bookings, attese: 2, chiave: ['id'] } }

test('nome del file datato, ora locale', () => {
  assert.equal(nomeFileBackup(new Date(2026, 8, 7, 14, 32)), 'gestionale-backup-2026-09-07-1432.json')
})

test('documento: tabelle in ordine, conteggi, chiave e attese registrate, impronta indipendente dall’ordine delle chiavi', () => {
  const doc = componiEsportazione({ origine: 'postgres', sorgente: '127.0.0.1:5433', tabelle, creatoIl: new Date('2026-09-07T12:00:00Z') })
  assert.deepEqual(Object.keys(doc.tabelle), ['bookings', 'rooms'])
  assert.equal(doc.tabelle.bookings.righe, 2)
  assert.equal(doc.tabelle.bookings.attese, 2)
  assert.deepEqual(doc.tabelle.bookings.chiave, ['id'])
  assert.equal(doc.versione, VERSIONE_ESPORTAZIONE)
  assert.equal(doc.sorgente, '127.0.0.1:5433')
  assert.match(doc.limiti, /auth\.users/)
  const disordinata = { bookings: [{ total_amount: '160.00', room_id: 'r1', id: 'b1' }, { total_amount: '80.00', id: 'b2', room_id: 'r1' }], rooms: [{ name: 'Ambra', id: 'r1' }] }
  assert.equal(improntaTabelle(disordinata), doc.impronta)
  assert.equal(serializzaStabile({ a: new Date('2026-09-07T12:00:00Z'), b: BigInt(5) }), '{"a":"2026-09-07T12:00:00.000Z","b":"5"}')
})

test('integrità: file intatto passa; riga tolta o valore alterato → impronta diversa (e conteggio)', () => {
  const doc = componiEsportazione({ origine: 'postgrest', sorgente: 'x.supabase.co', tabelle })
  const ok = verificaEsportazione(JSON.parse(JSON.stringify(doc)))
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.riepilogo, { bookings: { righe: 2, attese: 2, chiave: ['id'] }, rooms: { righe: 1, attese: 1, chiave: ['id'] } })
  const monco = JSON.parse(JSON.stringify(doc)); monco.tabelle.bookings.dati.pop()
  const e1 = verificaEsportazione(monco)
  assert.equal(e1.ok, false)
  assert.ok(e1.integrita.some(p => p.includes('bookings: dichiarate 2 righe, trovate 1')))
  assert.ok(e1.integrita.some(p => p.includes('impronta diversa')))
  const alterato = JSON.parse(JSON.stringify(doc)); alterato.tabelle.bookings.dati[0].total_amount = '1.00'
  assert.deepEqual(verificaEsportazione(alterato).integrita, ['impronta diversa: il contenuto non coincide con quello scritto'])
  assert.equal(verificaEsportazione(null).ok, false)
})

test('completezza (R3): righe lette sotto le attese, doppioni sulla chiave, tabella senza chiave — detti a parte, non come «integrità»', () => {
  // esportazione che ha letto 1000 righe di 1001 attese (paginazione sbagliata): il file è «integro» ma NON completo
  const incompleta = componiEsportazione({ origine: 'postgrest', sorgente: 'x', tabelle: { grande: { righe: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })), attese: 1001, chiave: ['id'] } } })
  const e = verificaEsportazione(incompleta)
  assert.equal(e.integrita.length, 0)
  assert.deepEqual(e.completezza, ['grande: lette 1000 righe su 1001 attese dalla sorgente'])
  assert.equal(e.ok, false)
  // doppione: id 1 due volte e id 1001 assente (pagine non ordinate)
  const doppia = componiEsportazione({ origine: 'postgrest', sorgente: 'x', tabelle: { grande: { righe: [...Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 })), { id: 1 }], attese: 1001, chiave: ['id'] } } })
  assert.deepEqual(verificaEsportazione(doppia).completezza, ['grande: 1 righe doppie sulla chiave primaria'])
  // senza chiave: dichiarato
  const vista = componiEsportazione({ origine: 'postgrest', sorgente: 'x', tabelle: { v: { righe: [{ a: 1 }], attese: 1, chiave: [], senzaChiave: true } } })
  assert.deepEqual(verificaEsportazione(vista).completezza, ['v: senza chiave primaria, doppioni non controllabili'])
  // la stessa regola usata dall'esportazione PRIMA di scrivere il file
  assert.deepEqual(controllaCompletezza('t', [{ id: 1 }, { id: 1 }], 3, ['id']), ['t: lette 2 righe, la sorgente ne dichiara 3', 't: 1 righe doppie sulla chiave primaria (id)'])
  assert.deepEqual(controllaCompletezza('t', [{ user_id: 'u1' }, { user_id: null }], 2, ['user_id']), ['t: 1 righe senza chiave primaria'])
})

test('confronto col database: conteggi (tabelle in più/in meno) e contenuti riga per riga sulla chiave', () => {
  assert.deepEqual(confrontaConteggi({ rooms: { righe: 1 }, bookings: { righe: 2 } }, { rooms: 1, bookings: 2 }), [])
  assert.deepEqual(confrontaConteggi({ rooms: { righe: 1 }, bookings: { righe: 2 } }, { rooms: 1, bookings: 3, guests: 4 }), ['bookings: file 2 righe, database 3', 'guests: nel database ma non nel file'])
  assert.deepEqual(confrontaConteggi({ rooms: 1, vecchia: 0 }, { rooms: 1 }), ['vecchia: nel file ma non nel database'])
  const file = [{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 3, v: 'c' }]
  const vivo = [{ id: 1, v: 'a' }, { id: 2, v: 'B' }, { id: 4, v: 'd' }]
  assert.deepEqual(confrontaRighe('t', ['id'], file, vivo), ['t: 1 righe del database mancano nel file', 't: 1 righe del file non sono più nel database', 't: 1 righe con contenuto diverso'])
  assert.deepEqual(confrontaRighe('t', ['id'], file, file), [])
})

// Primo backup reale (07/09/2026): il file viene da PostgREST, il database
// ripristinato si legge con node-pg → stessi valori, scrittura diversa. La
// forma canonica dipende dal TIPO della colonna, mai dall'aspetto del testo
// (tre falsi «uguali» riprodotti da Codex la sera stessa: telefono, numero
// grande, testo con la T).
test('confronto per tipo reale: numeri equivalenti e timestamptz in fusi diversi (microsecondi compresi) sono uguali; testo, numeri grandi e JSON restano esatti', () => {
  const tipi = { id: 'text', prezzo: 'numeric', quando: 'timestamp with time zone', locale: 'timestamp without time zone', giorno: 'date', extra: 'jsonb', tel: 'text', grande: 'bigint', testo: 'text' }
  const daPostgrest = [{ id: 'a', prezzo: 80, quando: '2026-08-29T07:57:37.71277+00:00', locale: '2026-09-07T10:00:00', giorno: '2026-09-07', extra: { b: 1, a: [1, 2] }, tel: '0123', grande: 12, testo: '2026-09-07 10:00:00', nota: null }]
  const daPostgres = [{ id: 'a', prezzo: '80.00', quando: '2026-08-29 09:57:37.71277+02', locale: '2026-09-07 10:00:00', giorno: '2026-09-07', extra: { a: [1, 2], b: 1 }, tel: '0123', grande: '12', testo: '2026-09-07 10:00:00', nota: null }]
  const con = (cambio: Record<string, unknown>) => confrontaRighe('t', ['id'], daPostgrest, [{ ...daPostgres[0], ...cambio }], tipi)
  assert.deepEqual(con({}), [])
  // valori davvero diversi: un centesimo, un microsecondo, un giorno
  assert.deepEqual(con({ prezzo: '80.01' }), ['t: 1 righe con contenuto diverso'])
  assert.deepEqual(con({ quando: '2026-08-29 09:57:37.71278+02' }), ['t: 1 righe con contenuto diverso'])
  assert.deepEqual(con({ giorno: '2026-09-08' }), ['t: 1 righe con contenuto diverso'])
  // REGRESSIONI (Codex, 07/09/2026): il tipo decide, non l'aspetto
  assert.deepEqual(con({ tel: '123' }), ['t: 1 righe con contenuto diverso'], 'telefono: «0123» ≠ «123» (text)')
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', grande: '9007199254740992' }], [{ id: 'a', grande: '9007199254740993' }], tipi), ['t: 1 righe con contenuto diverso'], 'bigint oltre 2^53: mai via Number')
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', grande: '9007199254740993' }], [{ id: 'a', grande: '09007199254740993' }], tipi), [], 'bigint: zero iniziale canonicalizzato come testo')
  assert.deepEqual(con({ testo: '2026-09-07T10:00:00' }), ['t: 1 righe con contenuto diverso'], 'campo text: la T non è uno spazio')
  assert.deepEqual(con({ extra: { a: [1, 2], b: '1' } }), ['t: 1 righe con contenuto diverso'], 'JSON: 1 e «1» restano diversi')
  // numeri equivalenti in forme diverse (solo per colonne numeriche)
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', prezzo: 1e21 }], [{ id: 'a', prezzo: '1000000000000000000000' }], tipi), [])
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', prezzo: -0.5 }], [{ id: 'a', prezzo: '-0.500' }], tipi), [])
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', prezzo: 0 }], [{ id: 'a', prezzo: '-0.0' }], tipi), [])
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', prezzo: '1e-07' }], [{ id: 'a', prezzo: '0.0000001' }], tipi), [])
  // Z e +00:00 sono lo stesso istante; a cavallo di mezzanotte il giorno cambia col fuso
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', quando: '2026-09-07T23:30:00Z' }], [{ id: 'a', quando: '2026-09-08 01:30:00+02' }], tipi), [])
  // senza tipi: confronto esatto (comportamento precedente)
  assert.deepEqual(confrontaRighe('t', ['id'], [{ id: 'a', prezzo: 80 }], [{ id: 'a', prezzo: '80' }]), ['t: 1 righe con contenuto diverso'])
  assert.deepEqual(tipiDaOpenApi({ definitions: { rooms: { properties: { id: { format: 'uuid' }, base_price: { format: 'numeric' }, name: {} } } } }), { rooms: { id: 'uuid', base_price: 'numeric', name: null } })
})

test('chiave primaria dall’OpenAPI di PostgREST (R2): app_members ha user_id, non id; le viste senza chiave si ordinano su tutte le colonne', () => {
  const api = { definitions: {
    app_members: { properties: { user_id: { description: 'Note:\nThis is a Primary Key.<pk/>', type: 'string' }, role: { type: 'string' } } },
    bookings: { properties: { id: { description: 'Note:\nThis is a Primary Key.<pk/>' }, room_id: {} } },
    una_vista: { properties: { b: {}, a: {} } },
    schema_migrations: { properties: { version: { description: '<pk/>' } } },
  } }
  assert.deepEqual(chiaviDaOpenApi(api), [
    { nome: 'app_members', chiave: ['user_id'], ordine: ['user_id'], senzaChiave: false },
    { nome: 'bookings', chiave: ['id'], ordine: ['id'], senzaChiave: false },
    { nome: 'una_vista', chiave: [], ordine: ['b', 'a'], senzaChiave: true },
  ])
})

test('la guardia sui segreti ferma un testo che contiene la chiave', () => {
  assert.equal(contieneSegreto('{"a":1}', ['eyJhbGciOiJIUzI1NiJ9.chiave-lunga']), false)
  assert.equal(contieneSegreto('… eyJhbGciOiJIUzI1NiJ9.chiave-lunga …', ['eyJhbGciOiJIUzI1NiJ9.chiave-lunga']), true)
  assert.equal(contieneSegreto('corto', ['corto']), false)
})
