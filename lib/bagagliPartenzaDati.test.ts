import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salvaOrari, INCERTO_ORARI, RILETTURA_DIVERSA } from './bagagliPartenzaDati.ts'

function server(righe: Record<string, Record<string, unknown>>, guasti: { errore?: { code?: string }; perdi?: boolean; zero?: boolean; rilettura?: 'errore' | 'vecchia'; dopo?: number } = {}) {
  let n = 0
  const scritte: unknown[] = []
  const scrivi = async (id: string, campi: Record<string, unknown>) => {
    n++
    const guasto = guasti.dopo === undefined || n > guasti.dopo
    if (guasto && guasti.errore) return { data: null, error: guasti.errore }
    scritte.push({ id, campi })
    if (guasto && guasti.zero) return { data: [], error: null }
    Object.assign(righe[id], Object.fromEntries(Object.entries(campi).map(([k, v]) => [k, v === null ? null : `${v}:00`])))
    if (guasto && guasti.perdi) return { data: null, error: { code: '', message: 'Failed to fetch' } }
    return { data: [{ id, ...righe[id] }], error: null }
  }
  const rileggi = async (ids: string[]) => guasti.rilettura === 'errore' ? { data: null, error: { code: '' } } : { data: ids.map(id => ({ id, ...(guasti.rilettura === 'vecchia' ? { bagagli_alle: null, check_out_time: null } : righe[id]) })), error: null }
  return { scrivi, rileggi, scritte }
}

test('salvato: scritto in formato del database e riletto uguale', async () => {
  const s = server({ a: { bagagli_alle: null, check_out_time: null } })
  const e = await salvaOrari([{ id: 'a', campi: { bagagli_alle: '9:30', check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'salvato')
  assert.deepEqual(s.scritte, [{ id: 'a', campi: { bagagli_alle: '09:30', check_out_time: '10:00' } }])
})

test('errore del server: non salvato, certo', async () => {
  const s = server({ a: {} }, { errore: { code: '42501' } })
  const e = await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'non_salvato')
})

test('zero righe restituite: mai «salvato»', async () => {
  const s = server({ a: {} }, { zero: true })
  const e = await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'non_salvato')
})

test('risposta persa: la rilettura che lo dimostra dice «salvato»; senza rilettura resta incerto, senza invito a risalvare', async () => {
  let s = server({ a: { check_out_time: null } }, { perdi: true })
  let e = await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'salvato'); assert.equal((e as { verificato?: boolean }).verificato, true)
  s = server({ a: { check_out_time: null } }, { perdi: true, rilettura: 'errore' })
  e = await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.deepEqual(e, { stato: 'incerto', messaggio: INCERTO_ORARI })
  assert.ok(!INCERTO_ORARI.includes('Riprova') && INCERTO_ORARI.includes('Non risalvare'))
})

test('cambio camera: bagagli passati, partenza rifiutata → detto preciso', async () => {
  const s = server({ a: { bagagli_alle: null }, b: { check_out_time: null } }, { errore: { code: '42501' }, dopo: 1 })
  const e = await salvaOrari([{ id: 'a', campi: { bagagli_alle: '11:00' } }, { id: 'b', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'non_salvato')
  assert.match((e as { messaggio: string }).messaggio, /bagagli è salvato, quello della partenza no/)
})

test('rilettura diversa da quanto scritto: non si dice «salvato»', async () => {
  const s = server({ a: { check_out_time: null } }, { rilettura: 'vecchia' })
  const e = await salvaOrari([{ id: 'a', campi: { check_out_time: '10:00' } }], s.scrivi, s.rileggi)
  assert.equal(e.stato, 'non_salvato'); assert.equal((e as { messaggio: string }).messaggio, RILETTURA_DIVERSA)
})
