// Test del sorvegliante di connessione (lib/connessione.ts)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  creaFetchSorvegliato, isErroreDiRete, messaggioErroreDati,
  statoConnessione, ascoltaConnessione, azzeraConnessionePerTest,
} from './connessione.ts'

beforeEach(() => azzeraConnessionePerTest())

const rispostaOk = () => Promise.resolve(new Response('[]', { status: 200 }))
const failedToFetch = () => Promise.reject(new TypeError('Failed to fetch'))

test('isErroreDiRete riconosce gli errori di rete dei vari browser e il tempo scaduto', () => {
  assert.equal(isErroreDiRete(new TypeError('Failed to fetch')), true)           // Chrome
  assert.equal(isErroreDiRete(new TypeError('Load failed')), true)               // Safari/iPhone
  assert.equal(isErroreDiRete({ message: 'TypeError: NetworkError when attempting to fetch resource.' }), true) // Firefox
  assert.equal(isErroreDiRete({ message: 'TypeError: fetch failed' }), true)     // Node
  assert.equal(isErroreDiRete({ name: 'AbortError', message: 'aborted' }), true)
  assert.equal(isErroreDiRete({ message: 'TimeoutError: Tempo scaduto: il server non ha risposto entro 30 secondi' }), true)
  // errori RESTITUITI dal server: non sono rete
  assert.equal(isErroreDiRete({ code: 'P0001', message: 'Camera non disponibile' }), false)
  assert.equal(isErroreDiRete({ code: '42P01', message: 'relation "x" does not exist' }), false)
  assert.equal(isErroreDiRete(null), false)
  assert.equal(isErroreDiRete(undefined), false)
})

test('messaggioErroreDati: testo chiaro per la rete, messaggio del server altrimenti', () => {
  assert.equal(messaggioErroreDati(new TypeError('Failed to fetch')),
    'Non riesco a caricare i dati: nessuna connessione al server. Controlla la linea e riprova.')
  assert.equal(messaggioErroreDati(new TypeError('Load failed'), 'cercare il cliente'),
    'Non riesco a cercare il cliente: nessuna connessione al server. Controlla la linea e riprova.')
  assert.equal(messaggioErroreDati({ message: 'permission denied' }), 'Non riesco a caricare i dati: permission denied')
})

test('errore di rete: il fetch rilancia e lo stato diventa «server irraggiungibile»', async () => {
  const f = creaFetchSorvegliato(failedToFetch)
  await assert.rejects(() => f('https://x.supabase.co/rest/v1/rooms'), TypeError)
  assert.equal(statoConnessione().serverIrraggiungibile, true)
  assert.match(statoConnessione().ultimoErrore ?? '', /Failed to fetch/)
})

test('risposta ricevuta: lo stato torna «raggiunto» e gli ascoltatori sono avvisati a ogni cambio, non a ogni richiesta', async () => {
  const cambi: boolean[] = []
  const stop = ascoltaConnessione(s => cambi.push(s.serverIrraggiungibile))
  const giu = creaFetchSorvegliato(failedToFetch)
  const su = creaFetchSorvegliato(rispostaOk)
  await su('https://x/rest/v1/a')                        // già raggiungibile: nessun avviso
  await giu('https://x/rest/v1/b').catch(() => {})        // → irraggiungibile
  await giu('https://x/rest/v1/c').catch(() => {})        // resta irraggiungibile: nessun secondo avviso
  const r = await su('https://x/rest/v1/d')               // → raggiunto
  assert.equal(r.status, 200)
  assert.deepEqual(cambi, [true, false])
  assert.equal(statoConnessione().serverIrraggiungibile, false)
  stop()
})

test('tempo scaduto: la richiesta viene interrotta con TimeoutError e lo stato è «irraggiungibile»', async () => {
  const eterna: typeof fetch = (_i, init) => new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(init.signal!.reason))
  })
  const f = creaFetchSorvegliato(eterna, { tempoMassimoMs: 20 })
  await assert.rejects(() => f('https://x/rest/v1/rooms'), (e: Error) => e.name === 'TimeoutError' && /30 secondi|0 secondi/.test(e.message))
  assert.equal(statoConnessione().serverIrraggiungibile, true)
})

test('i file (storage) hanno un tempo massimo più lungo delle letture', async () => {
  let attesaFile = 0
  const eterna: typeof fetch = (_i, init) => new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(init.signal!.reason))
  })
  const f = creaFetchSorvegliato(eterna, { tempoMassimoMs: 10, tempoMassimoFileMs: 60 })
  const t0 = Date.now()
  await f('https://x/storage/v1/object/scontrini/a.jpg').catch(() => { attesaFile = Date.now() - t0 })
  assert.ok(attesaFile >= 50, `il file doveva aspettare almeno 50 ms, ha aspettato ${attesaFile}`)
})

test('annullamento voluto dall\'app (signal esterno): rilancia ma NON accende l\'avviso', async () => {
  const eterna: typeof fetch = (_i, init) => new Promise((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
  })
  const f = creaFetchSorvegliato(eterna)
  const esterno = new AbortController()
  const p = f('https://x/rest/v1/rooms', { signal: esterno.signal })
  esterno.abort()
  await assert.rejects(p)
  assert.equal(statoConnessione().serverIrraggiungibile, false)
})
