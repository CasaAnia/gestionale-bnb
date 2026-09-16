import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHI_ANNULLA, motivoAnnullamento, chiHaAnnullato, sparisceDalloStorico, campiAnnullamento, propostaProblematica,
  motivoProblematicaNoShow, spiegazione, salvaAnnullamento, ERRORE_RIGHE,
} from './annullamento.ts'
import { righeStorico } from './storicoCliente.ts'
import { MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

test('le tre pastiglie, in quest’ordine', () => {
  assert.deepEqual(CHI_ANNULLA.map(c => c.testo), ['Errore mio', 'La cliente', 'Non si è presentata'])
})

test('il motivo salvato dice chi ha annullato, col motivo dopo il punto mediano', () => {
  assert.equal(motivoAnnullamento('errore_mio', ''), 'Errore mio')
  assert.equal(motivoAnnullamento('cliente', ' ha trovato  altro '), 'La cliente · ha trovato altro')
  assert.equal(motivoAnnullamento('no_show', null), 'Non si è presentata')
  assert.deepEqual(campiAnnullamento('cliente', 'ha trovato altro', '2026-09-16T10:00:00.000Z'),
    { status: 'annullata', cancelled_at: '2026-09-16T10:00:00.000Z', cancelled_reason: 'La cliente · ha trovato altro' })
})

test('dal motivo salvato si ritrova chi ha annullato; i motivi vecchi restano liberi', () => {
  assert.equal(chiHaAnnullato('Errore mio'), 'errore_mio')
  assert.equal(chiHaAnnullato('errore mio · date sbagliate'), 'errore_mio')
  assert.equal(chiHaAnnullato('La cliente · ha trovato altro'), 'cliente')
  assert.equal(chiHaAnnullato('Non si è presentata'), 'no_show')
  assert.equal(chiHaAnnullato('Prova'), null)
  assert.equal(chiHaAnnullato('Camera non più necessaria: date del soggiorno modificate'), null)
  assert.equal(chiHaAnnullato(null), null)
})

test('i tre casi: «Errore mio» sparisce dallo storico, gli altri due restano col motivo', () => {
  const s = (id: string, extra: Record<string, unknown>) => ({ id, rooms: { name: 'Camera Lena' }, check_in: '2026-08-01', check_out: '2026-08-03', status: 'annullata', total_amount: 100, ...extra })
  const righe = righeStorico([
    s('errore', { cancelled_reason: 'Errore mio · date sbagliate' }),
    s('cliente', { cancelled_reason: 'La cliente · ha trovato altro', check_in: '2026-07-01', check_out: '2026-07-02' }),
    s('noshow', { cancelled_reason: 'Non si è presentata', check_in: '2026-06-01', check_out: '2026-06-02' }),
    s('vecchia', { cancelled_reason: 'Prova', check_in: '2026-05-01', check_out: '2026-05-02' }),
  ])
  assert.deepEqual(righe.map(r => [r.chiave, r.status, r.cancelled_reason]), [
    ['cliente', 'annullata', 'La cliente · ha trovato altro'],
    ['noshow', 'annullata', 'Non si è presentata'],
    ['vecchia', 'annullata', 'Prova'],
  ])
  assert.equal(sparisceDalloStorico('Errore mio'), true)
  assert.equal(sparisceDalloStorico('La cliente'), false)
  // un soggiorno con una camera ancora valida non sparisce mai, anche se una camera annullata dice «errore mio»
  const misto = righeStorico([
    s('viva', { status: 'confermata', group_id: 'g' }),
    s('morta', { group_id: 'g', cancelled_reason: 'Errore mio' }),
  ])
  assert.equal(misto.length, 1)
  assert.equal(misto[0].status, 'confermata')
})

test('«Non si è presentata» propone di segnare la cliente come problematica', () => {
  assert.equal(propostaProblematica('no_show', 'Carmela Sabia'), 'Segnare Carmela Sabia come cliente problematica?')
  assert.equal(propostaProblematica('no_show', ''), 'Segnare la cliente come cliente problematica?')
  assert.equal(propostaProblematica('cliente', 'Carmela Sabia'), null)
  assert.equal(propostaProblematica('errore_mio', 'Carmela Sabia'), null)
  assert.equal(motivoProblematicaNoShow('2026-09-12'), 'Non si è presentata il 12/09/2026')
  assert.equal(motivoProblematicaNoShow(null), 'Non si è presentata')
})

test('sotto le pastiglie si dice cosa succede allo storico', () => {
  assert.match(spiegazione('errore_mio'), /Sparisce dallo storico/)
  assert.match(spiegazione('cliente'), /Resta nello storico della cliente, col motivo/)
  assert.match(spiegazione('no_show'), /Resta nello storico/)
  assert.equal(spiegazione(null), '')
})

test('la scrittura: le righe toccate devono essere quante le attive, altrimenti niente cambia', async () => {
  let aggiornato = 0
  const ok = await salvaAnnullamento(async () => ({ error: null, data: [{ id: 'a' }, { id: 'b' }] }), 2, () => { aggiornato++ })
  assert.equal(ok, null)
  assert.equal(aggiornato, 1)
  const poche = await salvaAnnullamento(async () => ({ error: null, data: [{ id: 'a' }] }), 2, () => { aggiornato++ })
  assert.equal(poche, MESSAGGIO_NON_SALVATO)
  assert.equal(aggiornato, 1)
  const errore = await salvaAnnullamento(async () => ({ error: new Error('boom'), data: null }), 2, () => { aggiornato++ })
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.equal(aggiornato, 1)
  assert.equal(ERRORE_RIGHE, 'Ricarica per verificare quali camere sono state annullate')
})
