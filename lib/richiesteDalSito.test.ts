// Errori di salvataggio visibili, pezzo 3 (05/09/2026): un errore di lettura
// delle richieste dal sito non deve mai sembrare «nessuna richiesta».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { caricaRichiesteWeb, statoDopoLettura, RICHIESTE_WEB_IN_CARICAMENTO, MESSAGGIO_RICHIESTE_NON_CARICATE, COLONNE_RICHIESTE_WEB, COLONNE_RICHIESTE_WEB_SENZA_NOME } from './richiesteDalSito.ts'

const riga = { id: 'b1', check_in: '2026-09-22', check_out: '2026-09-24', num_guests: 2, total_amount: '160', guest_name: null, rooms: { name: 'Camera Ambra' }, guests: { full_name: 'Richiesta Dal Sito', phone: '+39 333 000 0014' } }
const errorePermessi = { code: '42501', message: 'permission denied for table bookings' }

test('errore di Supabase su entrambe le letture → stato errore col messaggio, NON lista vuota', async () => {
  const chiamate: string[] = []
  const esito = await caricaRichiesteWeb(async cols => { chiamate.push(cols); return { data: null, error: errorePermessi } })
  assert.equal(esito.errore, `${MESSAGGIO_RICHIESTE_NON_CARICATE}, riprova`)
  assert.deepEqual(chiamate, [COLONNE_RICHIESTE_WEB, COLONNE_RICHIESTE_WEB_SENZA_NOME])
  const stato = statoDopoLettura(RICHIESTE_WEB_IN_CARICAMENTO, esito)
  assert.equal(stato.stato, 'errore')
  assert.notEqual(stato.stato, 'pronto')
})

test('senza rete (eccezione di fetch) niente catch silenzioso: messaggio con «nessuna connessione»', async () => {
  const esito = await caricaRichiesteWeb(() => Promise.reject(new TypeError('Load failed')))
  assert.equal(esito.errore, `${MESSAGGIO_RICHIESTE_NON_CARICATE}: nessuna connessione`)
  assert.deepEqual(esito.richieste, [])
})

test('lettura riuscita con zero righe → stato pronto senza errore (questo sì è «nessuna richiesta»)', async () => {
  const esito = await caricaRichiesteWeb(async () => ({ data: [], error: null }))
  assert.deepEqual(esito, { richieste: [], errore: null })
  assert.deepEqual(statoDopoLettura(RICHIESTE_WEB_IN_CARICAMENTO, esito), { stato: 'pronto', richieste: [], errore: null })
})

test('ripiego sulla query senza guest_name se la prima fallisce, con le righe mappate', async () => {
  const esito = await caricaRichiesteWeb(async cols => cols === COLONNE_RICHIESTE_WEB
    ? { data: null, error: { code: '42703', message: 'column bookings.guest_name does not exist' } }
    : { data: [riga], error: null })
  assert.equal(esito.errore, null)
  assert.equal(esito.richieste.length, 1)
  assert.equal(esito.richieste[0].room_name, 'Ambra')
  assert.equal(esito.richieste[0].guest_name, 'Richiesta Dal Sito')
  assert.equal(esito.richieste[0].total_amount, 160)
})

test('con un errore dopo una lettura riuscita le richieste già mostrate restano (lo stato locale non cambia in «nessuna»)', async () => {
  const pronto = statoDopoLettura(RICHIESTE_WEB_IN_CARICAMENTO, await caricaRichiesteWeb(async () => ({ data: [riga], error: null })))
  assert.equal(pronto.stato, 'pronto')
  const dopoErrore = statoDopoLettura(pronto, await caricaRichiesteWeb(async () => ({ data: null, error: errorePermessi })))
  assert.equal(dopoErrore.stato, 'errore')
  assert.equal(dopoErrore.richieste.length, 1)
  assert.match(dopoErrore.errore, /Non riesco a caricare le richieste dal sito/)
})
