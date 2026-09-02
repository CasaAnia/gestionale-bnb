import { test } from 'node:test'
import assert from 'node:assert/strict'
import { richiesteInConflitto, erroreDiDisponibilita } from './richiesteConferma.ts'
import type { Soluzione } from './richiesteProposta.ts'

const sol: Soluzione = {
  caso: 'cambio', nottiTotali: 3, nottiCoperte: 3, nottiMancanti: [], prezzoTotale: 230,
  segmenti: [
    { camera: { id: 'amelia', name: 'Amelia' }, arrivo: '2026-09-13', partenza: '2026-09-15', notti: 2, prezzoNotte: 70, lettoTotale: 0, totale: 140 },
    { camera: { id: 'lena', name: 'Lena' }, arrivo: '2026-09-15', partenza: '2026-09-16', notti: 1, prezzoNotte: 90, lettoTotale: 0, totale: 90 },
  ],
}
const r = (id: string, arrivo: string, partenza: string, camera_id: string | null, stato = 'in_attesa') => ({ id, arrivo, partenza, camera_id, stato: stato as 'in_attesa' })

test('richieste in conflitto: stessa camera o qualsiasi, notti in comune, solo aperte, mai se stessa', () => {
  const aperte = [
    r('me', '2026-09-13', '2026-09-16', null),
    r('a', '2026-09-14', '2026-09-15', 'amelia'),       // stessa camera, notte in comune
    r('b', '2026-09-15', '2026-09-17', null),           // qualsiasi, tocca Lena il 15
    r('c', '2026-09-14', '2026-09-15', 'lena'),         // Lena ma il 14 non è nel segmento Lena
    r('d', '2026-09-15', '2026-09-16', 'amelia'),       // Amelia il 15: il segmento Amelia finisce il 15
    r('e', '2026-09-13', '2026-09-14', 'amelia', 'rifiutata'),
    r('f', '2026-09-13', '2026-09-14', 'amelia', 'proposta_inviata'),
  ]
  assert.deepEqual(richiesteInConflitto(sol, aperte, 'me').map(x => x.id), ['a', 'b', 'f'])
})

test('errore di disponibilità riconosciuto', () => {
  assert.equal(erroreDiDisponibilita('Camera Amelia non più disponibile la notte del 13 settembre'), true)
  assert.equal(erroreDiDisponibilita('Letti aggiuntivi esauriti la notte del 13 settembre (camera Allegra)'), true)
  assert.equal(erroreDiDisponibilita('Nessuna proposta inviata'), false)
})
