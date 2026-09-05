// Errori di salvataggio visibili, parte 2 (05/09/2026) — pezzo 5: orario e
// navetta in Arrivi, secondo tentativo controllato, niente alert.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salvaOrarioENavetta, AVVISO_NAVETTA_0019 } from './arrivoOrario.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const ok = () => Promise.resolve({ data: null, error: null })
const rifiuta = () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table bookings' } })
const colonnaMancante = () => Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'shuttle' column" } })

test('entrambi i tentativi falliscono → errore, «Non salvato, riprova», lo stato locale non cambia', async () => {
  let bookings = [{ id: 'b1', check_in_time: null as string | null }]
  const esito = await salvaOrarioENavetta(rifiuta, rifiuta, true)
  assert.deepEqual(esito, { esito: 'errore', messaggio: MESSAGGIO_NON_SALVATO })
  if (esito.esito !== 'errore') bookings = bookings.map(b => ({ ...b, check_in_time: '15:00' }))
  assert.equal(bookings[0].check_in_time, null)
})

test('colonna shuttle assente, orario salvato → solo_orario con l\'avviso 0019 (solo se la navetta era stata scelta)', async () => {
  assert.deepEqual(await salvaOrarioENavetta(colonnaMancante, ok, true), { esito: 'solo_orario', messaggio: AVVISO_NAVETTA_0019 })
  assert.deepEqual(await salvaOrarioENavetta(colonnaMancante, ok, false), { esito: 'solo_orario', messaggio: null })
})

test('tutto salvato → ok; senza rete → messaggio con «nessuna connessione», nessuna eccezione fuori', async () => {
  assert.deepEqual(await salvaOrarioENavetta(ok, rifiuta, true), { esito: 'ok', messaggio: null })
  const rete = () => Promise.reject(new TypeError('Failed to fetch'))
  assert.deepEqual(await salvaOrarioENavetta(rete, rete, true), { esito: 'errore', messaggio: `${MESSAGGIO_NON_SALVATO}: nessuna connessione` })
})
