import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eseguiOperazionePulizia, type RichiestaPulizia, type RispostaPulizia } from './pulizieOperazioni.ts'
const request: RichiestaPulizia = { azione: 'registra', ultima_id: null, pulizia: { room_id: 'r', booking_id: 'b', tipo: 'soggiorno', stato: 'fatta', data_prevista: '2026-09-10', data_effettiva: '2026-09-12' }, recupero: null }
const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } } }

test('risposta persa, riapertura e seconda riapertura: una sola operazione, stessa data effettiva', async () => {
  const store = storage(), remote = new Map<string, RispostaPulizia>()
  let perdita = true, ids = 0
  const transport = async (id: string, r: RichiestaPulizia) => {
    if (r.azione !== 'registra') throw new Error('azione')
    if (!remote.has(id)) remote.set(id, { pulizia: { ...r.pulizia, id }, recupero: null })
    if (perdita) { perdita = false; throw new Error('risposta persa dopo commit') }
    return { data: remote.get(id)!, error: null }
  }
  const first = await eseguiOperazionePulizia('r', request, store, transport, () => `id-${++ids}`)
  assert.ok(first.errore); assert.equal(remote.size, 1)
  const reopened = await eseguiOperazionePulizia('r', null, store, transport, () => `id-${++ids}`)
  assert.equal(reopened.errore, null); assert.equal(reopened.risposta?.pulizia.data_effettiva, '2026-09-12')
  assert.equal(ids, 1); assert.equal(remote.size, 1)
  const second = await eseguiOperazionePulizia('r', null, store, transport, () => `id-${++ids}`)
  assert.equal(second.risposta, null); assert.equal(ids, 1)
})

test('un tentativo incerto non viene sostituito da nuove quantità o date', async () => {
  const store = storage(); let calls = 0
  const offline = async () => { calls++; throw new Error('rete') }
  await eseguiOperazionePulizia('r', request, store, offline, () => 'id')
  const changed: RichiestaPulizia = { ...request, pulizia: { ...request.pulizia, data_effettiva: '2026-09-13' } }
  assert.match((await eseguiOperazionePulizia('r', changed, store, offline, () => 'new')).errore!, /precedente/)
  assert.equal(calls, 1)
})

test('custodia guasta prima della rete: nessuna scrittura', async () => {
  let calls = 0
  const store = { ...storage(), setItem: () => { throw new Error('pieno') } }
  const result = await eseguiOperazionePulizia('r', request, store, async () => { calls++; return { data: null, error: null } }, () => 'id')
  assert.ok(result.errore); assert.equal(calls, 0)
})

test('un conflitto esplicito chiude il tentativo e richiede una rilettura', async () => {
  const store = storage()
  const res = await eseguiOperazionePulizia('r', request, store, async () => ({ data: null, error: { code: 'P0045' } }), () => 'id')
  assert.match(res.errore!, /cambiata/)
  assert.equal((await eseguiOperazionePulizia('r', null, store, async () => { throw new Error('non chiamare') }, () => 'id')).errore, null)
})

test('risposta tardiva in un altro tab: non cancella una nuova operazione pendente', async () => {
  const store = storage()
  let consegna: (r: { data: RispostaPulizia; error: null }) => void = () => {}
  const prima = eseguiOperazionePulizia('r', request, store, async () => new Promise(resolve => { consegna = resolve }), () => 'vecchia')
  const risposta = { pulizia: { ...request.pulizia, id: 'vecchia' }, recupero: null }
  // Il secondo tab ha già verificato il vecchio tentativo.
  await eseguiOperazionePulizia('r', null, store, async () => ({ data: risposta, error: null }), () => 'non-creare')
  await eseguiOperazionePulizia('r', { ...request, pulizia: { ...request.pulizia, data_effettiva: '2026-09-13' } }, store, async () => { throw new Error('offline') }, () => 'nuova')
  consegna({ data: risposta, error: null })
  assert.match((await prima).errore!, /altro salvataggio/)
  let ripreso = ''
  await eseguiOperazionePulizia('r', null, store, async id => { ripreso = id; return { data: { ...risposta, pulizia: { ...risposta.pulizia, id } }, error: null } }, () => 'non-creare')
  assert.equal(ripreso, 'nuova')
})
