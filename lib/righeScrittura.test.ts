// ============================================================================
// SCRITTURE SU PIÙ RIGHE COL CLIENT POSTGREST VERO (revisione del 17/09/2026,
// ultimo caso del rilievo 3): il client non lancia quando la rete cade, torna
// `{ error, status: 0 }`. Qui il trasporto è finto (una `fetch` che risponde
// o si spegne), il client è quello installato.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PostgrestClient } from '@supabase/postgrest-js'
import {
  aggiornaRigaPerRiga, aggiornaInUnColpo, rispostaPersa, ERRORE_RISPOSTA_PERSA, ERRORE_SALVATO_A_META, ERRORE_RIGA_NON_TROVATA,
  type ClienteRighe,
} from './righeScrittura.ts'

type Passo = { ok: string[] } | { persa: true } | { http: number; corpo: unknown }

/** Un trasporto finto: risponde un passo per richiesta, in ordine; conta le richieste */
function trasporto(passi: Passo[]) {
  const richieste: { url: string; corpo: string }[] = []
  const fetchFinta = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const corpo = String(init?.body ?? '')
    richieste.push({ url: String(url), corpo })
    const passo = passi[Math.min(richieste.length - 1, passi.length - 1)]
    if ('persa' in passo) throw new TypeError('Failed to fetch')     // la scrittura è partita, la risposta no
    if ('http' in passo) return new Response(JSON.stringify(passo.corpo), { status: passo.http, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify(passo.ok.map(id => ({ id }))), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  // niente tentativi ripetuti: la prova vuole vedere UNA risposta persa
  const client = new PostgrestClient('http://finto.test/rest/v1', { fetch: fetchFinta as typeof fetch }) as unknown as ClienteRighe
  return { client, richieste }
}

const campi = { discount_type: null, discount_value: null, total_amount: 160 }

test('la risposta persa alla PRIMA richiesta è un esito incerto, in tutte e due le strade', async () => {
  const uno = trasporto([{ persa: true }])
  const a = await aggiornaRigaPerRiga(uno.client, [{ id: 'a', campi }, { id: 'b', campi }])
  assert.equal(a.esito, 'errore')
  if (a.esito === 'errore') {
    assert.equal(a.incerto, true, 'riga per riga: la risposta persa deve essere incerta')
    assert.equal(a.scritte, 0)
    assert.equal(a.messaggio, ERRORE_RISPOSTA_PERSA)
  }
  assert.ok(uno.richieste.length >= 1)

  const due = trasporto([{ persa: true }])
  const b = await aggiornaInUnColpo(due.client, ['a', 'b'], campi)
  assert.equal(b.esito, 'errore')
  if (b.esito === 'errore') {
    assert.equal(b.incerto, true, 'in un colpo: la risposta persa deve essere incerta')
    assert.equal(b.messaggio, ERRORE_RISPOSTA_PERSA)
  }
})

test('prima riga scritta, seconda con la risposta persa: incerto e «salvato solo in parte»', async () => {
  const t = trasporto([{ ok: ['a'] }, { persa: true }])
  const e = await aggiornaRigaPerRiga(t.client, [{ id: 'a', campi }, { id: 'b', campi }])
  assert.equal(e.esito, 'errore')
  if (e.esito === 'errore') {
    assert.equal(e.scritte, 1)
    assert.equal(e.incerto, true)
    assert.equal(e.messaggio, ERRORE_SALVATO_A_META)
  }
})

test('un rifiuto del server (400) alla prima richiesta NON è incerto: niente è stato scritto', async () => {
  const t = trasporto([{ http: 400, corpo: { message: 'colonna sconosciuta', code: '42703' } }])
  const a = await aggiornaRigaPerRiga(t.client, [{ id: 'a', campi }])
  assert.equal(a.esito, 'errore')
  if (a.esito === 'errore') { assert.equal(a.incerto, false); assert.equal(a.scritte, 0) }
  const b = await aggiornaInUnColpo(trasporto([{ http: 400, corpo: { message: 'no' } }]).client, ['a'], campi)
  assert.equal(b.esito, 'errore')
  if (b.esito === 'errore') assert.equal(b.incerto, false)
  // ma un gateway caduto (502/503/504) sì: la scrittura può essere passata
  const c = await aggiornaInUnColpo(trasporto([{ http: 503, corpo: { message: 'gateway' } }]).client, ['a'], campi)
  assert.equal(c.esito, 'errore')
  if (c.esito === 'errore') assert.equal(c.incerto, true)
})

test('le righe toccate che non tornano sono incerte; tutto a posto quando tornano', async () => {
  const meno = await aggiornaInUnColpo(trasporto([{ ok: ['a'] }]).client, ['a', 'b'], campi)
  assert.equal(meno.esito, 'errore')
  if (meno.esito === 'errore') { assert.equal(meno.incerto, true); assert.equal(meno.messaggio, ERRORE_RIGA_NON_TROVATA) }
  const ok = trasporto([{ ok: ['a', 'b'] }])
  assert.deepEqual(await aggiornaInUnColpo(ok.client, ['a', 'b'], campi), { esito: 'ok' })
  assert.equal(ok.richieste.length, 1, 'gli stessi campi vanno in UNA richiesta')
  assert.match(ok.richieste[0].url, /id=in\.%28a%2Cb%29|id=in\.\(a,b\)/)
  const perRiga = trasporto([{ ok: ['a'] }, { ok: ['b'] }])
  assert.deepEqual(await aggiornaRigaPerRiga(perRiga.client, [{ id: 'a', campi }, { id: 'b', campi }]), { esito: 'ok' })
  assert.equal(perRiga.richieste.length, 2)
})

test('rispostaPersa riconosce status 0, i gateway giù e i messaggi di rete', () => {
  assert.equal(rispostaPersa({ message: 'TypeError: Failed to fetch' }, 0), true)
  assert.equal(rispostaPersa({ message: 'FetchError: socket hang up' }, undefined), true)
  assert.equal(rispostaPersa({ message: 'x' }, 504), true)
  assert.equal(rispostaPersa({ message: 'new row violates check constraint', code: '23514' }, 400), false)
  assert.equal(rispostaPersa(null, 0), false)
})
