// Backup locale (07/09/2026, pezzo 3): la parte pura di scripts/backup-comune.mjs —
// nome del file, documento, impronta, verifica alla rilettura, confronto conteggi,
// guardia sui segreti.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomeFileBackup, componiEsportazione, verificaEsportazione, improntaTabelle, confrontaConteggi, contieneSegreto, serializzaStabile } from '../scripts/backup-comune.mjs'

const tabelle = { rooms: [{ id: 'r1', name: 'Ambra' }], bookings: [{ id: 'b1', room_id: 'r1', total_amount: '160.00' }, { id: 'b2', room_id: 'r1', total_amount: '80.00' }] }

test('nome del file datato, ora locale', () => {
  assert.equal(nomeFileBackup(new Date(2026, 8, 7, 14, 32)), 'gestionale-backup-2026-09-07-1432.json')
})

test('documento: tabelle in ordine, conteggi, impronta stabile a prescindere dall’ordine delle chiavi', () => {
  const doc = componiEsportazione({ origine: 'postgres', sorgente: '127.0.0.1:5433', tabelle, creatoIl: new Date('2026-09-07T12:00:00Z') })
  assert.deepEqual(Object.keys(doc.tabelle), ['bookings', 'rooms'])
  assert.equal(doc.tabelle.bookings.righe, 2)
  assert.equal(doc.versione, 1)
  assert.equal(doc.sorgente, '127.0.0.1:5433')
  const stessaMaDisordinata = { bookings: [{ total_amount: '160.00', room_id: 'r1', id: 'b1' }, { total_amount: '80.00', id: 'b2', room_id: 'r1' }], rooms: [{ name: 'Ambra', id: 'r1' }] }
  assert.equal(improntaTabelle(stessaMaDisordinata), doc.impronta)
  // Date e bigint sopravvivono alla serializzazione
  assert.equal(serializzaStabile({ a: new Date('2026-09-07T12:00:00Z'), b: BigInt(5) }), '{"a":"2026-09-07T12:00:00.000Z","b":"5"}')
})

test('rilettura: un file integro passa; righe mancanti o impronta diversa vengono dette', () => {
  const doc = componiEsportazione({ origine: 'postgrest', sorgente: 'x.supabase.co', tabelle })
  const riletto = JSON.parse(JSON.stringify(doc))
  const ok = verificaEsportazione(riletto)
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.riepilogo, { bookings: 2, rooms: 1 })
  // una riga sparita
  const rotto = JSON.parse(JSON.stringify(doc))
  rotto.tabelle.bookings.dati.pop()
  const esito = verificaEsportazione(rotto)
  assert.equal(esito.ok, false)
  assert.ok(esito.problemi.some(p => p.includes('bookings: dichiarate 2 righe, trovate 1')))
  assert.ok(esito.problemi.some(p => p.includes('impronta diversa')))
  // un valore cambiato ma i conteggi tornano → solo l'impronta lo dice
  const alterato = JSON.parse(JSON.stringify(doc))
  alterato.tabelle.bookings.dati[0].total_amount = '1.00'
  assert.deepEqual(verificaEsportazione(alterato).problemi, ['impronta diversa: il contenuto non coincide con quello scritto'])
  assert.equal(verificaEsportazione(null).ok, false)
  assert.equal(verificaEsportazione({ versione: 1, creato_il: 'x' }).ok, false)
})

test('confronto coi conteggi vivi: tabelle in più, in meno, righe diverse', () => {
  assert.deepEqual(confrontaConteggi({ rooms: 1, bookings: 2 }, { rooms: 1, bookings: 2 }), [])
  assert.deepEqual(confrontaConteggi({ rooms: 1, bookings: 2 }, { rooms: 1, bookings: 3, guests: 4 }), ['bookings: file 2 righe, database 3', 'guests: nel database ma non nel file'])
  assert.deepEqual(confrontaConteggi({ rooms: 1, vecchia: 0 }, { rooms: 1 }), ['vecchia: nel file ma non nel database'])
})

test('la guardia sui segreti ferma un testo che contiene la chiave', () => {
  assert.equal(contieneSegreto('{"a":1}', ['eyJhbGciOiJIUzI1NiJ9.chiave-lunga']), false)
  assert.equal(contieneSegreto('… eyJhbGciOiJIUzI1NiJ9.chiave-lunga …', ['eyJhbGciOiJIUzI1NiJ9.chiave-lunga']), true)
  assert.equal(contieneSegreto('corto', ['corto']), false)   // sotto i 12 caratteri non è una chiave
})
