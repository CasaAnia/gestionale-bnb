import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSiteFunnel, type SiteEvent } from './siteStats.ts'

const base = { pagina: '/', fonte: 'google', campagna: null }
const event = (tipo: string, created_at: string, extra: Partial<SiteEvent> = {}): SiteEvent => ({
  ...base,
  tipo,
  created_at,
  ...extra,
})

test('costruisce l’imbuto del mese e raggruppa le richieste per provenienza', () => {
  const events = [
    event('visita', '2026-08-03T10:00:00+02:00'),
    event('visita', '2026-08-03T10:01:00+02:00', { pagina: '/prenota' }),
    event('modulo_iniziato', '2026-08-03T10:02:00+02:00'),
    event('richiesta_inviata', '2026-08-03T10:03:00+02:00', { fonte: 'instagram', campagna: 'estate' }),
    event('richiesta_errore', '2026-08-04T10:00:00+02:00'),
    event('visita', '2026-07-31T23:00:00+02:00'),
  ]

  const result = buildSiteFunnel(events, 'mese', new Date('2026-08-28T12:00:00+02:00'))
  assert.equal(result.visite, 2)
  assert.equal(result.paginaPrenota, 1)
  assert.equal(result.moduliIniziati, 1)
  assert.equal(result.richiesteInviate, 1)
  assert.equal(result.errori, 1)
  assert.equal(result.conversioneVisita, 50)
  assert.equal(result.conversioneModulo, 100)
  assert.deepEqual(result.fontiRichieste, [{ nome: 'instagram', valore: 1 }])
  assert.deepEqual(result.campagneRichieste, [{ nome: 'estate', valore: 1 }])
})

test('stima i moduli non conclusi senza produrre numeri negativi', () => {
  const events = [
    event('modulo_iniziato', '2026-08-25T10:00:00+02:00'),
    event('modulo_iniziato', '2026-08-25T11:00:00+02:00'),
    event('richiesta_inviata', '2026-08-25T11:05:00+02:00'),
  ]
  const result = buildSiteFunnel(events, 'settimana', new Date('2026-08-28T12:00:00+02:00'))
  assert.equal(result.nonConcluseStimate, 1)
})
