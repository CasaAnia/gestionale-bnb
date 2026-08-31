// ============================================================================
// Prova del CICLO di riconciliazione del guscio (rilievo 4 della
// revisione di 127277d): lettura fallita → «Riprova» → NUOVA chiamata
// vera → esito utilizzabile; le risposte obsolete non parlano.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cicloRiconciliazione } from './riconciliazioneSchermata.ts'
import type { AperturaRevisione } from './orchestrazioneRevisione.ts'

const esitoOk: AperturaRevisione = { risolte: 0, avvisi: [], revPerDocumento: {} }
const esitoRosso: AperturaRevisione = { ...esitoOk, bloccante: 'giornale non raggiungibile (finto)' }
const attendi = () => new Promise(r => setTimeout(r, 0))

test('lettura fallita → Riprova → nuova chiamata → esito utilizzabile', async () => {
  let chiamate = 0
  const pubblicati: (AperturaRevisione | null)[] = []
  const ciclo = cicloRiconciliazione(
    async () => (++chiamate === 1 ? esitoRosso : esitoOk),
    'd1', e => pubblicati.push(e))
  ciclo.avvia()
  await attendi()
  assert.equal(chiamate, 1)
  assert.deepEqual(pubblicati, [null, esitoRosso])            // attesa, poi il bloccante
  ciclo.avvia()                                               // «Riprova la riconciliazione»
  await attendi()
  assert.equal(chiamate, 2, 'il Riprova deve far PARTIRE una nuova chiamata')
  assert.deepEqual(pubblicati.at(-1), esitoOk)                // esito utilizzabile
  assert.equal(ciclo.avvii(), 2)
})

test('una risposta OBSOLETA (avvio precedente rimasto in volo) non parla', async () => {
  const pubblicati: (AperturaRevisione | null)[] = []
  let sbloccaPrima!: () => void
  const lenta = new Promise<void>(r => { sbloccaPrima = r })
  let chiamate = 0
  const ciclo = cicloRiconciliazione(
    async () => {
      if (++chiamate === 1) { await lenta; return esitoRosso }  // la prima arriva TARDI
      return esitoOk
    },
    'd1', e => pubblicati.push(e))
  ciclo.avvia()
  ciclo.avvia()                                               // riprova mentre la prima è in volo
  await attendi()
  assert.deepEqual(pubblicati.at(-1), esitoOk)
  sbloccaPrima()
  await attendi()
  assert.deepEqual(pubblicati.at(-1), esitoOk, 'la risposta vecchia non deve sovrascrivere quella nuova')
})
