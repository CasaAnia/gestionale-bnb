// Parte 3, pezzo 1 (05/09/2026): il contatore delle richieste aperte non
// torna mai 0 su errore; lo stato distingue caricamento / pronto / errore.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contaConEsito, statoDopoConteggio, CONTATORE_IN_CARICAMENTO, MESSAGGIO_CONTATORE_NON_LETTO } from './richiesteContatore.ts'

test('errore di Supabase → count null e messaggio, mai 0', async () => {
  const esito = await contaConEsito(async () => ({ count: null, error: { code: 'PGRST205', message: "Could not find the table 'public.richieste'" } }))
  assert.deepEqual(esito, { count: null, errore: `${MESSAGGIO_CONTATORE_NON_LETTO}, riprova` })
  const stato = statoDopoConteggio(CONTATORE_IN_CARICAMENTO, esito)
  assert.equal(stato.stato, 'errore')
  assert.notEqual(stato.stato, 'pronto')
})

test('senza rete (eccezione) → «nessuna connessione», nessun catch silenzioso', async () => {
  const esito = await contaConEsito(() => Promise.reject(new TypeError('Failed to fetch')))
  assert.equal(esito.errore, `${MESSAGGIO_CONTATORE_NON_LETTO}: nessuna connessione`)
  assert.equal(esito.count, null)
})

test('zero richieste è «pronto» con 0 (questo sì è nessuna richiesta); un numero vero resta', async () => {
  assert.deepEqual(statoDopoConteggio(CONTATORE_IN_CARICAMENTO, await contaConEsito(async () => ({ count: 0, error: null }))), { stato: 'pronto', count: 0, errore: null })
  assert.deepEqual(statoDopoConteggio(CONTATORE_IN_CARICAMENTO, await contaConEsito(async () => ({ count: 3, error: null }))), { stato: 'pronto', count: 3, errore: null })
})

test('errore dopo una lettura riuscita: il numero già mostrato resta (non torna a zero) e lo stato è errore', async () => {
  const pronto = statoDopoConteggio(CONTATORE_IN_CARICAMENTO, { count: 2, errore: null })
  const dopo = statoDopoConteggio(pronto, await contaConEsito(async () => ({ count: null, error: { message: 'permission denied' } })))
  assert.equal(dopo.stato, 'errore')
  assert.equal(dopo.count, 2)
})
