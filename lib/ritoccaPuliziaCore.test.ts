import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eseguiRitocco, RITOCCO_CAMBIATA, RITOCCO_INCERTO, RITOCCO_NON_ATTIVO } from './ritoccaPuliziaCore.ts'

const client = (rpc: { error?: { code?: string } | null; lancia?: boolean }, riga: { id: string; ora_effettiva?: string | null } | null, erroreLettura = false) => ({
  rpc: async () => { if (rpc.lancia) throw new Error('Failed to fetch'); return { data: null, error: rpc.error ?? null } },
  rileggi: async () => (erroreLettura ? { data: null, error: { code: '' } } : { data: riga, error: null }),
})
const togli = { azione: 'togli' as const, cleaning_id: 'c1', versione: null }
const ora = { azione: 'ora' as const, cleaning_id: 'c1', versione: null, ora: '09:02' }

test('riuscito; errori certi del server con parole chiare; funzione assente = proposta 0064', async () => {
  assert.deepEqual(await eseguiRitocco(client({}, null), togli), { errore: null })
  assert.equal((await eseguiRitocco(client({ error: { code: 'P0045' } }, null), togli)).errore, RITOCCO_CAMBIATA)
  assert.equal((await eseguiRitocco(client({ error: { code: 'PGRST202' } }, null), togli)).errore, RITOCCO_NON_ATTIVO)
})

test('risposta persa: decide la rilettura; senza rilettura resta incerto, senza «riprova»', async () => {
  assert.deepEqual(await eseguiRitocco(client({ lancia: true }, null), togli), { errore: null, verificato: true })
  assert.equal((await eseguiRitocco(client({ lancia: true }, { id: 'c1' }), togli)).errore, RITOCCO_INCERTO)
  assert.deepEqual(await eseguiRitocco(client({ error: { code: '' } }, { id: 'c1', ora_effettiva: '09:02:00' }), ora), { errore: null, verificato: true })
  assert.equal((await eseguiRitocco(client({ lancia: true }, null, true), ora)).errore, RITOCCO_INCERTO)
  assert.ok(!/riprova/i.test(RITOCCO_INCERTO))
})
