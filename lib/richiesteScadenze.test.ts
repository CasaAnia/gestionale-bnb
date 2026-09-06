// Scadenza dell'opzione (06/09/2026): notifica una volta sola, chiusura dopo 24 h
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daNotificare, daChiudere, testoNotifica, OPZIONI_PUSHOVER_SCADENZA } from './richiesteScadenze.ts'

const r = (id: string, stato: string, inviata: string | null, extra: Record<string, unknown> = {}) =>
  ({ id, nome: 'Mario', cognome: 'Rossi', stato, arrivo: '2026-09-17', partenza: '2026-09-20', proposta_inviata_at: inviata, ...extra })

test('da notificare: scadute da più di 3 ore e mai notificate; in attesa, confermate e già notificate no', () => {
  const adesso = new Date('2026-09-17T15:00:00Z')
  const righe = [
    r('a', 'proposta_inviata', '2026-09-17T11:40:00Z'),                                   // scaduta alle 14:40 → sì
    r('b', 'proposta_inviata', '2026-09-17T13:00:00Z'),                                   // scade alle 16:00 → no
    r('c', 'proposta_inviata', '2026-09-17T11:00:00Z', { scadenza_notificata_at: '2026-09-17T14:05:00Z' }),   // già notificata
    r('d', 'confermata', '2026-09-17T09:00:00Z'),
    r('e', 'in_attesa', null),
    r('f', 'chiusa', '2026-09-16T09:00:00Z'),
  ]
  assert.deepEqual(daNotificare(righe, adesso).map(x => x.id), ['a'])
})

test('da chiudere: 24 ore dopo la scadenza (27 ore dall\'invio), non prima', () => {
  const righe = [
    r('a', 'proposta_inviata', '2026-09-16T11:00:00Z'),   // scaduta il 16 alle 14:00 → chiusa dal 17 alle 14:00
    r('b', 'proposta_inviata', '2026-09-16T12:30:00Z'),   // scaduta il 16 alle 15:30 → dal 17 alle 15:30
  ]
  assert.deepEqual(daChiudere(righe, new Date('2026-09-17T14:00:00Z')).map(x => x.id), ['a'])
  assert.deepEqual(daChiudere(righe, new Date('2026-09-17T13:59:00Z')).map(x => x.id), [])
  assert.deepEqual(daChiudere(righe, new Date('2026-09-17T16:00:00Z')).map(x => x.id), ['a', 'b'])
})

test('testo della notifica: nome, camere della proposta, date; suono e priorità emergenza', () => {
  const t = testoNotifica(r('a', 'proposta_inviata', '2026-09-17T11:40:00Z', { proposta_soluzione: { segmenti: [{ camera: { name: 'Ambra' } }] } }))
  assert.equal(t.titolo, 'Proposta scaduta — Mario Rossi')
  assert.equal(t.messaggio, 'Ambra 17–20 set. Controlla se ha risposto.')
  const due = testoNotifica(r('b', 'proposta_inviata', null, { proposta_soluzione: { segmenti: [{ camera: { name: 'Ambra' } }, { camera: { name: 'Lena' } }, { camera: { name: 'Ambra' } }] } }))
  assert.equal(due.messaggio, 'Ambra e Lena 17–20 set. Controlla se ha risposto.')
  assert.equal(testoNotifica(r('c', 'proposta_inviata', null)).messaggio, '17–20 set. Controlla se ha risposto.')
  assert.equal(OPZIONI_PUSHOVER_SCADENZA.priority, 2)
  assert.notEqual(OPZIONI_PUSHOVER_SCADENZA.sound, 'persistent')   // suono diverso da quello delle nuove richieste
})
