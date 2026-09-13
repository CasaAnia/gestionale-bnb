// Salvare «Come paga» (13/09/2026): il modo su tutte le camere, la caparra una volta sola.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { salvaComePaga, AVVISO_SENZA_0041 } from './comePagaDati.ts'
import { campiComePaga } from './comePaga.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

function finto(errori: { tutte?: unknown; prima?: unknown } = {}) {
  const scritte: { dove: string; campi: Record<string, unknown> }[] = []
  let giroTutte = 0
  return {
    scritte,
    tutte: (campi: Record<string, unknown>) => {
      scritte.push({ dove: 'tutte', campi })
      giroTutte += 1
      return Promise.resolve({ error: giroTutte === 1 ? (errori.tutte ?? null) : null })
    },
    prima: (campi: Record<string, unknown>) => {
      scritte.push({ dove: 'prima', campi })
      return Promise.resolve({ error: errori.prima ?? null })
    },
  }
}

test('senza caparra si scrive una volta sola, su tutte le camere', async () => {
  const f = finto()
  const esito = await salvaComePaga(campiComePaga('contanti', {}), f.tutte, f.prima)
  assert.deepEqual(esito, { esito: 'ok', messaggio: null })
  assert.equal(f.scritte.length, 1)
  assert.deepEqual(f.scritte[0], { dove: 'tutte', campi: { accordo_pagamento: 'contanti', bonifico: false, caparra_centesimi: null, caparra_entro: null } })
})

test('con la caparra: il modo su tutte, l’importo solo sulla prima', async () => {
  const f = finto()
  const esito = await salvaComePaga(campiComePaga('meta', { totaleCent: 47000, entro: '2026-09-20T18:00:00' }), f.tutte, f.prima)
  assert.equal(esito.esito, 'ok')
  assert.deepEqual(f.scritte.map(s => s.dove), ['tutte', 'prima'])
  assert.equal(f.scritte[0].campi.accordo_pagamento, 'caparra_meta')
  assert.equal(f.scritte[0].campi.caparra_centesimi, null, 'la caparra vecchia non è stata azzerata sulle altre camere')
  assert.deepEqual(f.scritte[1].campi, { caparra_centesimi: 23500, caparra_entro: '2026-09-20T18:00:00' })
})

test('«Da vedere» svuota la colonna e spegne la spunta', async () => {
  const f = finto()
  await salvaComePaga(campiComePaga('da_vedere', {}), f.tutte, f.prima)
  assert.deepEqual(f.scritte[0].campi, { accordo_pagamento: null, bonifico: false, caparra_centesimi: null, caparra_entro: null })
})

test('senza la proposta 0041 si salva la spunta e lo si dice', async () => {
  const f = finto({ tutte: { code: '42703', message: 'column "accordo_pagamento" does not exist' } })
  const esito = await salvaComePaga(campiComePaga('tutto', {}), f.tutte, f.prima)
  assert.deepEqual(esito, { esito: 'senza_accordo', messaggio: AVVISO_SENZA_0041 })
  assert.deepEqual(f.scritte.map(s => s.campi), [
    { accordo_pagamento: 'bonifico_intero', bonifico: true, caparra_centesimi: null, caparra_entro: null },
    { bonifico: true },
  ])
})

test('un errore vero non si scambia per una colonna mancante', async () => {
  const f = finto({ tutte: { code: '23514', message: 'new row violates check constraint' } })
  const esito = await salvaComePaga(campiComePaga('contanti', {}), f.tutte, f.prima)
  assert.equal(esito.esito, 'errore')
  assert.match(esito.messaggio ?? '', new RegExp(MESSAGGIO_NON_SALVATO))
  assert.equal(f.scritte.length, 1, 'ha riprovato dopo un errore che non è una colonna mancante')
})

test('se la caparra non si scrive, lo dice invece di far finta di niente', async () => {
  const f = finto({ prima: { code: '23514', message: 'caparra non coerente' } })
  const esito = await salvaComePaga(campiComePaga('caparra', { importoCent: 5000 }), f.tutte, f.prima)
  assert.equal(esito.esito, 'errore')
})
