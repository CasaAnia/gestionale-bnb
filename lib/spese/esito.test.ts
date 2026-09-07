// Residui di lib/spese (07/09/2026, pezzo 6): la lettura degli scontrini
// distingue «tabella/bucket non ancora pronti» da un errore vero.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esitoLettura, tabellaOBucketAssente } from './esito.ts'

test('tabella o bucket assenti: codici PostgREST e messaggi dello storage', () => {
  assert.equal(tabellaOBucketAssente({ code: 'PGRST205', message: "Could not find the table 'public.family_receipts'" }), true)
  assert.equal(tabellaOBucketAssente({ code: '42P01' }), true)
  assert.equal(tabellaOBucketAssente({ code: '42703' }), true)
  assert.equal(tabellaOBucketAssente({ message: 'Bucket not found' }), true)
  assert.equal(tabellaOBucketAssente({ message: 'Failed to fetch' }), false)
  assert.equal(tabellaOBucketAssente({ code: '42501', message: 'permission denied' }), false)
  assert.equal(tabellaOBucketAssente(null), false)
})

test('esito: righe con dati; assente senza errore; errore visibile con Riprova negli altri casi', () => {
  assert.deepEqual(esitoLettura({ data: [{ id: 'a' }], error: null }, 'caricare gli scontrini'), { righe: [{ id: 'a' }], assente: false, errore: null })
  assert.deepEqual(esitoLettura({ data: null, error: null }, 'caricare gli scontrini'), { righe: [], assente: false, errore: null })
  assert.deepEqual(esitoLettura({ data: null, error: { code: 'PGRST205' } }, 'caricare gli scontrini'), { righe: [], assente: true, errore: null })
  const rete = esitoLettura({ data: null, error: { message: 'Failed to fetch' } }, 'caricare gli scontrini')
  assert.equal(rete.assente, false)
  assert.equal(rete.errore, 'Non riesco a caricare gli scontrini: nessuna connessione')
  const permesso = esitoLettura({ data: null, error: { code: '42501', message: 'permission denied' } }, 'caricare gli scontrini')
  assert.equal(permesso.errore, 'Non riesco a caricare gli scontrini, riprova')
})
