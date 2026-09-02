import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatIntervallo, oraArrivo, tempoTrascorso, ordinaRichieste, inArchivio, contaAperte, nomeCompleto, spiegaErrore,
  type Richiesta,
} from './richieste.ts'

const locale = (a: number, m: number, g: number, h = 12, min = 0) => new Date(a, m - 1, g, h, min)
const adesso = locale(2026, 9, 2, 9, 0)

function richiesta(x: Partial<Richiesta>): Richiesta {
  return {
    id: 'r', created_at: adesso.toISOString(), nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15',
    persone: 2, camera_id: null, canale: 'telefono', telefono: null, note: null, stato: 'in_attesa',
    proposta_inviata_at: null, chiusa_at: null, prenotazione_id: null, ...x,
  }
}

test('intervallo date compatto', () => {
  assert.equal(formatIntervallo('2026-09-13', '2026-09-15'), '13–15 set')
  assert.equal(formatIntervallo('2026-09-30', '2026-10-02'), '30 set – 2 ott')
  assert.equal(formatIntervallo('2026-12-30', '2027-01-02'), '30 dic 2026 – 2 gen 2027')
})

test('ora di arrivo relativa', () => {
  assert.equal(oraArrivo(locale(2026, 9, 2, 8, 41).toISOString(), adesso), 'oggi 08:41')
  assert.equal(oraArrivo(locale(2026, 9, 1, 22, 30).toISOString(), adesso), 'ieri 22:30')
  assert.equal(oraArrivo(locale(2026, 8, 30, 8, 5).toISOString(), adesso), '30 ago 08:05')
  assert.equal(oraArrivo(locale(2025, 8, 30, 8, 5).toISOString(), adesso), '30 ago 2025 08:05')
  assert.equal(oraArrivo('boh', adesso), '')
})

test('tempo trascorso dalla proposta', () => {
  assert.equal(tempoTrascorso(locale(2026, 9, 2, 8, 59, ).toISOString(), adesso), '1 minuto fa')
  assert.equal(tempoTrascorso(locale(2026, 9, 2, 8, 30).toISOString(), adesso), '30 minuti fa')
  assert.equal(tempoTrascorso(locale(2026, 9, 2, 6, 0).toISOString(), adesso), '3 ore fa')
  assert.equal(tempoTrascorso(locale(2026, 8, 31, 9, 0).toISOString(), adesso), '2 giorni fa')
  assert.equal(tempoTrascorso(adesso.toISOString(), adesso), 'adesso')
})

test('ordinamento: durata decrescente, a parità la più vecchia prima', () => {
  const a = richiesta({ id: 'a', arrivo: '2026-09-13', partenza: '2026-09-14', persone: 3, created_at: '2026-09-02T06:00:00Z' })
  const b = richiesta({ id: 'b', arrivo: '2026-09-13', partenza: '2026-09-16', persone: 1, created_at: '2026-09-02T08:00:00Z' })
  const c = richiesta({ id: 'c', arrivo: '2026-09-20', partenza: '2026-09-23', persone: 2, created_at: '2026-09-02T07:00:00Z' })
  assert.deepEqual(ordinaRichieste([a, b, c], 'durata').map(r => r.id), ['c', 'b', 'a'])
  assert.deepEqual(ordinaRichieste([a, b, c], 'arrivo').map(r => r.id), ['a', 'c', 'b'])
  assert.deepEqual(ordinaRichieste([a, b, c], 'persone').map(r => r.id), ['a', 'c', 'b'])
})

test('archivio: solo chiuse negli ultimi 90 giorni; conteggio delle aperte', () => {
  const chiusaIeri = richiesta({ stato: 'confermata', chiusa_at: locale(2026, 9, 1).toISOString() })
  const chiusaVecchia = richiesta({ stato: 'rifiutata', chiusa_at: locale(2026, 5, 1).toISOString() })
  const senzaData = richiesta({ stato: 'rifiutata', chiusa_at: null, created_at: locale(2026, 8, 1).toISOString() })
  const aperta = richiesta({ stato: 'proposta_inviata' })
  assert.equal(inArchivio(chiusaIeri, adesso), true)
  assert.equal(inArchivio(chiusaVecchia, adesso), false)
  assert.equal(inArchivio(senzaData, adesso), true)
  assert.equal(inArchivio(aperta, adesso), false)
  assert.equal(contaAperte([chiusaIeri, aperta, richiesta({})]), 2)
})

test('nome e spiegazione degli errori', () => {
  assert.equal(nomeCompleto({ nome: ' Anna ', cognome: 'Rossi' }), 'Rossi Anna')
  assert.match(spiegaErrore({ code: 'PGRST205', message: "Could not find the table 'public.richieste' in the schema cache" }), /migrazione 0024/)
  assert.equal(spiegaErrore({ message: 'permission denied' }), 'permission denied')
  assert.equal(spiegaErrore(null), '')
})
