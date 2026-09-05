// Errori di salvataggio visibili, parte 2 (05/09/2026) — pezzo 2: segmenti
// del soggiorno e rilettura della scheda; pezzo 4: storico del cliente.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salvaInSequenza, leggiConEsito, MESSAGGIO_SALVATO_IN_PARTE, MESSAGGIO_RILETTURA } from './prenotazioneScritture.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const ok = () => Promise.resolve({ data: null, error: null })
const rifiuta = () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table bookings' } })

test('pezzo 2 — soggiorno: il primo segmento fallisce → nessun salvataggio, «Non salvato, riprova», gli altri non vengono nemmeno tentati', async () => {
  let tentati = 0
  const esito = await salvaInSequenza([() => { tentati++; return rifiuta() }, () => { tentati++; return ok() }])
  assert.deepEqual(esito, { riusciti: 0, errore: MESSAGGIO_NON_SALVATO })
  assert.equal(tentati, 1)
})

test('pezzo 2 — soggiorno: il secondo segmento fallisce → «Salvato solo in parte…», riusciti = 1 (Ania deve ricontrollare, non credere che nulla sia cambiato)', async () => {
  const esito = await salvaInSequenza([ok, rifiuta, ok])
  assert.deepEqual(esito, { riusciti: 1, errore: MESSAGGIO_SALVATO_IN_PARTE })
})

test('pezzo 2 — soggiorno: tutto riuscito → nessun errore', async () => {
  assert.deepEqual(await salvaInSequenza([ok, ok]), { riusciti: 2, errore: null })
  assert.deepEqual(await salvaInSequenza([]), { riusciti: 0, errore: null })
})

test('pezzo 2 — soggiorno: eccezione di rete sul primo → messaggio con «nessuna connessione», sul secondo → «in parte»', async () => {
  const rete = () => Promise.reject(new TypeError('Failed to fetch'))
  assert.equal((await salvaInSequenza([rete])).errore, `${MESSAGGIO_NON_SALVATO}: nessuna connessione`)
  assert.deepEqual(await salvaInSequenza([ok, rete]), { riusciti: 1, errore: MESSAGGIO_SALVATO_IN_PARTE })
})

test('pezzo 2 — rilettura dopo un salvataggio riuscito: con errore torna il messaggio e NON null al posto della scheda', async () => {
  const scheda = { id: 'b1', status: 'confermata' }
  let booking: typeof scheda | null = scheda
  const riletto = await leggiConEsito<typeof scheda>(rifiuta, 'ricaricare la scheda')
  assert.equal(riletto.data, null)
  assert.equal(riletto.errore, 'Non riesco a ricaricare la scheda, riprova')
  // la pagina applica la rilettura solo senza errore: la scheda resta quella di prima
  if (!riletto.errore) booking = riletto.data
  assert.deepEqual(booking, scheda)
  assert.match(MESSAGGIO_RILETTURA, /riaprila/)
})

test('pezzo 2 — rilettura riuscita → dati nuovi', async () => {
  const riletto = await leggiConEsito(() => Promise.resolve({ data: { id: 'b1', status: 'confermata' }, error: null }), 'ricaricare la scheda')
  assert.deepEqual(riletto, { data: { id: 'b1', status: 'confermata' }, errore: null })
})

test('pezzo 4 — storico del cliente: errore → messaggio, mai lista vuota silenziosa; eccezione di rete → «nessuna connessione»', async () => {
  const storico = await leggiConEsito<unknown[]>(rifiuta, 'caricare lo storico del cliente')
  assert.deepEqual(storico, { data: null, errore: 'Non riesco a caricare lo storico del cliente, riprova' })
  const rete = await leggiConEsito<unknown[]>(() => Promise.reject(new TypeError('Load failed')), 'caricare lo storico del cliente')
  assert.equal(rete.errore, 'Non riesco a caricare lo storico del cliente: nessuna connessione')
})
