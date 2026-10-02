import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salvaOrari, RILETTURA_DIVERSA } from './bagagliPartenzaDati.ts'

type Guasto = 'errore' | 'perdi' | 'perdi-senza-scrivere' | 'zero'
// Un finto server: per ogni numero di scrittura (1, 2…) un guasto possibile.
function server(righe: Record<string, Record<string, unknown>>, guasti: Record<number, Guasto> = {}, rilettura: 'ok' | 'errore' | 'vecchia' = 'ok') {
  let n = 0
  const inviate: string[] = []
  const scrivi = async (id: string, campi: Record<string, unknown>) => {
    const g = guasti[++n]
    inviate.push(id)
    if (g === 'errore') return { data: null, error: { code: '42501' } }
    if (g === 'zero') return { data: [], error: null }
    if (g !== 'perdi-senza-scrivere') Object.assign(righe[id], Object.fromEntries(Object.entries(campi).map(([k, v]) => [k, v === null ? null : `${v}:00`])))
    if (g === 'perdi' || g === 'perdi-senza-scrivere') return { data: null, error: { code: '', message: 'Failed to fetch' } }
    return { data: [{ id, ...righe[id] }], error: null }
  }
  const rileggi = async (ids: string[]) => rilettura === 'errore' ? { data: null, error: { code: '' } }
    : { data: ids.map(id => ({ id, ...(rilettura === 'vecchia' ? { bagagli_alle: null, check_out_time: null } : righe[id]) })), error: null }
  return { scrivi, rileggi, inviate }
}
const cambioCamera = [{ id: 'a', campi: { bagagli_alle: '11:00' } }, { id: 'b', campi: { check_out_time: '10:00' } }]
const due = () => ({ a: { bagagli_alle: null }, b: { check_out_time: null } } as Record<string, Record<string, unknown>>)

test('salvato: scritto in formato del database e riletto uguale', async () => {
  const r = { a: { bagagli_alle: null, check_out_time: null } } as Record<string, Record<string, unknown>>
  const s = server(r)
  const e = await salvaOrari([{ id: 'a', campi: { bagagli_alle: '9:30', check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'salvato')
  assert.equal(r.a.bagagli_alle, '09:30:00')
})

test('REGRESSIONE (Codex, 01/10): risposta persa sulla PRIMA riga, bagagli salvati — la partenza parte lo stesso e «salvato» solo con entrambe confermate', async () => {
  const r = due()
  const s = server(r, { 1: 'perdi' })
  const e = await salvaOrari(cambioCamera, s.scrivi, s.rileggi)
  assert.deepEqual(s.inviate, ['a', 'b'], 'la seconda scrittura viene inviata')
  assert.equal(e.stato, 'salvato')
  assert.equal(r.b.check_out_time, '10:00:00')
})

test('risposta persa sulla prima, seconda rifiutata dal server: PARZIALE, mai «salvato»', async () => {
  const s = server(due(), { 1: 'perdi', 2: 'errore' })
  const e = await salvaOrari(cambioCamera, s.scrivi, s.rileggi)
  assert.equal(e.stato, 'parziale')
  assert.match((e as { messaggio: string }).messaggio, /L’orario dei bagagli: salvato\. L’orario della partenza: NON salvato/)
})

test('risposta persa sulla SECONDA riga e non arrivata: INCERTO, coi bagagli detti confermati, senza invito a risalvare', async () => {
  const s = server(due(), { 2: 'perdi-senza-scrivere' })
  const e = await salvaOrari(cambioCamera, s.scrivi, s.rileggi)
  assert.equal(e.stato, 'incerto')
  const m = (e as { messaggio: string }).messaggio
  assert.match(m, /L’orario dei bagagli: salvato\./)
  assert.match(m, /L’orario della partenza: non so se è stato salvato/)
  assert.match(m, /Non risalvare/)
})

test('risposta persa sulla seconda ma scrittura avvenuta: la rilettura la conferma → salvato (verificato)', async () => {
  const s = server(due(), { 2: 'perdi' })
  const e = await salvaOrari(cambioCamera, s.scrivi, s.rileggi)
  assert.deepEqual([e.stato, (e as { verificato?: boolean }).verificato], ['salvato', true])
})

test('risposta persa e rilettura impossibile: incerto', async () => {
  const s = server(due(), { 1: 'perdi' }, 'errore')
  const e = await salvaOrari(cambioCamera, s.scrivi, s.rileggi)
  assert.equal(e.stato, 'incerto')
})

test('errore del server su tutto: non salvato, certo; zero righe restituite: mai «salvato»', async () => {
  let s = server(due(), { 1: 'errore', 2: 'errore' })
  assert.equal((await salvaOrari(cambioCamera, s.scrivi, s.rileggi)).stato, 'non_salvato')
  s = server({ a: {} }, { 1: 'zero' })
  assert.equal((await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)).stato, 'non_salvato')
})

test('rilettura diversa da quanto scritto: non si dice «salvato»', async () => {
  const s = server({ a: { check_out_time: null } }, {}, 'vecchia')
  const e = await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.deepEqual([e.stato, (e as { messaggio: string }).messaggio], ['non_salvato', RILETTURA_DIVERSA])
})
