// Parte 3, pezzo 2 (05/09/2026): la cancellazione delle sottoscrizioni
// scadute controlla `error` e l'esito lo dice; la lettura fallita non è
// «zero telefoni». Finto client con la stessa forma di Supabase, finto invio
// al posto di web-push (nessuna chiave, nessuna rete).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inviaATutti, type ClientPush } from './inviaPush.ts'

const sub = { endpoint: 'https://push.example/abc', subscription: JSON.stringify({ endpoint: 'https://push.example/abc', keys: {} }) }

function clientFinto(opz: { lettura?: { message: string } | null; cancellazione?: { message: string } | null; cancellate?: string[] }): ClientPush {
  return {
    from() {
      return {
        select: async () => ({ data: opz.lettura ? null : [sub], error: opz.lettura ?? null }),
        delete: () => ({ eq: async (_c: string, valore: string) => { opz.cancellate?.push(valore); return { error: opz.cancellazione ?? null } } }),
      }
    },
  }
}
const scaduta = () => Promise.reject(Object.assign(new Error('Gone'), { statusCode: 410 }))

test('sottoscrizione scaduta e delete rifiutato → conta negli errori, NON tra le rimosse', async () => {
  const esito = await inviaATutti(clientFinto({ cancellazione: { message: 'permission denied for table push_subscriptions' } }), { title: 't', body: 'b' }, scaduta)
  assert.equal(esito.rimosse, 0)
  assert.equal(esito.inviate, 0)
  assert.equal(esito.errori.length, 1)
  assert.match(esito.errori[0], /410: sottoscrizione scaduta ma non cancellata \(permission denied/)
})

test('sottoscrizione scaduta e delete riuscito → rimossa, nessun errore', async () => {
  const cancellate: string[] = []
  const esito = await inviaATutti(clientFinto({ cancellate }), { title: 't', body: 'b' }, scaduta)
  assert.deepEqual(esito, { inviate: 0, rimosse: 1, errori: [] })
  assert.deepEqual(cancellate, [sub.endpoint])
})

test('lettura delle sottoscrizioni fallita → errore esplicito, nessun invio tentato', async () => {
  let invii = 0
  const esito = await inviaATutti(clientFinto({ lettura: { message: 'relation push_subscriptions does not exist' } }), { title: 't', body: 'b' }, async () => { invii++ })
  assert.equal(invii, 0)
  assert.deepEqual(esito, { inviate: 0, rimosse: 0, errori: ['lettura sottoscrizioni: relation push_subscriptions does not exist'] })
})

test('invio riuscito → inviate 1; altro errore (500) → negli errori senza cancellare', async () => {
  const cancellate: string[] = []
  assert.deepEqual(await inviaATutti(clientFinto({ cancellate }), { title: 't', body: 'b' }, async () => {}), { inviate: 1, rimosse: 0, errori: [] })
  const esito = await inviaATutti(clientFinto({ cancellate }), { title: 't', body: 'b' }, () => Promise.reject(Object.assign(new Error('boom'), { statusCode: 500 })))
  assert.deepEqual(esito, { inviate: 0, rimosse: 0, errori: ['500: boom'] })
  assert.deepEqual(cancellate, [])
})
