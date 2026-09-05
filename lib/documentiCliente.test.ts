import { test } from 'node:test'
import assert from 'node:assert/strict'
import { percorsoDocumento, tipoAccettato, misureRidotte, dimensioneLeggibile, etichettaLeggibile, rigaDocumenti, raccogliAnteprime, MESSAGGIO_ANTEPRIME } from './documentiCliente.ts'

test('percorso nel bucket: cartella del cliente, estensione dal tipo, mai dal nome', () => {
  assert.equal(percorsoDocumento('g1', 'd1', 'image/jpeg'), 'g1/d1.jpg')
  assert.equal(percorsoDocumento('g1', 'd1', 'image/png'), 'g1/d1.png')
  assert.equal(percorsoDocumento('g1', 'd1', 'application/pdf'), 'g1/d1.pdf')
  assert.equal(percorsoDocumento('g1', 'd1', 'image/heic'), 'g1/d1.jpg')
})

test('tipi accettati: foto e PDF, non altro', () => {
  assert.equal(tipoAccettato('image/jpeg'), true)
  assert.equal(tipoAccettato('image/heic'), true)
  assert.equal(tipoAccettato('application/pdf'), true)
  assert.equal(tipoAccettato('text/plain'), false)
  assert.equal(tipoAccettato('image/svg+xml'), false)
})

test('misure ridotte: lato lungo a 1600, proporzioni intatte, mai ingrandire', () => {
  assert.deepEqual(misureRidotte(4000, 3000), { larghezza: 1600, altezza: 1200 })
  assert.deepEqual(misureRidotte(3000, 4000), { larghezza: 1200, altezza: 1600 })
  assert.deepEqual(misureRidotte(800, 600), { larghezza: 800, altezza: 600 })
  assert.deepEqual(misureRidotte(0, 0), { larghezza: 0, altezza: 0 })
})

test('dimensione leggibile ed etichette', () => {
  assert.equal(dimensioneLeggibile(320000), '313 KB')
  assert.equal(dimensioneLeggibile(1500000), '1,4 MB')
  assert.equal(dimensioneLeggibile(null), '')
  assert.equal(etichettaLeggibile({ etichetta: 'carta_identita', lato: 'fronte' }), "Carta d'identità · fronte")
  assert.equal(etichettaLeggibile({ etichetta: 'passaporto', lato: null }), 'Passaporto')
  assert.equal(rigaDocumenti(0), 'Nessun documento')
  assert.equal(rigaDocumenti(1), 'Documenti · 1')
  assert.equal(rigaDocumenti(3), 'Documenti · 3')
})

// Parte 3, pezzo 3 (05/09/2026): anteprime con URL firmato non ottenuto
test('raccogliAnteprime: un URL firmato con errore non è una casella vuota silenziosa', () => {
  const r = raccogliAnteprime([
    { id: 'a', url: 'https://x/a', error: null },
    { id: 'b', url: null, error: { message: 'Object not found' } },
    { id: 'c', url: undefined, error: null },
  ])
  assert.deepEqual(r.urls, { a: 'https://x/a' })
  assert.equal(r.mancanti, 2)
  assert.equal(r.errore, MESSAGGIO_ANTEPRIME)
  assert.deepEqual(raccogliAnteprime([{ id: 'a', url: 'https://x/a', error: null }]), { urls: { a: 'https://x/a' }, mancanti: 0, errore: null })
})
