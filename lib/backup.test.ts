// Backup locale (07/09/2026, pezzo 3; rivisto per R3): la parte pura di
// scripts/backup-comune.mjs — nome del file, documento, impronta, i TRE
// livelli di verifica (integrità, completezza, confronto), guardia sui segreti.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeFileBackup, componiEsportazione, verificaEsportazione, improntaTabelle, confrontaConteggi, contieneSegreto, serializzaStabile, VERSIONE_ESPORTAZIONE } from '../scripts/backup-comune.mjs'
import { controllaCompletezza, confrontaRighe, chiaviDaOpenApi } from '../scripts/backup-lettura.mjs'

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
